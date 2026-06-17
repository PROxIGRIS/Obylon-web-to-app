import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { deriveStatus, DEAD_NODE_ALARM_MS } from "@/lib/sentinel";
import { toast } from "@/components/ui/toast";
import {
  appendUnauthorizedEvent,
  getUnauthorizedEvents,
  getUnauthorizedWindow,
  isUnauthorizedWindowActive,
  updateUnauthorizedEventPayload,
} from "@/lib/unauthorized-events";
import type { Workstation } from "@/components/sentinel/WorkstationTable";

const scriptLikeExtensions = [".py", ".ps1", ".js", ".vbs", ".bat", ".cmd", ".msi"];

function normalizeProcessName(processName: string | null | undefined): string {
  if (!processName) return "";
  const trimmed = processName.trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return "";
  const normalizedPath = trimmed.replace(/\//g, "\\");
  const lastSegment = normalizedPath.split("\\").pop() ?? normalizedPath;
  return lastSegment.toLowerCase();
}

function isExecutableOrScript(processName: string): boolean {
  return (
    processName.endsWith(".exe") || scriptLikeExtensions.some((ext) => processName.endsWith(ext))
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dead-node alarm helpers (browser-only side effects)
// ─────────────────────────────────────────────────────────────────────────────

let audioCtxSingleton: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtxSingleton) {
      const Ctor =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      audioCtxSingleton = new Ctor();
    }
    return audioCtxSingleton;
  } catch {
    return null;
  }
}

function fireAlarm(title: string, body: string) {
  // 1. Toast — sustained, dismissable
  toast.error(title, {
    description: body,
    duration: 15000,
  });

  // 2. Browser notification (request once, then fire if granted)
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    if (Notification.permission === "granted") {
      try {
        new Notification(title, { body, tag: `dead-${title}`, requireInteraction: true });
      } catch {
        /* iOS Safari etc. */
      }
    }
  }

  // 3. Vibration (mobile)
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate([300, 120, 300, 120, 600]);
    } catch {
      /* ignored */
    }
  }

  // 4. Short triple-beep via WebAudio (no asset required)
  const ctx = getAudioCtx();
  if (ctx) {
    try {
      const now = ctx.currentTime;
      [0, 0.22, 0.44].forEach((offset) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(880, now + offset);
        g.gain.setValueAtTime(0.0001, now + offset);
        g.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
        o.connect(g).connect(ctx.destination);
        o.start(now + offset);
        o.stop(now + offset + 0.2);
      });
    } catch {
      /* ignored */
    }
  }
}

/**
 * GlobalSentinelMonitor handles background detection of unauthorized apps
 * AND watches for "dead nodes" — workstations that started the observation
 * window alive but suddenly stopped heartbeating for > 60s.
 */
