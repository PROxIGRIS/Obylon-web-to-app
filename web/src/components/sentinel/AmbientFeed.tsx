import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";
import { relativeTime } from "@/lib/sentinel";

type Activity = {
  id: string;
  workstation_id: string | null;
  process_name: string | null;
  window_title: string | null;
  severity: "info" | "warning";
  is_anomaly: boolean;
  created_at: string;
};

export function AmbientFeed({ nodeNames }: { nodeNames?: Map<string, string> }) {
  const [items, setItems] = useState<Activity[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase as any)
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80);
      setItems((data as Activity[]) ?? []);
    };
    load();
    const ch = supabase
      .channel("ambient-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_logs" },
        (p) => {
          setItems((prev) => [p.new as Activity, ...prev].slice(0, 80));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <div className="glass-strong rounded-xl overflow-hidden">
      <div className="parchment-strip px-4 py-3 flex items-baseline justify-between">
        <h3 className="font-serif text-lg">Ambient Activity</h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          archive · {items.length}
        </span>
      </div>
      <div className="max-h-[360px] overflow-y-auto py-1">
        {items.length === 0 && (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            No background activity yet.
          </p>
        )}
        {items.map((a) => {
          const node = a.workstation_id ? nodeNames?.get(a.workstation_id) : null;
          const warn = a.severity === "warning";
          return (
            <div
              key={a.id}
              className={`px-4 py-1.5 font-mono text-[11px] flex items-center gap-2 ${
                warn ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {a.is_anomaly && (
                <AlertTriangle className="w-3 h-3 text-accent shrink-0" />
              )}
              <span className="text-muted-foreground/80 shrink-0">
                {relativeTime(a.created_at)}
              </span>
              <span className="text-accent shrink-0">
                [{node ?? "unknown"}]
              </span>
              <span className="truncate" title={a.window_title ?? ""}>
                {a.process_name ?? "—"}
                {a.window_title ? ` · ${a.window_title}` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
