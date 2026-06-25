import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Building2, PawPrint, ShieldCheck } from "lucide-react";
import { AuthorityView } from "@/components/dashboard/AuthorityView";
import { SentinelView } from "@/components/dashboard/SentinelView";
import { AdminView } from "@/components/dashboard/AdminView";

type Role = "authority" | "sentinel" | "admin";

const roles: { id: Role; label: string; sub: string; icon: typeof Building2 }[] = [
  { id: "authority", label: "Behörde", sub: "VetA München · BY-Süd", icon: Building2 },
  { id: "sentinel", label: "Sentinel", sub: "Dr. K. Hoffmann · S4", icon: PawPrint },
  { id: "admin", label: "ExoGuard Admin", sub: "Zertifizierungs-Review", icon: ShieldCheck },
];

const Dashboard = () => {
  const [role, setRole] = useState<Role>("authority");

  useEffect(() => {
    document.title = "Plattform-Demo · ExoGuard";
  }, []);

  const current = roles.find((r) => r.id === role)!;

  return (
    <div className="min-h-screen bg-background text-foreground dashboard-bg">
      <SiteHeader />

      {/* Sub-nav: role switcher */}
      <div className="border-b border-border bg-surface">
        <div className="container flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <span className="case-tag">Demo-Modus</span>
            <span className="font-mono text-xs text-muted-foreground">{current.sub}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-px bg-border">
              {roles.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  className={`flex items-center gap-2 bg-surface px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                    role === r.id
                      ? "bg-surface-elevated text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <r.icon className="h-3 w-3" />
                  {r.label}
                </button>
              ))}
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="h-1.5 w-1.5 bg-success animate-pulse-dot" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Live · Sync vor 3s
              </span>
            </div>
            {role === "authority" && (
              <Button size="sm" className="h-8">
                + Neue Akte
              </Button>
            )}
          </div>
        </div>
      </div>

      <main className="container py-8">
        {role === "authority" && <AuthorityView />}
        {role === "sentinel" && <SentinelView />}
        {role === "admin" && <AdminView />}
      </main>
    </div>
  );
};

export default Dashboard;
