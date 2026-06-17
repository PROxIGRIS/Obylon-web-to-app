import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Shell } from "@/components/sentinel/Shell";
import { toast } from "@/components/ui/toast";
import {
  Users,
  UserPlus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Crown,
  Shield,
  ShieldOff,
  GraduationCap,
  HelpCircle,
  User,
  Loader2,
  Ban,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/manage-users")({
  head: () => ({
    meta: [
      { title: "Manage Users · Obylon" },
      { name: "description", content: "Manage user accounts and roles." },
    ],
  }),
  component: ManageUsers,
});

type Profile = {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  role: string | null;
  banned?: boolean;
  unbanRequest?: any;
};

// ── Role hierarchy ────────────────────────────────────────────────────────
const ROLE_HIERARCHY: Record<string, { level: number; label: string; icon: typeof Crown }> = {
  dev:       { level: 0, label: "Developer",  icon: Crown },
  principal: { level: 1, label: "Principal",  icon: Shield },
  admin:     { level: 1, label: "Admin",      icon: Shield },
  teacher:   { level: 2, label: "Teacher",    icon: GraduationCap },
  helper:    { level: 3, label: "Helper",     icon: HelpCircle },
};

// Roles visible in hierarchy display (dev is conditionally shown)
const DISPLAY_ROLES = ["dev", "principal", "admin", "teacher", "helper"];
const ALL_ROLES = ["dev", "admin", "principal", "teacher", "helper"];

function getRoleIcon(role: string | null) {
  if (!role) return User;
  return ROLE_HIERARCHY[role]?.icon ?? User;
}

function getRoleLabel(role: string | null): string {
  if (!role) return "No Role";
  return ROLE_HIERARCHY[role]?.label ?? role;
}

/** Roles the current user can assign to others. */
function assignableRoles(myRole: string | null): string[] {
  if (myRole === "dev") return ALL_ROLES;
  if (myRole === "principal" || myRole === "admin") return ["teacher", "helper"];
  if (myRole === "teacher") return ["helper"];
  return [];
}

/**
 * Whether myRole can manage (change role / ban / delete) a target.
 * - Dev can manage everyone EXCEPT other devs.
 * - Principal can manage admin, teacher, helper, unassigned — NOT other principals.
 * - Admin can manage teacher, helper, unassigned — NOT other admins or principals.
 * - Teacher can manage helper and unassigned — NOT other teachers.
 * - Helper can manage nobody.
 */
function canManage(myRole: string | null, targetRole: string | null): boolean {
  if (!myRole) return false;
  const myLevel = ROLE_HIERARCHY[myRole]?.level ?? 99;

  if (myRole === "dev") {
    // Dev manages everyone except other devs
    return targetRole !== "dev";
  }

  if (!targetRole) {
    // Unassigned users can be managed by anyone with a role
    return myLevel <= 2; // dev, principal, admin, teacher
  }

  const targetLevel = ROLE_HIERARCHY[targetRole]?.level ?? 99;

  // Can only manage users strictly below own level
  return targetLevel > myLevel;
}

/** Whether myRole can see a profile with targetRole. */
function canView(myRole: string | null, targetRole: string | null): boolean {
  if (!myRole) return false;
  // Dev sees everyone
  if (myRole === "dev") return true;
  // Non-dev users cannot see devs
  if (targetRole === "dev") return false;
  const myLevel = ROLE_HIERARCHY[myRole]?.level ?? 99;
  const targetLevel = targetRole ? (ROLE_HIERARCHY[targetRole]?.level ?? 99) : 99;
  // Teachers see only strictly lower
  if (myRole === "teacher") return targetLevel > myLevel;
  // Others see same level and below
  return targetLevel >= myLevel;
}

// ── Role badge colors ─────────────────────────────────────────────────────
function roleBadgeClasses(role: string | null): string {
  switch (role) {
    case "dev":
      return "border-amber/60 bg-amber/10 text-amber";
    case "admin":
      return "border-accent/60 bg-accent/10 text-accent-foreground/90";
    case "principal":
      return "border-accent/60 bg-accent/10 text-accent-foreground/90";
    case "teacher":
      return "border-sage/40 bg-sage/10 text-foreground/80";
    case "helper":
      return "border-border/60 bg-background/40 text-muted-foreground";
    default:
      return "border-border/60 bg-background/40 text-muted-foreground";
  }
}

