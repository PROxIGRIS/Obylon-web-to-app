import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { Shell } from "@/components/sentinel/Shell";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password · Obylon by Umbraxis" },
      { name: "description", content: "Set a new operator password." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase recovery link sets a session on the client via the URL hash.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. Signing you in...");
    navigate({ to: "/" });
  };

  return (
    <Shell>
      <div className="min-h-[80vh] flex items-center justify-center px-6 py-16">
        <div className="paper-texture paper-elevated rounded-2xl w-full max-w-md p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-muted-foreground">
            Obylon by Umbraxis
          </p>
          <h1 className="font-serif text-3xl mt-2">Reset password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a new operator password.
          </p>

          {!ready ? (
            <p className="mt-6 text-xs text-muted-foreground font-mono">
              Open this page from the password reset email link. If you arrived here directly, request a new link from the sign-in page.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="password" className="font-mono text-[10px] uppercase tracking-widest">New password</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="confirm" className="font-mono text-[10px] uppercase tracking-widest">Confirm</Label>
                <Input id="confirm" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1" />
              </div>
              <Button type="submit" disabled={busy} className="w-full font-mono uppercase tracking-widest text-xs">
                {busy ? "..." : "Update password"}
              </Button>
            </form>
          )}

          <Link to="/login" className="block mt-6 text-[11px] text-muted-foreground hover:text-foreground">← Back to sign in</Link>
        </div>
      </div>
    </Shell>
  );
}
