import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertTriangle,
  Eye,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export type Alert = {
  id: string;
  workstation_id?: string | null;
  process_name: string | null;
  window_title: string | null;
  severity: "info" | "warning" | "medium" | "critical" | "high";
  alert_type?: string | null;
  reason?: string | null;
  timestamp: string;
};

export type TerminalMode = "cinematic" | "simple";

// ─── Human-readable translation of raw engine reasons ────────────────────
const REASON_MAP: Array<[RegExp, string]> = [
  [/fast_path:exact_regex_match/i, "Preemptive explicit intent detected"],
  [/fast_path:keyword_match/i, "Banned keyword observed"],
  [/typed[_-]?violation/i, "Typed intent detected before browser update"],
  [/pre[_-]?render/i, "Pre-render typed intent detected"],
  [/input[_-]?stream/i, "Direct input stream violation"],
  [/instant[_-]?strike/i, "Instant strike condition"],
  [/dom[_-]?analysis/i, "Page content flagged by DOM analysis"],
  [/ocr[_-]?verification/i, "Image content verified by OCR"],
  [/keylog(ger)?[_-]?intercept/i, "Captured by keystroke interceptor"],
  [/lev[_-]?score/i, "High lexical similarity to banned terms"],
  [/restricted[_-]?app/i, "Restricted application launched"],
  [/focus[_-]?lost/i, "Focus left the approved workspace"],
  [/heartbeat[_-]?miss/i, "Node went quiet"],
];

