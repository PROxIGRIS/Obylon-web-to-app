import type { Dispatch, SetStateAction } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Monitor,
  Play,
  Power,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deriveStatus, relativeTime } from "@/lib/sentinel";
import type { UnauthorizedEvent, UnauthorizedWindow } from "@/lib/unauthorized-events";
import type { Tables } from "@/integrations/supabase/types";

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.trunc(seconds));
  if (safe < 60) return `${safe}s`;
  const mins = Math.floor(safe / 60);
  const sec = safe % 60;
  if (mins < 60) return `${mins}m ${sec}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function formatIstTime(epochMs: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(epochMs));
}

type Groups = {
  unauthorized: number;
  unAdded: number;
  merged: UnauthorizedEvent[];
  totalDuration: number;
};

export function SimpleViolations({
  groups,
  workstations,
  windowConfig,
  windowActive,
  isScheduled,
  elapsed,
  startTime,
  endTime,
  clearDelayMins,
  nowMin,
  setStartTime,
  setEndTime,
  setClearDelayMins,
  setWindow,
  stopWindow,
  refresh,
  clearEvents,
}: {
  groups: Groups;
  workstations: Tables<"workstations">[];
  windowConfig: UnauthorizedWindow | null;
  windowActive: boolean;
  isScheduled: boolean;
  elapsed: string;
  startTime: string;
  endTime: string;
  clearDelayMins: number;
  nowMin: string;
  setStartTime: Dispatch<SetStateAction<string>>;
  setEndTime: Dispatch<SetStateAction<string>>;
  setClearDelayMins: Dispatch<SetStateAction<number>>;
  setWindow: () => Promise<void>;
  stopWindow: () => Promise<void>;
  refresh: () => Promise<void>;
  clearEvents: () => Promise<void>;
}) {
  return (
    <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-14 space-y-5">
      <header className="paper-elevated rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
              Legacy Activity Log
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl mt-1">Class Incidents</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Start a class window, review off-task activity, and clear logs when the session ends.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              className="font-mono text-[10px] uppercase tracking-widest"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearEvents}
              className="font-mono text-[10px] uppercase tracking-widest"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Clear
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="paper-elevated rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl border border-border/40 bg-background/50 flex items-center justify-center">
              <CalendarClock className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-serif text-xl">Class Time Settings</h2>
              <p className="text-xs text-muted-foreground">
                Choose when activity should be recorded.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_160px]">
            <label className="space-y-1.5">
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                Start
              </span>
              <Input
                type="datetime-local"
                value={startTime}
                min={nowMin}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                End
              </span>
              <Input
                type="datetime-local"
                value={endTime}
                min={startTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                Auto-clear
              </span>
              <select
                value={clearDelayMins}
                onChange={(e) => setClearDelayMins(Number(e.target.value))}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value={0}>Immediately</option>
                <option value={15}>15 mins</option>
                <option value={30}>30 mins</option>
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={setWindow} className="font-mono text-[10px] uppercase tracking-widest">
              <Play className="w-3.5 h-3.5 mr-1.5" />
              {windowActive || isScheduled ? "Update session" : "Start session"}
            </Button>
            {(windowActive || isScheduled) && (
              <Button
                variant="outline"
                onClick={stopWindow}
                className="font-mono text-[10px] uppercase tracking-widest text-destructive"
              >
                <Power className="w-3.5 h-3.5 mr-1.5" />
                Stop
              </Button>
            )}
          </div>
        </div>

        <aside className="paper-elevated rounded-2xl p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Session Status
          </p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${windowActive ? "bg-destructive" : isScheduled ? "bg-amber" : "bg-muted-foreground/40"}`}
              />
              <p className="font-serif text-2xl">
                {windowActive ? "Recording" : isScheduled ? "Scheduled" : "Standby"}
              </p>
            </div>
            {elapsed && <p className="font-mono text-xs text-destructive">{elapsed} elapsed</p>}
            {windowConfig ? (
              <div className="rounded-xl border border-border/40 bg-background/50 p-3 text-xs space-y-1.5">
                <p>
                  Starts: <span className="font-mono">{formatIstTime(windowConfig.startAtMs)}</span>
                </p>
                <p>
                  Ends: <span className="font-mono">{formatIstTime(windowConfig.endAtMs)}</span>
                </p>
                <p>
                  Clears: <span className="font-mono">{formatIstTime(windowConfig.clearAtMs)}</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No class is scheduled.</p>
            )}
          </div>
        </aside>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="paper-elevated rounded-2xl p-5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            Total Alerts
          </p>
          <p className="font-serif text-4xl mt-1">{groups.merged.length}</p>
        </div>
        <div className="paper-elevated rounded-2xl p-5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            Restricted Apps
          </p>
          <p className="font-serif text-4xl mt-1 text-destructive">{groups.unauthorized}</p>
        </div>
        <div className="paper-elevated rounded-2xl p-5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            Unknown Sites
          </p>
          <p className="font-serif text-4xl mt-1 text-amber">{groups.unAdded}</p>
        </div>
        <div className="paper-elevated rounded-2xl p-5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            Total Time
          </p>
          <p className="font-serif text-3xl mt-1">{formatDuration(groups.totalDuration)}</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="paper-elevated rounded-2xl p-5 h-fit">
          <h2 className="font-serif text-xl">Computer Health</h2>
          <div className="mt-4 space-y-2">
            {workstations.map((ws) => {
              const status = deriveStatus(ws.status, ws.last_heartbeat);
              return (
                <div
                  key={ws.id}
                  className="rounded-xl border border-border/40 bg-background/50 p-3"
                >
                  <div className="flex items-center gap-2">
                    <Monitor className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <p className="text-sm font-medium truncate">{ws.name}</p>
                    <span
                      className={`ml-auto w-2 h-2 rounded-full ${status === "online" ? "bg-accent" : status === "interrupted" ? "bg-amber" : "bg-muted-foreground/40"}`}
                    />
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground mt-1">
                    {relativeTime(ws.last_heartbeat)}
                  </p>
                </div>
              );
            })}
            {workstations.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No computers connected.
              </p>
            )}
          </div>
        </div>

        <div className="paper-elevated rounded-2xl overflow-hidden">
          <div className="parchment-strip px-5 py-3 flex items-center justify-between">
            <h2 className="font-serif text-xl">Incident List</h2>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {groups.merged.length} entries
            </p>
          </div>
          <div className="max-h-[620px] overflow-y-auto">
            {groups.merged.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <CheckCircle2 className="w-9 h-9 mx-auto text-accent/60" />
                <p className="text-sm mt-3">No off-task behavior detected.</p>
              </div>
            ) : (
              groups.merged.map((item) => {
                const isCrit = item.kind === "unauthorized";
                return (
                  <div
                    key={item.id}
                    className="border-b border-border/30 px-5 py-4 hover:bg-secondary/30 transition"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isCrit ? "bg-destructive/10 text-destructive" : "bg-amber/10 text-amber"}`}
                      >
                        {isCrit ? (
                          <ShieldAlert className="w-4 h-4" />
                        ) : (
                          <AlertTriangle className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{item.nodeName}</p>
                          <span className="font-mono text-[9px] uppercase tracking-widest rounded-full border border-border/40 px-2 py-0.5">
                            {item.kind}
                          </span>
                        </div>
                        <p className="font-mono text-xs mt-1 truncate">{item.processName}</p>
                        {item.windowTitle && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {item.windowTitle}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-xs text-amber">
                          {formatDuration(item.durationSeconds ?? 0)}
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                          <Clock className="w-3 h-3" />
                          {formatIstTime(new Date(item.timestamp).getTime())}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
