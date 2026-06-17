import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Activity, ShieldAlert, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/components/ui/toast";

export const Route = createFileRoute("/settings/audit")({
  component: AuditSettings,
});

function AuditSettings() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("security_audit_logs")
          .select("id, created_at, event_type, ip_address, status")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) throw error;
        setLogs(data || []);
      } catch (err: any) {
        console.error("Failed to fetch audit logs", err);
        toast.error(err.message || "Failed to load security audit log.");
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, [user]);

  const formatDate = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Account Activity</h2>
        <p className="text-sm text-muted-foreground mt-1">Review recent authentication and security events on your account.</p>
      </div>

      <div className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border/50 bg-muted/20 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold">Security Log</h3>
            <p className="text-xs text-muted-foreground">Read-only audit trail of sensitive actions.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/30 border-b border-border/50">
              <tr>
                <th className="px-6 py-3 font-medium">Timestamp</th>
                <th className="px-6 py-3 font-medium">Event</th>
                <th className="px-6 py-3 font-medium">IP Address</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary/50" />
                    <p className="text-sm">Fetching security records...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    <ShieldAlert className="w-6 h-6 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm">No recent security events found.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground font-mono text-xs">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {log.event_type}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                      {log.ip_address || "Unknown"}
                    </td>
                    <td className="px-6 py-4">
                      {log.status === 'success' ? (
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-xs font-medium uppercase tracking-wider">Success</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                          <XCircle className="w-4 h-4" />
                          <span className="text-xs font-medium uppercase tracking-wider">Failure</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t border-border/50 bg-muted/10 text-center">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            If you do not recognize an event, change your password immediately and revoke all active sessions.
          </p>
        </div>
      </div>
    </div>
  );
}
