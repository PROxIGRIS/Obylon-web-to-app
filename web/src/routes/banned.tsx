import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Lottie from "lottie-react";
import { LogOut, Send, Clock, XCircle, CheckCircle2, Loader2, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/toast";

const banAnimation = {
  v: "5.7.4", fr: 60, ip: 0, op: 180, w: 200, h: 200,
  nm: "Ban Orb", ddd: 0, assets: [],
  layers: [
    {
      ddd: 0, ind: 1, ty: 4, nm: "Outer Ring", sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [20], e: [50] }, { t: 90, s: [50], e: [20] }, { t: 180 }] },
        r: { a: 1, k: [{ t: 0, s: [0], e: [-360] }, { t: 180 }] },
        p: { a: 0, k: [100, 100, 0] },
        s: { a: 1, k: [{ t: 0, s: [130, 130], e: [145, 145] }, { t: 90, s: [145, 145], e: [130, 130] }, { t: 180 }] },
      },
      shapes: [
        { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [140, 140] } },
        { ty: "fl", c: { a: 0, k: [0.55, 0.08, 0.08, 1] }, o: { a: 0, k: 100 } },
      ],
    },
    {
      ddd: 0, ind: 2, ty: 4, nm: "Core", sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [70], e: [100] }, { t: 90, s: [100], e: [70] }, { t: 180 }] },
        r: { a: 1, k: [{ t: 0, s: [0], e: [360] }, { t: 180 }] },
        p: { a: 0, k: [100, 100, 0] },
        s: { a: 1, k: [{ t: 0, s: [85, 85], e: [95, 95] }, { t: 90, s: [95, 95], e: [85, 85] }, { t: 180 }] },
      },
      shapes: [
        { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] } },
        { ty: "fl", c: { a: 0, k: [0.72, 0.1, 0.1, 1] }, o: { a: 0, k: 100 } },
      ],
    },
  ],
};

export const Route = createFileRoute("/banned")({
  head: () => ({
    meta: [
      { title: "Account Banned · Dossier Archive" },
      { name: "theme-color", content: "#fcfaf2" },
    ],
  }),
  component: BannedPage,
});

