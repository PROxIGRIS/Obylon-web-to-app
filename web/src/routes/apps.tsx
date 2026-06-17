import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Shell } from "@/components/sentinel/Shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { 
  Search, 
  Plus, 
  Check, 
  AppWindow, 
  Code, 
  Globe, 
  Database,
  TerminalSquare,
  ShieldCheck,
  Briefcase
} from "lucide-react";

export const Route = createFileRoute("/apps")({
  head: () => ({
    meta: [
      { title: "Approved Apps · Obylon by Umbraxis" },
      { name: "description", content: "Manage apps allowed during class." },
    ],
  }),
  component: AppVaultPage,
});

export type App = {
  id: string;
  name: string;
  process_name: string;
  category: string | null;
  icon: string | null;
  whitelisted: boolean;
};

// Dynamic icon mapper based on category (fallback)
function getCategoryIcon(category: string | null) {
  const cat = (category ?? "").toLowerCase();
  if (cat.includes("dev") || cat.includes("code")) return <Code className="w-6 h-6 text-muted-foreground/60" />;
  if (cat.includes("web") || cat.includes("browser")) return <Globe className="w-6 h-6 text-muted-foreground/60" />;
  if (cat.includes("data")) return <Database className="w-6 h-6 text-muted-foreground/60" />;
  if (cat.includes("term") || cat.includes("sys")) return <TerminalSquare className="w-6 h-6 text-muted-foreground/60" />;
  if (cat.includes("sec")) return <ShieldCheck className="w-6 h-6 text-muted-foreground/60" />;
  if (cat.includes("office") || cat.includes("work")) return <Briefcase className="w-6 h-6 text-muted-foreground/60" />;
  return <AppWindow className="w-6 h-6 text-muted-foreground/60" />;
}

function AppIcon({ app }: { app: App }) {
  const [error, setError] = useState(false);
  
  const logoUrl = useMemo(() => {
    if (app.icon) return app.icon;
    const name = app.name.toLowerCase();
    const domainMap: Record<string, string> = {
      "code": "code.visualstudio.com",
      "chrome": "google.com",
      "firefox": "mozilla.org",
      "edge": "microsoft.com",
      "safari": "apple.com",
      "word": "office.com",
      "excel": "office.com",
      "powerpoint": "office.com",
      "teams": "teams.microsoft.com",
      "zoom": "zoom.us",
      "discord": "discord.com",
      "slack": "slack.com",
      "notion": "notion.so",
      "figma": "figma.com",
      "github": "github.com",
      "postman": "postman.com",
      "obs": "obsproject.com",
      "vlc": "videolan.org",
      "roblox": "roblox.com",
      "minecraft": "minecraft.net",
    };
    for (const [key, domain] of Object.entries(domainMap)) {
      if (name.includes(key)) return `https://icon.horse/icon/${domain}`;
    }
    return null;
  }, [app]);

  if (logoUrl && !error) {
    return <img src={logoUrl} alt={app.name} className="w-7 h-7 object-contain" onError={() => setError(true)} />;
  }

  return getCategoryIcon(app.category);
}

