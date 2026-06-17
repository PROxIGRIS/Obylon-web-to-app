import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Shell } from "@/components/sentinel/Shell";
import { toast } from "@/components/ui/toast";
import {
  UserCog,
  Server,
  UserPlus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Crown,
  Shield,
  GraduationCap,
  HelpCircle,
  User,
  Loader2,
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

export const Route = createFileRoute("/dev")({
  head: () => ({
    meta: [
      { title: "Access Control · Obylon by Umbraxis" },
      { name: "description", content: "Role management center." },
    ],
  }),
  component: DevDashboard,
});

type Profile = {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  role: string | null;
};

// ── Role hierarchy definition ─────────────────────────────────────────────
// The hierarchy determines who can manage whom.
// Level 0 = highest authority, level 4 = lowest.
const ROLE_HIERARCHY: Record<string, { level: number; label: string; icon: typeof Crown }> = {
  dev:        { level: 0, label: "Developer",  icon: Crown },
  admin:      { level: 1, label: "Admin",      icon: Shield },
  principal:  { level: 1, label: "Principal",  icon: Shield },
  teacher:    { level: 2, label: "Teacher",    icon: GraduationCap },
  helper:     { level: 3, label: "Helper",     icon: HelpCircle },
};

const ALL_ROLES = ["dev", "admin", "principal", "teacher", "helper"];

function getRoleIcon(role: string | null) {
  if (!role) return User;
  return ROLE_HIERARCHY[role]?.icon ?? User;
}


function getRoleLabel(role: string | null): string {
  if (!role) return "No Role";
  return ROLE_HIERARCHY[role]?.label ?? role;
}

/** Roles that a user with `myRole` is allowed to assign. */
function assignableRoles(myRole: string | null): string[] {
  if (myRole === "dev") return ALL_ROLES;
  if (myRole === "principal" || myRole === "admin") return ["teacher", "helper"];
  if (myRole === "teacher") return ["helper"];
  return [];
}

/** Whether `myRole` can modify a target that currently has `targetRole`. */
function canManage(myRole: string | null, targetRole: string | null): boolean {
  if (!myRole) return false;
  if (myRole === "dev") return true;
  if (myRole === "principal" || myRole === "admin") {
    return !targetRole || targetRole === "teacher" || targetRole === "helper";
  }
  if (myRole === "teacher") {
    return !targetRole || targetRole === "helper";
  }
  return false;
}

/** Whether `myRole` is allowed to even see a profile with `targetRole`. */
function canView(myRole: string | null, targetRole: string | null): boolean {
  if (!myRole) return false;
  if (myRole === "dev") return true;
  const myLevel = ROLE_HIERARCHY[myRole]?.level ?? 99;
  const targetLevel = targetRole ? (ROLE_HIERARCHY[targetRole]?.level ?? 99) : 99;
  // Teachers only see strictly-lower (helpers + unassigned), never peers.
  if (myRole === "teacher") return targetLevel > myLevel;
  return targetLevel >= myLevel;
}

// ── Role badge colors (themed to the paper/archive aesthetic) ─────────
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

function DevDashboard() {
  const { role, loading } = useAuth();
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

  const canAccess = role === "dev" || role === "principal" || role === "admin" || role === "teacher";
  useEffect(() => {
    if (!loading && !canAccess) {
      toast.error("Unauthorized: Elevated access required.");
      navigate({ to: "/" });
    }
  }, [loading, canAccess, navigate]);

  const reqIdRef = React.useRef(0);

  const loadData = async () => {
    const reqId = ++reqIdRef.current;
    setFetching(true);
    // Fetch profiles
    const { data: profs, error: profErr } = await supabase.from("profiles").select("*");
    if (reqId !== reqIdRef.current) return;
    if (profErr) {
      toast.error(profErr.message);
      setFetching(false);
      return;
    }

    // Fetch roles
    const { data: roles, error: roleErr } = await supabase.from("user_roles").select("*");
    if (reqId !== reqIdRef.current) return;
    if (roleErr) {
      toast.error(roleErr.message);
      setFetching(false);
      return;
    }

    const merged = (profs || []).map((p: any) => {
      const userRoleRow = (roles || []).find((r: any) => r.user_id === p.user_id);
      return {
        ...p,
        role: userRoleRow ? userRoleRow.role : null,
      };
    });
    // Hierarchy visibility filter — never expose emails of users at higher authority.
    const visible = merged.filter((p: Profile) => canView(role, p.role));
    setProfiles(visible);
    setFetching(false);
  };

  useEffect(() => {
    if (canAccess) {
      loadData();
    }
  }, [role, canAccess]);

  const setRole_ = async (userId: string, newRole: string | null) => {
    const allowed = assignableRoles(role);
    if (newRole && !allowed.includes(newRole)) {
      toast.error(`Your role (${role ?? "none"}) cannot assign '${newRole}'. Allowed: ${allowed.join(", ") || "none"}.`);
      return;
    }
    try {
      if (!newRole) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
        if (delErr) throw delErr;
        const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
        if (insErr) throw insErr;
      }
      toast.success("Role updated successfully.");
      loadData();
    } catch (err: any) {
      const code = err?.code ? ` [${err.code}]` : "";
      const hint = err?.code === "42501" || /policy|permission/i.test(err?.message ?? "")
        ? " — RLS denied: your role lacks permission for this change."
        : "";
      toast.error(`Failed to assign role${code}: ${err?.message ?? "Unknown error"}${hint}`);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) {
      toast.error("Email and password are required.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    // Check hierarchy guard before creating
    if (newRole && !assignableRoles(role).includes(newRole)) {
      toast.error(`Your role (${role}) cannot assign '${newRole}'.`);
      return;
    }

    setCreating(true);
    try {
      // Create the user via Supabase auth.signUp (works with publishable key)
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: {
          data: { display_name: newDisplayName || newEmail.split("@")[0] },
        },
      });

      if (signUpErr) {
        throw new Error(signUpErr.message);
      }

      const newUserId = signUpData?.user?.id;
      if (!newUserId) {
        throw new Error("User created but no ID returned.");
      }

      toast.success(`User "${newEmail}" created. ${signUpData?.user?.email_confirmed_at ? "" : "Email confirmation may be required."}`);

      // Assign role if specified (uses the current user's session + RLS)
      if (newRole) {
        const { error: roleErr } = await supabase
          .from("user_roles")
          .insert({ user_id: newUserId, role: newRole as any });

        if (roleErr) {
          toast.warning(`User created but role assignment failed: ${roleErr.message}`);
        } else {
          toast.success(`Role "${getRoleLabel(newRole)}" assigned.`);
        }
      }

      // Reset form & close dialog
      setNewEmail("");
      setNewPassword("");
      setNewDisplayName("");
      setNewRole("");
      setShowCreateDialog(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create user.");
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

  return (
    <Shell>
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 pt-8 pb-12 space-y-6 overflow-hidden">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] sm:text-[11px] uppercase tracking-[0.4em] text-muted-foreground font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-accent heartbeat-dot" />
            Dev Environment
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl tracking-tight flex items-center gap-3">
            <Server className="w-8 h-8 text-accent hidden sm:block" />
            System Control
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Highest authority control panel. Manage roles, create users, and maintain organizational hierarchy.
          </p>
        </header>

        {/* ── Hierarchy Overview ─────────────────────────────────────── */}
        <div className="glass-strong rounded-2xl p-4 sm:p-6 shadow-sm border border-border/50">
          <button
            onClick={() => setExpandedHierarchy((v) => !v)}
            className="flex items-center gap-2 w-full text-left"
          >
            {expandedHierarchy ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <Crown className="w-5 h-5 text-amber" />
            <h2 className="font-serif text-lg sm:text-xl tracking-tight">Role Hierarchy</h2>
            <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {profiles.length} users
            </span>
          </button>

          {expandedHierarchy && (
            <div className="mt-4 space-y-1 overflow-x-auto">
              {ALL_ROLES.map((r) => {
                const Icon = ROLE_HIERARCHY[r].icon;
                const count = profilesByRole[r].length;
                return (
                  <div
                    key={r}
                    className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-secondary/30 transition-colors"
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
              {/* No role */}
              <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-secondary/30 transition-colors pl-3">
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground min-w-0 truncate">
                  Unassigned
                </span>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono border border-border/60 bg-background/40 text-muted-foreground">
                  {profilesByRole["none"].length}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Identity Access Management ─────────────────────────────── */}
        <div className="grid gap-6">
          <div className="glass-strong rounded-2xl p-4 sm:p-6 shadow-sm border border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
              <div className="flex items-center gap-3 min-w-0">
                <UserCog className="w-6 h-6 text-accent shrink-0" />
                <h2 className="font-serif text-xl sm:text-2xl tracking-tight truncate">
                  Identity Access Management
                </h2>
              </div>
              <div className="flex items-center gap-2 sm:ml-auto shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateDialog(true)}
                  className="text-xs font-mono uppercase tracking-widest gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  New User
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadData}
                  disabled={fetching}
                  className="text-xs font-mono uppercase tracking-widest"
                >
                  {fetching ? "Loading..." : "Refresh"}
                </Button>
              </div>
            </div>

            {/* ── Mobile: card list ─────────────────────────────────── */}
            <div className="sm:hidden space-y-3">
              {profiles.map((p) => {
                const RoleIcon = getRoleIcon(p.role);
                const manageable = canManage(role, p.role);
                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-border/40 bg-background/40 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.display_name || p.email.split("@")[0]}</p>
                        <p className="text-[11px] text-muted-foreground font-mono truncate">{p.email}</p>
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
                    {manageable ? (
                      <div className="flex items-center gap-2">
                        <select
                          className="flex-1 text-xs bg-background border border-border/50 rounded px-2 py-2 focus:outline-none focus:border-accent"
                          value={p.role || ""}
                          onChange={(e) => setRole_(p.user_id, e.target.value || null)}
                        >
                          <option value="">No Role</option>
                          {allowedRoles.map((r) => (
                            <option key={r} value={r}>{getRoleLabel(r)}</option>
                          ))}
                        </select>
                        {p.role && (
                          <button
                            onClick={() => setRole_(p.user_id, null)}
                            className="min-h-11 min-w-11 flex items-center justify-center rounded border border-border/40 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            aria-label="Remove role"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">Protected</p>
                    )}
                  </div>
                );
              })}
              {profiles.length === 0 && !fetching && (
                <p className="text-center text-xs text-muted-foreground italic py-6">No profiles visible.</p>
              )}
            </div>

            {/* ── Desktop: table ──────────────────────────────────── */}
            <div className="hidden sm:block overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
              <div className="min-w-[540px] rounded-xl border border-border/40 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-secondary/40 text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Display Name</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {profiles.map((p) => {
                      const RoleIcon = getRoleIcon(p.role);
                      const manageable = canManage(role, p.role);
                      return (
                        <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="truncate block max-w-[240px]">{p.email}</span>
                          </td>
                          <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">
                            {p.display_name || "—"}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {p.role ? (
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
                          <td className="px-4 py-4 text-right whitespace-nowrap">
                            {manageable ? (
                              <div className="flex items-center justify-end gap-2">
                                <select
                                  className="text-xs bg-background border border-border/50 rounded px-2 py-1.5 focus:outline-none focus:border-accent cursor-pointer"
                                  value={p.role || ""}
                                  onChange={(e) => setRole_(p.user_id, e.target.value || null)}
                                >
                                  <option value="">No Role</option>
                                  {allowedRoles.map((r) => (
                                    <option key={r} value={r}>{getRoleLabel(r)}</option>
                                  ))}
                                </select>
                                {p.role && (
                                  <button
                                    onClick={() => setRole_(p.user_id, null)}
                                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                    aria-label="Remove role"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                                Protected
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {profiles.length === 0 && !fetching && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground italic text-xs">
                          No profiles visible.
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

      {/* ── Create New User Dialog ───────────────────────────────────── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl tracking-tight flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-accent" />
              Provision New User
            </DialogTitle>
            <DialogDescription>
              Create a new operator account and optionally assign a role. The user will
              be auto-confirmed and can sign in immediately.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <Label
                htmlFor="create-email"
                className="font-mono text-[10px] uppercase tracking-widest"
              >
                Email Address
              </Label>
              <Input
                id="create-email"
                type="email"
                required
                placeholder="operator@school.edu"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label
                htmlFor="create-display-name"
                className="font-mono text-[10px] uppercase tracking-widest"
              >
                Display Name
              </Label>
              <Input
                id="create-display-name"
                type="text"
                placeholder="John Doe"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label
                htmlFor="create-password"
                className="font-mono text-[10px] uppercase tracking-widest"
              >
                Password
              </Label>
              <Input
                id="create-password"
                type="password"
                required
                minLength={6}
                placeholder="Min 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label
                htmlFor="create-role"
                className="font-mono text-[10px] uppercase tracking-widest"
              >
                Assign Role
              </Label>
              <select
                id="create-role"
                className="mt-1 w-full text-sm bg-background border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                <option value="">No Role (assign later)</option>
                {allowedRoles.map((r) => {
                  const Icon = ROLE_HIERARCHY[r]?.icon;
                  return (
                    <option key={r} value={r}>
                      {getRoleLabel(r)} — Level {ROLE_HIERARCHY[r]?.level ?? "?"}
                    </option>
                  );
                })}
              </select>
              <p className="mt-1.5 text-[10px] text-muted-foreground font-mono">
                You can only assign roles your level permits.
              </p>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                className="font-mono text-xs uppercase tracking-widest"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="font-mono text-xs uppercase tracking-widest gap-1.5"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    Create User
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
