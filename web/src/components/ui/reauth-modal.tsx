import { useState } from "react";
import { Loader2, ShieldAlert, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/toast";

interface ReauthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export function ReauthModal({
  isOpen,
  onClose,
  onSuccess,
  title = "Verify Identity",
  description = "Please confirm your clearance credentials to proceed.",
}: ReauthModalProps) {
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);

  if (!isOpen) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setVerifying(true);
    
    try {
      const { error } = await supabase.auth.reauthenticate({ password });
      if (error) throw error;
      
      setPassword("");
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md glass-strong rounded-2xl p-6 relative border border-border/50 shadow-lg">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 text-foreground">
          <ShieldAlert className="w-6 h-6 text-accent" />
          <h2 className="font-serif text-2xl font-medium tracking-tight">{title}</h2>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          {description}
        </p>

        <form onSubmit={handleVerify} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password..."
              className="w-full bg-background border border-border/50 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/20 transition-all font-medium placeholder:text-muted-foreground/40"
              autoFocus
            />
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              disabled={verifying}
              className="flex-1 py-2.5 px-4 rounded-md border border-border/50 text-foreground font-medium text-sm hover:bg-secondary/30 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={verifying || !password}
              className="flex-1 py-2.5 px-4 rounded-md bg-foreground text-background font-medium text-sm hover:bg-foreground/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
