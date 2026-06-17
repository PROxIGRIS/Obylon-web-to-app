import { supabase } from "@/integrations/supabase/client";

export type UnauthorizedEventKind = "unauthorized" | "un-added";

export type UnauthorizedEvent = {
  id: string;
  timestamp: string;
  lastSeen: string;
  durationSeconds: number;
  nodeId: string;
  nodeName: string;
  processName: string;
  windowTitle?: string;
  payload?: string;
  kind: UnauthorizedEventKind;
};

export type UnauthorizedWindow = {
  startAtMs: number;
  endAtMs: number;
  clearAtMs: number;
  clearDelaySeconds: number;
  timezone: "Asia/Kolkata";
};

const UPDATE_EVENT = "sentinel:unauthorized-events-updated";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const AUTO_CLEAR_DELAY_SECONDS_DEFAULT = 30 * 60;

function emitUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  }
}

/**
 * Converts an IST date+time pair into UTC epoch milliseconds.
 */
export function istDateTimeToEpochMs(date: string, time: string, seconds = "00"): number | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  const secMatch = /^(\d{2})$/.exec(seconds);
  if (!dateMatch || !timeMatch || !secMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(secMatch[1]);

  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second, 0) - IST_OFFSET_MS;
  return Number.isFinite(utcMs) ? utcMs : null;
}

export function formatIstDateTime(epochMs: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(epochMs));
}

export async function getUnauthorizedWindow(): Promise<UnauthorizedWindow | null> {
  const { data, error } = await supabase
    .from("unauthorized_window_settings" as any)
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as any;

  return {
    startAtMs: new Date(row.start_at).getTime(),
    endAtMs: new Date(row.end_at).getTime(),
    clearAtMs: new Date(row.clear_at).getTime(),
    clearDelaySeconds: row.clear_delay_seconds,
    timezone: "Asia/Kolkata",
  };
}

export async function clearUnauthorizedWindow() {
  await supabase.from("unauthorized_window_settings" as any).delete().eq("id", 1);
  emitUpdate();
}

export async function setUnauthorizedWindowByRangeEpoch(
  startAtMs: number,
  endAtMs: number,
  clearDelaySeconds = AUTO_CLEAR_DELAY_SECONDS_DEFAULT,
): Promise<{ ok: boolean; message?: string }> {
  const clearDelayMs = Math.trunc(clearDelaySeconds * 1000);
  const start_at = new Date(startAtMs).toISOString();
  const end_at = new Date(endAtMs).toISOString();
  const clear_at = new Date(endAtMs + clearDelayMs).toISOString();

  const { error } = await supabase.from("unauthorized_window_settings" as any).upsert({
    id: 1,
    start_at,
    end_at,
    clear_at,
    clear_delay_seconds: Math.trunc(clearDelaySeconds),
  });

  if (!error) {
    emitUpdate();
    return { ok: true };
  }
  console.error("[Obylon] Failed to set unauthorized window:", error.message, error.details, error.hint);
  return { ok: false, message: error.message };
}

export async function applyUnauthorizedAutoClear(nowMs = Date.now()): Promise<boolean> {
  const current = await getUnauthorizedWindow();
  if (!current) return false;
  if (nowMs < current.clearAtMs) return false;

  // Clear events and window
  await supabase.from("unauthorized_events" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000" as any);
  await supabase.from("unauthorized_window_settings" as any).delete().eq("id", 1);
  
  emitUpdate();
  return true;
}

export async function isUnauthorizedWindowActive(nowMs = Date.now()): Promise<boolean> {
  const windowConfig = await getUnauthorizedWindow();
  if (!windowConfig) return false;
  return nowMs >= windowConfig.startAtMs && nowMs <= windowConfig.endAtMs;
}

export async function getUnauthorizedEvents(): Promise<UnauthorizedEvent[]> {
  const { data, error } = await supabase
    .from("unauthorized_events" as any)
    .select("*, workstations(name)")
    .order("last_seen", { ascending: false });

  if (error || !data) return [];

  return data.map((ev: any) => ({
    id: ev.id,
    timestamp: ev.timestamp,
    lastSeen: ev.last_seen,
    durationSeconds: ev.duration_seconds,
    nodeId: ev.workstation_id,
    nodeName: ev.workstations?.name ?? "Unknown Node",
    processName: ev.process_name,
    windowTitle: ev.window_title,
    payload: ev.payload,
    kind: ev.kind as UnauthorizedEventKind,
  }));
}

export async function appendUnauthorizedEvent(
  event: Omit<UnauthorizedEvent, "id" | "timestamp" | "lastSeen" | "durationSeconds"> & {
    timestamp?: string;
  },
) {
  const active = await isUnauthorizedWindowActive();
  if (!active) return "ignored" as const;

  const now = new Date();
  const nowIso = now.toISOString();

  // Check if existing
  const { data: existing, error: fetchError } = await supabase
    .from("unauthorized_events" as any)
    .select("*")
    .eq("workstation_id", event.nodeId)
    .eq("process_name", event.processName)
    .eq("kind", event.kind)
    .maybeSingle();

  if (fetchError) return "ignored" as const;

  if (existing) {
    const row = existing as any;
    const lastSeenMs = new Date(row.last_seen).getTime();
    const deltaSeconds = Math.max(0, Math.round((now.getTime() - lastSeenMs) / 1000));
    const increment = Math.min(deltaSeconds, 5);

    const { error: updateError } = await supabase
      .from("unauthorized_events" as any)
      .update({
        last_seen: nowIso,
        duration_seconds: (row.duration_seconds || 0) + increment,
        window_title: event.windowTitle || row.window_title,
      })
      .eq("id", row.id);

    if (!updateError) {
      emitUpdate();
      return "updated" as const;
    }
  } else {
    const { error: insertError } = await supabase.from("unauthorized_events" as any).insert({
      workstation_id: event.nodeId,
      process_name: event.processName,
      window_title: event.windowTitle,
      kind: event.kind,
      timestamp: event.timestamp ?? nowIso,
      last_seen: nowIso,
      duration_seconds: 1,
    });

    if (!insertError) {
      emitUpdate();
      return "created" as const;
    }
  }
  return "ignored" as const;
}

export async function updateUnauthorizedEventPayload(nodeId: string, processName: string, payload: string) {
  const { error } = await supabase
    .from("unauthorized_events" as any)
    .update({ payload })
    .eq("workstation_id", nodeId)
    .eq("process_name", processName)
    .is("payload", null);

  if (!error) {
    emitUpdate();
  }
}

export async function clearUnauthorizedEvents() {
  await supabase.from("unauthorized_events" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000" as any);
  emitUpdate();
}

export function unauthorizedEventsUpdateEventName() {
  return UPDATE_EVENT;
}
