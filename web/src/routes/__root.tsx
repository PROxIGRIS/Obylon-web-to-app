import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useNavigate,
  Navigate,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth, AuthGuard } from "@/hooks/use-auth";
import { ToastProvider } from "@/components/ui/toast";
import { AlertTriangle, RefreshCcw, Home, TerminalSquare, Compass, Loader2 } from "lucide-react";
import React, { Suspense } from "react";
import { GlobalSentinelMonitor } from "@/components/sentinel/GlobalSentinelMonitor";
import { ThemeProvider } from "@/components/ThemeProvider";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 relative overflow-hidden font-mono text-slate-300 terminal-scanlines">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05),transparent_80%)]" />
      
      <div className="max-w-2xl w-full text-center relative z-10 animate-in fade-in duration-1000">
        <div className="mb-8 relative inline-block">
          <h1 className="text-6xl sm:text-8xl font-bold tracking-[0.2em] uppercase text-white/90 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] glitch" data-text="404">
            404
          </h1>
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/20 -translate-y-1/2" />
        </div>

        <div className="space-y-4 mb-12">
          <h2 className="text-2xl sm:text-3xl font-medium tracking-[0.3em] uppercase text-slate-200">
            Signal Lost
          </h2>
          <div className="flex items-center justify-center gap-4">
            <div className="h-[1px] w-12 bg-slate-500/50" />
            <p className="text-slate-400 text-sm sm:text-base tracking-[0.4em] uppercase">
              Dead Sector
            </p>
            <div className="h-[1px] w-12 bg-slate-500/50" />
          </div>
          <p className="text-slate-500 text-xs mt-6 uppercase tracking-widest max-w-md mx-auto leading-loose">
            The endpoint you are trying to reach has been redacted, destroyed, or never existed in the grid.
          </p>
        </div>

        <div className="flex justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-3 py-3 px-8 border border-slate-500/50 text-slate-300 font-medium text-sm hover:bg-slate-100 hover:text-black transition-all uppercase tracking-[0.2em] group"
          >
            <Compass className="w-4 h-4 opacity-50 group-hover:opacity-100" />
            Re-establish Link
          </Link>
        </div>
      </div>
    </div>
  );
}

function PendingComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      <div className="relative z-10 flex flex-col items-center gap-4 animate-in fade-in duration-500">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/50" />
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 relative overflow-hidden font-mono text-emerald-500 terminal-scanlines">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.2),transparent_80%)]" />

      <div className="max-w-3xl w-full relative z-10 animate-in fade-in duration-500 border border-emerald-500/30 p-8 sm:p-12 bg-black/80 shadow-[0_0_50px_rgba(16,185,129,0.05)]">
        <div className="flex items-start gap-4 mb-6 pb-6 border-b border-emerald-500/30">
          <AlertTriangle className="w-12 h-12 text-emerald-500 shrink-0" />
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-widest uppercase text-emerald-500 mb-2 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]">
              Kernel Panic
            </h1>
            <p className="text-emerald-400/80 text-sm uppercase tracking-[0.2em] blink">
              SYSTEM HALTED: UNRECOVERABLE FATAL EXCEPTION
            </p>
          </div>
        </div>

        <div className="mb-8 space-y-4">
          <p className="text-sm text-emerald-400 uppercase tracking-widest flex items-center gap-2">
            <span className="bg-emerald-500/20 px-2 py-0.5 border border-emerald-500/30 text-emerald-400">ERR_CODE:</span>
            <span>MEMORY_SEGMENTATION_FAULT / RENDER_CRASH</span>
          </p>
          <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-4 text-left overflow-x-auto relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50" />
            <pre className="text-xs sm:text-sm font-mono text-emerald-400 whitespace-pre-wrap break-all pl-2 leading-relaxed opacity-90">
              {error.message || "Unknown execution failure at memory address 0x00000000."}
              {'\n\n'}
              {error.stack?.split('\n').slice(0, 5).join('\n') || "Stack trace unavailable. Core dumped."}
            </pre>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 border-t border-emerald-500/30 pt-8">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="flex-1 flex items-center justify-center gap-3 py-4 px-6 border border-emerald-500 bg-emerald-500/10 text-emerald-500 font-bold text-sm hover:bg-emerald-500 hover:text-black transition-all uppercase tracking-widest"
          >
            <RefreshCcw className="w-5 h-5" />
            [ REBOOT SYSTEM ]
          </button>
          <a
            href="/"
            className="flex-1 flex items-center justify-center gap-3 py-4 px-6 border border-emerald-500/50 bg-black text-emerald-500/70 font-bold text-sm hover:border-emerald-500 hover:text-emerald-500 transition-all uppercase tracking-widest"
          >
            <Home className="w-5 h-5" />
            [ ABORT TO DASHBOARD ]
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Obylon by Umbraxis" },
      { name: "description", content: "Centralized classroom monitoring — operator-grade telemetry and remote control." },
      { name: "author", content: "Umbraxis" },
      { property: "og:title", content: "Obylon by Umbraxis" },
      { property: "og:description", content: "Centralized classroom monitoring — operator-grade telemetry and remote control." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Obylon by Umbraxis" },
      { name: "twitter:description", content: "Centralized classroom monitoring — operator-grade telemetry and remote control." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/9850ae00-ea47-4511-86c0-03e12534c3a7" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/9850ae00-ea47-4511-86c0-03e12534c3a7" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
  pendingComponent: PendingComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}


function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <ThemeProvider defaultTheme="system" storageKey="obylon-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthGuard>
            <GlobalSentinelMonitor />
            <Outlet />
          </AuthGuard>
          <ToastProvider position="bottom-right" />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
