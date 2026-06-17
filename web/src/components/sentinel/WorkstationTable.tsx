import { Link } from "@tanstack/react-router";
import { memo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FileSearch, ArrowUpDown, ShieldCheck } from "lucide-react";
import { deriveStatus, relativeTime, type WsStatus } from "@/lib/sentinel";
import { GavelButton, type GavelCommand } from "@/components/sentinel/GavelButton";
import { hasAuthority } from "@/utils/Security";
import { useAuth } from "@/hooks/use-auth";

export type Workstation = {
  id: string;
  name: string;
  status: "online" | "offline";
  last_heartbeat: string | null;
  current_window: string | null;
  current_process: string | null;
  os_info: any;
  alias_verified?: boolean;
};

export type SortKey =
  | "status"
  | "name"
  | "current_window"
  | "current_process"
  | "last_heartbeat";

// Matte-finish status indicators
const dotByStatus: Record<WsStatus, string> = {
  online: "bg-accent shadow-[0_0_8px_hsl(var(--accent))]",
  interrupted: "bg-amber shadow-[0_0_8px_hsl(var(--amber))] signal-interrupted",
  offline: "bg-muted-foreground/30",
};

const labelByStatus: Record<WsStatus, string> = {
  online: "ONLINE",
  interrupted: "INTERRUPT",
  offline: "OFFLINE",
};

const toneByStatus: Record<WsStatus, string> = {
  online: "text-accent-foreground/90 font-medium",
  interrupted: "text-amber font-bold",
  offline: "text-muted-foreground/60",
};

const COMMANDS: GavelCommand[] = [
  "lock",
  "freeze",
  "unfreeze",
  "kill_task",
  "set_alias",
  "terminate",
];

function ActionBar({
  w,
  isOffline,
  size = "sm",
}: {
  w: Workstation;
  isOffline: boolean;
  size?: "sm" | "md";
}) {
  const { role } = useAuth();
  const allowedCommands = COMMANDS.filter((cmd) => hasAuthority(role, cmd));

  return (
    <div className="flex items-center gap-1 justify-end flex-nowrap min-w-0">
      {allowedCommands.map((cmd) => (
        <div
          key={cmd}
          className={
            isOffline
              ? "opacity-30 pointer-events-none grayscale shrink-0"
              : "transition-transform hover:scale-105 shrink-0"
          }
          title={isOffline ? "Target Offline — Execution Disabled" : undefined}
        >
          <GavelButton
            workstationId={w.id}
            workstationName={w.name}
            command={cmd}
            size={size}
            defaultPayload={
              cmd === "kill_task" && w.current_process
                ? { process_name: w.current_process }
                : cmd === "set_alias"
                  ? { alias: w.name }
                  : undefined
            }
          />
        </div>
      ))}

      <Link
        to="/case/$id"
        params={{ id: w.id }}
        search={{ incidentId: undefined }}
        className={`shrink-0 ${size === "md" ? "p-2" : "p-1"} rounded-lg bg-background/30 hover:bg-secondary/80 border border-border/30 hover:border-border/80 transition-all text-muted-foreground hover:text-foreground shadow-sm`}
        title="Open Case Dossier"
      >
        <FileSearch className={size === "md" ? "w-4 h-4" : "w-3.5 h-3.5"} />
      </Link>
    </div>
  );
}

const fluidGridCols =
  "minmax(80px, 1fr) minmax(120px, 1.5fr) minmax(140px, 2.5fr) minmax(120px, 2fr) minmax(80px, 1fr) 200px";

