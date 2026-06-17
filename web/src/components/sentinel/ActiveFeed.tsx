import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { deriveStatus, relativeTime, type WsStatus } from "@/lib/sentinel";

type Row = {
  id: string;
  name: string;
  status: "online" | "offline";
  last_heartbeat: string | null;
  current_window: string | null;
  current_process: string | null;
};

const dotByStatus: Record<WsStatus, string> = {
  online: "bg-accent",
  interrupted: "bg-amber signal-interrupted",
  offline: "bg-muted-foreground/40",
};

const RowItem = memo(function RowItem({
  r,
  pulse,
}: {
  r: Row;
  pulse: "none" | "info" | "violation";
}) {
  const status = deriveStatus(r.status, r.last_heartbeat);
  const pulseClass =
    pulse === "violation" ? "signal-glow-violation" : pulse === "info" ? "signal-glow" : "";
  return (
    <Link
      to="/case/$id"
      params={{ id: r.id }}
      search={{ incidentId: undefined }}
      className={`grid grid-cols-[14px_minmax(0,1fr)_minmax(0,2fr)_64px] items-center gap-3 px-3 py-1.5 hover:bg-secondary/40 rounded font-mono text-xs ${pulseClass}`}
    >
      <span className={`w-2 h-2 rounded-full ${dotByStatus[status]}`} />
      <span className="truncate">{r.name}</span>
      <span className="truncate text-foreground/80" title={r.current_window ?? ""}>
        {r.current_window ?? <span className="text-muted-foreground italic">—</span>}
      </span>
      <span className="text-right text-muted-foreground text-[10px]">{relativeTime(r.last_heartbeat)}</span>
    </Link>
  );
});

export function ActiveFeed({
  items,
  pulses,
}: {
  items: Row[];
  pulses?: Map<string, "info" | "violation">;
}) {
  return (
    <div className="glass-strong rounded-xl overflow-hidden">
      <div className="parchment-strip px-4 py-3 flex items-baseline justify-between">
        <h3 className="font-serif text-lg">Active Session Feed</h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          live · {items.length}
        </span>
      </div>
      <div className="grid grid-cols-[14px_minmax(0,1fr)_minmax(0,2fr)_64px] gap-3 px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground border-b border-border/60">
        <span />
        <span>Node</span>
        <span>Foreground</span>
        <span className="text-right">Last</span>
      </div>
      <div className="max-h-[480px] overflow-y-auto py-1">
        {items.length === 0 && (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Awaiting telemetry…
          </p>
        )}
        {items.map((r) => (
          <RowItem key={r.id} r={r} pulse={pulses?.get(r.id) ?? "none"} />
        ))}
      </div>
    </div>
  );
}
