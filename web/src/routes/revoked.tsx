import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LogOut, ShieldAlert, MonitorOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/revoked")({
  head: () => ({
    meta: [
      { title: "Session Revoked · Dossier Archive" },
      { name: "theme-color", content: "#fcfaf2" },
    ],
  }),
  component: RevokedPage,
});

function RevokedPage() {
  const { user, signOut, loading, isRevoked } = useAuth();
  const navigate = useNavigate();
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
    if (!loading && user && !isRevoked) {
      navigate({ to: "/" });
    }
  }, [loading, user, isRevoked, navigate]);

  if (loading || !user || !isRevoked)
    return <div className="h-screen bg-background" />;

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
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

      {/* ── Main layout ── */}
      <section className="relative min-h-screen flex items-center justify-center">
        <div className="container mx-auto px-5 lg:px-16 py-12 lg:py-20 flex justify-center">

          <div className="max-w-xl w-full">

            {/* ── RIGHT: Revoked Card ── */}
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative text-center sm:text-left">
                {/* Glow */}
                <div
                  className="absolute inset-0 rounded-3xl blur-2xl scale-105 -z-10"
                  style={{
                    background:
                      "linear-gradient(135deg, color-mix(in oklab, var(--blood) 14%, transparent) 0%, color-mix(in oklab, var(--charcoal) 12%, transparent) 100%)",
                  }}
                />

                <div
                  className="relative rounded-3xl p-6 lg:p-10 space-y-8"
                  style={{
                    background:
                      "linear-gradient(160deg, color-mix(in oklab, var(--card) 94%, transparent) 0%, color-mix(in oklab, var(--card) 84%, transparent) 100%)",
                    border: "1px solid color-mix(in oklab, var(--charcoal) 10%, transparent)",
                    boxShadow:
                      "0 0 0 1px oklch(1 0 0 / 0.5) inset, 0 8px 32px -8px oklch(0.27 0.005 270 / 0.18), 0 32px 64px -24px oklch(0.27 0.005 270 / 0.14)",
                    backdropFilter: "blur(16px)",
                  }}
                >
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                    <div className="relative shrink-0">
                      <div className="w-20 h-20 rounded-2xl bg-rose-500/10 flex items-center justify-center relative z-10 border border-rose-500/20">
                        <MonitorOff className="w-10 h-10 text-rose-500" />
                      </div>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-rose-500/20 rounded-2xl animate-ping opacity-75" />
                    </div>
                    
                    <div className="space-y-3">
                      <h1 className="text-3xl font-bold tracking-tight text-foreground">Session Revoked</h1>
                      <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
                        This device's active session has been administratively revoked. 
                        You must re-authenticate to restore system access.
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-center sm:justify-start">
                    <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.975 }} className="w-full sm:w-auto">
                      <Button
                        onClick={handleSignOut}
                        size="lg"
                        className="w-full sm:w-auto rounded-full py-6 px-10 text-base font-medium shadow-lg hover:shadow-xl transition-all"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Acknowledge & Sign In
                      </Button>
                    </motion.div>
                  </div>

                  {/* Footer */}
                  <div
                    className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[10px] font-mono text-muted-foreground/40"
                    style={{ borderTop: "1px solid color-mix(in oklab, var(--charcoal) 7%, transparent)" }}
                  >
                    <span className="uppercase tracking-[0.12em]">Status: Device Revoked</span>
                    <span>CODE: 401-REV</span>
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
