import { Link } from "@tanstack/react-router";
import { memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/toast";
import { Lock, Power, AlertTriangle } from "lucide-react";
import { deriveStatus, relativeTime, type WsStatus } from "@/lib/sentinel";

type Workstation = {
  id: string;
  name: string;
  status: "online" | "offline";
  last_heartbeat: string | null;
  current_window: string | null;
  current_process: string | null;
  os_info: any;
};

const statusStyles: Record<WsStatus, { dot: string; ring: string; label: string; tone: string }> = {
  online: { dot: "bg-accent", ring: "border-accent/40", label: "ONLINE", tone: "text-accent" },
  interrupted: { dot: "bg-amber signal-interrupted", ring: "border-amber/40", label: "SIGNAL INTERRUPTED", tone: "text-amber" },
  offline: { dot: "bg-muted-foreground/40", ring: "border-border", label: "OFFLINE", tone: "text-muted-foreground" },
};

const NodeCard = memo(function NodeCard({ w }: { w: Workstation }) {
  const status = deriveStatus(w.status, w.last_heartbeat);
  const s = statusStyles[status];

  const isOffline = status === "offline";
  const issue = async (command: "lock" | "terminate") => {
    if (isOffline) {
      toast.error(`${w.name} is offline — admin actions disabled`);
      return;
    }
    const { error } = await supabase.from("admin_actions").insert({ target_id: w.id, command });
    if (error) toast.error(error.message);
    else toast.success(`${command.toUpperCase()} → ${w.name}`);
  };

  return (
    <div className={`node-card glass rounded-lg p-3 border ${s.ring} ${status === "interrupted" ? "aura aura-spin" : ""}`}>
      <div className="flex items-start gap-2.5">
        <div className="relative mt-1">
          <span className={`block w-2 h-2 rounded-full ${s.dot} ${status === "online" ? "heartbeat-dot" : ""}`} />
          {status === "online" && <span className="absolute inset-0 rounded-full border border-accent pulse-ring" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate leading-tight">{w.name}</p>
          <p className={`font-mono text-[9px] uppercase tracking-widest ${s.tone}`}>{s.label}</p>
        </div>
      </div>

      <div className="mt-2.5 min-h-[34px]">
        {w.current_window ? (
          <>
            <p className="text-xs truncate text-foreground/90" title={w.current_window}>
              {w.current_window}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground truncate">
              {w.current_process ?? "—"}
            </p>
          </>
        ) : (
          <p className="font-mono text-[10px] text-muted-foreground italic">no foreground signal</p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="font-mono text-[9px] text-muted-foreground/70">{relativeTime(w.last_heartbeat)}</span>
        <div className="flex gap-1">
          <button
            onClick={() => issue("lock")}
            disabled={isOffline}
            className="p-1.5 rounded hover:bg-secondary transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            title={isOffline ? "Offline — disabled" : "Lock"}
          >
            <Lock className="w-3 h-3" />
          </button>
          <button
            onClick={() => issue("terminate")}
            disabled={isOffline}
            className="p-1.5 rounded hover:bg-destructive/30 text-destructive transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            title={isOffline ? "Offline — disabled" : "Terminate"}
          >
            <Power className="w-3 h-3" />
          </button>
          <Link
            to="/case/$id"
            params={{ id: w.id }}
            search={{ incidentId: undefined }}
            className="p-1.5 rounded hover:bg-secondary transition text-muted-foreground hover:text-foreground"
            title="Open dossier"
          >
            <AlertTriangle className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
});

export function WorkstationGrid({ items }: { items: Workstation[] }) {
  if (items.length === 0) {
    return (
      <div className="glass rounded-xl p-12 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          No workstations enrolled
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Run the Python sentinel agent on a lab machine to enroll.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((w) => (
        <NodeCard key={w.id} w={w} />
      ))}
    </div>
  );
}