function ManageUsers() {
  const { role, loading, user } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [expandedHierarchy, setExpandedHierarchy] = useState(true);

  // Create user form state
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [creating, setCreating] = useState(false);

  // Ban state
  const [banTarget, setBanTarget] = useState<Profile | null>(null);
  const [banning, setBanning] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canAccess = role === "dev" || role === "principal" || role === "admin" || role === "teacher";

  useEffect(() => {
    if (!loading && !canAccess) {
      toast.error("You don't have permission to view this page.");
      navigate({ to: "/" });
    }
  }, [loading, canAccess, navigate]);

  const reqIdRef = React.useRef(0);

  const loadData = async () => {
    const reqId = ++reqIdRef.current;
    setFetching(true);
    const { data: profs, error: profErr } = await supabase.from("profiles").select("*");
    if (reqId !== reqIdRef.current) return;
    if (profErr) {
      toast.error(profErr.message);
      setFetching(false);
      return;
    }

    const { data: roles, error: roleErr } = await supabase.from("user_roles").select("*");
    if (reqId !== reqIdRef.current) return;
    if (roleErr) {
      toast.error(roleErr.message);
      setFetching(false);
      return;
    }

    // Fetch unban requests
    const { data: unbanRes, error: unbanErr } = await supabase.from("unban_requests" as any).select("*").eq("status", "pending");
    if (reqId !== reqIdRef.current) return;

    const unbanRequests = unbanRes || [];

    const merged = (profs || []).map((p: any) => {
      const userRoleRow = (roles || []).find((r: any) => r.user_id === p.user_id);
      const isBanned = !!p.is_banned;
      const pendingReq = unbanRequests.find((req: any) => req.user_id === p.user_id);
      
      return {
        ...p,
        role: userRoleRow ? userRoleRow.role : null,
        banned: isBanned,
        unbanRequest: pendingReq || null
      };
    });

    // Banned users are shown to devs/admins even if role is null.
    // They don't have a role, so canView would fail if targetRole is null unless they have level <= 2.
    // Let's just show banned users if my level is dev/admin/principal.
    const myLevel = role ? (ROLE_HIERARCHY[role]?.level ?? 99) : 99;
    const visible = merged.filter((p: Profile) => {
      if (p.banned && myLevel <= 1) return true; // Dev, principal, admin can see banned users
      return canView(role, p.role);
    });
    setProfiles(visible);
    setFetching(false);
  };

  useEffect(() => {
    if (canAccess) {
      loadData();
    }
  }, [role, canAccess]);

  // ── Role change ──────────────────────────────────────────────────────────
  const setRole_ = async (userId: string, newRoleVal: string | null) => {
    const allowed = assignableRoles(role);
    if (newRoleVal && !allowed.includes(newRoleVal)) {
      toast.error(`You can't assign the "${getRoleLabel(newRoleVal)}" role.`);
      return;
    }
    try {
      if (!newRoleVal) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
        if (delErr) throw delErr;
        const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role: newRoleVal as any });
        if (insErr) throw insErr;
      }
      toast.success("Role updated.");
      loadData();
    } catch (err: any) {
      const hint = err?.code === "42501" || /policy|permission/i.test(err?.message ?? "")
        ? " You don't have permission for this change."
        : "";
      toast.error(`Failed to update role: ${err?.message ?? "Unknown error"}${hint}`);
    }
  };

  const handleBan = async () => {
    if (!banTarget) return;
    setBanning(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ is_banned: true } as any)
        .eq("user_id", banTarget.user_id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Permission denied or target not found (RLS silent failure)");

      const { error: banInsErr } = await supabase.from("banned_users").insert({ user_id: banTarget.user_id });
      if (banInsErr) throw banInsErr;

      toast.success(`${banTarget.display_name || banTarget.email} has been banned.`);
      setBanTarget(null);
      loadData();
    } catch (err: any) {
      toast.error(`Ban failed: ${err?.message ?? "Unknown error"}`);
    } finally {
      setBanning(false);
    }
  };

  const handleUnban = async (userId: string) => {
    try {
      // Remove ban status
      const { data, error: banErr } = await supabase
        .from("profiles")
        .update({ is_banned: false } as any)
        .eq("user_id", userId)
        .select();
        
      if (banErr) throw banErr;
      if (!data || data.length === 0) throw new Error("Permission denied or target not found (RLS silent failure)");

      const { error: banDelErr } = await supabase.from("banned_users").delete().eq("user_id", userId);
      if (banDelErr) throw banDelErr;

      // Wipe their appeal slate completely clean
      const { error: unbanReqErr } = await supabase.from("unban_requests" as any).delete().eq("user_id", userId);
      if (unbanReqErr) throw unbanReqErr;

      toast.success("User has been unbanned.");
      loadData();
    } catch (err: any) {
      toast.error(`Unban failed: ${err.message}`);
    }
  };

  // ── Delete user ──────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      console.log(`[manage-users] Attempting to delete user ${deleteTarget.user_id} (${deleteTarget.email})`);
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: deleteTarget.user_id }
      });
      
      console.log("[manage-users] delete-user response:", { data, error });
      
      if (error) {
        console.error("[manage-users] Edge function invocation error (Network/CORS/Client):", error);
        throw error;
      }
      if (data?.error) {
        console.error("[manage-users] Edge function execution error (Logic/DB):", data.error);
        throw new Error(data.error);
      }

      toast.success(`${deleteTarget.display_name || deleteTarget.email}'s account has been permanently deleted.`);
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      toast.error(`Delete failed: ${err?.message ?? "Unknown error"}`);
    } finally {
      setDeleting(false);
    }
  };

  // ── Invite operator ────────────────────────────────────────────────────────
  const handleInviteOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newRole) {
      toast.error("Email and role are required.");
      return;
    }
    
    if (newRole && !assignableRoles(role).includes(newRole)) {
      toast.error(`You can't assign the "${getRoleLabel(newRole)}" role.`);
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-operator", {
        body: { 
          email: newEmail.trim(), 
          role: newRole,
          redirectTo: window.location.origin + "/welcome"
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Invitation transmitted to "${newEmail}" for role "${getRoleLabel(newRole)}".`);
      setNewEmail("");
      setNewRole("");
      loadData();
    } catch (err: any) {
      if (err.message?.toLowerCase().includes("rate limit") || err.status === 429) {
        toast.error("You are sending too many requests. Please wait a moment and try again.");
      } else {
        toast.error(err.message || "Failed to invite operator.");
      }
    } finally {
      setCreating(false);
    }
  };

  if (loading || !canAccess) return null;

  const allowedRoles = assignableRoles(role);

  // Group profiles by role for hierarchy view
  const profilesByRole: Record<string, Profile[]> = {};
  for (const r of ALL_ROLES) {
    profilesByRole[r] = profiles.filter((p) => p.role === r);
  }
  profilesByRole["none"] = profiles.filter((p) => !p.role);

  // Which roles to show in hierarchy (hide dev from non-devs)
  const visibleHierarchyRoles = DISPLAY_ROLES.filter((r) => {
    if (r === "dev" && role !== "dev") return false;
    return true;
  });

  return (
    <Shell>
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 pt-8 pb-12 space-y-6 overflow-hidden">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="space-y-3 px-2">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.4em] text-muted-foreground font-mono font-semibold">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_10px_rgba(var(--accent),0.5)]" />
            System Administration
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight flex items-center gap-4 text-foreground">
            <Users className="w-9 h-9 text-accent hidden sm:block drop-shadow-md" />
            Manage Users
          </h1>
          <p className="text-sm text-muted-foreground/80 max-w-2xl leading-relaxed">
            Add, remove, and manage who has access to the system. Change roles, ban accounts, or remove users entirely.
          </p>
        </header>

        {/* ── Invite Operator Terminal ───────────────────────────────── */}
        <div className="relative rounded-3xl p-6 sm:p-8 border border-border/50 bg-background/40 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent opacity-50" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-accent" />
              </div>
              <h2 className="font-serif text-2xl tracking-tight font-medium text-foreground">
                Invite Operator
              </h2>
            </div>
            
            <form onSubmit={handleInviteOperator} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-5 items-end">
              <div className="space-y-2.5">
                <label htmlFor="invite-email" className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                  Operator Target (Email)
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  placeholder="operator@nexus.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-background/50 border border-border/50 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30 transition-all font-medium placeholder:text-muted-foreground/40"
                />
              </div>
              
              <div className="space-y-2.5">
                <label htmlFor="invite-role" className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                  Clearance Level
                </label>
                <select
                  id="invite-role"
                  required
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-background/50 border border-border/50 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30 transition-all font-medium cursor-pointer"
                >
                  <option value="" disabled>Select Clearance...</option>
                  {allowedRoles.map((r) => (
                    <option key={r} value={r}>
                      {getRoleLabel(r)}
                    </option>
                  ))}
                </select>
              </div>
              
              <Button
                type="submit"
                disabled={creating}
                className="w-full md:w-auto h-[50px] px-8 rounded-xl bg-foreground text-background font-bold text-sm uppercase tracking-widest gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Transmitting…
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Issue Invite
                  </>
                )}
              </Button>
            </form>
            <p className="mt-5 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              A secured invitation link will be dispatched to the provided address.
            </p>
          </div>
        </div>

        {/* ── Role Overview ──────────────────────────────────────────── */}
        <div className="rounded-3xl p-6 sm:p-8 border border-border/50 bg-background/40 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <button
            onClick={() => setExpandedHierarchy((v) => !v)}
            className="flex items-center gap-3 w-full text-left group"
          >
            {expandedHierarchy ? (
              <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-all" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform" />
            )}
            <Shield className="w-5 h-5 text-accent" />
            <h2 className="font-serif text-lg sm:text-xl tracking-tight">Who's Who</h2>
            <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {fetching ? <span className="inline-block w-12 h-3 animate-pulse bg-foreground/10 rounded-md text-transparent">...</span> : `${profiles.length} ${profiles.length === 1 ? "user" : "users"}`}
            </span>
          </button>

          {expandedHierarchy && (
            <div className="mt-4 space-y-1 overflow-x-auto">
              {fetching ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 px-3 rounded-lg animate-pulse bg-foreground/10 text-transparent">
                    <div className="w-4 h-4 rounded bg-foreground/20" />
                    <div className="w-24 h-3 rounded bg-foreground/20" />
                    <div className="w-6 h-3 rounded-full bg-foreground/20" />
                  </div>
                ))
              ) : (
                <>
                  {visibleHierarchyRoles.map((r) => {
                    const Icon = ROLE_HIERARCHY[r].icon;
                    const count = profilesByRole[r]?.length ?? 0;
                    return (
                      <div
                        key={r}
                        className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-secondary/30 transition-colors"
                        style={{ paddingLeft: `${ROLE_HIERARCHY[r].level * 24 + 12}px` }}
                      >
                        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs uppercase tracking-widest min-w-0 truncate">
                          {getRoleLabel(r)}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono border ${roleBadgeClasses(r)}`}>
                          {count}
                        </span>
                        {count > 0 && (
                          <span className="text-[10px] text-muted-foreground font-mono truncate hidden sm:inline">
                            {profilesByRole[r]
                              .slice(0, 3)
                              .map((p) => p.display_name || p.email)
                              .join(", ")}
                            {count > 3 && ` +${count - 3}`}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {/* Unassigned */}
                  <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-secondary/30 transition-colors pl-3">
                    <User className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground min-w-0 truncate">
                      No Role
                    </span>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono border border-border/60 bg-background/40 text-muted-foreground">
                      {profilesByRole["none"]?.length ?? 0}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Users List ─────────────────────────────────────────────── */}
        <div className="grid gap-6">
          <div className="glass-strong rounded-2xl p-4 sm:p-6 shadow-sm border border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
              <div className="flex items-center gap-3 min-w-0">
                <Users className="w-6 h-6 text-accent shrink-0" />
                <h2 className="font-serif text-xl sm:text-2xl tracking-tight truncate">
                  All Users
                </h2>
              </div>
            {/* ── Mobile: card list ─────────────────────────────────── */}
            <div className="sm:hidden space-y-3">
              {fetching ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border/40 p-4 space-y-3 animate-pulse bg-foreground/10 text-transparent">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="w-24 h-4 rounded bg-foreground/20" />
                        <div className="w-32 h-3 rounded bg-foreground/20" />
                      </div>
                      <div className="w-16 h-4 rounded-full bg-foreground/20" />
                    </div>
                  </div>
                ))
              ) : (
                profiles.map((p) => {
                const RoleIcon = getRoleIcon(p.role);
                const manageable = canManage(role, p.role);
                const isSelf = p.user_id === user?.id;
                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-border/40 bg-background/40 p-4 space-y-3 transition-all hover:border-border/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {p.display_name || p.email.split("@")[0]}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono truncate">
                          {p.email}
                        </p>
                      </div>
                      {p.role ? (
                        <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest ${roleBadgeClasses(p.role)}`}>
                          <RoleIcon className="w-3 h-3" />
                          {getRoleLabel(p.role)}
                        </span>
                      ) : (
                        <span className="shrink-0 inline-flex items-center rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                          None
                        </span>
                      )}
                    </div>

                    {p.banned ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUnban(p.user_id)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-amber/30 bg-amber/5 text-amber hover:bg-amber/15 text-xs font-medium transition-all"
                          >
                            Unban
                          </button>
                          <button
                            onClick={() => setDeleteTarget(p)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/15 text-xs font-medium transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : manageable && !isSelf ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <select
                            className="flex-1 text-xs bg-background border border-border/50 rounded px-2 py-2 focus:outline-none focus:border-accent transition-colors"
                            value={p.role || ""}
                            onChange={(e) => setRole_(p.user_id, e.target.value || null)}
                          >
                            <option value="">No Role</option>
                            {allowedRoles.map((r) => (
                              <option key={r} value={r}>{getRoleLabel(r)}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setBanTarget(p)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-amber/30 bg-amber/5 text-amber hover:bg-amber/15 text-xs font-medium transition-all"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Ban
                          </button>
                          <button
                            onClick={() => setDeleteTarget(p)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/15 text-xs font-medium transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : isSelf ? (
                      <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">You</p>
                    ) : (
                      <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">Protected</p>
                    )}
                  </div>
                );
              }))}
              {profiles.length === 0 && !fetching && (
                <p className="text-center text-xs text-muted-foreground italic py-6">No users found.</p>
              )}
            </div>

            {/* ── Desktop: table ──────────────────────────────────── */}
            <div className="hidden sm:block overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
              <div className="min-w-[640px] rounded-xl border border-border/40 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-secondary/40 text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Change Role</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {fetching ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i} className="animate-pulse bg-foreground/10 text-transparent">
                          <td className="px-4 py-4 whitespace-nowrap"><div className="w-32 h-4 rounded bg-foreground/20" /></td>
                          <td className="px-4 py-4 whitespace-nowrap"><div className="w-48 h-4 rounded bg-foreground/20" /></td>
                          <td className="px-4 py-4 whitespace-nowrap"><div className="w-16 h-4 rounded-full bg-foreground/20" /></td>
                          <td className="px-4 py-4 whitespace-nowrap"><div className="w-20 h-4 rounded bg-foreground/20" /></td>
                          <td className="px-4 py-4 whitespace-nowrap text-right"><div className="w-16 h-4 rounded bg-foreground/20 ml-auto" /></td>
                        </tr>
                      ))
                    ) : (
                      profiles.map((p) => {
                      const RoleIcon = getRoleIcon(p.role);
                      const manageable = canManage(role, p.role);
                      const isSelf = p.user_id === user?.id;
                      return (
                        <tr key={p.id} className="hover:bg-secondary/20 transition-colors group">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="font-medium truncate block max-w-[180px]">
                              {p.display_name || p.email.split("@")[0]}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-muted-foreground">
                            <span className="truncate block max-w-[220px]">{p.email}</span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {p.banned ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-destructive/50 bg-destructive/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-destructive">
                                <Ban className="w-3 h-3" />
                                Banned
                              </span>
                            ) : p.role ? (
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest ${roleBadgeClasses(p.role)}`}>
                                <RoleIcon className="w-3 h-3" />
                                {getRoleLabel(p.role)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                                None
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {p.banned ? (
                              <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                                Revoked
                              </span>
                            ) : manageable && !isSelf ? (
                              <select
                                className="text-xs bg-background border border-border/50 rounded px-2 py-1.5 focus:outline-none focus:border-accent cursor-pointer transition-colors"
                                value={p.role || ""}
                                onChange={(e) => setRole_(p.user_id, e.target.value || null)}
                              >
                                <option value="">No Role</option>
                                {allowedRoles.map((r) => (
                                  <option key={r} value={r}>{getRoleLabel(r)}</option>
                                ))}
                              </select>
                            ) : isSelf ? (
                              <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                                You
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                                Protected
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right whitespace-nowrap">
                            {p.banned ? (
                              <div className="flex items-center justify-end gap-1.5">
                                {p.unbanRequest ? (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-7 text-[10px] font-mono uppercase bg-amber/10 text-amber hover:bg-amber/20 border-amber/20"
                                    onClick={() => {
                                      toast(`Appeal Reason: ${p.unbanRequest.reason}`, {
                                        action: {
                                          label: "Unban User",
                                          onClick: () => handleUnban(p.user_id)
                                        },
                                        duration: 10000
                                      });
                                    }}
                                  >
                                    Review Appeal
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[10px] font-mono uppercase opacity-60 hover:opacity-100"
                                    onClick={() => handleUnban(p.user_id)}
                                  >
                                    Unban
                                  </Button>
                                )}
                                <button
                                  onClick={() => setDeleteTarget(p)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/15 hover:border-destructive/50 text-[10px] font-mono uppercase tracking-widest transition-all opacity-60 group-hover:opacity-100"
                                  title={`Delete ${p.display_name || p.email}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ) : manageable && !isSelf ? (
                              <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => setBanTarget(p)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber/30 bg-amber/5 text-amber hover:bg-amber/15 hover:border-amber/50 text-[10px] font-mono uppercase tracking-widest transition-all"
                                  title={`Ban ${p.display_name || p.email}`}
                                >
                                  <Ban className="w-3 h-3" />
                                  Ban
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(p)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/15 hover:border-destructive/50 text-[10px] font-mono uppercase tracking-widest transition-all"
                                  title={`Delete ${p.display_name || p.email}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    }))}
                    {profiles.length === 0 && !fetching && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground italic text-xs">
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Ban Confirmation Dialog ─────────────────────────────────────── */}
      <Dialog open={!!banTarget} onOpenChange={(open) => !open && setBanTarget(null)}>
        <DialogContent className="sm:max-w-md overflow-hidden p-0">
          {/* Red gradient header */}
          <div className="relative px-6 pt-8 pb-6 bg-gradient-to-br from-amber/10 via-destructive/10 to-destructive/5 border-b border-destructive/20">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(220,38,38,0.08),transparent_70%)]" />
            <div className="relative flex items-start gap-4">
              <div className="shrink-0 w-12 h-12 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                <ShieldOff className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <DialogTitle className="font-serif text-2xl tracking-tight text-foreground">
                  Ban User
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm">
                  Are you sure you want to ban{" "}
                  <strong className="text-foreground">{banTarget?.display_name || banTarget?.email}</strong>?
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-destructive/5 border border-destructive/15">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                <p className="font-medium text-foreground/80 mb-1">What happens when you ban someone:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Their profile will be flagged as banned.</li>
                  <li>They will be immediately locked out of the grid and redirected to the revoked access terminal.</li>
                  <li>Their existing operator roles will remain intact but suspended until an unban is issued.</li>
                </ul>
              </div>
            </div>

            {banTarget && (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-secondary/20">
                <User className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{banTarget.display_name || banTarget.email.split("@")[0]}</p>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">{banTarget.email}</p>
                </div>
                {banTarget.role && (
                  <span className={`ml-auto shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest ${roleBadgeClasses(banTarget.role)}`}>
                    {getRoleLabel(banTarget.role)}
                  </span>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="px-6 pb-6 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBanTarget(null)}
              className="font-mono text-xs uppercase tracking-widest"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleBan}
              disabled={banning}
              className="font-mono text-xs uppercase tracking-widest gap-1.5 bg-gradient-to-r from-destructive to-destructive/80 hover:from-destructive/90 hover:to-destructive/70 shadow-lg shadow-destructive/20"
            >
              {banning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Banning…
                </>
              ) : (
                <>
                  <Ban className="w-3.5 h-3.5" />
                  Ban User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ──────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md overflow-hidden p-0">
          <div className="relative px-6 pt-8 pb-6 bg-gradient-to-br from-destructive/10 via-destructive/5 to-background border-b border-destructive/20">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(220,38,38,0.1),transparent_70%)]" />
            <div className="relative flex items-start gap-4">
              <div className="shrink-0 w-12 h-12 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <DialogTitle className="font-serif text-2xl tracking-tight text-foreground">
                  Delete Account
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm">
                  Permanently remove{" "}
                  <strong className="text-foreground">{deleteTarget?.display_name || deleteTarget?.email}</strong>'s
                  account from the system.
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-destructive/5 border border-destructive/15">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                <p className="font-medium text-destructive mb-1">⚠ This cannot be undone</p>
                <p>The user's profile, role, and all associated data will be permanently removed. They will need to be re-created from scratch.</p>
              </div>
            </div>

            {deleteTarget && (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-secondary/20">
                <User className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{deleteTarget.display_name || deleteTarget.email.split("@")[0]}</p>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">{deleteTarget.email}</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 pb-6 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="font-mono text-xs uppercase tracking-widest"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="font-mono text-xs uppercase tracking-widest gap-1.5 bg-gradient-to-r from-destructive to-destructive/80 hover:from-destructive/90 hover:to-destructive/70 shadow-lg shadow-destructive/20"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Account
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </Shell>
  );
}
