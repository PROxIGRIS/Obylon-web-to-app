/**
 * Heartbeat thresholds.
 * - Online: last beat within 15s
 * - Interrupted: 15s..90s (transient — network blip, brief sleep)
 * - Offline: > 90s of silence (PC shut down without agent quitting cleanly,
 *   or unplugged). After this threshold we stop pretending it is "interrupt".
 */
export const SIGNAL_INTERRUPT_THRESHOLD_MS = 15_000;
export const SIGNAL_OFFLINE_THRESHOLD_MS = 90_000;
/** A node that beat once during the active window then went silent for this
 *  long is considered "dead" and triggers an alarm. */
export const DEAD_NODE_ALARM_MS = 60_000;

export type WsStatus = "online" | "interrupted" | "offline";

export function deriveStatus(
  status: "online" | "offline" | null | undefined,
  last_heartbeat: string | null | undefined,
): WsStatus {
  if (status === "offline" || !last_heartbeat) return "offline";
  const age = Date.now() - new Date(last_heartbeat).getTime();
  if (age >= SIGNAL_OFFLINE_THRESHOLD_MS) return "offline";
  if (age > SIGNAL_INTERRUPT_THRESHOLD_MS) return "interrupted";
  return "online";
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 5) return "now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Natural-order comparator: "Workstation 2" < "Workstation 10". */
export function naturalCompare(a: string, b: string): number {
  return (a ?? "").localeCompare(b ?? "", undefined, { numeric: true, sensitivity: "base" });
}

/** Group key derived from the alias prefix (everything before trailing digits). */
export function labGroupKey(name: string | null | undefined): string {
  const s = (name ?? "").trim();
  if (!s) return "Unassigned";
  const m = s.match(/^(.*?)[\s\-_]*\d+\s*$/);
  return (m?.[1] || s).trim() || "Lab";
}
