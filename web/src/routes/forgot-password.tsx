import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { Shell } from "@/components/sentinel/Shell";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password · Obylon by Umbraxis" },
      { name: "description", content: "Request a password reset link." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://umbraxis.umbraxis.workers.dev/reset-password",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Reset link sent. Check your email.");
  };

  return (
    <Shell>
      <div className="min-h-[80vh] flex items-center justify-center px-6 py-16">
        <div className="paper-texture paper-elevated rounded-2xl w-full max-w-md p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-muted-foreground">
            Obylon by Umbraxis
          </p>
          <h1 className="font-serif text-3xl mt-2">Forgot password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            We'll email you a secure reset link.
          </p>

          {sent ? (
            <p className="mt-6 text-sm text-muted-foreground">
              If an account exists for <span className="text-foreground font-mono">{email}</span>, a reset link is on its way.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="email" className="font-mono text-[10px] uppercase tracking-widest">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
              </div>
              <Button type="submit" disabled={busy} className="w-full font-mono uppercase tracking-widest text-xs">
                {busy ? "..." : "Send reset link"}
              </Button>
            </form>
          )}

          <Link to="/login" className="block mt-6 text-[11px] text-muted-foreground hover:text-foreground">← Back to sign in</Link>
        </div>
      </div>
    </Shell>
  );
}
