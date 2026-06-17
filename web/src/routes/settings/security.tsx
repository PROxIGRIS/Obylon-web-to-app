import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getClientIp } from "@/utils/ip";
import { toast } from "@/components/ui/toast";
import { Loader2, Key, Shield, Smartphone, Laptop, Trash2, Monitor, RefreshCw } from "lucide-react";
import { ReauthModal } from "@/components/ui/reauth-modal";

export const Route = createFileRoute("/settings/security")({
  component: SecuritySettings,
});

function SecuritySettings() {
  const { user } = useAuth();
  
  const [pwdState, setPwdState] = useState<"idle" | "changing" | "otp">("idle");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  const [savingPasskey, setSavingPasskey] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  
  const [isReauthOpen, setIsReauthOpen] = useState(false);
  const [sessionToRevoke, setSessionToRevoke] = useState<string | null>(null);

  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    async function fetchSessions() {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("user_sessions")
          .select("*")
          .eq("user_id", user.id)
          .order("last_active_at", { ascending: false });
        
        if (error) throw error;
        setSessions(data || []);
      } catch (err: any) {
        console.error("Failed to load sessions", err);
      } finally {
        setLoadingSessions(false);
      }
    }
    fetchSessions();
  }, [user]);

  if (!user) return null;

  const handleUpdatePasswordWithCurrent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !user?.email) return;
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    setPwdLoading(true);
    try {
      // Re-authenticate user with current password to ensure session is fresh
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) throw new Error("Incorrect current password.");

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (updateError) throw updateError;

      const ip = await getClientIp();
      await supabase.from("security_audit_logs").insert({
        user_id: user.id,
        event_type: "Password updated successfully",
        status: "success",
        ip_address: ip
      });

      toast.success("Security credentials successfully updated.");
      setPwdState("idle");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      const ip = await getClientIp();
      await supabase.from("security_audit_logs").insert({
        user_id: user?.id,
        event_type: "Password update failed",
        status: "failure",
        ip_address: ip
      });

      toast.error(err.message || "Failed to update password.");
    } finally {
      setPwdLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!user?.email) return;
    setPwdLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: user.email });
      if (error) throw error;
      toast.success("A 6-digit confirmation code has been sent to your email.");
      setPwdState("otp");
    } catch (err: any) {
      toast.error(err.message || "Failed to request code.");
    } finally {
      setPwdLoading(false);
    }
  };

  const handleUpdatePasswordWithOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || !newPassword || !user?.email) return;
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    setPwdLoading(true);
    try {
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: user.email,
        token: otpCode,
        type: 'email'
      });
      if (otpError) throw new Error("Invalid or expired 2FA code.");

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (updateError) throw updateError;

      toast.success("Security credentials successfully updated.");
      setPwdState("idle");
      setCurrentPassword("");
      setNewPassword("");
      setOtpCode("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password.");
    } finally {
      setPwdLoading(false);
    }
  };

  const handleRegisterPasskey = async () => {
    setSavingPasskey(true);
    try {
      // @ts-ignore
      const { data, error } = await supabase.auth.registerPasskey();
      if (error) throw error;
      
      const ip = await getClientIp();
      await supabase.from("security_audit_logs").insert({
        user_id: user.id,
        event_type: "Passkey registered (Hardware Key)",
        status: "success",
        ip_address: ip
      });

      toast.success("Hardware security key has been bound to your dossier.");
    } catch (err: any) {
      const ip = await getClientIp();
      await supabase.from("security_audit_logs").insert({
        user_id: user?.id,
        event_type: "Passkey registration failed",
        status: "failure",
        ip_address: ip
      }).select().maybeSingle();

      toast.error(err.message || "Failed to register passkey.");
    } finally {
      setSavingPasskey(false);
    }
  };

  const handleRevokeOtherSessions = async () => {
    setRevoking(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error && !error.message.includes("Auth session missing")) throw error;

      // Clean up from our tracking table based on local_session_id
      const currentSessionId = localStorage.getItem("local_session_id");
      if (currentSessionId) {
        await supabase.from("user_sessions").update({ status: 'revoked' }).eq("user_id", user?.id).neq("id", currentSessionId);
        setSessions((prev) => prev.map(s => s.id === currentSessionId ? s : { ...s, status: 'revoked' }));
      } else {
        // Fallback if local session isn't found
        await supabase.from("user_sessions").update({ status: 'revoked' }).eq("user_id", user?.id).eq("is_current", false);
        setSessions((prev) => prev.map(s => s.is_current ? s : { ...s, status: 'revoked' }));
      }

      const ip = await getClientIp();
      await supabase.from("security_audit_logs").insert({
        user_id: user.id,
        event_type: "Revoked all other active sessions",
        status: "success",
        ip_address: ip
      });

      toast.success("All other active sessions have been terminated.");
    } catch (err: any) {
      const ip = await getClientIp();
      await supabase.from("security_audit_logs").insert({
        user_id: user?.id,
        event_type: "Failed to revoke sessions",
        status: "failure",
        ip_address: ip
      }).select().maybeSingle();

      toast.error(err.message || "Failed to revoke sessions.");
    } finally {
      setRevoking(false);
    }
  };

  const initiateRevoke = (sessionId: string) => {
    setSessionToRevoke(sessionId);
    setIsReauthOpen(true);
  };

  const handleRevokeSingleSession = async () => {
    if (!sessionToRevoke) return;
    setIsReauthOpen(false);
    setRevokingId(sessionToRevoke);
    try {
      const { error } = await supabase.from("user_sessions").update({ status: 'revoked' }).eq("id", sessionToRevoke);
      if (error) throw error;
      setSessions((prev) => prev.map(s => s.id === sessionToRevoke ? { ...s, status: 'revoked' } : s));
      
      const ip = await getClientIp();
      await supabase.from("security_audit_logs").insert({
        user_id: user?.id,
        event_type: "Revoked single device session",
        status: "success",
        ip_address: ip
      });

      toast.success("Device access temporarily revoked.");
    } catch (err: any) {
      const ip = await getClientIp();
      await supabase.from("security_audit_logs").insert({
        user_id: user?.id,
        event_type: "Failed to revoke device session",
        status: "failure",
        ip_address: ip
      }).select().maybeSingle();

      toast.error(err.message || "Failed to revoke device.");
    } finally {
      setRevokingId(null);
      setSessionToRevoke(null);
    }
  };

  const handleUndoRevoke = async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      const { error } = await supabase.from("user_sessions").update({ status: 'active' }).eq("id", sessionId);
      if (error) throw error;
      setSessions((prev) => prev.map(s => s.id === sessionId ? { ...s, status: 'active' } : s));
      
      const ip = await getClientIp();
      await supabase.from("security_audit_logs").insert({
        user_id: user?.id,
        event_type: "Undid device revocation",
        status: "success",
        ip_address: ip
      });

      toast.success("Device access restored successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to restore device.");
    } finally {
      setRevokingId(null);
    }
  };

  const activeSessions = sessions.filter(s => s.status !== 'revoked');
  const revokedSessions = sessions.filter(s => s.status === 'revoked');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Access & Defense</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage passwords, passkeys, and active sessions.</p>
      </div>

      <div className="space-y-6">
        <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Password Management</h3>
              <p className="text-xs text-muted-foreground">Cycle your password via 2FA verification.</p>
            </div>
          </div>

          <div className="max-w-md">
            {pwdState === "idle" && (
              <button
                type="button"
                onClick={() => setPwdState("changing")}
                className="py-2.5 px-4 rounded-xl border border-border/50 bg-background text-foreground font-medium text-sm hover:bg-secondary transition-colors"
              >
                Change Password
              </button>
            )}

            {pwdState === "changing" && (
              <form onSubmit={handleUpdatePasswordWithCurrent} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password..."
                    className="w-full bg-background border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                    className="w-full bg-background border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={!currentPassword || !newPassword || pwdLoading}
                    className="py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                  >
                    {pwdLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
                  </button>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={pwdLoading}
                    className="py-2.5 px-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Forgot Password?
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPwdState("idle");
                      setCurrentPassword("");
                      setNewPassword("");
                    }}
                    disabled={pwdLoading}
                    className="py-2.5 px-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ml-auto"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {pwdState === "otp" && (
              <form onSubmit={handleUpdatePasswordWithOtp} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">2FA Code (from Email)</label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="6-digit code"
                    className="w-full bg-background border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all tracking-widest font-mono"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                    className="w-full bg-background border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={!otpCode || !newPassword || pwdLoading}
                    className="py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                  >
                    {pwdLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPwdState("idle")}
                    disabled={pwdLoading}
                    className="py-2.5 px-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Key className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold">Hardware Security & Biometrics</h3>
              <p className="text-xs text-muted-foreground">Register passkeys for passwordless entry.</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl mb-6">
            Enhance your account's security by registering a physical security key or biometric device (e.g., Touch ID, Face ID, YubiKey). Once registered, you can authenticate without a password.
          </p>
          <button
            type="button"
            onClick={handleRegisterPasskey}
            disabled={savingPasskey}
            className="py-2.5 px-4 rounded-xl border border-border/50 bg-background text-foreground font-medium text-sm hover:bg-secondary transition-colors flex items-center gap-2"
          >
            {savingPasskey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            Register New Passkey
          </button>
        </div>

        <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold">Active Sessions</h3>
                <p className="text-xs text-muted-foreground">Manage your authenticated devices.</p>
              </div>
            </div>
            <button
              onClick={handleRevokeOtherSessions}
              disabled={revoking}
              className="py-2 px-4 rounded-xl bg-destructive/10 text-destructive font-medium text-sm hover:bg-destructive/20 transition-colors flex items-center gap-2"
            >
              {revoking ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Revoke All Other Sessions
            </button>
          </div>

          <div className="space-y-3">
            {loadingSessions ? (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mb-2 opacity-50" />
                <p className="text-xs">Scanning active connections...</p>
              </div>
            ) : activeSessions.length === 0 ? (
              <div className="p-4 rounded-xl border border-border/50 bg-background/50 text-center">
                <p className="text-sm text-muted-foreground">No active session history found.</p>
              </div>
            ) : (
              activeSessions.map((sess) => {
                const Icon = sess.device_name?.toLowerCase().includes("iphone") || sess.device_name?.toLowerCase().includes("android") ? Smartphone : Laptop;
                const isCurrent = sess.id === localStorage.getItem("local_session_id") || (activeSessions.length === 1 && sess.is_current);
                return (
                  <div key={sess.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-background/50 group">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-secondary/50 rounded-lg">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium flex items-center gap-2">
                          {sess.device_name || "Unknown Device"}
                          {isCurrent && (
                            <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              Current
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{sess.browser || "Unknown Browser"} · {sess.location || "Unknown Location"}</p>
                      </div>
                    </div>
                    {!isCurrent && (
                      <button
                        onClick={() => initiateRevoke(sess.id)}
                        disabled={revokingId === sess.id}
                        className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                        title="Revoke Session"
                      >
                        {revokingId === sess.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {revokedSessions.length > 0 && (
            <div className="mt-8 pt-8 border-t border-border/50">
              <h3 className="font-semibold mb-4 text-destructive">Revoked Devices</h3>
              <div className="space-y-3">
                {revokedSessions.map((sess) => {
                  const Icon = sess.device_name?.toLowerCase().includes("iphone") || sess.device_name?.toLowerCase().includes("android") ? Smartphone : Laptop;
                  return (
                    <div key={sess.id} className="flex items-center justify-between p-4 rounded-xl border border-destructive/20 bg-destructive/5 group opacity-80">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-destructive/10 rounded-lg">
                          <Icon className="w-5 h-5 text-destructive" />
                        </div>
                        <div>
                          <p className="text-sm font-medium flex items-center gap-2 line-through text-muted-foreground">
                            {sess.device_name || "Unknown Device"}
                          </p>
                          <p className="text-xs text-muted-foreground">{sess.browser || "Unknown Browser"} · {sess.location || "Unknown Location"}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUndoRevoke(sess.id)}
                        disabled={revokingId === sess.id}
                        className="py-1.5 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50 flex items-center gap-2"
                        title="Undo Revoke"
                      >
                        {revokingId === sess.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Restore Access
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <ReauthModal
        isOpen={isReauthOpen}
        onClose={() => {
          setIsReauthOpen(false);
          setSessionToRevoke(null);
        }}
        onSuccess={handleRevokeSingleSession}
        title="Verify Identity"
        description="Re-authenticate to confirm you want to revoke this device's access."
      />
    </div>
  );
}