function BannedPage() {
  const { user, signOut, loading, isBanned } = useAuth();
  const navigate = useNavigate();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [unbanStatus, setUnbanStatus] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      if (!hasInteracted) setHasInteracted(true);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [hasInteracted]);

  useEffect(() => {
    if (!loading && user && !isBanned) {
      navigate({ to: "/" });
      return;
    }
    if (user && isBanned) {
      const checkAppeal = async () => {
        const { data } = await supabase
          .from("unban_requests" as any)
          .select("status")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          const status = (data as any).status;
          setUnbanStatus(status);
          if (status === "approved") {
            setTimeout(() => navigate({ to: "/" }), 2500);
          }
        }
        setCheckingStatus(false);
      };
      checkAppeal();
    } else {
      setCheckingStatus(false);
    }
  }, [loading, user, isBanned, navigate]);

  if (loading || !user || !isBanned)
    return <div className="h-screen bg-background" />;

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Please provide a reason before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("unban_requests" as any)
        .insert({ user_id: user.id, reason: reason.trim() });
      if (error) throw error;
      toast.success("Your appeal has been submitted and is pending review.");
      setUnbanStatus("pending");
    } catch (err: any) {
      toast.error(err.message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: "var(--gradient-archive)" }}
    >
      {/* Cursor aura */}
      <div
        className="fixed w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none transition-all duration-500 ease-out -z-10"
        style={{
          left: mousePosition.x - 250,
          top: mousePosition.y - 250,
          opacity: hasInteracted ? 0.6 : 0,
          backgroundColor: "color-mix(in oklab, var(--blood) 12%, transparent)",
        }}
      />

      {/* Background blobs */}
      <div
        className="absolute -top-72 -right-72 w-[700px] h-[700px] rounded-full blur-3xl -z-10"
        style={{ background: "radial-gradient(ellipse, color-mix(in oklab, var(--blood) 18%, transparent) 0%, transparent 65%)" }}
      />
      <div
        className="absolute -bottom-32 -left-32 w-[600px] h-[600px] rounded-full blur-3xl -z-10"
        style={{ background: "radial-gradient(ellipse, color-mix(in oklab, var(--charcoal) 22%, transparent) 0%, transparent 65%)" }}
      />
      <motion.div
        className="absolute top-24 left-8 w-28 h-28 rounded-3xl blur-2xl -z-10"
        style={{ backgroundColor: "color-mix(in oklab, var(--blood) 14%, transparent)" }}
        animate={{ y: [0, -22, 0], opacity: [0.3, 0.65, 0.3] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-40 right-12 w-44 h-44 rounded-full blur-3xl -z-10"
        style={{ backgroundColor: "color-mix(in oklab, var(--charcoal) 18%, transparent)" }}
        animate={{ y: [0, 16, 0], x: [0, -10, 0], opacity: [0.25, 0.55, 0.25] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ── Desktop-only top nav ── */}
      <div className="hidden lg:block absolute top-6 left-6 z-10">
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="rounded-full text-muted-foreground hover:text-foreground hover:scale-105 transition-all"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>

      {/* ── Main layout ── */}
      <section className="relative min-h-screen flex items-center">
        <div className="container mx-auto px-5 lg:px-16 py-12 lg:py-20">

          {/* Mobile: stacked single-column, tight padding */}
          {/* Desktop: side-by-side 3:2 grid */}
          <div className="grid gap-10 lg:gap-16 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-center">

            {/* ── LEFT: Hero ── */}
            <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-6">

              {/* Orb — hidden on mobile to save space */}
              <motion.div
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 180, damping: 18, delay: 0.1 }}
                className="hidden lg:block w-36 h-36"
              >
                <Lottie animationData={banAnimation} loop />
              </motion.div>

              {/* Eyebrow + title block */}
              <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-3"
              >
                {/* Eyebrow */}
                <div className="flex items-center gap-2 justify-center lg:justify-start">
                  <ShieldOff className="w-3.5 h-3.5" style={{ color: "var(--blood)" }} />
                  <span
                    className="text-xs font-mono uppercase tracking-[0.22em]"
                    style={{ color: "var(--blood)" }}
                  >
                    Access Revoked
                  </span>
                </div>

                {/* "Banned" — charcoal → blood → charcoal gradient */}
                <h1 className="text-[clamp(4rem,18vw,7rem)] font-bold leading-none">
                  <span
                    className="bg-clip-text text-transparent"
                    style={{
                      backgroundImage:
                        "linear-gradient(to right, var(--charcoal), var(--blood), var(--charcoal))",
                    }}
                  >
                    Banned
                  </span>
                </h1>

                <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-md mx-auto lg:mx-0">
                  Your account has been suspended by an administrator.
                  If you believe this was made in error, submit a formal
                  reinstatement request using the form below.
                </p>
              </motion.div>

              {/* Desktop-only hint */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.55 }}
                transition={{ delay: 0.65 }}
                className="hidden lg:block text-sm text-muted-foreground/60"
              >
                For urgent matters, contact your platform administrator directly.
              </motion.p>
            </div>

            {/* ── RIGHT: Appeal Card ── */}
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative">
                {/* Glow */}
                <div
                  className="absolute inset-0 rounded-3xl blur-2xl scale-105 -z-10"
                  style={{
                    background:
                      "linear-gradient(135deg, color-mix(in oklab, var(--blood) 14%, transparent) 0%, color-mix(in oklab, var(--charcoal) 12%, transparent) 100%)",
                  }}
                />

                <div
                  className="relative rounded-3xl p-6 lg:p-8 space-y-5"
                  style={{
                    background:
                      "linear-gradient(160deg, color-mix(in oklab, var(--card) 94%, transparent) 0%, color-mix(in oklab, var(--card) 84%, transparent) 100%)",
                    border: "1px solid color-mix(in oklab, var(--charcoal) 10%, transparent)",
                    boxShadow:
                      "0 0 0 1px oklch(1 0 0 / 0.5) inset, 0 8px 32px -8px oklch(0.27 0.005 270 / 0.18), 0 32px 64px -24px oklch(0.27 0.005 270 / 0.14)",
                    backdropFilter: "blur(16px)",
                  }}
                >
                  {/* Card header */}
                  <div
                    className="flex items-start justify-between gap-4 pb-5"
                    style={{ borderBottom: "1px solid color-mix(in oklab, var(--charcoal) 8%, transparent)" }}
                  >
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50 mb-1">
                        Dossier Archive
                      </p>
                      <h2 className="text-base font-semibold text-foreground/90">
                        Reinstatement Request
                      </h2>
                    </div>

                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest shrink-0"
                      style={{
                        backgroundColor: "color-mix(in oklab, var(--blood) 10%, transparent)",
                        border: "1px solid color-mix(in oklab, var(--blood) 25%, transparent)",
                        color: "var(--blood)",
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: "var(--blood)", animation: "heartbeat 1.4s ease-in-out infinite" }}
                      />
                      Banned
                    </motion.div>
                  </div>

                  {/* ── States ── */}
                  {checkingStatus ? (
                    <div className="flex flex-col items-center py-10 gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">
                        Retrieving account status…
                      </p>
                    </div>

                  ) : unbanStatus === "approved" ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-3"
                    >
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">Decision</p>
                      <div
                        className="flex items-start gap-4 px-4 py-4 rounded-2xl"
                        style={{
                          backgroundColor: "color-mix(in oklab, var(--sage) 10%, transparent)",
                          border: "1px solid color-mix(in oklab, var(--sage) 30%, transparent)",
                        }}
                      >
                        <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--sage)" }} />
                        <div>
                          <p className="text-sm font-semibold text-foreground/90">Appeal Approved</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            Your access has been restored. Redirecting you now…
                          </p>
                        </div>
                      </div>
                    </motion.div>

                  ) : unbanStatus === "pending" ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-3"
                    >
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">Decision</p>
                      <div
                        className="flex items-start gap-4 px-4 py-4 rounded-2xl"
                        style={{
                          backgroundColor: "color-mix(in oklab, var(--amber) 8%, transparent)",
                          border: "1px solid color-mix(in oklab, var(--amber) 22%, transparent)",
                        }}
                      >
                        <Clock className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--amber)" }} />
                        <div>
                          <p className="text-sm font-semibold text-foreground/90">Under Review</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            Your appeal has been received and is awaiting administrative review.
                          </p>
                        </div>
                      </div>
                    </motion.div>

                  ) : unbanStatus === "rejected" ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-3"
                    >
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">Decision</p>
                      <div
                        className="flex items-start gap-4 px-4 py-4 rounded-2xl"
                        style={{
                          backgroundColor: "color-mix(in oklab, var(--blood) 7%, transparent)",
                          border: "1px solid color-mix(in oklab, var(--blood) 20%, transparent)",
                        }}
                      >
                        <XCircle className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--blood)" }} />
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "color-mix(in oklab, var(--blood) 85%, var(--foreground))" }}>
                            Appeal Rejected
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            This determination is final. Contact your administrator for further clarification.
                          </p>
                        </div>
                      </div>
                    </motion.div>

                  ) : (
                    <motion.form
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      onSubmit={handleSubmitAppeal}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">
                          Grounds for Reinstatement
                        </label>
                        <textarea
                          className="w-full min-h-[110px] resize-none rounded-2xl px-4 py-3 text-sm text-foreground/90 placeholder:text-muted-foreground/35 outline-none transition-all"
                          style={{
                            backgroundColor: "color-mix(in oklab, var(--secondary) 70%, transparent)",
                            border: "1px solid color-mix(in oklab, var(--charcoal) 10%, transparent)",
                          }}
                          onFocus={e => {
                            e.currentTarget.style.borderColor = "color-mix(in oklab, var(--blood) 35%, transparent)";
                            e.currentTarget.style.boxShadow = "0 0 0 3px color-mix(in oklab, var(--blood) 8%, transparent)";
                          }}
                          onBlur={e => {
                            e.currentTarget.style.borderColor = "color-mix(in oklab, var(--charcoal) 10%, transparent)";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                          placeholder="Provide a clear explanation of why your account should be reinstated…"
                          value={reason}
                          onChange={e => setReason(e.target.value)}
                          maxLength={500}
                          disabled={submitting}
                          required
                        />
                        <div className="flex justify-between items-center">
                          <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
                            Be specific. Vague requests are less likely to be approved.
                          </p>
                          <p className="text-[10px] font-mono text-muted-foreground/40 shrink-0 ml-2">
                            {reason.length}/500
                          </p>
                        </div>
                      </div>

                      <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.975 }}>
                        <Button
                          type="submit"
                          size="lg"
                          disabled={submitting || !reason.trim()}
                          className="w-full rounded-full py-6 text-base font-medium shadow-lg hover:shadow-xl transition-all"
                        >
                          {submitting ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting Appeal…</>
                          ) : (
                            <><Send className="w-4 h-4 mr-2" />Submit Appeal</>
                          )}
                        </Button>
                      </motion.div>
                    </motion.form>
                  )}

                  {/* Footer */}
                  <div
                    className="pt-4 flex items-center justify-between text-[10px] font-mono text-muted-foreground/35"
                    style={{ borderTop: "1px solid color-mix(in oklab, var(--charcoal) 7%, transparent)" }}
                  >
                    <span className="uppercase tracking-[0.12em]">Status: Account Banned</span>
                    <span>CODE: 403-BAN</span>
                  </div>

                  {/* Mobile-only sign out — lives inside the card, no extra clutter above */}
                  <div className="flex justify-center pt-1 lg:hidden">
                    <button
                      onClick={handleSignOut}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors py-1"
                    >
                      <LogOut className="w-3 h-3" />
                      Sign out of this account
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
