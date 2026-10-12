import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Building2, PawPrint, ShieldCheck, Landmark } from "lucide-react";
import { AuthorityView } from "@/components/dashboard/AuthorityView";
import { SentinelView } from "@/components/dashboard/SentinelView";
import { AdminView } from "@/components/dashboard/AdminView";

type Role = "authority" | "sentinel" | "admin" | "behoerde" | "einrichtung";

const roles: { id: Role; label: string; sub: string; icon: typeof Building2; real?: string }[] = [
  { id: "authority", label: "Behörde (Demo)", sub: "VetA München · BY-Süd", icon: Building2 },
  { id: "sentinel", label: "Sentinel", sub: "Dr. K. Hoffmann · S4", icon: PawPrint },
  { id: "admin", label: "ExoGuard Admin", sub: "Zertifizierungs-Review", icon: ShieldCheck },
  { id: "behoerde", label: "Behörde (Live)", sub: "Einzugsgebiet · Region", icon: Landmark, real: "/behoerde" },
  { id: "einrichtung", label: "Einrichtung (Live)", sub: "Tierheim / Shelter", icon: Building2, real: "/shelters" },
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
            <div className="flex flex-wrap gap-px bg-border">
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
          </div>
        </div>
      </div>

      <main className="container py-8">
        {role === "authority" && <AuthorityView />}
        {role === "sentinel" && <SentinelView />}
        {role === "admin" && <AdminView />}
        {(role === "behoerde" || role === "einrichtung") && (
          <div className="rounded border border-border bg-surface p-10 text-center">
            <p className="font-display text-2xl">{current.label}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Diese Ansicht ist die reale, rollen- und regionsgebundene App. Sie ist
              nur mit dem passenden Clerk-Rollen-Metadatum erreichbar.
            </p>
            {current.real && (
              <Button asChild className="mt-6">
                <Link to={current.real}>Zur Live-Ansicht</Link>
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
