import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getIpAndLocation } from "@/utils/ip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { Shell } from "@/components/sentinel/Shell";
import { Key } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in · Obylon by Umbraxis" },
      { name: "description", content: "Operator access to the Obylon grid." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const logLoginEvent = async (userId: string, eventType: string) => {
    try {
      const { ip, location } = await getIpAndLocation();
      const ua = navigator.userAgent;
      let browser = "Unknown";
      if (ua.includes("Chrome")) browser = "Chrome";
      else if (ua.includes("Firefox")) browser = "Firefox";
      else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
      else if (ua.includes("Edge")) browser = "Edge";
      
      let deviceName = "Unknown Device";
      if (ua.includes("iPhone")) deviceName = "iPhone";
      else if (ua.includes("iPad")) deviceName = "iPad";
      else if (ua.includes("Android")) deviceName = "Android";
      else if (ua.includes("Mac OS X")) deviceName = "Mac";
      else if (ua.includes("Windows")) deviceName = "Windows";
      else if (ua.includes("Linux")) deviceName = "Linux";

      const existingSessionId = localStorage.getItem("local_session_id");
      let sessionData = null;

      if (existingSessionId) {
        // Attempt to recycle the existing device session
        const { data } = await supabase.from("user_sessions").update({
          device_name: deviceName,
          browser: browser,
          location: location,
          ip_address: ip,
          status: 'active',
          last_active_at: new Date().toISOString()
        }).eq("id", existingSessionId).select().maybeSingle();
        
        sessionData = data;
      }

      // If it didn't exist or update failed (maybe different user), create new
      if (!sessionData) {
        const { data } = await supabase.from("user_sessions").insert({
          user_id: userId,
          device_name: deviceName,
          browser: browser,
          location: location,
          is_current: false,
          ip_address: ip,
          status: 'active'
        }).select().maybeSingle();
        
        sessionData = data;
      }

      if (sessionData) {
        localStorage.setItem("local_session_id", sessionData.id);
      }

      await supabase.from("security_audit_logs").insert({
        user_id: userId,
        event_type: eventType,
        status: "success",
        ip_address: ip
      });
    } catch (e) {
      console.error("Failed to log session:", e);
    }
  };



  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "signin") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const ip = await getClientIp();
        // Since we don't have user.id (auth failed), we skip inserting into audit log
        // because RLS requires user_id = auth.uid(), which is null.
        toast.error(error.message);
      } else if (data?.user) {
        await logLoginEvent(data.user.id, "Successful login (Password)");
        navigate({ to: "/" });
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: "https://umbraxis.umbraxis.workers.dev/auth/callback" },
      });

      if (error) toast.error(error.message);
      else toast.success("Account created. Check your email if confirmation is required, then sign in.");
    }
    setBusy(false);
  };

  const handlePasskeyLogin = async () => {
    setBusy(true);
    try {
      // @ts-ignore - Supabase passkey is experimental
      const { data, error } = await supabase.auth.signInWithPasskey();
      if (error) throw error;
      if (data?.user) {
        await logLoginEvent(data.user.id, "Successful login (Passkey)");
      }
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message || "Hardware key verification failed", {
        className: "bg-[#1C1A16] text-[#F0EDE3] border-2 border-[#1C1A16] rounded-none font-mono uppercase tracking-widest"
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div className="min-h-[80vh] flex items-center justify-center px-4 sm:px-6 py-12 sm:py-16">
        <div className="w-full max-w-md">
          <div className="paper-texture paper-elevated rounded-2xl p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
            <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

            <div className="relative">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.45em] text-muted-foreground font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-accent heartbeat-dot" />
                Obylon by Umbraxis
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl mt-3 tracking-tight">
                {mode === "signin" ? "Operator access" : "Create operator"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                {mode === "signin"
                  ? "Authenticate to enter the grid."
                  : "Provision a new account. Roles are assigned by an administrator."}
              </p>

              <form onSubmit={submit} className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="email" className="font-mono text-[10px] uppercase tracking-widest">Email</Label>
                  <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-11" />
                </div>
                <div>
                  <Label htmlFor="password" className="font-mono text-[10px] uppercase tracking-widest">Password</Label>
                  <Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-11" />
                </div>
                <Button type="submit" disabled={busy} className="w-full h-11 font-mono uppercase tracking-widest text-xs">
                  {busy ? "Authenticating…" : mode === "signin" ? "Engage" : "Provision"}
                </Button>
              </form>

              <div className="mt-6 flex items-center justify-between text-xs gap-3">
                <button
                  type="button"
                  onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                  className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
                >
                  {mode === "signin" ? "Need an account? Provision one" : "Already provisioned? Sign in"}
                </button>
                {mode === "signin" && (
                  <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors shrink-0">
                    Forgot password?
                  </Link>
                )}
              </div>

              {/* ── Brutalist Passkey Login ────────────────────────── */}
              <div className="mt-8 pt-6 border-t border-border/40">
                <button
                  type="button"
                  onClick={handlePasskeyLogin}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-3 bg-primary/90 hover:bg-primary text-primary-foreground border-none rounded-xl py-4 px-6 font-sans text-sm font-medium shadow-paper-elevated hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 ring-1 ring-inset ring-white/10 dark:ring-white/5"
                >
                  <Key className="w-5 h-5" />
                  Biometric / Hardware Key Access
                </button>
              </div>

              <p className="mt-6 pt-5 border-t border-border/40 text-[11px] text-muted-foreground font-mono leading-relaxed">
                New accounts have no role. An administrator must grant access before the dashboard unlocks.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
