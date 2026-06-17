import { useState } from "react";
import {
  Lock,
  Power,
  Snowflake,
  Sun,
  Skull,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { hasAuthority, type GavelCommand } from "@/Utils/Security";
export type { GavelCommand }; // Re-export for downstream consumers
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Spec = {
  title: string;
  body: string;
  cta: string;
  icon: LucideIcon;
  destructive?: boolean;
  inputs?: Array<{
    key: string;
    label: string;
    placeholder: string;
    required?: boolean;
  }>;
};

const SPECS: Record<GavelCommand, Spec> = {
  lock: {
    title: "Lock workstation?",
    body: "Immediately locks the active session. The user must re-authenticate.",
    cta: "Lock now",
    icon: Lock,
  },
  terminate: {
    title: "Force terminate?",
    body: "Parallel Forensic Strike — powers down the workstation after sealing evidence. Irreversible.",
    cta: "Terminate",
    icon: Power,
    destructive: true,
  },
  freeze: {
    title: "Freeze workstation?",
    body: "Suspends input on the target. The screen stays visible but keyboard and mouse are blocked until unfrozen.",
    cta: "Freeze",
    icon: Snowflake,
  },
  unfreeze: {
    title: "Release freeze?",
    body: "Restores keyboard and mouse on the target workstation.",
    cta: "Unfreeze",
    icon: Sun,
  },
  kill_task: {
    title: "Kill process?",
    body: "Terminates a single foreground process on the target without locking the session.",
    cta: "Kill process",
    icon: Skull,
    destructive: true,
    inputs: [
      {
        key: "process_name",
        label: "Process name",
        placeholder: "e.g. chrome.exe",
        required: true,
      },
    ],
  },
  set_alias: {
    title: "Rename workstation?",
    body: "Sets a new operator-facing alias for this node. The Hardware UUID identity remains unchanged.",
    cta: "Save alias",
    icon: Pencil,
    inputs: [
      {
        key: "alias",
        label: "New alias",
        placeholder: "e.g. Lab-A · Seat 04",
        required: true,
      },
    ],
  },
};

export function GavelButton({
  workstationId,
  workstationName,
  command,
  size = "sm",
  defaultPayload,
}: {
  workstationId: string;
  workstationName: string;
  command: GavelCommand;
  size?: "sm" | "md";
  defaultPayload?: Record<string, string>;
}) {
  const spec = SPECS[command];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(defaultPayload ?? {});
  const { role } = useAuth();

  // Centralized Server-Proxy Authority Gate
  if (!hasAuthority(role, command)) {
    return null;
  }

  const Icon = spec.icon;
  const dim = size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";
  const pad = size === "md" ? "p-2" : "p-1.5";

  const issue = async () => {
    if (spec.inputs?.some((i) => i.required && !values[i.key]?.trim())) {
      toast.error("Please fill all required fields.");
      return;
    }
    setBusy(true);
    const metadata = spec.inputs?.length ? values : null;
    const { error } = await (supabase as any)
      .from("admin_actions")
      .insert({ target_id: workstationId, command, metadata });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${command.replace("_", " ").toUpperCase()} → ${workstationName}`);
    setValues(defaultPayload ?? {});
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          className={`${pad} rounded transition shrink-0 ${
            spec.destructive
              ? "hover:bg-destructive/15 text-destructive"
              : "hover:bg-secondary text-foreground/80 hover:text-foreground"
          }`}
          title={spec.title}
          aria-label={spec.title}
        >
          <Icon className={dim} />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {spec.title}
            <span className="block font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mt-1">
              Target · {workstationName}
            </span>
          </AlertDialogTitle>
          <AlertDialogDescription>{spec.body}</AlertDialogDescription>
        </AlertDialogHeader>

        {spec.inputs?.length ? (
          <div className="space-y-3 py-2">
            {spec.inputs.map((inp) => (
              <div key={inp.key} className="space-y-1.5">
                <Label htmlFor={`${command}-${inp.key}`} className="text-xs">
                  {inp.label}
                </Label>
                <Input
                  id={`${command}-${inp.key}`}
                  placeholder={inp.placeholder}
                  value={values[inp.key] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [inp.key]: e.target.value }))
                  }
                  autoFocus
                />
              </div>
            ))}
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={issue}
            className={
              spec.destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
            }
          >
            {busy ? "Issuing…" : spec.cta}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
