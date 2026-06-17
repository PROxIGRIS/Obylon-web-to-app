import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { Target } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function FocusModeToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const { role } = useAuth();
  
  // Teachers, Admins, Principals, and Devs can use this. Helpers cannot.
  const isAuthorized = role === "dev" || role === "principal" || role === "admin" || role === "teacher";

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("system_settings").select("focus_mode").eq("id", 1).maybeSingle();
      setEnabled(!!data?.focus_mode);
      setLoading(false);
    };
    load();

    const ch = supabase
      .channel("focus-mode")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "system_settings" }, (p) => {
        setEnabled(!!(p.new as any).focus_mode);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const toggle = async (v: boolean) => {
    if (!isAuthorized) {
        toast.error("You do not have permission to alter app monitoring settings.");
        return;
    }
    
    setEnabled(v);
    const { error } = await supabase.from("system_settings").update({ focus_mode: v }).eq("id", 1);
    if (error) {
      toast.error(error.message);
      setEnabled(!v);
    } else {
      toast.success(v ? "Focus Mode active: Alerting on unapproved apps." : "Focus Mode disabled.");
    }
  };

  return (
    <div 
        className={`relative paper-elevated rounded-xl p-5 sm:p-6 transition-all duration-300 border ${
            enabled 
                ? "bg-accent/5 border-accent/40 shadow-[0_0_15px_rgba(var(--accent),0.05)]" 
                : "bg-background border-border/30"
        }`}
    >
      <div className="flex items-start gap-4">
        {/* Dynamic Icon */}
        <div className={`mt-0.5 p-2.5 rounded-lg border transition-colors ${
            enabled 
                ? "bg-accent/10 border-accent/30 text-accent" 
                : "bg-secondary/40 border-border/40 text-muted-foreground"
        }`}>
            <Target className="w-5 h-5" />
        </div>

        {/* Practical Teacher-Friendly Copy */}
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-foreground">
                Focus Mode Alerts
            </h3>
            <Switch 
                checked={enabled} 
                disabled={loading || !isAuthorized} 
                onCheckedChange={toggle} 
                className={enabled ? "data-[state=checked]:bg-accent" : ""}
            />
          </div>
          
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] mt-1 mb-2 font-medium">
             Status: {enabled ? <span className="text-accent">Active</span> : <span className="text-muted-foreground">Standby</span>}
          </p>
          
          <p className={`text-xs leading-relaxed ${enabled ? "text-foreground/80" : "text-muted-foreground"}`}>
            {enabled 
                ? "Actively logging. If a student opens any application not on your approved list, it will instantly trigger a High-priority alert on your dashboard." 
                : "Computers are not currently flagging unapproved applications."
            }
          </p>
        </div>
      </div>
    </div>
  );
}
