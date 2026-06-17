import { Server } from "lucide-react";
import { useSimpleMode, label } from "@/hooks/use-simple-mode";

type Props = {
  online: number;
  interrupted: number;
  total: number;
};

export function Heartbeat({ online, interrupted, total }: Props) {
  const [simple] = useSimpleMode();
  const live = online > 0;
  const hasIssues = interrupted > 0;
  const offline = Math.max(0, total - online - interrupted);

  // Percentages for the stacked capacity bar
  const onlinePct = total > 0 ? (online / total) * 100 : 0;
  const interruptedPct = total > 0 ? (interrupted / total) * 100 : 0;
  const offlinePct = total > 0 ? (offline / total) * 100 : 0;

  return (
    <div
      className={`paper-elevated rounded-xl p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 border ${
        hasIssues
          ? "border-amber-500/40 bg-amber-500/[0.02]"
          : "border-border/30 bg-background/50"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
            <Server className="w-3.5 h-3.5" />
            {label(simple, "Network Health", "Endpoint Telemetry")}
          </p>
          <h2 className="text-2xl sm:text-3xl font-serif mt-1 tracking-tight text-foreground">
            {live
              ? label(simple, "Lab Online", "Grid Active")
              : label(simple, "Lab Offline", "Signal Lost")}
          </h2>
        </div>

        {/* Status Badge */}
        <div
          className={`px-2.5 py-1 rounded border font-mono text-[10px] uppercase tracking-widest flex items-center gap-1.5 ${
            !live
              ? "bg-secondary/50 border-border/40 text-muted-foreground"
              : hasIssues
              ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
              : "bg-accent/10 border-accent/30 text-accent"
          }`}
        >
          {live && (
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                hasIssues ? "bg-amber-500" : "bg-accent"
              } animate-pulse`}
            />
          )}
          {!live ? "Offline" : hasIssues ? "Degraded" : "Optimal"}
        </div>
      </div>

      {/* Capacity Bar */}
      <div className="h-2.5 w-full bg-secondary/40 rounded-full overflow-hidden flex mb-2">
        {/* Active / Online */}
        <div
          className="h-full bg-accent transition-all duration-700 ease-out"
          style={{ width: `${onlinePct}%` }}
        />
        
        {/* Quiet / Interrupted */}
        <div
          className="h-full bg-amber-500 transition-all duration-700 ease-out"
          style={{ width: `${interruptedPct}%` }}
        />
        
        {/* Dead / Offline — subtle warning */}
        <div
          className="h-full bg-destructive/20 transition-all duration-700 ease-out"
          style={{ width: `${offlinePct}%` }}
        />
      </div>

      {/* Data Matrix */}
      <div className="grid grid-cols-3 gap-2">
        {/* Active */}
        <div className="flex flex-col border-l-2 border-accent/70 pl-3">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            Active
          </span>
          <span className="font-mono text-lg font-medium text-foreground tabular-nums">
            {online}
          </span>
        </div>

        {/* Quiet / Interrupted */}
        <div className="flex flex-col border-l-2 border-amber-500/70 pl-3">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            Quiet
          </span>
          <span className="font-mono text-lg font-medium text-foreground tabular-nums">
            {interrupted}
          </span>
        </div>

        {/* Dead / Offline */}
        <div className="flex flex-col border-l-2 border-muted-foreground/40 pl-3">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            Dead
          </span>
          <span className="font-mono text-lg font-medium text-foreground/80 tabular-nums">
            {offline}
          </span>
        </div>
      </div>
    </div>
  );
}