const Row = memo(function Row({
  w,
  pulse,
}: {
  w: Workstation;
  pulse: "none" | "info" | "violation";
}) {
  const status = deriveStatus(w.status, w.last_heartbeat);
  const isOffline = status === "offline";
  const pulseClass =
    pulse === "violation"
      ? "bg-destructive/[0.03]"
      : pulse === "info"
        ? "bg-accent/[0.02]"
        : "";

  return (
    <div
      className={`group grid items-center gap-3 px-5 h-[52px] border-b border-border/10 bg-transparent hover:bg-secondary/30 transition-all duration-200 ${pulseClass} ${isOffline ? "opacity-60 hover:opacity-100" : "opacity-100"}`}
      style={{ gridTemplateColumns: fluidGridCols }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`shrink-0 w-2 h-2 rounded-full ${dotByStatus[status]}`} />
        <span
          className={`font-mono text-[9px] uppercase tracking-widest ${toneByStatus[status]} truncate`}
        >
          {labelByStatus[status]}
        </span>
      </div>
      <div className="min-w-0 flex flex-col justify-center">
        <p className="font-semibold text-xs truncate leading-tight flex items-center gap-1.5 text-foreground/90 group-hover:text-foreground transition-colors">
          <span className="truncate">{w.name}</span>
          {w.alias_verified && (
            <ShieldCheck
              className="w-3 h-3 text-accent/80 shrink-0"
              aria-label="Identity Verified"
            />
          )}
        </p>
        <p className="font-mono text-[9px] text-muted-foreground/60 truncate mt-0.5">
          {w.os_info?.platform ?? "—"}
        </p>
      </div>
      <div className="min-w-0 flex items-center pr-2">
        {w.current_window ? (
          <p className="text-xs truncate w-full text-foreground/80" title={w.current_window}>
            {w.current_window}
          </p>
        ) : (
          <p className="text-[11px] italic text-muted-foreground/40">no signal</p>
        )}
      </div>
      <div className="min-w-0 flex items-center pr-2">
        <p
          className="font-mono text-[10px] text-muted-foreground/70 truncate w-full"
          title={w.current_process ?? ""}
        >
          {w.current_process ?? "—"}
        </p>
      </div>
      <span className="font-mono text-[9px] text-muted-foreground/60 text-right truncate tabular-nums">
        {relativeTime(w.last_heartbeat)}
      </span>
      <div className="flex justify-end min-w-0 opacity-80 group-hover:opacity-100 transition-opacity">
        <ActionBar w={w} isOffline={isOffline} />
      </div>
    </div>
  );
});

// Hyper-condensed, scannable mobile list row (strict 84px height)
const MobileRow = memo(function MobileRow({
  w,
  pulse,
}: {
  w: Workstation;
  pulse: "none" | "info" | "violation";
}) {
  const status = deriveStatus(w.status, w.last_heartbeat);
  const isOffline = status === "offline";
  const pulseClass =
    pulse === "violation"
      ? "bg-destructive/[0.04]"
      : pulse === "info"
        ? "bg-accent/[0.03]"
        : "bg-background/40";

  return (
    <div
      className={`flex flex-col justify-center px-4 h-[84px] border-b border-border/10 backdrop-blur-md ${pulseClass} ${isOffline ? "opacity-70" : "opacity-100"}`}
    >
      <div className="flex items-center justify-between gap-3 min-w-0 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`shrink-0 w-2 h-2 rounded-full ${dotByStatus[status]}`} />
          <p className="font-bold text-[15px] leading-tight truncate text-foreground/90">
            {w.name}
          </p>
          {w.alias_verified && <ShieldCheck className="w-3.5 h-3.5 text-accent/80 shrink-0" />}
        </div>

        {/* Horizontal scroll keeps the action bar one row tall no matter how many buttons. */}
        <div className="shrink-0 max-w-[55%] overflow-x-auto custom-scrollbar pb-1 -mb-1">
          <ActionBar w={w} isOffline={isOffline} size="sm" />
        </div>
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`shrink-0 font-mono text-[9px] uppercase tracking-widest ${toneByStatus[status]}`}
        >
          {labelByStatus[status]}
        </span>
        <span className="shrink-0 font-mono text-[9px] text-border">|</span>
        <div className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground/80">
          {w.current_window ?? (
            <span className="italic opacity-60">no active signal</span>
          )}
        </div>
        <span className="shrink-0 font-mono text-[9px] text-muted-foreground/50 tabular-nums">
          {relativeTime(w.last_heartbeat)}
        </span>
      </div>
    </div>
  );
});