// Extracted Core Component so it can be seamlessly embedded into Simple Mode later
export function AppVaultCore({ isSimpleMode = false }: { isSimpleMode?: boolean }) {
  const { isAdmin, role, loading } = useAuth();
  const [apps, setApps] = useState<App[]>([]);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newProc, setNewProc] = useState("");
  const [newCat, setNewCat] = useState("");

  const reqIdRef = React.useRef(0);

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      const reqId = ++reqIdRef.current;
      const { data } = await supabase.from("allowed_apps").select("*").order("category").order("name");
      if (reqId !== reqIdRef.current) return;
      setApps((data as App[]) ?? []);
    };
    load();
    const ch = supabase
      .channel("apps-vault")
      .on("postgres_changes", { event: "*", schema: "public", table: "allowed_apps" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return apps;
    return apps.filter((a) => 
      a.name.toLowerCase().includes(s) || 
      a.process_name.toLowerCase().includes(s) || 
      (a.category ?? "").toLowerCase().includes(s)
    );
  }, [apps, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, App[]>();
    for (const a of filtered) {
      const k = a.category ?? "General";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(a);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const canManage = role === "admin" || role === "principal" || role === "dev";

  const toggle = async (app: App) => {
    if (!canManage) {
      toast.error("Only administrators can modify this.");
      return;
    }
    const next = !app.whitelisted;
    setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, whitelisted: next } : a)));
    const { error } = await supabase.from("allowed_apps").update({ whitelisted: next }).eq("id", app.id);
    if (error) {
      toast.error(error.message);
      setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, whitelisted: !next } : a)));
    }
  };

  const addApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newProc) return;
    const { error } = await supabase.from("allowed_apps").insert({
      name: newName,
      process_name: newProc,
      category: newCat || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`${newName} added`);
      setNewName(""); setNewProc(""); setNewCat(""); setAdding(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-muted-foreground font-mono text-xs">Loading apps...</div>;
  if (!isAdmin) return <div className="p-12 text-center text-muted-foreground font-mono text-xs">Only administrators can access this page.</div>;

  const whitelistedCount = apps.filter((a) => a.whitelisted).length;

  return (
    <div className="space-y-6 w-full min-w-0">
      
      {/* Header hidden in Simple Mode to save space */}
      {!isSimpleMode && (
        <header className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pb-2">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
              Classroom Software
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl mt-2 leading-none truncate">Approved Apps</h1>
            <p className="text-base text-muted-foreground mt-3 max-w-2xl leading-relaxed">
              Click an app to allow students to use it during class. Any app not selected here will be blocked.
            </p>
          </div>
          <div className="paper-elevated rounded-xl px-5 py-3.5 w-full md:w-auto flex flex-col shrink-0">
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Allowed</p>
            <p className="font-serif text-3xl tabular-nums">
              <span className="text-accent glow-sage">{whitelistedCount}</span>
              <span className="text-muted-foreground"> / {apps.length}</span>
            </p>
          </div>
        </header>
      )}

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search for an app..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10 paper-elevated border-0 font-sans text-sm w-full"
          />
        </div>
        {canManage && (
          <Button 
            onClick={() => setAdding((v) => !v)} 
            variant={adding ? "default" : "outline"} 
            className="shrink-0 font-sans font-medium text-sm shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            {adding ? "Cancel" : "Add New App"}
          </Button>
        )}
      </div>

      {/* Registration Form */}
      {adding && (
        <form onSubmit={addApp} className="paper-elevated rounded-xl p-5 grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          <Input placeholder="App Name (e.g. VS Code)" value={newName} onChange={(e) => setNewName(e.target.value)} required className="sm:col-span-2" />
          <Input placeholder="Process Name (Code.exe)" value={newProc} onChange={(e) => setNewProc(e.target.value)} required className="font-mono text-sm" />
          <div className="flex gap-2">
            <Input placeholder="Category" value={newCat} onChange={(e) => setNewCat(e.target.value)} className="w-full" />
            <Button type="submit" className="font-sans font-medium shrink-0">Save</Button>
          </div>
        </form>
      )}

      {/* Responsive App Grid */}
      <div className="space-y-8">
        {grouped.map(([cat, items]) => (
          <section key={cat}>
            <div className="parchment-strip flex items-center justify-between mb-4 pb-2">
              <h2 className="font-sans font-semibold text-lg text-foreground/80 truncate pr-4">{cat}</h2>
              <span className="font-sans text-xs font-medium text-muted-foreground shrink-0 tabular-nums bg-secondary/80 px-2 py-0.5 rounded-full">
                {items.filter((i) => i.whitelisted).length}/{items.length} allowed
              </span>
            </div>
            
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {items.map((a) => (
                <button
                  key={a.id}
                  onClick={() => toggle(a)}
                  className={`paper-elevated rounded-2xl p-3.5 text-left flex items-center gap-4 transition-all duration-200 outline-none w-full min-w-0 ${
                    a.whitelisted
                      ? "border-emerald-500/30 ring-1 ring-emerald-500/10 bg-emerald-50/30 dark:bg-emerald-950/10"
                      : "border-transparent hover:border-border/60 hover:-translate-y-0.5"
                  }`}
                >
                  <div className="w-12 h-12 rounded-[14px] bg-white flex items-center justify-center shrink-0 border border-black/5 shadow-sm overflow-hidden p-1.5">
                    <AppIcon app={a} />
                  </div>
                  
                  <div className="flex-1 min-w-0 py-1">
                    <p className="font-semibold text-[15px] leading-tight text-foreground truncate">{a.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground/70 truncate mt-1">
                      {a.process_name}
                    </p>
                  </div>
                  
                  <div className="shrink-0 pl-2">
                    {a.whitelisted ? (
                      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/80 dark:bg-emerald-900/50 dark:text-emerald-300 px-2.5 py-1 rounded-full">
                        <Check className="w-3.5 h-3.5" strokeWidth={3} /> Allowed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
                        Blocked
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
        {grouped.length === 0 && (
          <div className="text-center py-16 paper-elevated rounded-2xl border-dashed border-border/60">
            <Search className="w-6 h-6 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-sans text-sm text-muted-foreground">No apps found</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Wrapper to provide the Shell specifically for the /apps route
function AppVaultPage() {
  return (
    <Shell>
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
        <AppVaultCore />
      </div>
    </Shell>
  );
}
