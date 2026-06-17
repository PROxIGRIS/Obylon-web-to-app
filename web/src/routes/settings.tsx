import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Shell } from "@/components/sentinel/Shell";
import { User, Shield, Sliders, Activity } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  const { location } = useRouterState();

  const navItems = [
    { name: "General", path: "/settings/general", icon: User },
    { name: "Security", path: "/settings/security", icon: Shield },
    { name: "Preferences", path: "/settings/preferences", icon: Sliders },
    { name: "Audit", path: "/settings/audit", icon: Activity },
  ];

  return (
    <Shell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-full md:w-64 shrink-0 space-y-1">
            <h2 className="text-xl font-semibold tracking-tight mb-6 text-foreground">Settings</h2>
            {navItems.map((item) => {
              const active = location.pathname.startsWith(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-full transition-all font-medium text-sm ${
                    active 
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </aside>

          {/* Right-hand content */}
          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </Shell>
  );
}
