import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSimpleMode } from "@/hooks/use-simple-mode";
import { Shell } from "@/components/sentinel/Shell";
import { SimpleCaseDossier } from "@/components/sentinel/simple/SimpleCaseDossier";
import {
  ChevronLeft,
  Camera,
  Keyboard,
  AlertTriangle,
  Pencil,
  ShieldCheck,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import { deriveStatus, relativeTime } from "@/lib/sentinel";

// 1. Hook into TanStack's search parameters to catch the incidentId
export const Route = createFileRoute("/case/$id")({
  validateSearch: (search: Record<string, unknown>) => ({
    incidentId: (search.incidentId as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Forensic Dossier · Nexus Sentinel" },
      { name: "description", content: "Audit dossier for a monitored workstation." },
    ],
  }),
  component: ForensicDossier,
});

type Workstation = any;
type Alert = {
  id: string;
  process_name: string | null;
  window_title: string | null;
  severity: "info" | "warning" | "medium" | "critical" | "high";
  timestamp: string;
};
type Evidence = {
  id: string;
  alert_id: string | null;
  screenshot_url: string | null;
  webcam_url: string | null;
  metadata: any;
  created_at: string;
};

function Typewriter({ text }: { text: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    const t = setInterval(() => {
      setI((v) => {
        if (v >= text.length) {
          clearInterval(t);
          return v;
        }
        return v + 1;
      });
    }, 35);
    return () => clearInterval(t);
  }, [text]);
  return (
    <span className="caret font-mono text-sm leading-relaxed whitespace-pre-wrap">
      {text.slice(0, i)}
    </span>
  );
}

const sevStyle: Record<Alert["severity"], string> = {
  info: "text-muted-foreground border-border",
  warning: "text-amber border-amber/40",
  medium: "text-amber border-amber/40",
  critical: "text-destructive border-destructive/50",
  high: "text-destructive border-destructive/50",
};