function humanizeReason(raw: string | null | undefined): string | null {
  if (!raw) return null;
  for (const [re, label] of REASON_MAP) if (re.test(raw)) return label;
  return raw
    .replace(/[_:\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

type Grouped = Alert & {
  count: number;
  lastTimestamp: string;
  incidents: Alert[];
  groupKey: string;
};

function groupAlerts(alerts: Alert[]): Grouped[] {
  const WINDOW = 60_000;
  const ordered = [...alerts].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const clusters: Grouped[] = [];
  for (const a of ordered) {
    const key = `${a.workstation_id ?? "?"}|${a.alert_type ?? a.process_name ?? ""}|${a.severity}`;
    const last = clusters[clusters.length - 1];
    const within =
      last &&
      last.groupKey === key &&
      new Date(a.timestamp).getTime() - new Date(last.lastTimestamp).getTime() < WINDOW;
    if (within && last) {
      last.count += 1;
      last.lastTimestamp = a.timestamp;
      last.incidents.push(a);
    } else {
      clusters.push({
        ...a,
        count: 1,
        lastTimestamp: a.timestamp,
        incidents: [a],
        groupKey: key,
      });
    }
  }
  return clusters.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
}

// Reverted to your original semantic classes and glow effects
const sevColor: Record<Alert["severity"], string> = {
  info: "text-muted-foreground",
  warning: "text-amber",
  medium: "text-amber",
  high: "text-destructive glow-blood",
  critical: "text-destructive glow-blood font-bold",
};

const ACTION_REQUIRED: Alert["severity"][] = ["critical", "high"];
const AMBIENT: Alert["severity"][] = ["medium", "warning", "info"];

function formatTime(isoString: string) {
  const d = new Date(isoString);
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}.${d
    .getMilliseconds()
    .toString()
    .padStart(3, "0")}`;
}

export function Terminal({
  alerts,
  nodeNames,
  mode = "cinematic",
}: {
  alerts: Alert[];
  nodeNames?: Map<string, string>;
  mode?: TerminalMode;
}) {
  const [tab, setTab] = useState<"action" | "ambient">("action");

  const actionAlerts = useMemo(
    () => groupAlerts(alerts.filter((a) => ACTION_REQUIRED.includes(a.severity))),
    [alerts],
  );
  const ambientAlerts = useMemo(
    () => groupAlerts(alerts.filter((a) => AMBIENT.includes(a.severity))),
    [alerts],
  );

  useEffect(() => {
    if (actionAlerts.length === 0 && ambientAlerts.length > 0 && tab === "action") {
      setTab("ambient");
    }
  }, [actionAlerts.length, ambientAlerts.length]);

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden paper-elevated font-mono text-[11px] sm:text-xs shadow-2xl">
      
      {/* Reverted header to parchment-strip with Tabs integration */}
      <div className="parchment-strip border-b border-border/40 px-4 py-3 flex items-center justify-between shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-destructive/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber" />
            <span className="w-2.5 h-2.5 rounded-full bg-accent" />
          </div>
          <span className="ml-2 uppercase tracking-[0.3em] text-[10px] text-muted-foreground font-semibold truncate">
            incident.log · {tab === "action" ? "live threats" : "ambient stream"}
          </span>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="h-8 bg-black/10 border border-border/30 rounded-md p-1">
            <TabsTrigger
              value="action"
              className="text-[9px] uppercase tracking-widest px-3 rounded data-[state=active]:bg-background/80 data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground transition-all"
            >
              <AlertTriangle className="w-3 h-3 mr-1.5" />
              Action
              {actionAlerts.length > 0 && (
                <span className="ml-1.5 text-destructive font-bold">
                  {actionAlerts.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="ambient"
              className="text-[9px] uppercase tracking-widest px-3 rounded data-[state=active]:bg-background/80 data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground transition-all"
            >
              <Eye className="w-3 h-3 mr-1.5" />
              Ambient
              {ambientAlerts.length > 0 && (
                <span className="ml-1.5 text-foreground/70 font-bold">
                  {ambientAlerts.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content Area */}
      <div className="terminal-scanlines flex-1 overflow-y-auto p-2 scroll-smooth custom-scrollbar relative">
        <Tabs value={tab} className="h-full">
          <TabsContent value="action" className="m-0 h-full">
            <AlertList
              items={actionAlerts}
              nodeNames={nodeNames}
              emptyHint="$ active threat stream clear..."
            />
          </TabsContent>
          <TabsContent value="ambient" className="m-0 h-full">
            <AlertList
              items={ambientAlerts}
              nodeNames={nodeNames}
              emptyHint="$ awaiting ambient telemetry..."
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function AlertList({
  items,
  nodeNames,
  emptyHint,
}: {
  items: Grouped[];
  nodeNames?: Map<string, string>;
  emptyHint: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setExpandedGroups(new Set());
  }, [items]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  if (items.length === 0) {
    return (
      <div className="p-4 text-cream/50 animate-pulse">
        {emptyHint}
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex flex-col space-y-1">
      {items.map((a) => (
        <IncidentRow
          key={a.groupKey}
          a={a}
          nodeNames={nodeNames}
          expanded={expandedGroups.has(a.groupKey)}
          onToggle={() => toggleGroup(a.groupKey)}
        />
      ))}
    </div>
  );
}

function IncidentRow({
  a,
  nodeNames,
  expanded,
  onToggle,
}: {
  a: Grouped;
  nodeNames?: Map<string, string>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const node = a.workstation_id ? nodeNames?.get(a.workstation_id) : null;
  const isCritical = a.severity === "critical" || a.severity === "high";
  const isInfo = a.severity === "info";
  const stacked = a.count > 1;
  const olderIncidents = stacked ? a.incidents.slice(0, -1).reverse() : [];
  
  const reason = humanizeReason(a.reason ?? a.alert_type ?? null);

  return (
    <div 
      className={`group flex flex-col px-3 py-2 rounded transition-all duration-200 
        ${isCritical 
          ? "bg-destructive/15 border-l-2 border-destructive" 
          : "border-l-2 border-transparent hover:bg-white/5"
        }
        ${isInfo ? "opacity-60 hover:opacity-100" : "opacity-100"}
      `}
    >
      {/* Responsive layout: Grid on Desktop, Flex-col on Mobile */}
      <div className="flex flex-col sm:grid sm:grid-cols-[auto_100px_80px_1fr_auto] gap-2 sm:gap-3 items-start">
        
        {/* 1. Timestamp */}
        <span className={`shrink-0 select-none hidden sm:block ${isCritical ? "text-destructive/80" : "text-cream/50"}`}>
          [{formatTime(a.lastTimestamp)}]
        </span>

        {/* Mobile Header (Time + Node + Sev) */}
        <div className="flex sm:hidden items-center gap-2 w-full mb-1">
          <span className={`select-none ${isCritical ? "text-destructive/80" : "text-cream/50"}`}>
            [{formatTime(a.lastTimestamp)}]
          </span>
          <span className={`font-semibold select-none truncate ${isCritical ? "text-destructive" : "text-accent"}`}>
            {node ?? "SYS-UNKNOWN"}
          </span>
          <span className={`${sevColor[a.severity]} uppercase ml-auto font-bold`}>
            {a.severity}
          </span>
        </div>
        
        {/* 2. Node Identity (Desktop) */}
        <span className={`shrink-0 font-semibold select-none truncate hidden sm:block ${isCritical ? "text-destructive" : "text-accent"}`}>
          {node ?? "SYS-UNKNOWN"}
        </span>
        
        {/* 3. Severity (Desktop) */}
        <span className={`${sevColor[a.severity]} uppercase shrink-0 select-none hidden sm:block`}>
          {a.severity}
        </span>
        
        {/* 4. Payload / Evidence Column */}
        <div className="flex flex-col min-w-0 w-full">
          <span className={`truncate ${isCritical ? "text-cream" : "text-cream/90"}`}>
            {stacked && (
              <span className={`mr-2 px-1.5 py-0.5 rounded text-[9px] font-bold inline-block ${isCritical ? "bg-destructive/40" : "bg-white/20"}`}>
                x{a.count}
              </span>
            )}
            <span className={isCritical ? "text-destructive/80" : "text-cream/70"}>
              {a.process_name ?? "unknown"}
            </span>
            {a.window_title && (
              <>
                <span className={`${isCritical ? "text-destructive/50" : "text-cream/50"} mx-1`}>·</span>
                <span className={`${isCritical ? "font-medium" : "group-hover:text-white transition-colors"}`}>
                  {a.window_title}
                </span>
              </>
            )}
          </span>
          
          {/* Diagnostic Reason Context */}
          {reason && reason !== a.window_title && (
            <span className="text-[10px] text-cream/50 mt-0.5 italic">
              {">"} {reason}
            </span>
          )}

          {/* Stacking Controls */}
          {stacked && (
            <button 
              onClick={onToggle} 
              className="mt-2 text-left text-[9px] uppercase tracking-widest text-cream/50 hover:text-cream transition-colors flex items-center gap-1 w-fit"
            >
              {expanded ? (
                <><ChevronDown className="w-3 h-3" /> Hide Trace</>
              ) : (
                <><ChevronRight className="w-3 h-3" /> {a.count - 1} earlier events</>
              )}
            </button>
          )}
        </div>

        {/* 5. Action Button */}
        <div className="shrink-0 pt-2 sm:pt-0">
          {a.workstation_id ? (
            <Link
              to="/case/$id"
              params={{ id: a.workstation_id }}
              search={{ incidentId: a.id }}
              className="inline-flex items-center rounded border border-white/20 bg-white/5 hover:bg-white/20 px-2.5 py-1 text-[9px] uppercase tracking-widest text-cream transition-colors shadow-sm"
            >
              Inspect
            </Link>
          ) : (
            <span className="inline-flex items-center rounded border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] uppercase tracking-widest text-cream/30 cursor-not-allowed">
              No Trace
            </span>
          )}
        </div>
      </div>

      {/* Expanded Cluster Content */}
      {expanded && stacked && (
        <div className="mt-2 pl-2 sm:pl-[200px] border-l-2 border-white/10 ml-1 sm:ml-0 space-y-1.5 py-2">
          {olderIncidents.map((child) => (
            <div key={child.id} className="flex items-start justify-between gap-3 text-[10px]">
              <span className="text-cream/60 truncate min-w-0">
                <span className="text-cream/40 mr-1.5">└</span>
                {child.process_name ?? "unknown"} {child.window_title ? `· ${child.window_title}` : ""}
              </span>
              <span className="text-cream/40 shrink-0 tabular-nums">
                [{formatTime(child.timestamp)}]
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
