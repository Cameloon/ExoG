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
import { useEffect } from "react";

const Index = () => {
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

export default Index;