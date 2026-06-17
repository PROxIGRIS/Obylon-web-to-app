import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
import { AlertTriangle } from "lucide-react";

type CriticalAlert = {
  id: string;
  workstation_id: string | null;
  process_name: string | null;
  window_title: string | null;
  severity: "info" | "warning" | "medium" | "critical" | "high";
  alert_type?: string | null;
  timestamp: string;
};

const STORAGE_KEY = "sentinel:lastCriticalSeen";

function isCritical(a: { severity: string; alert_type?: string | null }) {
  return (
    a.severity === "critical" ||
    a.severity === "high" ||
    (a.alert_type ?? "").toLowerCase().includes("restricted") ||
    (a.alert_type ?? "").toLowerCase().includes("focus")
  );
}

export function CriticalIncidentDialog({
  alerts,
  nodeNames,
}: {
  alerts: CriticalAlert[];
  nodeNames: Map<string, string>;
}) {
  const navigate = useNavigate();
  const [active, setActive] = useState<CriticalAlert | null>(null);
  const seenRef = useRef<string | null>(
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null,
  );
  const initRef = useRef(false);

  useEffect(() => {
    const latestCrit = alerts.find(isCritical);
    if (!latestCrit) return;

    // Skip the very first render — only fire on *new* criticals after mount.
    if (!initRef.current) {
      initRef.current = true;
      seenRef.current = latestCrit.id;
      try {
        localStorage.setItem(STORAGE_KEY, latestCrit.id);
      } catch {
        /* ignore */
      }
      return;
    }

    if (seenRef.current === latestCrit.id) return;
    seenRef.current = latestCrit.id;
    try {
      localStorage.setItem(STORAGE_KEY, latestCrit.id);
    } catch {
      /* ignore */
    }
    setActive(latestCrit);

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate?.([120, 60, 120]);
      } catch {
        /* ignore */
      }
    }
  }, [alerts]);

  const open = active !== null;
  const node = active?.workstation_id ? nodeNames.get(active.workstation_id) ?? "Unknown node" : "Unknown node";

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && setActive(null)}>
      <AlertDialogContent className="border-destructive/40 bg-card">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15">
              <span className="absolute inset-0 rounded-full border border-destructive/50 pulse-ring" />
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-destructive">
                Critical Incident
              </p>
              <AlertDialogTitle className="font-serif text-xl leading-tight">
                {node}
              </AlertDialogTitle>
            </div>
          </div>
          <AlertDialogDescription asChild>
            <div className="mt-2 space-y-1.5 text-sm">
              <p className="text-foreground/90">
                <span className="font-mono text-xs text-muted-foreground">PROCESS · </span>
                {active?.process_name ?? "unknown"}
              </p>
              {active?.window_title && (
                <p className="text-foreground/80">
                  <span className="font-mono text-xs text-muted-foreground">WINDOW · </span>
                  {active.window_title}
                </p>
              )}
              <p className="font-mono text-[11px] text-muted-foreground pt-1">
                {active && new Date(active.timestamp).toLocaleString()}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="font-mono text-xs uppercase tracking-widest">
            Dismiss
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (active?.workstation_id) {
                navigate({ to: "/case/$id", params: { id: active.workstation_id }, search: { incidentId: undefined } });
              }
              setActive(null);
            }}
            className="font-mono text-xs uppercase tracking-widest bg-destructive hover:bg-destructive/90"
          >
            Open Dossier
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
