import { useState } from "react";
import {
  Lock,
  Power,
  Snowflake,
  Sun,
  Skull,
  Pencil,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GavelCommand } from "@/components/sentinel/GavelButton";

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
  freeze: {
    title: "Freeze workstation?",
    body: "Suspends input. Screen stays visible but keyboard and mouse are blocked until released.",
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
    body: "Terminates a single foreground process without locking the session.",
    cta: "Kill process",
    icon: Skull,
    destructive: true,
    inputs: [
      { key: "process_name", label: "Process name", placeholder: "e.g. chrome.exe", required: true },
    ],
  },
  set_alias: {
    title: "Rename workstation?",
    body: "Sets a new operator-facing alias. Hardware UUID identity remains unchanged.",
    cta: "Save alias",
    icon: Pencil,
    inputs: [
      { key: "new_name", label: "New alias", placeholder: "e.g. Lab-A · Seat 04", required: true },
    ],
  },
  terminate: {
    title: "Force terminate?",
    body: "Parallel Forensic Strike — powers down the workstation after sealing evidence. Irreversible.",
    cta: "Terminate",
    icon: Power,
    destructive: true,
  },
};

// Visual order in the menu — safe → destructive at the bottom.
const ORDER: GavelCommand[] = [
  "lock",
  "freeze",
  "unfreeze",
  "kill_task",
  "set_alias",
  "terminate",
];

export function GavelMenu({
  workstationId,
  workstationName,
  currentProcess,
}: {
  workstationId: string;
  workstationName: string;
  currentProcess?: string | null;
}) {
  const [active, setActive] = useState<GavelCommand | null>(null);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const openCommand = (cmd: GavelCommand) => {
    const seed: Record<string, string> = {};
    if (cmd === "kill_task" && currentProcess) seed.process_name = currentProcess;
    if (cmd === "set_alias") seed.new_name = workstationName;
    setValues(seed);
    setActive(cmd);
  };

  const close = () => {
    if (busy) return;
    setActive(null);
    setValues({});
  };

  const issue = async () => {
    if (!active) return;
    const spec = SPECS[active];
    if (spec.inputs?.some((i) => i.required && !values[i.key]?.trim())) {
      toast.error("Please fill all required fields.");
      return;
    }
    setBusy(true);
    const metadata = spec.inputs?.length ? values : null;
    const { error } = await (supabase as any)
      .from("admin_actions")
      .insert({ target_id: workstationId, command: active, metadata });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${active.replace("_", " ").toUpperCase()} → ${workstationName}`);
    setActive(null);
    setValues({});
  };

  const spec = active ? SPECS[active] : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="p-1.5 rounded hover:bg-secondary text-foreground/70 hover:text-foreground transition"
            title="Workstation actions"
            aria-label="Workstation actions"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            {workstationName}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ORDER.map((cmd) => {
            const s = SPECS[cmd];
            const Icon = s.icon;
            return (
              <DropdownMenuItem
                key={cmd}
                onSelect={(e) => {
                  e.preventDefault();
                  openCommand(cmd);
                }}
                className={
                  s.destructive
                    ? "text-destructive focus:text-destructive focus:bg-destructive/10"
                    : ""
                }
              >
                <Icon className="w-3.5 h-3.5 mr-2" />
                {s.cta}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!active} onOpenChange={(o) => !o && close()}>
        {spec && (
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
                    <Label htmlFor={`gm-${inp.key}`} className="text-xs">
                      {inp.label}
                    </Label>
                    <Input
                      id={`gm-${inp.key}`}
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
        )}
      </AlertDialog>
    </>
  );
}
