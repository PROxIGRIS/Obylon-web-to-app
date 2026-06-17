import { Link } from "@tanstack/react-router";
import { memo, useCallback, useMemo } from "react";
import { ShieldCheck, Lock, Power, FileSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/toast";
import { deriveStatus, naturalCompare, labGroupKey, relativeTime, type WsStatus } from "@/lib/sentinel";
import type { Workstation } from "./WorkstationTable";

/**
 * ENHANCED & OPTIMIZED FOR 40-50+ WORKSTATIONS
 * - GlassCard is now React.memo'd → no more pointless re-renders when data updates (this was your lag culprit, genius)
 * - Issue handler is useCallback'd and stable
 * - Grid tuned to minmax(210px, 1fr) so 50 cards don't look like a sad spreadsheet
 * - Smoother, lighter animations (less GPU-melting box-shadow spam)
 * - Premium glassmorphism with deeper blur + inner glow
 * - Better typography, spacing, hover feedback
 * - Still zero bloat. Scales like a boss.
 */

const ringByStatus: Record<WsStatus, string> = {
  online: "ring-accent/50 shadow-[0_0_24px_-8px_hsl(var(--accent)/0.6)]",
  interrupted: "ring-amber/60 shadow-[0_0_28px_-6px_hsl(var(--amber)/0.55)] signal-interrupted",
  offline: "ring-border/40",
};

const dotByStatus: Record<WsStatus, string> = {
  online: "bg-accent",
  interrupted: "bg-amber",
  offline: "bg-muted-foreground/40",
};

const GlassCard = memo(function GlassCard({
  w,
  pulse,
}: {
  w: Workstation & { alias_verified?: boolean };
  pulse: "none" | "info" | "violation";
}) {
  const status = deriveStatus(w.status, w.last_heartbeat);
  const isOffline = status === "offline";

  const handleIssue = useCallback(async (command: "lock" | "terminate") => {
    if (isOffline) {
      toast.error(`${w.name} is offline — admin actions disabled`);
      return;
    }
    const { error } = await supabase.from("admin_actions").insert({ target_id: w.id, command });
    if (error) toast.error(error.message);
    else toast.success(`${command.toUpperCase()} → ${w.name}`);
  }, [w.id, w.name, isOffline]);

  const pulseRing = pulse === "violation" 
    ? "signal-glow-violation" 
    : pulse === "info" 
      ? "signal-glow" 
      : "";

  return (
    <div
      className={`group relative rounded-2xl p-3 ring-1 ${ringByStatus[status]} ${pulseRing}
        backdrop-blur-2xl bg-[color-mix(in_oklab,var(--card)_75%,transparent)]
        transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:ring-offset-2
        border border-white/10`}
    >
      {/* Status header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${dotByStatus[status]} ring-1 ring-offset-2 ring-offset-card`} />
            <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-muted-foreground font-medium">
              {status}
            </p>
          </div>
          <p className="font-serif text-base leading-tight mt-1 truncate font-semibold" title={w.name}>
            {w.name}
          </p>
        </div>

        {w.alias_verified && (
          <span
            className="shrink-0 inline-flex items-center gap-1 rounded-3xl border border-accent/30 bg-accent/10 px-3 py-px text-[10px] font-mono uppercase tracking-widest text-accent-foreground/90"
            title="Identity Verified — alias persisted on host"
          >
            <ShieldCheck className="w-3 h-3" />
            verified
          </span>
        )}
      </div>

      {/* Current activity */}
      <div className="mt-4 space-y-1">
        <p
          className="text-sm text-foreground/90 line-clamp-2 min-h-[2.5rem] font-medium"
          title={w.current_window ?? ""}
        >
          {w.current_window ?? <span className="italic text-muted-foreground">no signal</span>}
        </p>
        <p className="font-mono text-xs text-muted-foreground truncate">
          {w.current_process ?? "—"}
        </p>
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {relativeTime(w.last_heartbeat)}
        </span>

        {/* Floating action bar - appears on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 scale-95 group-hover:scale-100">
          <button
            onClick={() => handleIssue("lock")}
            disabled={isOffline}
            className="p-2.5 rounded-2xl hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={isOffline ? "Offline — disabled" : "Lock workstation"}
          >
            <Lock className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleIssue("terminate")}
            disabled={isOffline}
            className="p-2.5 rounded-2xl hover:bg-destructive/15 text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={isOffline ? "Offline — disabled" : "Terminate session"}
          >
            <Power className="w-4 h-4" />
          </button>
          <Link
            to="/case/$id"
            params={{ id: w.id }}
            search={{ incidentId: undefined }}
            className="p-2.5 rounded-2xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Open full dossier"
          >
            <FileSearch className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
});

export const LabLayout = memo(function LabLayout({
  items,
  pulses,
}: {
  items: (Workstation & { alias_verified?: boolean })[];
  pulses: Map<string, "info" | "violation">;
}) {
  const groups = useMemo(() => {
    const m = new Map<string, (Workstation & { alias_verified?: boolean })[]>();
    for (const w of items) {
      const k = labGroupKey(w.name);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(w);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => naturalCompare(a.name, b.name));
    }
    return [...m.entries()].sort(([a], [b]) => naturalCompare(a, b));
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="paper-elevated rounded-3xl p-16 text-center border border-white/5">
        <p className="font-mono text-xs uppercase tracking-[0.4em] text-muted-foreground">
          No workstations enrolled yet. 
          <br />
          <span className="text-foreground/70">Go recruit some PCs, champ.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {groups.map(([label, ws]) => (
        <section key={label}>
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-serif text-2xl tracking-tight">{label}</h3>
            <span className="font-mono text-xs uppercase tracking-[0.4em] text-muted-foreground bg-secondary/50 px-3 py-1 rounded-3xl">
              {ws.length} node{ws.length === 1 ? "" : "s"}
            </span>
          </div>
          {/* Tuned grid for 40-50 cards without looking like a dumpster fire */}
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
            {ws.map((w) => (
              <GlassCard key={w.id} w={w} pulse={pulses.get(w.id) ?? "none"} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
});
