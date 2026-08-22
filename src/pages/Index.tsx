import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Hero } from "@/components/sections/Hero";
import { Problem } from "@/components/sections/Problem";
import { System } from "@/components/sections/System";
import { Sentinel } from "@/components/sections/Sentinel";
import { Manifest } from "@/components/sections/Manifest";
import { Workflow } from "@/components/sections/Workflow";
import { Legal } from "@/components/sections/Legal";
import { CTA } from "@/components/sections/CTA";
import { useAuth } from "@/hooks/useAuth";
import { PageLoader } from "@/components/ui/loading-snake";

// Logged-in users are sent straight into the web app (role home); the
// marketing page is only shown when logged out or via /start.
const roleHome: Record<string, string> = {
  behoerde: "/behoerde",
  einrichtung: "/shelters",
  admin: "/admin",
  sentinel: "/care",
};

export const Landing = () => {
  useEffect(() => {
    document.title = "ExoGuard · Custody-Infrastruktur für beschlagnahmte Exoten";
    const meta = document.querySelector('meta[name="description"]');
    const content =
      "ExoGuard / BioSteward: Dezentrales Custody-Netzwerk für Veterinärämter, Polizei und Zoll — gerichtsfeste Beweiskette, verifizierte Stewards, CITES- und TierSchG-konform.";
    if (meta) meta.setAttribute("content", content);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = content;
      document.head.appendChild(m);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#09090B] text-foreground">
      <SiteHeader />
      <main>
        <Hero />
        <Problem />
        <System />
        <Sentinel />
        <Manifest />
        <Workflow />
        <Legal />
        <CTA />
      </main>
      <SiteFooter />
    </div>
  );
};

const Index = () => {
  const { user, role, loading } = useAuth();
  if (loading) {
    return <PageLoader label="Lade Start" />;
  }
  if (user) return <Navigate to={roleHome[role] ?? "/dashboard"} replace />;
  return <Landing />;
};

export default Index;
