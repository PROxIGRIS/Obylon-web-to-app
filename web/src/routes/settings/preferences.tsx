import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { Monitor, Moon, Sun, Bell, AlertTriangle, ShieldAlert, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/toast";

export const Route = createFileRoute("/settings/preferences")({
  component: PreferencesSettings,
});

function PreferencesSettings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  const [alerts, setAlerts] = useState({
    email_critical_alerts: true,
    email_hardware_panic: false,
    email_new_logins: true,
  });
  
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    async function loadPreferences() {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("user_preferences")
          .select("email_critical_alerts, email_hardware_panic, email_new_logins")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setAlerts({
            email_critical_alerts: !!data.email_critical_alerts,
            email_hardware_panic: !!data.email_hardware_panic,
            email_new_logins: !!data.email_new_logins,
          });
        }
      } catch (err: any) {
        console.error("Failed to load preferences", err);
      } finally {
        setLoading(false);
      }
    }
    loadPreferences();
  }, [user]);

  const toggleAlert = async (key: keyof typeof alerts) => {
    if (!user) return;
    const newValue = !alerts[key];
    setAlerts((prev) => ({ ...prev, [key]: newValue }));
    setSavingKey(key);

    try {
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: user.id, [key]: newValue }, { onConflict: "user_id" });
      
      if (error) throw error;
      toast.success("Preferences updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update preferences");
      // Revert optimism
      setAlerts((prev) => ({ ...prev, [key]: !newValue }));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">System & Notifications</h2>
        <p className="text-sm text-muted-foreground mt-1">Configure your environment and routing rules for telemetry alerts.</p>
      </div>

      <div className="space-y-6">
        <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Monitor className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="font-semibold">Interface Display</h3>
              <p className="text-xs text-muted-foreground">Customize the visual appearance of the grid.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => setTheme("system")}
              className={`flex flex-col items-center justify-center gap-2 py-4 rounded-xl border border-border/50 transition-all ${
                theme === "system" ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-background text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              <Monitor className="w-5 h-5" />
              <span className="text-sm font-medium">System</span>
            </button>
            <button
              onClick={() => setTheme("light")}
              className={`flex flex-col items-center justify-center gap-2 py-4 rounded-xl border border-border/50 transition-all ${
                theme === "light" ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-background text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              <Sun className="w-5 h-5" />
              <span className="text-sm font-medium">Light</span>
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`flex flex-col items-center justify-center gap-2 py-4 rounded-xl border border-border/50 transition-all ${
                theme === "dark" ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-background text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              <Moon className="w-5 h-5" />
              <span className="text-sm font-medium">Dark</span>
            </button>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
              <Bell className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h3 className="font-semibold">Alert Routing</h3>
              <p className="text-xs text-muted-foreground">Select which events trigger out-of-band email notifications.</p>
            </div>
          </div>

          <div className="space-y-0 divide-y divide-border/50 border border-border/50 rounded-xl bg-background/50 overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <div className="flex gap-4">
                <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Critical Warden Strike</p>
                  <p className="text-xs text-muted-foreground">Receive an email when a high-priority policy violation occurs.</p>
                </div>
              </div>
              <button
                onClick={() => toggleAlert('email_critical_alerts')}
                disabled={savingKey === 'email_critical_alerts' || loading}
                className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 shrink-0 disabled:opacity-50 ${alerts.email_critical_alerts ? 'bg-primary' : 'bg-secondary border border-border'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-background transition-transform flex items-center justify-center ${alerts.email_critical_alerts ? 'translate-x-5' : 'translate-x-0 shadow-sm'}`}>
                  {savingKey === 'email_critical_alerts' && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                </div>
              </button>
            </div>
            
            <div className="flex items-center justify-between p-4">
              <div className="flex gap-4">
                <ShieldAlert className="w-5 h-5 text-rose-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Hardware Panic</p>
                  <p className="text-xs text-muted-foreground">Receive an email when a device goes offline unexpectedly.</p>
                </div>
              </div>
              <button
                onClick={() => toggleAlert('email_hardware_panic')}
                disabled={savingKey === 'email_hardware_panic' || loading}
                className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 shrink-0 disabled:opacity-50 ${alerts.email_hardware_panic ? 'bg-primary' : 'bg-secondary border border-border'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-background transition-transform flex items-center justify-center ${alerts.email_hardware_panic ? 'translate-x-5' : 'translate-x-0 shadow-sm'}`}>
                  {savingKey === 'email_hardware_panic' && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                </div>
              </button>
            </div>

            <div className="flex items-center justify-between p-4">
              <div className="flex gap-4">
                <Monitor className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">New Account Logins</p>
                  <p className="text-xs text-muted-foreground">Receive an email when your account logs in from a new IP.</p>
                </div>
              </div>
              <button
                onClick={() => toggleAlert('email_new_logins')}
                disabled={savingKey === 'email_new_logins' || loading}
                className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 shrink-0 disabled:opacity-50 ${alerts.email_new_logins ? 'bg-primary' : 'bg-secondary border border-border'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-background transition-transform flex items-center justify-center ${alerts.email_new_logins ? 'translate-x-5' : 'translate-x-0 shadow-sm'}`}>
                  {savingKey === 'email_new_logins' && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                </div>
              </button>
            </div>
            <div className="flex items-center justify-between p-4">
              <div className="flex gap-4">
                <ShieldAlert className="w-5 h-5 text-indigo-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Password Reset Emails</p>
                  <p className="text-xs text-muted-foreground">Receive an email when your password is changed.</p>
                </div>
              </div>
              <button
                onClick={() => toast.info("System Enforced", { description: "Password reset alerts are permanently enabled for your security.", duration: 4000 })}
                className="w-11 h-6 rounded-full transition-colors flex items-center px-1 shrink-0 bg-primary/80 cursor-not-allowed"
              >
                <div className="w-4 h-4 rounded-full bg-background transition-transform translate-x-5 shadow-sm" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
