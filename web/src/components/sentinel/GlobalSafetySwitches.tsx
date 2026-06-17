import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ShieldAlert, ShieldCheck, Shield, AlertTriangle, Check, Info } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

type SafetyMode = "log_only" | "strict" | "full";

interface ModeConfig {
  label: string;
  description: string;
  icon: React.ReactNode;
  activeBorder: string;
  iconActive: string;
}

// Stripped of theatrical fluff. Pure, practical SaaS copy.
const MODE_CONFIG: Record<SafetyMode, ModeConfig> = {
  log_only: {
    label: "Audit Mode",
    description: "Logs violations silently. Warden hardware freezing is completely disabled for baseline testing.",
    icon: <ShieldAlert className="w-4 h-4" />,
    activeBorder: "border-amber-500/50 bg-amber-500/5",
    iconActive: "text-amber-500",
  },
  strict: {
    label: "Strict Mode",
    description: "Requires 99.9% match confidence to freeze hardware. Designed to minimize false positives.",
    icon: <Shield className="w-4 h-4" />,
    activeBorder: "border-orange-500/50 bg-orange-500/5",
    iconActive: "text-orange-500",
  },
  full: {
    label: "Standard Enforcement",
    description: "Normal heuristic detection. Autonomously freezes hardware on any recognized violation.",
    icon: <ShieldCheck className="w-4 h-4" />,
    activeBorder: "border-destructive/50 bg-destructive/5",
    iconActive: "text-destructive",
  },
};

export function GlobalSafetySwitches() {
  const { role } = useAuth();
  const isAuthorized = role === "principal" || role === "dev";

  const [mode, setMode] = useState<SafetyMode | "loading">("loading");
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingMode, setPendingMode] = useState<SafetyMode | null>(null);
  const [expandedInfo, setExpandedInfo] = useState<SafetyMode | null>(null);
  const [workstationCount, setWorkstationCount] = useState(0);

  useEffect(() => {
    async function loadCurrentMode() {
      try {
        const { data: workstations } = await supabase.from("workstations").select("id");
        setWorkstationCount(workstations?.length || 0);

        const { data } = await (supabase.from as any)("agent_configs")
          .select("log_only_mode, strict_warden")
          .limit(1)
          .maybeSingle();

        if (data) {
          if ((data as any).log_only_mode) setMode("log_only");
          else if ((data as any).strict_warden) setMode("strict");
          else setMode("full");
        } else {
          setMode("log_only");
        }
      } catch (err) {
        console.error(err);
        setMode("log_only");
      }
    }
    loadCurrentMode();
  }, []);

  const applyMode = async (newMode: SafetyMode) => {
    if (!isAuthorized) {
      toast.error("Only Principal or Dev can change global settings.");
      return;
    }

    setIsUpdating(true);
    const log_only_mode = newMode === "log_only";
    const strict_warden = newMode === "strict";

    try {
      const { data: workstations } = await supabase.from("workstations").select("id");
      if (!workstations || workstations.length === 0) {
        toast.error("No active workstations found.");
        return;
      }

      const updates = workstations.map((w) => ({
        agent_id: w.id,
        log_only_mode,
        strict_warden,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await (supabase.from as any)("agent_configs").upsert(updates);
      if (error) throw error;

      setMode(newMode);
      setPendingMode(null);
      setExpandedInfo(null);

      toast.success(`Mode updated to ${MODE_CONFIG[newMode].label}. Synced to ${workstations.length} endpoints.`);
    } catch (err: any) {
      toast.error(`Update failed: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleModeSelect = (newMode: SafetyMode) => {
    if (newMode === mode) return;

    if (newMode === "full" && mode !== "full") {
      setPendingMode("full");
      setExpandedInfo("full"); // Auto-expand to show the warning
      return;
    }
    applyMode(newMode);
  };

  const toggleInfo = (key: SafetyMode) => {
    setExpandedInfo(expandedInfo === key ? null : key);
  };

  if (mode === "loading") {
    return (
      <div className="paper-elevated rounded-xl p-5 border border-border/30">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-48 bg-muted rounded" />
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 w-full bg-muted/50 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="paper-elevated rounded-xl p-5 sm:p-6 space-y-4 border border-border/30">
      
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-serif text-lg">Enforcement Level</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Global heuristic limits for local agents.
          </p>
        </div>
      </div>

      {/* Dense Accordion List */}
      <div className="flex flex-col gap-2.5">
        {(Object.keys(MODE_CONFIG) as SafetyMode[]).map((key) => {
          const config = MODE_CONFIG[key];
          const isActive = mode === key;
          const isPending = pendingMode === key;
          const isExpanded = expandedInfo === key || isPending;

          return (
            <div 
              key={key}
              className={`relative flex flex-col rounded-lg border transition-all duration-200 overflow-hidden ${
                isActive ? config.activeBorder : "border-border/40 hover:border-border/80 bg-background/50"
              } ${isPending ? "ring-1 ring-destructive/50" : ""}`}
            >
              {/* Thin Row Button */}
              <div className="flex items-center">
                <button 
                  onClick={() => handleModeSelect(key)} 
                  disabled={!isAuthorized || isUpdating || isActive}
                  className="flex items-center gap-3 flex-1 p-3 text-left disabled:cursor-not-allowed"
                >
                  <div className={isActive ? config.iconActive : "text-muted-foreground/60"}>
                    {config.icon}
                  </div>
                  <span className={`font-medium text-sm ${isActive ? "text-foreground" : "text-foreground/70"}`}>
                    {config.label}
                  </span>
                </button>
                
                {/* Right Side Actions */}
                <div className="flex items-center gap-2 pr-3">
                  {isActive && <Check className={`w-4 h-4 ${config.iconActive}`} />}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleInfo(key); }}
                    className={`p-1.5 rounded-md transition-colors ${isExpanded ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"}`}
                    title="View details"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Inline Expansion Area */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-border/10 bg-secondary/10 animate-in slide-in-from-top-2 duration-200">
                  <p className="text-xs text-muted-foreground leading-relaxed pl-10">
                    {config.description}
                  </p>
                  
                  {isPending && (
                    <div className="mt-3 ml-10 flex gap-2 bg-destructive/5 border border-destructive/20 p-2.5 rounded-md">
                      <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-destructive mb-2">Enable Standard Enforcement?</p>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => {
                              if (pendingMode) applyMode(pendingMode);
                            }}
                            disabled={isUpdating}
                            className="h-7 text-[10px] uppercase tracking-widest px-3"
                          >
                            {isUpdating ? "Applying..." : "Confirm"}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => {
                              setPendingMode(null);
                              setExpandedInfo(null);
                            }}
                            disabled={isUpdating}
                            className="h-7 text-[10px] uppercase tracking-widest px-3"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isAuthorized && (
        <p className="text-center text-[9px] text-muted-foreground font-mono tracking-widest uppercase mt-4">
          Admin clearance required
        </p>
      )}
    </div>
  );
}
