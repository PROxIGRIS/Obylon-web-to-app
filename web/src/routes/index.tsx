import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Shell } from "@/components/sentinel/Shell";
import { Heartbeat } from "@/components/sentinel/Heartbeat";
import {
  WorkstationTable,
  type SortKey,
  type Workstation,
} from "@/components/sentinel/WorkstationTable";
import { LabLayout } from "@/components/sentinel/LabLayout";
import { ActiveFeed } from "@/components/sentinel/ActiveFeed";
import { FocusModeToggle } from "@/components/sentinel/FocusModeToggle";
import { GlobalSafetySwitches } from "@/components/sentinel/GlobalSafetySwitches";
import { Terminal } from "@/components/sentinel/Terminal";
import { CriticalIncidentDialog } from "@/components/sentinel/CriticalIncidentDialog";
import { SimpleDashboard } from "@/components/sentinel/simple/SimpleDashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LayoutGrid, List, Search, X } from "lucide-react";
import { deriveStatus, type WsStatus } from "@/lib/sentinel";
import { useMobilePush } from "@/hooks/use-mobile-push";
import { useSimpleMode } from "@/hooks/use-simple-mode";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Obylon by Umbraxis · Operator Grid" },
      {
        name: "description",
        content: "Centralized classroom monitoring — heartbeat, incidents, and remote control.",
      },
    ],
  }),
  component: Dashboard,
});

type Alert = {
  id: string;
  workstation_id: string | null;
  process_name: string | null;
  window_title: string | null;
  severity: "info" | "warning" | "medium" | "critical" | "high";
  alert_type?: string | null;
  timestamp: string;
};

