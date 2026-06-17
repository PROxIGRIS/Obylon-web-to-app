import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert, Check, X, AlertCircle, FileText } from "lucide-react";
import { Shell } from "@/components/sentinel/Shell";

export const Route = createFileRoute("/appeals")({
  head: () => ({
    meta: [{ title: "Appeals · Obylon" }],
  }),
  component: AppealsPage,
});

type Appeal = {
  id: string;
  user_id: string;
  reason: string;
  created_at: string;
  profiles: { display_name: string; email: string };
};

function AppealsPage() {
  const { role, loading } = useAuth();
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [fetching, setFetching] = useState(true);

  const canAccess = role === "dev" || role === "admin" || role === "principal";

  const reqIdRef = React.useRef(0);

  const fetchAppeals = async () => {
    const reqId = ++reqIdRef.current;
    setFetching(true);
    const { data: appealsData, error: appealsError } = await supabase
      .from("unban_requests" as any)
      .select(`id, user_id, reason, created_at`)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (reqId !== reqIdRef.current) return;

    if (!appealsError && appealsData) {
      const userIds = appealsData.map((a: any) => a.user_id);
      let profilesMap: Record<string, {display_name: string; email: string}> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, display_name, email")
          .in("user_id", userIds);
        
        if (reqId !== reqIdRef.current) return;

        if (profilesData) {
          profilesData.forEach((p: any) => {
            profilesMap[p.user_id] = { display_name: p.display_name || "Unknown", email: p.email || "Unknown" };
          });
        }
      }

      const enhancedAppeals = appealsData.map((a: any) => ({
        ...a,
        profiles: profilesMap[a.user_id] || { display_name: "Unknown Identity", email: "Unknown" }
      }));
      setAppeals(enhancedAppeals as any[]);
    } else if (appealsError) {
      toast.error("Failed to load appeals: " + appealsError.message);
    }
    setFetching(false);
  };

  useEffect(() => {
    if (!loading && canAccess) {
      fetchAppeals();

      const channel = supabase.channel('appeals_page')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'unban_requests', filter: "status=eq.pending" }, () => {
          fetchAppeals();
        })
        .subscribe();
      return () => { supabase.removeChannel(channel) };
    }
  }, [loading, canAccess]);

  if (loading) return null;
  
  if (!canAccess) {
    return (
      <Shell>
        <div className="flex h-full items-center justify-center">
          <div className="text-center space-y-4">
            <ShieldAlert className="w-12 h-12 text-destructive mx-auto signal-interrupted" />
            <h2 className="text-xl font-mono uppercase tracking-widest text-destructive">Access Denied</h2>
          </div>
        </div>
      </Shell>
    );
  }

  const handleAction = async (appealId: string, userId: string, action: "approve" | "reject") => {
    try {
      if (action === "approve") {
        const { data, error } = await supabase.from("profiles").update({ is_banned: false } as any).eq("user_id", userId).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error("Permission denied or target not found (RLS silent failure)");
        
        await supabase.from("banned_users").delete().eq("user_id", userId);
        await supabase.from("unban_requests" as any).delete().eq("user_id", userId);
        toast.success("Appeal approved. User unbanned.");
      } else {
        await supabase.from("unban_requests" as any).update({ status: "rejected" }).eq("id", appealId);
        toast.success("Appeal rejected.");
      }
      fetchAppeals();
    } catch (err: any) {
      toast.error("Failed to process appeal: " + err.message);
    }
  };

  return (
    <Shell>
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 px-4 py-8">
        <div className="flex items-end justify-between border-b border-border/40 pb-6 mb-8">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber/10 border border-amber/20 rounded-full text-amber text-[10px] font-mono uppercase tracking-widest">
              <AlertCircle className="w-3 h-3 heartbeat-dot" />
              High Priority Alerts
            </div>
            <h1 className="text-4xl font-serif tracking-tight text-foreground">Pending Appeals</h1>
            <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest max-w-xl">
              Dossier files for revoked identities awaiting administrative review.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {fetching ? (
            <div className="p-12 flex justify-center glass rounded-xl border border-border/40">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/50" />
            </div>
          ) : appeals.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center glass rounded-xl border border-border/40">
              <div className="w-16 h-16 rounded-full border border-border/40 bg-background/50 flex items-center justify-center mb-6">
                <FileText className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <h3 className="text-xl font-serif font-medium mb-2 text-foreground/80">No Pending Appeals</h3>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
                The terminal is quiet. No dossiers require review.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {appeals.map((a) => (
                <div key={a.id} className="relative group overflow-hidden paper-texture rounded-xl border border-border/60 transition-all hover:border-accent/40">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-amber to-amber/30" />
                  
                  <div className="p-6 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center relative z-10 pl-8">
                    <div className="space-y-4 flex-1 w-full min-w-0">
                      
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-serif text-2xl font-medium text-foreground truncate">
                          {a.profiles?.display_name || "Unknown Identity"}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono bg-background/50 border border-border/40 px-2.5 py-1 rounded-sm">
                          {a.profiles?.email}
                        </span>
                        <span className="text-[10px] uppercase tracking-widest text-amber font-mono bg-amber/10 px-2 py-0.5 rounded-sm border border-amber/20">
                          Review Required
                        </span>
                      </div>

                      <div className="text-sm p-4 rounded-md bg-background/40 border-l-2 border-border/50 text-foreground/90 font-mono relative">
                        <div className="absolute -left-[9px] top-4 w-4 h-4 rounded-full bg-background border-2 border-border flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber/60" />
                        </div>
                        <p className="italic opacity-80 mb-2 text-xs uppercase tracking-widest text-muted-foreground">User Statement:</p>
                        "{a.reason}"
                      </div>
                      
                      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono flex items-center gap-2">
                        <span>Submitted</span>
                        <span className="w-1 h-1 bg-muted-foreground/30 rounded-full" />
                        <span className="text-foreground/70">{new Date(a.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex md:flex-col items-center gap-3 w-full md:w-40 shrink-0">
                      <Button 
                        className="w-full h-10 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 border border-emerald-600/30 transition-colors font-mono uppercase text-[11px] tracking-widest"
                        onClick={() => handleAction(a.id, a.user_id, "approve")}
                      >
                        <Check className="w-3.5 h-3.5 mr-2" />
                        Approve
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full h-10 border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors font-mono uppercase text-[11px] tracking-widest"
                        onClick={() => handleAction(a.id, a.user_id, "reject")}
                      >
                        <X className="w-3.5 h-3.5 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