function HeaderCell({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
  align = "left",
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === k;
  return (
    <button
      onClick={() => onSort(k)}
      className={`flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] transition-colors group ${
        active ? "text-foreground font-bold" : "text-muted-foreground hover:text-foreground/80"
      } ${align === "right" ? "justify-end w-full" : ""}`}
    >
      {label}
      <ArrowUpDown
        className={`w-3 h-3 transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`}
      />
      {active && (
        <span className="text-[10px] text-accent">{sortDir === "asc" ? "▲" : "▼"}</span>
      )}
    </button>
  );
}

export function WorkstationTable({
  items,
  pulses,
  sortKey,
  sortDir,
  onSort,
}: {
  items: Workstation[];
  pulses: Map<string, "info" | "violation">;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
}) {
  const desktopParentRef = useRef<HTMLDivElement>(null);
  const mobileParentRef = useRef<HTMLDivElement>(null);

  const desktopVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => desktopParentRef.current,
    estimateSize: () => 52,
    overscan: 10,
  });

  // Dedicated mobile virtualizer locked to the 84px row height.
  const mobileVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => mobileParentRef.current,
    estimateSize: () => 84,
    overscan: 8,
  });

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center bg-background/30 backdrop-blur-md rounded-3xl border border-border/20 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-secondary/50 border border-border/30 flex items-center justify-center mb-4 shadow-inner">
          <ShieldCheck className="w-8 h-8 text-muted-foreground/40" />
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.4em] text-foreground/70 mb-2">
          Grid Offline
        </p>
        <p className="text-sm text-muted-foreground/60 max-w-xs">
          No workstations are currently projecting telemetry to this matrix.
        </p>
      </div>
    );
  }

  return (
    <div className="relative rounded-[2rem] overflow-hidden shadow-2xl border border-border/20 bg-background/50 backdrop-blur-xl w-full">
      {/* MOBILE — virtualized, condensed */}
      <div
        className="md:hidden max-h-[75vh] overflow-y-auto custom-scrollbar"
        ref={mobileParentRef}
      >
        <div
          style={{
            height: `${mobileVirtualizer.getTotalSize()}px`,
            position: "relative",
            width: "100%",
          }}
        >
          {mobileVirtualizer.getVirtualItems().map((vi) => {
            const w = items[vi.index];
            return (
              <div
                key={w.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${vi.size}px`,
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                <MobileRow w={w} pulse={pulses.get(w.id) ?? "none"} />
              </div>
            );
          })}
        </div>
      </div>

      {/* DESKTOP */}
      <div className="hidden md:block overflow-x-auto custom-scrollbar w-full">
        <div className="min-w-[768px]">
          <div
            className="grid items-center gap-3 px-5 py-4 border-b border-border/20 bg-secondary/20 backdrop-blur-md sticky top-0 z-10"
            style={{ gridTemplateColumns: fluidGridCols }}
          >
            <HeaderCell label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <HeaderCell label="Node" k="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <HeaderCell label="Foreground Window" k="current_window" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <HeaderCell label="Process" k="current_process" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <HeaderCell label="Heartbeat" k="last_heartbeat" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
            <span className="text-right font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/50 pr-2">
              Execution
            </span>
          </div>

          <div
            ref={desktopParentRef}
            className="max-h-[640px] overflow-y-auto overflow-x-hidden custom-scrollbar scroll-smooth"
          >
            <div
              style={{
                height: `${desktopVirtualizer.getTotalSize()}px`,
                position: "relative",
                width: "100%",
              }}
            >
              {desktopVirtualizer.getVirtualItems().map((vi) => {
                const w = items[vi.index];
                return (
                  <div
                    key={w.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${vi.size}px`,
                      transform: `translateY(${vi.start}px)`,
                    }}
                  >
                    <Row w={w} pulse={pulses.get(w.id) ?? "none"} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
