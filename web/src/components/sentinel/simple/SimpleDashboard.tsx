import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  AppWindow,
  FileSearch,
  Monitor,
  Search,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { deriveStatus, relativeTime, type WsStatus } from "@/lib/sentinel";
import type { Workstation } from "@/components/sentinel/WorkstationTable";
import { GavelButton, type GavelCommand } from "@/components/sentinel/GavelButton";

type Alert = {
  id: string;
  workstation_id?: string | null;
  process_name: string | null;
  window_title: string | null;
  severity: "info" | "warning" | "medium" | "critical" | "high";
  timestamp: string;
};

const dotByStatus: Record<WsStatus, string> = {
  online: "bg-accent",
  interrupted: "bg-amber signal-interrupted",
  offline: "bg-muted-foreground/40",
};

const labelByStatus: Record<WsStatus, string> = {
  online: "Online",
  interrupted: "Needs attention",
  offline: "Offline",
};

const ACTIONS: Array<{ key: GavelCommand; label: string; hint: string }> = [
  { key: "lock", label: "Lock", hint: "Require sign-in again" },
  { key: "freeze", label: "Freeze", hint: "Pause input devices" },
  { key: "unfreeze", label: "Release", hint: "Restore controls" },
  { key: "kill_task", label: "Close app", hint: "Stop foreground app" },
  { key: "set_alias", label: "Rename", hint: "Change display name" },
  { key: "terminate", label: "Shutdown", hint: "Power off target" },
];

function statusRank(w: Workstation) {
  const status = deriveStatus(w.status, w.last_heartbeat);
  if (status === "interrupted") return 0;
  if (status === "offline") return 1;
  return 2;
}

export function SimpleDashboard({
  items,
  alerts = [],
}: {
  items: Workstation[];
  alerts?: Alert[];
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = items.find((w) => w.id === selectedId) ?? null;
  const criticalCount = alerts.filter(
    (a) => a.severity === "critical" || a.severity === "high",
  ).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...items].sort(
      (a, b) => statusRank(a) - statusRank(b) || a.name.localeCompare(b.name),
    );
    if (!q) return sorted;
    return sorted.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.current_window ?? "").toLowerCase().includes(q) ||
        (w.current_process ?? "").toLowerCase().includes(q),
    );
  }, [items, query]);

  const status = selected ? deriveStatus(selected.status, selected.last_heartbeat) : null;
  const isOffline = status === "offline";

  return (
    <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-14 space-y-5">
      <header className="paper-elevated rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
              Legacy Console
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl mt-1">Simple Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Pick a computer, confirm its current activity, then choose a safe action.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 min-w-[260px]">
            <div className="rounded-xl border border-border/40 bg-background/50 p-3">
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                Nodes
              </p>
              <p className="font-serif text-2xl">{items.length}</p>
            </div>
            <Link
              to="/violations"
              className="rounded-xl border border-border/40 bg-background/50 p-3 hover:border-amber/50 transition"
            >
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                Incidents
              </p>
              <p className="font-serif text-2xl text-amber">{criticalCount}</p>
            </Link>
            <Link
              to="/apps"
              className="rounded-xl border border-border/40 bg-background/50 p-3 hover:border-accent/50 transition"
            >
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                Apps
              </p>
              <AppWindow className="w-6 h-6 mt-1 text-muted-foreground" />
            </Link>
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search computer, app, or window..."
              className="w-full rounded-xl border border-border/60 bg-card px-10 py-3 text-sm outline-none focus:border-accent/60"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((w) => {
              const rowStatus = deriveStatus(w.status, w.last_heartbeat);
              const active = selectedId === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => setSelectedId(w.id)}
                  className={`paper-elevated rounded-2xl p-4 text-left min-w-0 transition ${
                    active ? "ring-2 ring-accent/50 border-accent/50" : "hover:border-accent/40"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${dotByStatus[rowStatus]}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="font-semibold text-sm truncate">{w.name}</p>
                        {w.alias_verified && (
                          <ShieldCheck className="w-3.5 h-3.5 text-accent shrink-0" />
                        )}
                      </div>
                      <p className="font-mono text-[10px] text-muted-foreground mt-1">
                        {labelByStatus[rowStatus]} · {relativeTime(w.last_heartbeat)}
                      </p>
                      <p className="text-xs text-muted-foreground/80 truncate mt-2">
                        {w.current_window ?? "No active window"}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="paper-elevated rounded-2xl p-10 text-center text-sm text-muted-foreground">
              No matching computers found.
            </div>
          )}
        </div>

        <aside className="paper-elevated rounded-2xl p-5 h-fit sticky top-24">
          {selected ? (
            <div className="space-y-5">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                  Selected Computer
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${status ? dotByStatus[status] : ""}`}
                  />
                  <h2 className="font-serif text-2xl truncate">{selected.name}</h2>
                </div>
                <p className="font-mono text-[10px] text-muted-foreground mt-1">
                  {status ? labelByStatus[status] : "Unknown"} ·{" "}
                  {relativeTime(selected.last_heartbeat)}
                </p>
              </div>

              <div className="rounded-xl border border-border/40 bg-background/50 p-4">
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  Current Activity
                </p>
                <p className="text-sm mt-2 break-words">
                  {selected.current_window ?? "No foreground signal"}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground mt-1 break-all">
                  {selected.current_process ?? "-"}
                </p>
              </div>

              <div
                className={`grid grid-cols-2 gap-2 ${isOffline ? "opacity-45 pointer-events-none grayscale" : ""}`}
              >
                {ACTIONS.map((action) => (
                  <div
                    key={action.key}
                    className="rounded-xl border border-border/40 bg-background/50 p-3 min-w-0"
                  >
                    <div className="flex items-center gap-2">
                      <GavelButton
                        workstationId={selected.id}
                        workstationName={selected.name}
                        command={action.key}
                        size="md"
                        defaultPayload={
                          action.key === "kill_task" && selected.current_process
                            ? { process_name: selected.current_process }
                            : action.key === "set_alias"
                              ? { alias: selected.name }
                              : undefined
                        }
                      />
                      <p className="font-semibold text-xs">{action.label}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{action.hint}</p>
                  </div>
                ))}
              </div>

              {isOffline && (
                <p className="rounded-xl border border-dashed border-border/60 bg-secondary/30 px-3 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Offline computers cannot receive actions.
                </p>
              )}

              <Link
                to="/case/$id"
                params={{ id: selected.id }}
                search={{ incidentId: undefined }}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 p-4 hover:border-accent/50 transition"
              >
                <FileSearch className="w-5 h-5 text-muted-foreground shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Open simple case page</span>
                  <span className="block text-xs text-muted-foreground truncate">
                    Evidence, timeline, and details
                  </span>
                </span>
              </Link>
            </div>
          ) : (
            <div className="py-12 text-center">
              <Monitor className="w-10 h-10 mx-auto text-muted-foreground/40" />
              <p className="font-serif text-xl mt-3">Pick a computer</p>
              <p className="text-sm text-muted-foreground mt-1">
                Details and actions will appear here.
              </p>
              {criticalCount > 0 && (
                <Link
                  to="/violations"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl border border-amber/40 bg-amber/10 px-4 py-2 text-xs font-mono uppercase tracking-widest text-amber"
                >
                  <Siren className="w-3.5 h-3.5" />
                  Review incidents
                </Link>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
