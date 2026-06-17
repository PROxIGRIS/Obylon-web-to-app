import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import * as React from "react";
import { Shell } from "@/components/sentinel/Shell";
import { useAuth } from "@/hooks/use-auth";
import { useSimpleMode } from "@/hooks/use-simple-mode";
import { SimpleViolations } from "@/components/sentinel/simple/SimpleViolations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
  ShieldAlert,
  FileWarning,
  Activity,
  Clock,
  Monitor,
  Trash2,
  Power,
  Play,
  RefreshCw,
  Timer,
  CalendarClock,
  Zap,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Eye,
} from "lucide-react";
import {
  applyUnauthorizedAutoClear,
  clearUnauthorizedEvents,
  clearUnauthorizedWindow,
  formatIstDateTime,
  getUnauthorizedEvents,
  getUnauthorizedWindow,
  setUnauthorizedWindowByRangeEpoch,
  unauthorizedEventsUpdateEventName,
  type UnauthorizedEvent,
  type UnauthorizedWindow,
} from "@/lib/unauthorized-events";
import { supabase } from "@/integrations/supabase/client";
import { type Tables } from "@/integrations/supabase/types";
import { deriveStatus, relativeTime } from "@/lib/sentinel";

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.trunc(seconds));
  if (safe < 60) return `${safe}s`;
  const mins = Math.floor(safe / 60);
  const sec = safe % 60;
  if (mins < 60) return `${mins}m ${sec}s`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs}h ${remainMins}m`;
}

function formatIstTime(epochMs: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(epochMs));
}

function formatIstDate(epochMs: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(epochMs));
}

// Helper to format Date to HTML datetime-local string (YYYY-MM-DDThh:mm)
function toDateTimeLocal(date: Date) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

export const Route = createFileRoute("/violations")({
  head: () => ({
    meta: [
      { title: "Class Activity Log · Obylon" },
      { name: "description", content: "Dashboard history for off-task detections." },
    ],
  }),
  component: ViolationsPage,
});

function ViolationsPage() {
  const { role, loading } = useAuth();
  const [simple] = useSimpleMode();
  const [events, setEvents] = useState<UnauthorizedEvent[]>([]);
  const [windowConfig, setWindowConfig] = useState<UnauthorizedWindow | null>(null);
  const [workstations, setWorkstations] = useState<Tables<"workstations">[]>([]);

  // Custom Future Time States (Defaults to Now -> Now + 1 Hour)
  const [startTime, setStartTime] = useState(() => toDateTimeLocal(new Date()));
  const [endTime, setEndTime] = useState(() => toDateTimeLocal(new Date(Date.now() + 3600000)));
  const [clearDelayMins, setClearDelayMins] = useState(30);

  // Live clock for real-time min threshold (updates every 30s to avoid excessive renders)
  const [nowMin, setNowMin] = useState(() => toDateTimeLocal(new Date()));
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMin(toDateTimeLocal(new Date()));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Elapsed time display for active sessions
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    if (!windowConfig) return;
    const now = Date.now();
    if (now < windowConfig.startAtMs || now > windowConfig.endAtMs) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((Date.now() - windowConfig.startAtMs) / 1000));
      setElapsed(formatDuration(diff));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [windowConfig]);

  const reqIdRef = React.useRef(0);

  const refresh = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    await applyUnauthorizedAutoClear();
    const [evs, win, { data: ws }] = await Promise.all([
      getUnauthorizedEvents(),
      getUnauthorizedWindow(),
      supabase.from("workstations").select("*").order("name"),
    ]);
    if (reqId !== reqIdRef.current) return;
    setEvents(evs);
    setWindowConfig(win);
    setWorkstations(ws || []);

    // Sync UI times with active config if it exists
    if (win && win.endAtMs > Date.now()) {
      setStartTime(toDateTimeLocal(new Date(win.startAtMs)));
      setEndTime(toDateTimeLocal(new Date(win.endAtMs)));
    }
  }, []);

  useEffect(() => {
    refresh();

    const updateEvent = unauthorizedEventsUpdateEventName();

    window.addEventListener(updateEvent, refresh as EventListener);
    window.addEventListener("storage", refresh);
    const timer = setInterval(refresh, 2000);

    return () => {
      window.removeEventListener(updateEvent, refresh as EventListener);
      window.removeEventListener("storage", refresh);
      clearInterval(timer);
    };
  }, [refresh]);

  const groups = useMemo(() => {
    const grouped = new Map<string, UnauthorizedEvent>();
    for (const item of events) {
      const key = `${item.nodeId}::${item.processName}::${item.kind}`;
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, item);
        continue;
      }
      const firstSeenMs = new Date(existing.timestamp).getTime();
      const incomingFirstSeenMs = new Date(item.timestamp).getTime();
      const lastSeenMs = new Date(existing.lastSeen ?? existing.timestamp).getTime();
      const incomingLastSeenMs = new Date(item.lastSeen ?? item.timestamp).getTime();
      grouped.set(key, {
        ...existing,
        timestamp:
          Number.isFinite(incomingFirstSeenMs) && incomingFirstSeenMs < firstSeenMs
            ? item.timestamp
            : existing.timestamp,
        lastSeen:
          Number.isFinite(incomingLastSeenMs) && incomingLastSeenMs > lastSeenMs
            ? item.lastSeen
            : existing.lastSeen,
        durationSeconds: (existing.durationSeconds ?? 0) + (item.durationSeconds ?? 0),
        windowTitle: item.windowTitle || existing.windowTitle,
        payload: existing.payload || item.payload,
      });
    }
    const merged = Array.from(grouped.values()).sort(
      (a, b) =>
        new Date(b.lastSeen ?? b.timestamp).getTime() -
        new Date(a.lastSeen ?? a.timestamp).getTime(),
    );
    let unauthorized = 0;
    let unAdded = 0;
    let totalDuration = 0;
    for (const item of merged) {
      if (item.kind === "unauthorized") unauthorized++;
      else unAdded++;
      totalDuration += item.durationSeconds ?? 0;
    }
    return { unauthorized, unAdded, merged, totalDuration };
  }, [events]);

  const now = Date.now();
  const windowActive =
    !!windowConfig && now <= windowConfig.endAtMs && now >= windowConfig.startAtMs;
  const isScheduled = !!windowConfig && now < windowConfig.startAtMs;

  const setWindow = async () => {
    let startAtMs = new Date(startTime).getTime();
    const endAtMs = new Date(endTime).getTime();
    const clearDelaySeconds = clearDelayMins * 60;
    const nowMs = Date.now();

    // Validate parsed values are real numbers
    if (!Number.isFinite(startAtMs) || !Number.isFinite(endAtMs)) {
      toast.error("Please select valid start and end times.");
      return;
    }

    // 1. The Grace Period Snap
    // If the start time is within the last 5 minutes, they clearly meant "start right now".
    // We snap it slightly into the future (+1000ms) so the backend validation doesn't reject it.
    if (startAtMs < nowMs && startAtMs > nowMs - 5 * 60000) {
      startAtMs = nowMs + 1000;
    } else if (startAtMs < nowMs) {
      toast.error("Class start time cannot be in the past.");
      return;
    }

    if (startAtMs >= endAtMs) {
      toast.error("The class end time must be after the start time.");
      return;
    }

    // Duration sanity check (max 12 hours)
    if (endAtMs - startAtMs > 12 * 60 * 60 * 1000) {
      toast.error("Class duration cannot exceed 12 hours.");
      return;
    }

    const result = await setUnauthorizedWindowByRangeEpoch(startAtMs, endAtMs, clearDelaySeconds);

    if (!result.ok) {
      toast.error(
        result.message ?? "System error setting the schedule. Ensure timestamps are valid.",
      );
      return;
    }
    const win = await getUnauthorizedWindow();
    setWindowConfig(win);
    toast.success(
      `Monitoring schedule saved: ${formatIstTime(startAtMs)} to ${formatIstTime(endAtMs)}`,
    );
  };

  const stopWindow = async () => {
    await clearUnauthorizedWindow();
    setWindowConfig(null);
    toast.info("Monitoring session stopped.");
  };

  const clearEvents = async () => {
    await clearUnauthorizedEvents();
    setEvents([]);
    toast.success("Class history cleared.");
  };

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl border-2 border-border/40 flex items-center justify-center">
              <Eye className="w-5 h-5 text-muted-foreground animate-pulse" />
            </div>
            <div
              className="absolute -inset-2 rounded-3xl border border-border/20 animate-ping"
              style={{ animationDuration: "2s" }}
            />
          </div>
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-[0.3em] animate-pulse">
            Loading Activity Logs...
          </p>
        </div>
      </Shell>
    );
  }

  // Allow Dev, Principal, Admin, and Teacher. Block Helpers or unassigned.
  const isElevated =
    role === "dev" || role === "principal" || role === "admin" || role === "teacher";

  if (!isElevated) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-destructive" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-destructive font-mono text-sm tracking-widest uppercase font-semibold">
              Access Denied
            </p>
            <p className="text-muted-foreground text-xs">
              Teacher or Administrator clearance required.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  const statusColor = windowActive
    ? "text-destructive"
    : isScheduled
      ? "text-amber"
      : "text-muted-foreground/60";

  const statusBg = windowActive
    ? "bg-destructive/10 border-destructive/20"
    : isScheduled
      ? "bg-amber/10 border-amber/20"
      : "bg-secondary/40 border-border/30";

  if (simple) {
    return (
      <Shell>
        <SimpleViolations
          groups={groups}
          workstations={workstations}
          windowConfig={windowConfig}
          windowActive={windowActive}
          isScheduled={isScheduled}
          elapsed={elapsed}
          startTime={startTime}
          endTime={endTime}
          clearDelayMins={clearDelayMins}
          nowMin={nowMin}
          setStartTime={setStartTime}
          setEndTime={setEndTime}
          setClearDelayMins={setClearDelayMins}
          setWindow={setWindow}
          stopWindow={stopWindow}
          refresh={refresh}
          clearEvents={clearEvents}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-12 space-y-6 sm:space-y-8">
        {/* ─── Header ─── */}
        <header className="relative overflow-hidden rounded-2xl paper-elevated p-6 sm:p-8 border border-border/30">
          {/* Decorative gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-sage/[0.06] via-transparent to-soft-yellow/[0.04] pointer-events-none" />

          <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex-1 min-w-0">
              {/* Live status beacon */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className="relative flex items-center justify-center">
                  <span
                    className={`w-2 h-2 rounded-full ${windowActive ? "bg-destructive" : isScheduled ? "bg-amber" : "bg-muted-foreground/30"}`}
                  />
                  {windowActive && (
                    <span
                      className="absolute w-2 h-2 rounded-full bg-destructive animate-ping"
                      style={{ animationDuration: "1.5s" }}
                    />
                  )}
                </div>
                <span
                  className={`font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.4em] sm:tracking-[0.5em] font-medium ${statusColor}`}
                >
                  Class Monitor ·{" "}
                  {windowActive ? "Recording" : isScheduled ? "Scheduled" : "Standby"}
                </span>
                {windowActive && elapsed && (
                  <span className="font-mono text-[10px] bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-full tabular-nums">
                    {elapsed}
                  </span>
                )}
              </div>

              <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl leading-none text-foreground tracking-tight">
                Class Activity Log
              </h1>
              <p className="text-sm text-muted-foreground mt-3 max-w-2xl leading-relaxed">
                Track student activity, off-task behavior, and restricted app usage during your
                class. Logs are automatically cleared after class to protect student privacy.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                className="font-mono text-[10px] uppercase tracking-widest border-border/50 hover:bg-secondary/60 transition-all h-8 px-3"
              >
                <RefreshCw className="w-3 h-3 mr-1.5" /> Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearEvents}
                className="font-mono text-[10px] uppercase tracking-widest border-border/50 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all h-8 px-3"
              >
                <Trash2 className="w-3 h-3 mr-1.5" /> Clear
              </Button>
            </div>
          </div>
        </header>

        {/* ─── Configuration Panel ─── */}
        <div className="paper-elevated rounded-2xl overflow-hidden shadow-md border border-border/30">
          {/* Panel header */}
          <div className="px-6 sm:px-8 pt-6 sm:pt-7 pb-4 border-b border-border/20 bg-gradient-to-r from-secondary/30 via-transparent to-secondary/20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-foreground/[0.06] border border-border/40 flex items-center justify-center">
                <CalendarClock className="w-4 h-4 text-foreground/70" />
              </div>
              <div>
                <h2 className="font-mono text-[11px] uppercase tracking-[0.35em] text-foreground font-semibold">
                  Class Time Settings
                </h2>
                <p className="text-xs mt-0.5 text-muted-foreground">
                  Schedule when Obylon should actively record screen violations.
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 sm:px-8 py-5 sm:py-6">
            <div className="flex flex-col xl:flex-row justify-between items-start gap-6">
              {/* Left: Inputs row */}
              <div className="flex flex-wrap items-end gap-3 sm:gap-4 w-full xl:w-auto">
                {/* Start Time */}
                <div className="space-y-1.5 min-w-[180px] flex-1 sm:flex-none">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
                    <Play className="w-2.5 h-2.5" />
                    Class Start Time
                  </p>
                  <Input
                    type="datetime-local"
                    value={startTime}
                    min={nowMin}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="h-9 font-mono text-xs bg-background/50 cursor-pointer border-border/50 hover:border-border/80 transition-colors"
                  />
                </div>

                {/* Arrow connector (desktop only) */}
                <div className="hidden sm:flex items-center justify-center pb-1 text-muted-foreground/40">
                  <ArrowRight className="w-4 h-4" />
                </div>

                {/* End Time */}
                <div className="space-y-1.5 min-w-[180px] flex-1 sm:flex-none">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
                    <Power className="w-2.5 h-2.5" />
                    Class End Time
                  </p>
                  <Input
                    type="datetime-local"
                    value={endTime}
                    min={startTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="h-9 font-mono text-xs bg-background/50 cursor-pointer border-border/50 hover:border-border/80 transition-colors"
                  />
                </div>

                {/* Auto-Delete Selector */}
                <div className="space-y-1.5 w-full sm:w-40">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
                    <Timer className="w-2.5 h-2.5" />
                    Auto-Delete Logs
                  </p>
                  <select
                    value={clearDelayMins}
                    onChange={(e) => setClearDelayMins(Number(e.target.value))}
                    className="h-9 w-full rounded-md border border-border/50 bg-background/50 px-2.5 font-mono text-xs outline-none focus:ring-1 focus:ring-ring hover:border-border/80 transition-colors cursor-pointer"
                  >
                    <option value={0}>Immediately</option>
                    <option value={15}>After 15 Mins</option>
                    <option value={30}>After 30 Mins</option>
                    <option value={60}>After 1 Hour</option>
                    <option value={120}>After 2 Hours</option>
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="flex items-end gap-2 pb-px">
                  <Button
                    onClick={setWindow}
                    className={`font-mono text-[10px] uppercase tracking-widest h-9 px-5 transition-all shadow-sm hover:shadow-md ${
                      windowActive || isScheduled
                        ? "bg-accent hover:bg-accent/90 text-foreground"
                        : "bg-foreground hover:bg-foreground/90 text-background"
                    }`}
                  >
                    {windowActive || isScheduled ? (
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {windowActive || isScheduled ? "Update" : "Start"}
                  </Button>

                  {(windowActive || isScheduled) && (
                    <Button
                      variant="outline"
                      onClick={stopWindow}
                      className="font-mono text-[10px] uppercase tracking-widest h-9 px-4 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/40 transition-all"
                    >
                      <Power className="w-3.5 h-3.5 mr-1.5" /> Stop
                    </Button>
                  )}
                </div>
              </div>

              {/* Right: Status Card */}
              <div
                className={`rounded-xl px-5 py-4 min-w-[280px] sm:min-w-[300px] border transition-all ${statusBg}`}
              >
                {windowConfig ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Status
                      </span>
                      <span
                        className={`font-mono text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5 ${statusColor}`}
                      >
                        {windowActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                        )}
                        {isScheduled && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse"
                            style={{ animationDuration: "2s" }}
                          />
                        )}
                        {windowActive ? "Active" : isScheduled ? "Scheduled" : "Closed"}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Play className="w-2.5 h-2.5" /> Starts:
                        </span>
                        <span className="text-foreground font-medium tabular-nums">
                          {formatIstTime(windowConfig.startAtMs)}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Power className="w-2.5 h-2.5" /> Ends:
                        </span>
                        <span className="text-foreground font-medium tabular-nums">
                          {formatIstTime(windowConfig.endAtMs)}
                        </span>
                      </div>
                      <div className="h-px bg-border/30 my-1" />
                      <div className="flex justify-between text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Trash2 className="w-2.5 h-2.5" /> Auto-Delete:
                        </span>
                        <span className="text-amber font-medium tabular-nums">
                          {formatIstTime(windowConfig.clearAtMs)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-xs text-muted-foreground py-5 gap-2">
                    <CalendarClock className="w-5 h-5 opacity-40" />
                    <span className="italic">No class currently scheduled.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Metrics Grid ─── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Total Alerts",
              value: groups.merged.length,
              tone: "text-foreground",
              accent: "from-foreground/10",
              bg: "bg-foreground/[0.03]",
              Icon: Activity,
              subtitle: groups.merged.length === 0 ? "Clean" : `${groups.merged.length} detected`,
            },
            {
              label: "Restricted Apps",
              value: groups.unauthorized,
              tone: "text-destructive",
              accent: "from-destructive/20",
              bg: "bg-destructive/[0.03]",
              Icon: ShieldAlert,
              subtitle: groups.unauthorized === 0 ? "None blocked" : "Blocked processes",
            },
            {
              label: "Unknown Sites",
              value: groups.unAdded,
              tone: "text-amber",
              accent: "from-amber/20",
              bg: "bg-amber/[0.03]",
              Icon: FileWarning,
              subtitle: groups.unAdded === 0 ? "All clear" : "Unrecognized activity",
            },
            {
              label: "Total Time",
              value: groups.totalDuration > 0 ? formatDuration(groups.totalDuration) : "0s",
              tone: "text-foreground",
              accent: "from-sage/20",
              bg: "bg-sage/[0.04]",
              Icon: Clock,
              subtitle: "Cumulative off-task",
              isText: true,
            },
          ].map(({ label, value, tone, accent, bg, Icon, subtitle, isText }) => (
            <div
              key={label}
              className={`relative overflow-hidden paper-elevated rounded-2xl p-5 sm:p-6 border border-border/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl group cursor-default`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${accent} to-transparent opacity-40 group-hover:opacity-60 transition-opacity`}
              />
              <div className="relative flex items-start justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                    {label}
                  </p>
                  <p
                    className={`font-serif ${isText ? "text-2xl sm:text-3xl" : "text-4xl sm:text-5xl"} mt-2 tabular-nums ${tone} leading-none`}
                  >
                    {value}
                  </p>
                  <p className="font-mono text-[9px] text-muted-foreground/60 mt-2 uppercase tracking-wider">
                    {subtitle}
                  </p>
                </div>
                <div
                  className={`p-2 sm:p-2.5 rounded-xl ${bg} border border-border/30 ${tone} transition-transform group-hover:scale-110`}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ─── Classroom Computers Health ─── */}
        <div className="paper-elevated rounded-2xl overflow-hidden shadow-lg border border-border/30 mb-8 p-6">
          <div className="flex items-center gap-2.5 mb-6">
            <Monitor className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-mono text-xs uppercase tracking-[0.3em] font-semibold text-foreground/80">
              Live Computer Health
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workstations.map((ws) => {
              const status = deriveStatus(ws.status, ws.last_heartbeat);
              const os = ws.os_info as any;
              return (
                <div
                  key={ws.id}
                  className="p-4 rounded-xl border border-border/40 bg-background/50 flex flex-col gap-3"
                >
                  <div className="flex justify-between items-center">
                    <p className="font-medium text-sm text-foreground">{ws.name}</p>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-mono tracking-wider ${
                        status === "online"
                          ? "bg-sage/20 text-sage"
                          : status === "interrupted"
                            ? "bg-amber/20 text-amber"
                            : "bg-destructive/20 text-destructive"
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono">
                        CPU
                      </span>
                      <span className="text-xs font-mono font-medium">
                        {os?.cpu_percent != null ? `${os.cpu_percent}%` : "--"}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono">
                        RAM
                      </span>
                      <span className="text-xs font-mono font-medium">
                        {os?.mem_percent != null ? `${os.mem_percent}%` : "--"}
                      </span>
                    </div>
                    <div className="flex flex-col col-span-2 mt-1 border-t border-border/30 pt-2">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono">
                        Heartbeat
                      </span>
                      <span className="text-xs text-muted-foreground/80">
                        {relativeTime(ws.last_heartbeat)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {workstations.length === 0 && (
              <div className="col-span-full py-8 text-center text-muted-foreground text-sm border-2 border-dashed border-border/40 rounded-xl">
                No computers connected
              </div>
            )}
          </div>
        </div>

        {/* ─── Telemetry Table ─── */}
        <div className="paper-elevated rounded-2xl overflow-hidden shadow-lg border border-border/30">
          {/* Table header */}
          <div className="px-6 py-3.5 border-b border-border/40 bg-gradient-to-r from-secondary/30 to-transparent flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Zap className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-semibold">
                Live Telemetry Feed
              </p>
            </div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
              {groups.merged.length} {groups.merged.length === 1 ? "entry" : "entries"}
            </p>
          </div>

          {/* Column headers */}
          <div className="hidden lg:grid parchment-strip grid-cols-[160px_180px_200px_1fr_180px] gap-4 px-6 py-2.5 border-b border-border/40">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/80 font-medium">
              Alert Type
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/80 font-medium">
              Computer
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/80 font-medium">
              App / Website
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/80 font-medium">
              Details
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/80 font-medium text-right">
              Time Logged
            </p>
          </div>

          <div className="max-h-[640px] overflow-y-auto custom-scrollbar bg-background/30">
            {groups.merged.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <div className="relative mb-5">
                  <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-border/40 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-sage/60" />
                  </div>
                  <div
                    className="absolute -inset-2 rounded-3xl border border-sage/20 animate-pulse"
                    style={{ animationDuration: "3s" }}
                  />
                </div>
                <p className="text-sm font-medium text-foreground/70">
                  No off-task behavior detected
                </p>
                <p className="text-xs mt-1.5 opacity-60 max-w-xs text-center">
                  {windowActive
                    ? "The current class session is clean. Great focus!"
                    : "Start a monitoring session to begin tracking activity."}
                </p>
              </div>
            )}

            {groups.merged.map((item, idx) => {
              const firstSeen = new Date(item.timestamp).getTime();
              const lastSeen = new Date(item.lastSeen || item.timestamp).getTime();
              const duration = Math.max(1, item.durationSeconds || 0);
              const isContinuous = lastSeen - firstSeen <= duration * 1000 + 15000;
              const isCrit = item.kind === "unauthorized";
              const Icon = isCrit ? ShieldAlert : FileWarning;
              const severityLevel =
                duration > 600
                  ? "critical"
                  : duration > 300
                    ? "high"
                    : duration > 60
                      ? "medium"
                      : "low";

              return (
                <div
                  key={item.id}
                  className={`relative border-b border-border/30 hover:bg-secondary/30 transition-all duration-200 group ${
                    isCrit ? "bg-destructive/[0.015]" : ""
                  }`}
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  {/* Left severity stripe */}
                  <span
                    className={`absolute left-0 top-0 bottom-0 w-[3px] transition-all ${
                      isCrit
                        ? "bg-destructive/70 group-hover:bg-destructive"
                        : "bg-amber/60 group-hover:bg-amber"
                    }`}
                  />

                  <div className="grid lg:grid-cols-[160px_180px_200px_1fr_180px] gap-3 sm:gap-4 px-5 sm:px-6 py-3.5 sm:py-4 items-center">
                    {/* Alert Type Badge */}
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full w-fit border transition-colors ${
                        isCrit
                          ? "bg-destructive/10 border-destructive/25 text-destructive group-hover:bg-destructive/15"
                          : "bg-amber/10 border-amber/25 text-amber group-hover:bg-amber/15"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <p className="font-mono text-[9px] uppercase tracking-widest font-bold leading-none">
                        {item.kind}
                      </p>
                    </div>

                    {/* Computer */}
                    <div className="flex items-center gap-2 min-w-0">
                      <Monitor className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                      <p className="font-mono text-[11px] text-foreground font-medium truncate">
                        {item.nodeName}
                      </p>
                    </div>

                    {/* Process name */}
                    <p className="font-mono text-[11px] text-foreground/80 truncate bg-background/60 px-2.5 py-1 rounded-md inline-block w-fit border border-border/25 max-w-full">
                      {item.processName}
                    </p>

                    {/* Details */}
                    <div className="min-w-0 pr-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-mono">
                          Time Open
                        </span>
                        <span
                          className={`font-mono font-bold text-sm tabular-nums ${
                            severityLevel === "critical"
                              ? "text-destructive"
                              : severityLevel === "high"
                                ? "text-destructive/80"
                                : "text-amber"
                          }`}
                        >
                          {formatDuration(duration)}
                        </span>
                        <span
                          className={`text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded-full border leading-none ${
                            isContinuous
                              ? "bg-destructive/5 border-destructive/25 text-destructive/80"
                              : "bg-secondary border-border/30 text-muted-foreground/80"
                          }`}
                        >
                          {isContinuous ? "Continuous" : "Intermittent"}
                        </span>
                        {severityLevel === "critical" && (
                          <AlertTriangle className="w-3 h-3 text-destructive/70" />
                        )}
                      </div>
                      {item.windowTitle && (
                        <p className="text-[11px] text-muted-foreground/70 truncate mt-1.5 pl-0.5">
                          ↳ {item.windowTitle}
                        </p>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="text-left lg:text-right">
                      <p className="font-mono text-[11px] text-foreground flex items-center lg:justify-end gap-1 tabular-nums">
                        <Clock className="w-3 h-3 text-muted-foreground/50" />
                        {formatIstTime(firstSeen)}{" "}
                        <span className="text-muted-foreground/40 mx-0.5">→</span>{" "}
                        {formatIstTime(lastSeen)}
                      </p>
                      <p className="font-mono text-[9px] text-muted-foreground/50 mt-0.5 uppercase tracking-widest">
                        {formatIstDate(firstSeen)}
                      </p>
                    </div>
                  </div>

                  {/* Payload section */}
                  {item.payload && (
                    <div className="px-5 sm:px-6 pb-3.5 pt-0.5">
                      <div className="bg-background rounded-lg p-3 border border-border/40 shadow-sm relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber/40" />
                        <p className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground/60 mb-1.5 pl-2.5">
                          Violation Details
                        </p>
                        <p className="font-mono text-xs break-words text-foreground/75 pl-2.5 leading-relaxed">
                          {item.payload}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Shell>
  );
}
