import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Camera,
  ChevronLeft,
  ChevronDown,
  FileText,
  Keyboard,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { deriveStatus, relativeTime } from "@/lib/sentinel";

type Workstation = {
  id: string;
  name: string;
  status: "online" | "offline";
  last_heartbeat: string | null;
  current_window: string | null;
  current_process?: string | null;
  alias_verified?: boolean | null;
};
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
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const severityClass: Record<Alert["severity"], string> = {
  info: "border-border text-muted-foreground",
  warning: "border-amber/50 text-amber",
  medium: "border-amber/50 text-amber",
  high: "border-destructive/50 text-destructive",
  critical: "border-destructive/50 text-destructive",
};

export function SimpleCaseDossier({
  ws,
  alerts,
  evidence,
  selected,
  setSelected,
  visibleAlerts,
  showAllIncidents,
  setShowAllIncidents,
}: {
  ws: Workstation;
  alerts: Alert[];
  evidence: Evidence[];
  selected: Alert | null;
  setSelected: (alert: Alert) => void;
  visibleAlerts: Alert[];
  showAllIncidents: boolean;
  setShowAllIncidents: (value: boolean) => void;
}) {
  const status = deriveStatus(ws.status, ws.last_heartbeat);
  const evWithKeys = evidence.find((e) => e.metadata?.retrospective_payload || e.metadata?.payload);
  const rawKeystrokes =
    evWithKeys?.metadata?.retrospective_payload || evWithKeys?.metadata?.payload;
  const keystrokes = typeof rawKeystrokes === "string" ? rawKeystrokes : "";
  const webcam = evidence.find((e) => e.webcam_url)?.webcam_url;
  const screenshot = evidence.find((e) => e.screenshot_url)?.screenshot_url;

  return (
    <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-14 space-y-5">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Back to simple dashboard
      </Link>

      <header className="paper-elevated rounded-2xl p-5 sm:p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
          Simple Case Review
        </p>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mt-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="font-serif text-3xl sm:text-4xl truncate">{ws.name}</h1>
              {ws.alias_verified && <ShieldCheck className="w-5 h-5 text-accent shrink-0" />}
            </div>
            <p className="font-mono text-xs text-muted-foreground mt-2">
              {status} · last seen {relativeTime(ws.last_heartbeat)}
            </p>
            <p className="text-sm text-muted-foreground mt-3 break-words">
              {ws.current_window ?? "No foreground signal"}
            </p>
          </div>
          <div className="rounded-xl border border-border/40 bg-background/50 px-4 py-3 min-w-[150px]">
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              Incidents
            </p>
            <p className="font-serif text-3xl">{alerts.length}</p>
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="paper-elevated rounded-2xl overflow-hidden h-fit">
          <div className="parchment-strip px-5 py-3">
            <h2 className="font-serif text-xl">Incident Timeline</h2>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {alerts.length} archived
            </p>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {alerts.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Clean record.</p>
            )}
            {visibleAlerts.map((alert) => (
              <button
                key={alert.id}
                onClick={() => setSelected(alert)}
                className={`w-full text-left border-b border-border/30 px-5 py-4 hover:bg-secondary/35 transition ${
                  selected?.id === alert.id ? "bg-secondary/50" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-mono text-[9px] uppercase tracking-widest border rounded-full px-2 py-0.5 ${severityClass[alert.severity]}`}
                  >
                    {alert.severity}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {relativeTime(alert.timestamp)}
                  </span>
                </div>
                <p className="text-sm font-medium mt-2 truncate">
                  {alert.window_title ?? alert.process_name ?? "Activity logged"}
                </p>
                {alert.process_name && (
                  <p className="font-mono text-[10px] text-muted-foreground mt-1 truncate">
                    {alert.process_name}
                  </p>
                )}
              </button>
            ))}
            {!showAllIncidents && alerts.length > 5 && (
              <button
                onClick={() => setShowAllIncidents(true)}
                className="w-full px-5 py-4 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary/25 flex items-center justify-center gap-1.5"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                Load all incidents
              </button>
            )}
          </div>
        </aside>

        <main className="space-y-5">
          {selected ? (
            <>
              <div
                className={`paper-elevated rounded-2xl p-5 sm:p-6 border ${severityClass[selected.severity]}`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 mt-1 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                      {new Date(selected.timestamp).toLocaleString()}
                    </p>
                    <h2 className="font-serif text-2xl sm:text-3xl mt-1">
                      {selected.severity.toUpperCase()} Incident
                    </h2>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/40 bg-background/50 p-4">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                      Process
                    </p>
                    <p className="font-mono text-xs mt-2 break-all">
                      {selected.process_name ?? "-"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-background/50 p-4">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                      Window
                    </p>
                    <p className="text-sm mt-2 break-words">{selected.window_title ?? "-"}</p>
                  </div>
                </div>
              </div>

              <div className="paper-elevated rounded-2xl overflow-hidden">
                <div className="parchment-strip px-5 py-3 flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-muted-foreground" />
                  <h2 className="font-serif text-xl">Captured Text</h2>
                </div>
                <div className="terminal-scanlines p-5 min-h-[130px] max-h-[280px] overflow-y-auto">
                  {keystrokes ? (
                    <pre className="font-mono text-xs whitespace-pre-wrap">{keystrokes}</pre>
                  ) : (
                    <p className="font-mono text-xs text-muted-foreground">
                      No keystroke evidence captured.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <EvidencePanel
                  title="Screen Capture"
                  icon={Camera}
                  url={screenshot}
                  alt="Screen capture evidence"
                />
                <EvidencePanel
                  title="Identity Check"
                  icon={Camera}
                  url={webcam}
                  alt="Identity verification capture"
                />
              </div>
            </>
          ) : (
            <div className="paper-elevated rounded-2xl p-12 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto opacity-40" />
              <p className="text-sm mt-3">Select an incident to review evidence.</p>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}

function EvidencePanel({
  title,
  icon: Icon,
  url,
  alt,
}: {
  title: string;
  icon: LucideIcon;
  url?: string | null;
  alt: string;
}) {
  return (
    <div className="paper-elevated rounded-2xl overflow-hidden">
      <div className="parchment-strip px-5 py-3 flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-serif text-xl truncate">{title}</h2>
      </div>
      <div className="aspect-video bg-black/70 flex items-center justify-center">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="w-full h-full">
            <img src={url} alt={alt} className="w-full h-full object-cover" />
          </a>
        ) : (
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            No capture
          </p>
        )}
      </div>
    </div>
  );
}