function Dashboard() {
  const { user, session, isAdmin, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  useMobilePush();
  const [simple] = useSimpleMode();
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pulses, setPulses] = useState<Map<string, "info" | "violation">>(new Map());
  const [tick, setTick] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | WsStatus>("all");
  const [view, setView] = useState<"table" | "grid">("table");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const v = localStorage.getItem("sentinel:view") as "table" | "grid";
      if (v === "table" || v === "grid") setView(v);
    }
  }, []);

  const setViewPersist = (v: "table" | "grid") => {
    setView(v);
    if (typeof window !== "undefined") localStorage.setItem("sentinel:view", v);
  };
  const pulseTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!loading && !user && !session) navigate({ to: "/login" });
  }, [loading, user, session, navigate]);

  const triggerPulse = (wsId: string, kind: "info" | "violation") => {
    setPulses((prev) => {
      const next = new Map(prev);
      // violation outranks info
      if (next.get(wsId) === "violation" && kind === "info") return prev;
      next.set(wsId, kind);
      return next;
    });
    const existing = pulseTimers.current.get(wsId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(
      () => {
        setPulses((prev) => {
          const next = new Map(prev);
          next.delete(wsId);
          return next;
        });
        pulseTimers.current.delete(wsId);
      },
      kind === "violation" ? 3200 : 2400,
    );
    pulseTimers.current.set(wsId, t);
  };

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    const load = async () => {
      const [{ data: ws }, { data: al }] = await Promise.all([
        supabase.from("workstations").select("*").order("name"),
        supabase.from("alerts").select("*").order("timestamp", { ascending: false }).limit(120),
      ]);
      if (cancelled) return;
      setWorkstations((ws as Workstation[]) ?? []);
      setAlerts((al as Alert[]) ?? []);
    };
    load();
    const ch = supabase
      .channel("sentinel-grid")
      .on("postgres_changes", { event: "*", schema: "public", table: "workstations" }, (p) => {
        const row = p.new as Workstation;
        if (p.eventType === "DELETE") {
          const old = p.old as { id: string };
          setWorkstations((prev) => prev.filter((w) => w.id !== old.id));
          return;
        }
        setWorkstations((prev) => {
          const idx = prev.findIndex((w) => w.id === row.id);
          if (idx === -1) return [...prev, row];
          const next = prev.slice();
          next[idx] = { ...next[idx], ...row };
          return next;
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, (p) => {
        const a = p.new as Alert;
        setAlerts((prev) => [a, ...prev].slice(0, 120));
        if (a.workstation_id) {
          const isViolation =
            a.severity === "high" ||
            a.severity === "critical" ||
            (a.alert_type ?? "").toLowerCase().includes("focus") ||
            (a.alert_type ?? "").toLowerCase().includes("restricted");
          triggerPulse(a.workstation_id, isViolation ? "violation" : "info");
        }
      })
      .subscribe();
    // Heartbeat-age refresh — light, only updates relative-time labels.
    const heartbeatTick = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => {
      cancelled = true;
      clearInterval(heartbeatTick);
      supabase.removeChannel(ch);
      pulseTimers.current.forEach(clearTimeout);
      pulseTimers.current.clear();
    };
  }, [isAdmin]);

  const counts = useMemo(() => {
    let online = 0,
      interrupted = 0;
    for (const w of workstations) {
      const s = deriveStatus(w.status, w.last_heartbeat);
      if (s === "online") online++;
      else if (s === "interrupted") interrupted++;
    }
    return { online, interrupted, total: workstations.length };
  }, [workstations, tick]);

  const nodeNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of workstations) m.set(w.id, w.name);
    return m;
  }, [workstations]);

  const sortedWorkstations = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const statusRank: Record<string, number> = { interrupted: 0, online: 1, offline: 2 };
    const arr = [...workstations];
    arr.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (sortKey === "status") {
        av = statusRank[deriveStatus(a.status, a.last_heartbeat)] ?? 99;
        bv = statusRank[deriveStatus(b.status, b.last_heartbeat)] ?? 99;
      } else if (sortKey === "last_heartbeat") {
        av = a.last_heartbeat ? new Date(a.last_heartbeat).getTime() : 0;
        bv = b.last_heartbeat ? new Date(b.last_heartbeat).getTime() : 0;
      } else {
        av = (a[sortKey] ?? "").toString().toLowerCase();
        bv = (b[sortKey] ?? "").toString().toLowerCase();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
    // Intentionally omit `tick` — re-sorting on every heartbeat tick caused
    // the virtualizer to thrash. Status changes already arrive via realtime.
  }, [workstations, sortKey, sortDir]);

  const displayedWorkstations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedWorkstations.filter((w) => {
      if (statusFilter !== "all") {
        if (deriveStatus(w.status, w.last_heartbeat) !== statusFilter) return false;
      }
      if (!q) return true;
      return (
        (w.name ?? "").toLowerCase().includes(q) ||
        (w.current_window ?? "").toLowerCase().includes(q) ||
        (w.current_process ?? "").toLowerCase().includes(q)
      );
    });
  }, [sortedWorkstations, search, statusFilter, tick]);

  const onSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "last_heartbeat" ? "desc" : "asc");
    }
  };

  if (loading) {
    return (
      <Shell>
        <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground font-mono text-xs uppercase tracking-[0.3em]">
          calibrating signal…
        </div>
      </Shell>
    );
  }

  if (!user) return null;

  if (!isAdmin) {
    return (
      <Shell>
        <div className="min-h-[80vh] flex items-center justify-center px-4 sm:px-6 py-12">
          <div className="paper-elevated rounded-2xl w-full max-w-md p-8 text-center relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
            <div className="mx-auto w-14 h-14 rounded-full border border-accent/40 bg-accent/10 flex items-center justify-center mb-5">
              <span className="w-2.5 h-2.5 rounded-full bg-accent heartbeat-dot" />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-muted-foreground">
              Restricted
            </p>
            <h1 className="font-serif text-3xl mt-2 tracking-tight">Awaiting clearance</h1>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              Your account <span className="font-mono text-foreground/90">{user.email}</span> has no
              operator role assigned yet. An administrator must grant access before the grid
              unlocks.
            </p>
            <div className="mt-6 rounded-lg border border-border/50 bg-secondary/30 px-4 py-3 text-left">
              <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-muted-foreground">
                Next step
              </p>
              <p className="text-xs mt-1.5 text-foreground/80">
                Share your email with a privileged operator and ask them to provision a role.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={signOut}
              className="mt-6 w-full font-mono text-xs uppercase tracking-widest"
            >
              Sign out
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  const violations = alerts.filter(
    (a) =>
      a.severity === "critical" ||
      a.severity === "high" ||
      (a.alert_type ?? "").toLowerCase().includes("focus") ||
      (a.alert_type ?? "").toLowerCase().includes("restricted"),
  ).length;

  // ───── Simple Mode: legacy-friendly dashboard page ─────
  if (simple) {
    return (
      <Shell>
        <SimpleDashboard items={sortedWorkstations} alerts={alerts} />
        <CriticalIncidentDialog alerts={alerts} nodeNames={nodeNames} />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-4 sm:pt-8 pb-10 sm:pb-12 space-y-5 sm:space-y-6">
        {/* Cinematic hero — upgraded to gorgeous glassmorphic app-like header */}
        <header className="relative overflow-hidden rounded-3xl p-6 sm:p-10 mb-8 border border-border/40 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out glass-strong">
          <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 via-transparent to-background/20 pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-accent/20 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-amber/20 rounded-full blur-[80px] pointer-events-none" />
          
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/50 border border-border/50 text-[10px] sm:text-[11px] uppercase tracking-[0.4em] sm:tracking-[0.5em] text-muted-foreground font-mono shadow-sm backdrop-blur-md">
              <span className="relative flex w-2 h-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full w-2 h-2 bg-accent"></span>
              </span>
              Obylon by Umbraxis · Live
            </div>
            <h1 className="font-serif text-[2.5rem] leading-[1.05] sm:text-5xl lg:text-7xl tracking-tight text-foreground drop-shadow-sm">
              Sentinel Dashboard
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl font-medium">
              {workstations.length} node{workstations.length === 1 ? "" : "s"} · <span className="text-accent">{counts.online} online</span> · <span className="text-amber">{counts.interrupted} quiet</span> · <span className="text-destructive font-semibold">{alerts.length} incidents</span> in last 120s
            </p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both">
          <div className="lg:col-span-2 transform transition-all duration-300 hover:scale-[1.01]">
            <Heartbeat {...counts} />
          </div>
          <div className="space-y-6">
            <FocusModeToggle />
            <GlobalSafetySwitches />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300 fill-mode-both mt-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-serif text-xl sm:text-2xl">
                {view === "grid" ? "Lab Layout" : "Workstation Registry"}
              </h2>
              <div className="flex items-center gap-3 ml-auto">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground hidden sm:inline">
                  {displayedWorkstations.length}/{workstations.length} nodes
                </span>
                <div className="inline-flex rounded-md border border-border/60 p-0.5 bg-secondary/40">
                  <button
                    onClick={() => setViewPersist("table")}
                    className={`px-2 py-1 rounded font-mono text-[10px] uppercase tracking-widest inline-flex items-center gap-1 transition ${
                      view === "table"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title="Table view"
                  >
                    <List className="w-3 h-3" /> List
                  </button>
                  <button
                    onClick={() => setViewPersist("grid")}
                    className={`px-2 py-1 rounded font-mono text-[10px] uppercase tracking-widest inline-flex items-center gap-1 transition ${
                      view === "grid"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title="Lab Layout — grouped grid"
                  >
                    <LayoutGrid className="w-3 h-3" /> Lab
                  </button>
                </div>
              </div>
            </div>

            {/* Scale toolbar — keeps 40-50+ nodes browsable */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[180px] max-w-md group">
                <div className="absolute inset-0 bg-gradient-to-r from-accent/20 to-amber/20 rounded-xl blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 transition-colors group-focus-within:text-accent" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search node, window, or process…"
                  className="h-10 pl-10 pr-9 text-xs sm:text-sm font-mono bg-background/60 backdrop-blur-md border-border/50 rounded-xl shadow-inner transition-all focus:border-accent/50 focus:ring-2 focus:ring-accent/20 relative z-10"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors z-20"
                    title="Clear"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="inline-flex rounded-md border border-border/60 p-0.5 bg-secondary/40 text-[10px] font-mono uppercase tracking-widest flex-wrap">
                {(["all", "online", "interrupted", "offline"] as const).map((s) => {
                  const count =
                    s === "all"
                      ? workstations.length
                      : workstations.filter((w) => deriveStatus(w.status, w.last_heartbeat) === s)
                          .length;
                  const active = statusFilter === s;
                  const tone =
                    s === "online"
                      ? "text-accent"
                      : s === "interrupted"
                        ? "text-amber"
                        : s === "offline"
                          ? "text-muted-foreground"
                          : "";
                  return (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-2 py-1 rounded transition ${
                        active
                          ? "bg-background shadow-sm text-foreground"
                          : `${tone} hover:text-foreground`
                      }`}
                    >
                      {s} <span className="opacity-60 tabular-nums">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {view === "table" ? (
              <WorkstationTable
                items={displayedWorkstations}
                pulses={pulses}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
            ) : (
              <LabLayout items={displayedWorkstations} pulses={pulses} />
            )}
          </div>
          <div className="space-y-4">
            <div className="paper-elevated rounded-xl p-4 sm:p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
                Compliance Incidents
              </p>
              <p className="font-serif text-4xl sm:text-5xl mt-1">{alerts.length}</p>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                <span className="text-destructive">{violations}</span> policy violations · last 120
              </p>
            </div>
            <ActiveFeed items={workstations} pulses={pulses} />
          </div>
        </div>

        <Terminal alerts={alerts} nodeNames={nodeNames} />
      </div>
      <CriticalIncidentDialog alerts={alerts} nodeNames={nodeNames} />
    </Shell>
  );
}