export function GlobalSentinelMonitor() {
  const { isAdmin } = useAuth();
  const allowedProcessesRef = useRef<Map<string, boolean>>(new Map());

  // Dead-node tracking, reset each new observation window
  const windowStartRef = useRef<number | null>(null);
  const seenAliveRef = useRef<Map<string, number>>(new Map()); // wsId -> last beat ms
  const alarmedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isAdmin) return;

    const evaluateDeadNodes = async (items: Workstation[]) => {
      const win = await getUnauthorizedWindow();
      const now = Date.now();
      if (!win || now < win.startAtMs || now > win.endAtMs) {
        // No active window — clear tracker so next window starts fresh
        windowStartRef.current = null;
        if (seenAliveRef.current.size) seenAliveRef.current.clear();
        if (alarmedRef.current.size) alarmedRef.current.clear();
        return;
      }

      // New window detected → reset trackers
      if (windowStartRef.current !== win.startAtMs) {
        windowStartRef.current = win.startAtMs;
        seenAliveRef.current.clear();
        alarmedRef.current.clear();
      }

      for (const ws of items) {
        if (!ws.last_heartbeat) continue;
        const beatMs = new Date(ws.last_heartbeat).getTime();
        const age = now - beatMs;

        // Record nodes that have beat at least once during the window
        if (beatMs >= win.startAtMs && age < DEAD_NODE_ALARM_MS) {
          seenAliveRef.current.set(ws.id, beatMs);
          // If it came back to life, allow re-alarm next time it dies
          alarmedRef.current.delete(ws.id);
          continue;
        }

        // Was alive in this window but now silent > 60s
        if (
          seenAliveRef.current.has(ws.id) &&
          age >= DEAD_NODE_ALARM_MS &&
          !alarmedRef.current.has(ws.id)
        ) {
          alarmedRef.current.add(ws.id);
          const nodeName = ws.name || "Unknown Node";
          fireAlarm(
            `⚠ NODE DEAD — ${nodeName}`,
            `No heartbeat for ${Math.round(age / 1000)}s during active observation window. Possible shutdown or agent kill.`,
          );
        }
      }
    };

    const evaluateUnauthorizedApps = async (items: Workstation[]) => {
      for (const ws of items) {
        const wsStatus = deriveStatus(ws.status, ws.last_heartbeat);
        if (wsStatus !== "online") continue;

        const processName = normalizeProcessName(ws.current_process);
        if (!processName || !isExecutableOrScript(processName)) continue;

        const whitelisted = allowedProcessesRef.current.get(processName);
        if (whitelisted === true) continue;

        if (!(await isUnauthorizedWindowActive())) continue;

        const reason = whitelisted === undefined ? "un-added" : "unauthorized";
        const nodeName = ws.name || "Unknown Node";
        const windowTitle = ws.current_window || "";

        if (reason === "unauthorized") {
          const result = await appendUnauthorizedEvent({
            nodeId: ws.id,
            nodeName,
            processName,
            windowTitle,
            kind: "unauthorized",
          });
          if (result === "created") {
            toast.error(`${nodeName}: this user has been using unauthorized app`, {
              description: `${processName} — ${windowTitle}`,
              duration: 9000,
            });
          }
        } else {
          const result = await appendUnauthorizedEvent({
            nodeId: ws.id,
            nodeName,
            processName,
            windowTitle,
            kind: "un-added",
          });
          if (result === "created") {
            toast.error(`${nodeName}: this user has been using un added app`, {
              description: `${processName} — ${windowTitle}`,
              duration: 9000,
            });
          }
        }
      }
    };

    const load = async () => {
      const [{ data: ws }, { data: allowed }] = await Promise.all([
        supabase.from("workstations").select("*").order("name"),
        supabase.from("allowed_apps").select("process_name, whitelisted"),
      ]);
      const wsRows = (ws as Workstation[]) ?? [];
      const allowedRows = (allowed as any[]) ?? [];
      const nextAllowed = new Map<string, boolean>();
      for (const app of allowedRows) {
        const key = normalizeProcessName(app.process_name);
        if (!key) continue;
        nextAllowed.set(key, app.whitelisted);
      }
      allowedProcessesRef.current = nextAllowed;
      await evaluateUnauthorizedApps(wsRows);
      await evaluateDeadNodes(wsRows);
    };

    // One-time sync for missing keystrokes
    const syncMissing = async () => {
      const currentEvents = await getUnauthorizedEvents();
      const missing = currentEvents.filter((ev: any) => !ev.payload && ev.kind === "unauthorized");
      if (missing.length === 0) return;

      for (const ev of missing) {
        const { data: alerts } = await supabase
          .from("alerts")
          .select("id")
          .eq("workstation_id", ev.nodeId)
          .ilike("process_name", `%${ev.processName}%`)
          .order("timestamp", { ascending: false })
          .limit(1);

        if (alerts && alerts.length > 0) {
          const { data: logs } = await supabase
            .from("evidence_logs")
            .select("metadata")
            .eq("alert_id", alerts[0].id)
            .not("metadata->payload", "is", null)
            .maybeSingle();

          if (logs && logs.metadata && (logs.metadata as any).payload) {
            await updateUnauthorizedEventPayload(ev.nodeId, ev.processName, (logs.metadata as any).payload);
          }
        }
      }
    };

    load();
    syncMissing();

    const ch = supabase
      .channel("global-sentinel-monitor")
      .on("postgres_changes", { event: "*", schema: "public", table: "workstations" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "allowed_apps" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "unauthorized_window_settings" as any }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "evidence_logs" }, async (p) => {
        const ev = p.new as any;
        if (ev && ev.alert_id && ev.metadata && ev.metadata.payload) {
          const { data: alert } = await supabase
            .from("alerts")
            .select("workstation_id, process_name")
            .eq("id", ev.alert_id)
            .single();
          
          if (alert && alert.workstation_id && alert.process_name) {
            await updateUnauthorizedEventPayload(
              alert.workstation_id,
              normalizeProcessName(alert.process_name),
              ev.metadata.payload
            );
          }
        }
      })
      .subscribe();

    // Poll every 5s — needed because heartbeat-age changes locally without a row update
    const interval = setInterval(load, 5000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(ch);
    };
  }, [isAdmin]);

  return null;
}
