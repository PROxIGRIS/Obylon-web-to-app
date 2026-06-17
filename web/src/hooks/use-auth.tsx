import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate, Navigate, useRouterState } from "@tanstack/react-router";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  user_id?: string;
  email?: string | null;
  display_name: string | null;
  avatar_url?: string | null;
  is_banned?: boolean;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  role: "principal" | "dev" | "teacher" | "helper" | "admin" | null;
  loading: boolean;
  isBanned: boolean;
  isRevoked: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  profile: null,
  isAdmin: false,
  role: null,
  loading: true,
  isBanned: false,
  isRevoked: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<"principal" | "dev" | "teacher" | "helper" | "admin" | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const [isRevoked, setIsRevoked] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const ROLE_PRIORITY = ["dev", "admin", "principal", "teacher", "helper"] as const;

    const fetchUserData = async (userId: string, userEmail: string | null) => {
      try {
        // Concurrent fetch — roles + profile + ban status in parallel.
        // CRITICAL: profiles.user_id is the FK to auth.uid(), NOT profiles.id (random PK).
        // Earlier `.eq("id", userId)` always returned null → no profile, no avatar.
        const sessionId = localStorage.getItem("local_session_id");
        const promises: Promise<any>[] = [
          supabase.from("user_roles").select("role").eq("user_id", userId),
          supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle()
        ];
        
        if (sessionId) {
          promises.push(supabase.from("user_sessions").select("status").eq("id", sessionId).maybeSingle());
        }

        const [rolesRes, profileRes, sessionRes] = await Promise.all(promises);

        if (!mounted) return;

        if (rolesRes.error) {
          console.error("fetchRole error:", rolesRes.error.message, rolesRes.error.code);
          setRole(null);
          setIsAdmin(false);
        } else {
          const roles = (rolesRes.data ?? []).map((r: any) => r.role).filter(Boolean);
          const top = ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null;
          setRole(top as any);
          setIsAdmin(!!top);
        }

        if (profileRes.error) {
          console.error("fetchProfile error:", profileRes.error.message);
          setProfile(null);
          setIsBanned(false);
        } else if (profileRes.data) {
          setProfile(profileRes.data as Profile);
          setIsBanned(!!(profileRes.data as any).is_banned);
        } else {
          if (mounted) setProfile(null);
        }

        if (sessionRes && !sessionRes.error && sessionRes.data?.status === 'revoked') {
          setIsRevoked(true);
          localStorage.setItem(`session_status_${sessionId}`, 'revoked');
        } else if (sessionId) {
          localStorage.setItem(`session_status_${sessionId}`, 'active');
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
        if (mounted) {
          setRole(null);
          setIsAdmin(false);
          setProfile(null);
          setIsBanned(false);
          setIsRevoked(false);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const initializeAuth = async () => {
      try {
        // 1. Intercept PKCE tokens BEFORE doing anything else
        const searchParams = new URLSearchParams(window.location.search);
        const token_hash = searchParams.get("token_hash");
        const type = searchParams.get("type");

        if (token_hash && type) {
          // Scrub URL instantly to prevent router loops
          window.history.replaceState(null, "", window.location.pathname);
          // Await verification so the session is securely established
          await supabase.auth.verifyOtp({ token_hash, type: type as any });
        }

        // 2. Fetch the session ONLY after tokens are processed
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session?.user) {
          // fetchUserData handles releasing the loading state via finally{} block
          await fetchUserData(session.user.id, session.user.email ?? null);
        } else {
          if (mounted) setLoading(false);
        }
      } catch (err) {
        console.error("Auth initialization failed:", err);
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    // 3. Mount listener for subsequent changes
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        setTimeout(() => fetchUserData(s.user.id, s.user.email ?? null), 0);
      } else {
        setRole(null);
        setIsAdmin(false);
        setProfile(null);
        setIsBanned(false);
        setIsRevoked(false);
        setLoading(false);
      }
    });

    const failsafe = setTimeout(() => { if (mounted) setLoading(false); }, 5000);

    return () => {
      mounted = false;
      clearTimeout(failsafe);
      sub.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;

  // Real-time ban check
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase.channel('user_ban_status')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        const banned = !!(payload.new as any).is_banned;
        setIsBanned(banned);
        setProfile((prev) => prev ? { ...prev, is_banned: banned } : prev);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Real-time device revocation check
  useEffect(() => {
    if (!user) return;
    const sessionId = localStorage.getItem("local_session_id");
    if (!sessionId) return;

    if (localStorage.getItem(`session_status_${sessionId}`) === 'revoked') {
      setIsRevoked(true);
    }
    
    const channel = supabase.channel('user_session_status')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'user_sessions',
        filter: `id=eq.${sessionId}`
      }, (payload) => {
        const isRev = (payload.new as any).status === 'revoked';
        setIsRevoked(isRev);
        localStorage.setItem(`session_status_${sessionId}`, isRev ? 'revoked' : 'active');
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'user_sessions',
        filter: `id=eq.${sessionId}`
      }, () => {
        setIsRevoked(true);
        localStorage.setItem(`session_status_${sessionId}`, 'revoked');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Merge avatar_url from user_metadata so profile changes show instantly,
  // even before the DB column exists in older schemas.
  const mergedProfile: Profile | null = profile
    ? {
        ...profile,
        avatar_url:
          (profile.avatar_url as string | null | undefined) ??
          ((user?.user_metadata?.avatar_url as string | undefined) ?? null),
        display_name: profile.display_name ?? null,
      }
    : null;

  const refreshProfile = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", u.user.id)
      .maybeSingle();
    if (data) setProfile(data as Profile);
    // Force user re-read so user_metadata (avatar_url) updates downstream.
    setSession((s) => (s ? { ...s, user: u.user } : s));
  };

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        profile: mergedProfile,
        isAdmin,
        role,
        loading,
        isBanned,
        isRevoked,
        signOut: async () => {
          await supabase.auth.signOut();
          navigate({ to: "/login" });
        },
        refreshProfile,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isBanned, isRevoked, loading, user } = useAuth();
  const { location } = useRouterState();
  const path = location.pathname;

  // Freeze rendering until the initialization lock releases
  if (loading) return <div className="min-h-screen bg-background" />;

  const isAuthRoute = path === '/login' || path === '/forgot-password' || path === '/reset-password';
  const isWelcomeRoute = path === '/welcome';

  if (user) {
    // Rely solely on the metadata flag set by the Edge Function
    const needsSetup = user.user_metadata?.needs_setup === true;

    // Force new users to /welcome
    if (needsSetup && !isWelcomeRoute) {
      return <Navigate replace to="/welcome"/>;
    }
    
    // Kick fully setup users away from auth and onboarding pages
    if (!needsSetup && (isAuthRoute || isWelcomeRoute)) {
      return <Navigate replace to="/"/>;
    }
  }

  // Handle active bans/revocations
  if (isBanned && path !== '/banned') return <Navigate replace to="/banned"/>;
  if (isRevoked && path !== '/revoked') return <Navigate replace to="/revoked"/>;
  
  // Failsafe: Protect internal routes from unauthenticated users
  if (!user && !isAuthRoute && !isWelcomeRoute && path !== '/banned' && path !== '/revoked') {
    return <Navigate replace to="/login"/>;
  }

  return <>{children}</>;
}
