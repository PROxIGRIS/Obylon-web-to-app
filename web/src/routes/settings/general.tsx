import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getClientIp } from "@/utils/ip";
import { AvatarRing } from "@/components/sentinel/AvatarRing";
import { toast } from "@/components/ui/toast";
import { Loader2, Upload, Shuffle, Save, ShieldAlert } from "lucide-react";
import { ReauthModal } from "@/components/ui/reauth-modal";

export const Route = createFileRoute("/settings/general")({
  component: GeneralSettings,
});

const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

const DICEBEAR_STYLES = [
  "thumbs",
  "bottts",
  "adventurer",
  "avataaars",
  "fun-emoji",
  "lorelei",
  "notionists",
  "shapes",
  "personas",
  "micah",
];

function randomDicebear() {
  const style = DICEBEAR_STYLES[Math.floor(Math.random() * DICEBEAR_STYLES.length)];
  const seed = Math.random().toString(36).slice(2, 12);
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

function GeneralSettings() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newEmail, setNewEmail] = useState("");
  const [isReauthOpen, setIsReauthOpen] = useState(false);
  const [emailUpdating, setEmailUpdating] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      setDisplayName(profile?.display_name ?? "");
      setAvatarUrl(profile?.avatar_url ?? (user?.user_metadata?.avatar_url as string) ?? "");
    }
  }, [loading, profile, user]);

  if (loading) return null;

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-medium">Access Denied</h2>
        </div>
      </div>
    );
  }

  const uploadBlob = async (blob: Blob, ext: string) => {
    if (!user) throw new Error("Not signed in");
    if (blob.size > MAX_BYTES) throw new Error("Image is over 5MB");
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { upsert: true, contentType: blob.type, cacheControl: "3600" });
    if (error) throw error;
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl;
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error("Use PNG, JPG, WEBP, GIF, or SVG");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be under 5MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.includes(".") ? file.name.split(".").pop()! : "png";
      const url = await uploadBlob(file, ext);
      setAvatarUrl(`${url}?t=${Date.now()}`);
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const randomize = () => setAvatarUrl(randomDicebear());

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const name = displayName.trim() || null;
    const url = avatarUrl.trim() || null;

    const { error: profErr } = await supabase
      .from("profiles")
      .update({ display_name: name })
      .eq("user_id", user.id);

    const { error: authErr } = await supabase.auth.updateUser({
      data: { display_name: name, avatar_url: url },
    });

    setSaving(false);
    if (profErr || authErr) {
      toast.error(profErr?.message || authErr?.message || "Failed to save profile");
      return;
    }
    toast.success("Profile updated successfully.");
    await refreshProfile?.();
  };

  const handleEmailChangeRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || newEmail === user?.email) return;
    setIsReauthOpen(true);
  };

  const executeEmailUpdate = async () => {
    setIsReauthOpen(false);
    setEmailUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      
      const ip = await getClientIp();
      await supabase.from("security_audit_logs").insert({
        user_id: user.id,
        event_type: "Email update requested",
        status: "success",
        ip_address: ip
      });

      toast.success("Confirmation emails have been sent to both your old and new addresses.");
      setNewEmail("");
    } catch (err: any) {
      const ip = await getClientIp();
      await supabase.from("security_audit_logs").insert({
        user_id: user?.id,
        event_type: "Email update failed",
        status: "failure",
        ip_address: ip
      }).select().maybeSingle();

      toast.error(err.message || "Email update failed");
    } finally {
      setEmailUpdating(false);
    }
  };

  const busy = saving || uploading || emailUpdating;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Profile & Identity</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage your public persona and contact information.</p>
        </div>
        <button
          onClick={save}
          disabled={busy}
          className="flex items-center justify-center gap-2 py-2.5 px-5 rounded-full bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 space-y-6">
          <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm flex flex-col items-center">
            <div className="mb-6 relative">
              <AvatarRing
                uuid={user?.id}
                name={displayName || profile?.display_name || "Unknown"}
                email={user?.email}
                avatarUrl={avatarUrl}
                size={120}
                ringWidth={6}
                ringGap={4}
                status="online"
              />
            </div>

            <input
              type="file"
              accept={ALLOWED_MIME.join(",")}
              ref={fileInputRef}
              onChange={onPickFile}
              className="hidden"
            />
            
            <div className="w-full space-y-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-secondary text-foreground font-medium text-sm hover:bg-secondary/80 transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload Image
              </button>
              <button
                type="button"
                onClick={randomize}
                disabled={busy}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border border-border bg-transparent text-foreground font-medium text-sm hover:bg-secondary/50 transition-colors disabled:opacity-50"
              >
                <Shuffle className="w-4 h-4" />
                Randomize
              </button>
            </div>
          </div>
        </div>

        <div className="col-span-1 md:col-span-2 space-y-6">
          <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm space-y-4">
            <div className="space-y-1">
              <label htmlFor="displayName" className="text-sm font-medium">Display Name</label>
              <p className="text-xs text-muted-foreground">Your name as it appears to others in the system.</p>
            </div>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name..."
              className="w-full bg-background border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm space-y-4">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Primary Email</h4>
              <p className="text-xs text-muted-foreground">Current address: <span className="font-mono text-foreground">{user?.email}</span></p>
            </div>
            
            <form onSubmit={handleEmailChangeRequest} className="flex gap-3">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="New email address..."
                className="flex-1 bg-background border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <button
                type="submit"
                disabled={!newEmail || newEmail === user?.email || emailUpdating}
                className="py-2.5 px-4 rounded-xl bg-secondary text-foreground font-medium text-sm hover:bg-secondary/80 transition-colors disabled:opacity-50 whitespace-nowrap flex items-center justify-center min-w-[100px]"
              >
                {emailUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Change"}
              </button>
            </form>
          </div>
        </div>
      </div>

      <ReauthModal
        isOpen={isReauthOpen}
        onClose={() => setIsReauthOpen(false)}
        onSuccess={executeEmailUpdate}
        title="Verify Clearance"
        description="Re-authenticate to authorize electronic mail changes."
      />
    </div>
  );
}