function ForensicDossier() {
  const { id } = Route.useParams();
  const { incidentId } = Route.useSearch(); // 2. Extract the payload
  const { isAdmin, role, loading } = useAuth();
  const [simple] = useSimpleMode();

  const [ws, setWs] = useState<Workstation | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [selected, setSelected] = useState<Alert | null>(null);

  const [renameOpen, setRenameOpen] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [showAllIncidents, setShowAllIncidents] = useState(false); // Mobile scroll fix

  const reqIdRef = React.useRef(0);

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      const reqId = ++reqIdRef.current;
      const [w, a] = await Promise.all([
        supabase.from("workstations").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("alerts")
          .select("*")
          .eq("workstation_id", id)
          .order("timestamp", { ascending: false })
          .limit(60),
      ]);

      if (reqId !== reqIdRef.current) return;

      setWs(w.data);
      const fetchedAlerts = (a.data as Alert[]) ?? [];
      setAlerts(fetchedAlerts);

      if (fetchedAlerts.length > 0) {
        // 3. Pinpoint the exact alert via URL, fallback to latest
        const targetAlert = fetchedAlerts.find((alert) => alert.id === incidentId);
        setSelected(targetAlert || fetchedAlerts[0]);
      }
    };
    load();

    const ch = supabase
      .channel(`dossier-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "workstations", filter: `id=eq.${id}` },
        (p) => setWs((prev: any) => ({ ...(prev ?? {}), ...(p.new as any) })),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "admin_actions", filter: `target_id=eq.${id}` },
        (p) => {
          const row = p.new as { id: string; status: string; command: string };
          if (pendingActionId && row.id === pendingActionId) {
            if (row.status === "acknowledged") {
              toast.success("Workstation renamed");
              setPendingActionId(null);
            } else if (row.status === "failed" || row.status === "expired") {
              toast.error(`Rename ${row.status}`);
              setPendingActionId(null);
            }
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, isAdmin, pendingActionId, incidentId]);

  const submitRename = async () => {
    const newName = draftName.trim();
    if (!newName) return;
    if (ws && deriveStatus(ws.status, ws.last_heartbeat) === "offline") {
      toast.error(`${ws.name} is offline — admin actions disabled`);
      return;
    }
    const { data, error } = await supabase
      .from("admin_actions")
      .insert({
        target_id: id,
        command: "set_alias" as never,
        metadata: { new_name: newName },
      } as never)
      .select("id")
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Failed to dispatch rename");
      return;
    }
    setPendingActionId(data.id);
    setRenameOpen(false);
    toast("Rename dispatched · awaiting agent acknowledgement");
  };

  useEffect(() => {
    if (!selected) {
      setEvidence([]);
      return;
    }
    supabase
      .from("evidence_logs")
      .select("*")
      .eq("alert_id", selected.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setEvidence((data as Evidence[]) ?? []));
  }, [selected]);

  if (loading)
    return (
      <Shell>
        <div className="p-12 text-center font-mono text-xs">loading…</div>
      </Shell>
    );
  if (!isAdmin)
    return (
      <Shell>
        <div className="p-12 text-center text-muted-foreground">Admin clearance required.</div>
      </Shell>
    );
  if (!ws)
    return (
      <Shell>
        <div className="p-12 text-center text-muted-foreground">Dossier not found.</div>
      </Shell>
    );

  const status = deriveStatus(ws.status, ws.last_heartbeat);
  const evWithKeys = evidence.find((e) => e.metadata?.retrospective_payload || e.metadata?.payload);
  const keystrokes =
    (evWithKeys?.metadata?.retrospective_payload ||
      (evWithKeys?.metadata?.payload as string | undefined)) ??
    "";
  const webcam = evidence.find((e) => e.webcam_url)?.webcam_url;
  const screenshot = evidence.find((e) => e.screenshot_url)?.screenshot_url;

  // Calculate visible incidents (first 5 or all)
  const visibleAlerts = showAllIncidents ? alerts : alerts.slice(0, 5);

  if (simple) {
    return (
      <Shell>
        <SimpleCaseDossier
          ws={ws}
          alerts={alerts}
          evidence={evidence}
          selected={selected}
          setSelected={setSelected}
          visibleAlerts={visibleAlerts}
          showAllIncidents={showAllIncidents}
          setShowAllIncidents={setShowAllIncidents}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-8 pb-12 space-y-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Return to Grid
        </Link>

        {/* Header Block */}
        <header className="glass-strong rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-muted-foreground">
                Forensic Dossier · {status.toUpperCase()}
              </p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <h1 className="font-serif text-3xl sm:text-5xl leading-none truncate">{ws.name}</h1>
                {ws.alias_verified && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-accent-foreground/90 shrink-0"
                    title="Identity Verified — alias persisted on host"
                  >
                    <ShieldCheck className="w-3 h-3" /> Identity Verified
                  </span>
                )}
              </div>
              <p className="font-mono text-[11px] sm:text-xs text-muted-foreground mt-2">
                {ws.os_info?.platform ?? "—"} {ws.os_info?.release ?? ""} · last heartbeat{" "}
                {relativeTime(ws.last_heartbeat)}
              </p>
              {ws.current_window && (
                <p className="mt-3 text-sm text-foreground/80 break-words leading-relaxed">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mr-2 hidden sm:inline">
                    Foreground
                  </span>
                  <span className="font-medium text-foreground">{ws.current_window}</span>
                  <span className="text-muted-foreground ml-1.5 hidden sm:inline">
                    · {ws.current_process}
                  </span>
                </p>
              )}
            </div>
            <div className="shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
              {pendingActionId ? (
                <div className="inline-flex w-full justify-center sm:w-auto items-center gap-2 rounded-md border border-amber/40 bg-amber/10 px-3 py-2 text-xs font-mono uppercase tracking-widest text-amber">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Pending ack
                </div>
              ) : !renameOpen ? (
                <button
                  onClick={() => {
                    setDraftName(ws.name ?? "");
                    setRenameOpen(true);
                  }}
                  disabled={status === "offline" || (role !== "principal" && role !== "dev")}
                  title={
                    status === "offline"
                      ? "Offline — admin actions disabled"
                      : role !== "principal" && role !== "dev"
                        ? "Unauthorized"
                        : "Rename"
                  }
                  className={`inline-flex w-full justify-center sm:w-auto items-center gap-1.5 rounded-md border border-border/60 bg-background/40 backdrop-blur px-3 py-2 text-xs font-mono uppercase tracking-widest hover:bg-secondary transition ${role !== "principal" && role !== "dev" ? "hidden" : "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-background/40"}`}
                >
                  <Pencil className="w-3.5 h-3.5" /> Rename node
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitRename();
                      if (e.key === "Escape") setRenameOpen(false);
                    }}
                    placeholder="Workstation-01"
                    className="w-full sm:w-44 rounded-md border border-border/60 bg-background/60 px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-accent/60"
                  />
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={submitRename}
                      disabled={!draftName.trim()}
                      className="flex-1 sm:flex-none rounded-md bg-foreground text-background px-3 py-1.5 text-xs font-mono uppercase tracking-widest disabled:opacity-40"
                    >
                      Push
                    </button>
                    <button
                      onClick={() => setRenameOpen(false)}
                      className="flex-1 sm:flex-none rounded-md border border-border/60 px-2 py-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 4. flex-col-reverse forces the selected evidence above the incident list on mobile */}
        <div className="flex flex-col-reverse lg:grid lg:grid-cols-[320px_minmax(0,1fr)] gap-6">
          {/* Incident timeline (List) */}
          <div className="glass-strong rounded-xl overflow-hidden shadow-sm h-fit">
            <div className="parchment-strip px-4 py-3 border-b border-border/40">
              <h3 className="font-serif text-lg">Trace History</h3>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {alerts.length} events archived
              </p>
            </div>
            <div className="max-h-[600px] overflow-y-auto divide-y divide-border/40 custom-scrollbar">
              {alerts.length === 0 && (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">Clean record.</p>
              )}

              {visibleAlerts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className={`w-full text-left px-4 py-3.5 hover:bg-secondary/40 transition group ${selected?.id === a.id ? "bg-secondary/60" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`font-mono text-[9px] uppercase tracking-widest border rounded px-1.5 py-0.5 ${sevStyle[a.severity]}`}
                    >
                      {a.severity}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                      {relativeTime(a.timestamp)}
                    </span>
                  </div>
                  <p
                    className={`text-[13px] mt-2 truncate ${selected?.id === a.id ? "text-foreground font-medium" : "text-foreground/80 group-hover:text-foreground"}`}
                  >
                    {a.window_title ?? a.process_name ?? "Activity Logged"}
                  </p>
                  {a.process_name && (
                    <p className="font-mono text-[10px] text-muted-foreground/70 truncate mt-1">
                      {a.process_name}
                    </p>
                  )}
                </button>
              ))}

              {/* Pagination toggle to protect mobile scroll */}
              {!showAllIncidents && alerts.length > 5 && (
                <button
                  onClick={() => setShowAllIncidents(true)}
                  className="w-full text-center px-4 py-4 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary/20 transition flex items-center justify-center gap-1.5"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  Load all {alerts.length} incidents
                </button>
              )}
            </div>
          </div>

          {/* Forensic detail (Evidence view) */}
          <div className="space-y-4">
            {selected ? (
              <>
                <div
                  className={`glass-strong rounded-xl p-5 sm:p-6 border ${sevStyle[selected.severity]} shadow-sm`}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground truncate">
                        {new Date(selected.timestamp).toLocaleString()}
                      </p>
                      <h2 className="font-serif text-2xl sm:text-3xl mt-1 break-words">
                        {selected.severity.toUpperCase()} VIOLATION
                      </h2>
                    </div>
                  </div>
                  <div className="mt-5 grid sm:grid-cols-2 gap-3 text-sm">
                    <div className="bg-background/40 rounded-lg p-3 sm:p-4 border border-border/20">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">
                        Process Target
                      </p>
                      <p className="font-mono text-xs break-all text-foreground/90">
                        {selected.process_name ?? "—"}
                      </p>
                    </div>
                    <div className="bg-background/40 rounded-lg p-3 sm:p-4 border border-border/20">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">
                        Active Window
                      </p>
                      <p className="text-[13px] break-words text-foreground/90 leading-snug">
                        {selected.window_title ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Keystroke audit */}
                <div className="glass-strong rounded-xl overflow-hidden shadow-sm">
                  <div className="parchment-strip px-4 py-3 flex items-center gap-2 border-b border-border/40">
                    <Keyboard className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-serif text-lg">Retrospective Telemetry</h3>
                    <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground hidden sm:block">
                      forensic audit
                    </span>
                  </div>

                  <div className="terminal-scanlines bg-black/50 p-4 sm:p-5 min-h-[120px] max-h-[300px] overflow-y-auto custom-scrollbar">
                    {keystrokes ? (
                      <Typewriter text={keystrokes} />
                    ) : (
                      <p className="font-mono text-xs text-muted-foreground italic flex items-center justify-center h-full opacity-60">
                        [ No keystroke array captured in this timeframe ]
                      </p>
                    )}
                  </div>
                </div>

                {/* Visual capture */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="glass-strong rounded-xl overflow-hidden shadow-sm">
                    <div className="parchment-strip px-4 py-3 flex items-center gap-2 border-b border-border/40">
                      <Camera className="w-4 h-4 text-muted-foreground" />
                      <h3 className="font-serif text-lg truncate">Screen Capture</h3>
                    </div>
                    <div className="aspect-video bg-black/60 flex items-center justify-center relative group">
                      {screenshot ? (
                        <a
                          href={screenshot}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full h-full cursor-zoom-in"
                        >
                          <img
                            src={screenshot}
                            alt="Screen capture evidence"
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                          />
                        </a>
                      ) : (
                        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground opacity-50">
                          Null payload
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="glass-strong rounded-xl overflow-hidden shadow-sm">
                    <div className="parchment-strip px-4 py-3 flex items-center gap-2 border-b border-border/40">
                      <Camera className="w-4 h-4 text-muted-foreground" />
                      <h3 className="font-serif text-lg truncate">Identity Check</h3>
                    </div>
                    <div className="aspect-video bg-black/60 flex items-center justify-center relative group">
                      {webcam ? (
                        <a
                          href={webcam}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full h-full cursor-zoom-in"
                        >
                          <img
                            src={webcam}
                            alt="Identity verification capture"
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                          />
                        </a>
                      ) : (
                        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground opacity-50">
                          Null payload
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="glass-strong rounded-xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
                <AlertTriangle className="w-8 h-8 text-muted-foreground/30 mb-3" />
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                  Select an incident to mount dossier data.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
