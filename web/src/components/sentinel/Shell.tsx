import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useNativeShell } from "@/hooks/use-native-shell";
import { useSimpleMode } from "@/hooks/use-simple-mode";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AppWindow,
  Shield,
  LogOut,
  Sparkles,
  AlertTriangle,
  X,
  Server,
  Pencil,
  Bell,
  Settings,
  Users,
  Gavel,
} from "lucide-react";
import { AvatarRing } from "@/components/sentinel/AvatarRing";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/toast";


export function Shell({ children }: { children: ReactNode }) {
  const { user, profile, role, loading, isBanned, signOut, refreshProfile } = useAuth();

  const { location } = useRouterState();
  const navigate = useNavigate();
  const path = location.pathname;
  const isAuthRoute = path === "/login" || path.startsWith("/auth") || path === "/welcome" || path === "/forgot-password" || path === "/reset-password";
  const shell = useNativeShell();
  const native = shell !== "web";
  const [simple, setSimple] = useSimpleMode();



  // Real-time unban request notifications for admins
  useEffect(() => {
    if (loading || !role || !['dev', 'admin', 'principal'].includes(role)) return;

    const channel = supabase.channel('appeals_notifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'unban_requests' 
      }, (payload) => {
        const newAppeal = payload.new;
        toast.message("New Unban Appeal", {
          description: `Reason: ${newAppeal.reason}`,
          icon: <Bell className="w-4 h-4 text-amber" />,
          action: {
            label: "Review",
            onClick: () => navigate({ to: "/appeals" })
          },
          duration: 10000
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loading, role, navigate]);
  
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Teacher";
  const displayRole = role === "dev" ? "Developer" : role === "admin" ? "Administrator" : role === "principal" ? "Principal" : "Teacher";

  const nav = [
    { to: "/", label: "Dashboard", icon: Activity },
    { to: "/apps", label: "Apps", icon: AppWindow },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  if (role && ["dev", "admin", "principal"].includes(role)) {
    nav.push({ to: "/manage-users", label: "Users", icon: Users });
    nav.push({ to: "/appeals", label: "Appeals", icon: Gavel });
  }



  return (
    <div
      className="bg-background text-foreground min-h-screen flex flex-col selection:bg-foreground/10"
      data-shell={shell}
      style={
        native
          ? {
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
              paddingLeft: "env(safe-area-inset-left)",
              paddingRight: "env(safe-area-inset-right)",
            }
          : undefined
      }
    >
      {user && !isAuthRoute && (
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-2xl border-b border-border/40">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            
            {/* Left: Monochrome Brand Identity */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center shadow-md">
                <Shield className="w-4 h-4" />
              </div>
              <h1 className="font-serif text-[19px] font-medium tracking-tight text-foreground mt-0.5">
                Obylon
              </h1>
            </div>

            {/* Center: The 2026 Floating Island (Desktop) */}
            {/* Added loading opacity transition to prevent layout flash */}
            <nav 
              className={`hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2 p-1.5 rounded-full border border-border/60 bg-background/70 backdrop-blur-xl shadow-xl transition-all duration-500 ease-out ${
                loading ? "opacity-0 scale-95" : "opacity-100 scale-100"
              }`}
            >
              {nav.map((n) => {
                const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
                const Icon = n.icon;
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={`relative px-4 py-2 rounded-full text-xs font-semibold tracking-wide flex items-center gap-2 transition-all duration-300 ${
                      active
                        ? "bg-foreground text-background shadow-md"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {n.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right: Operator Profile (Monochrome) */}
            <div className="hidden md:flex items-center gap-4">
              <button
                onClick={() => setSimple(!simple)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all duration-300 ${
                  simple
                    ? "border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    : "border-foreground/20 text-foreground bg-foreground/5 shadow-sm"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {simple ? "Simple Interface" : "Advanced Interface"}
              </button>

              <div className="flex items-center gap-4 pl-4 border-l border-border/40">
                <Link to="/appeals" className="relative p-2 rounded-full hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-destructive animate-pulse" />
                </Link>

                <div className="text-right">
                  <p className="font-semibold text-sm text-foreground leading-none">
                    {displayName}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1.5 leading-none uppercase tracking-widest font-mono">
                    {displayRole}
                  </p>
                </div>
                <Link
                  to="/settings"
                  className="rounded-full transition-transform hover:scale-105 active:scale-95 block"
                  aria-label="Settings"
                  title="Settings"
                >
                  <AvatarRing
                    uuid={user?.id}
                    name={profile?.display_name ?? displayName}
                    email={user?.email}
                    avatarUrl={profile?.avatar_url ?? null}
                    size={36}
                    status="online"
                  />
                </Link>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/login", replace: true });
                }}
                className="w-9 h-9 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>

            {/* Mobile: Avatar on the right (Discord-style ring) */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="md:hidden rounded-full transition-transform active:scale-95"
              aria-label="Open profile menu"
            >
              <AvatarRing
                uuid={user?.id}
                name={profile?.display_name ?? displayName}
                email={user?.email}
                avatarUrl={profile?.avatar_url ?? null}
                size={32}
                status="online"
              />
            </button>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 pb-28 md:pb-8">
        {children}
      </main>

      {/* Monochrome Desktop Footer */}
      {user && !isAuthRoute && (
        <footer className="hidden md:flex border-t border-border/30 bg-background/50 backdrop-blur-md py-3 px-6">
          <div className="max-w-[1600px] w-full mx-auto flex justify-between items-center font-mono text-[10px] text-muted-foreground">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-foreground animate-pulse" />
              <span>Classroom Monitoring Active</span>
            </div>
            <div>
              Obylon System
            </div>
          </div>
        </footer>
      )}

      {/* The 2026 Floating Mobile Dock */}
      {user && !isAuthRoute && (
        <nav 
          className={`md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-40 bg-background/80 backdrop-blur-2xl border border-border/50 p-2 rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.2)] transition-all duration-500 ease-out ${
            loading ? "opacity-0 translate-y-8" : "opacity-100 translate-y-0"
          }`}
        >
          <div className="flex items-center justify-between px-2">
            {nav.map((n) => {
              const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className="relative flex flex-col items-center justify-center w-14 h-12 group"
                >
                  <div className={`flex flex-col items-center justify-center transition-all duration-300 z-10 ${active ? "-translate-y-1" : "translate-y-0"}`}>
                    <div className={`p-2 rounded-full transition-colors duration-300 ${active ? "bg-foreground text-background shadow-md" : "text-muted-foreground group-hover:text-foreground/80"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`absolute -bottom-3 text-[9px] font-semibold tracking-wide transition-all duration-300 ${active ? "opacity-100 text-foreground" : "opacity-0 translate-y-2"}`}>
                      {n.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* The Mobile Menu Drawer (Slide-up Overlay) */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setMobileDrawerOpen(false)}
          />
          
          <div className="relative bg-background border-t border-border/20 rounded-t-[2rem] p-6 pb-safe animate-in slide-in-from-bottom-[100%] duration-300 shadow-2xl">
            <button 
              onClick={() => setMobileDrawerOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile Block */}
            <div className="w-full flex items-center gap-4 mb-6 pt-2 text-left">
              <Link to="/appeals" className="relative p-2 rounded-full bg-secondary/50 hover:bg-secondary transition-colors shrink-0" onClick={() => setMobileDrawerOpen(false)}>
                <Bell className="w-6 h-6 text-foreground" />
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-destructive animate-pulse border-2 border-background" />
              </Link>

              <Link
                to="/settings"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-4 flex-1 min-w-0 active:opacity-70 transition-opacity"
              >
                <AvatarRing
                  uuid={user?.id}
                  name={profile?.display_name ?? displayName}
                  email={user?.email}
                  avatarUrl={profile?.avatar_url ?? null}
                  size={56}
                  ringWidth={4}
                  ringGap={3}
                  status="online"
                />
                <div className="pr-2 flex-1 min-w-0">
                  <h3 className="font-serif text-xl text-foreground tracking-tight truncate">{displayName}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-1 uppercase tracking-widest">{displayRole}</p>
                </div>
              </Link>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 mb-4">
              <Link
                to="/settings"
                onClick={() => setMobileDrawerOpen(false)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border border-border/40 bg-secondary/30 hover:bg-secondary/60 active:bg-secondary transition-colors"
              >
                <Settings className="w-5 h-5 text-foreground" />
                <span className="font-semibold text-sm text-foreground">Settings</span>
              </Link>

              <button
                onClick={() => { setSimple(!simple); setMobileDrawerOpen(false); }}
                className="w-full flex items-center justify-between p-4 rounded-2xl border border-border/40 bg-secondary/30 hover:bg-secondary/60 active:bg-secondary transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-foreground" />
                  <span className="font-semibold text-sm text-foreground">{simple ? "Simple Interface" : "Advanced Interface"}</span>
                </div>
                {/* Monochrome Toggle Switch */}
                <div className={`w-11 h-6 rounded-full border flex items-center px-1 transition-colors ${!simple ? "bg-foreground border-foreground justify-end" : "bg-secondary border-border/60 justify-start"}`}>
                  <div className={`w-4 h-4 rounded-full ${!simple ? "bg-background" : "bg-muted-foreground/60"}`} />
                </div>
              </button>

              <button
                onClick={async () => { 
                  setMobileDrawerOpen(false); 
                  await signOut(); 
                  navigate({ to: "/login", replace: true });
                }}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border border-destructive/20 bg-destructive/5 text-destructive active:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-semibold text-sm">Sign Out</span>
              </button>
            </div>
            
            <div className="mt-6 flex justify-center">
                <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
                  <Server className="w-3.5 h-3.5" />
                  <span>Obylon System</span>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

