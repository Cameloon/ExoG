import { useEffect } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PathwayFlow } from "@/components/sections/PathwayFlow";
import SentinelOnboarding from "@/components/sections/SentinelOnboarding";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const SentinelPath = () => {
  useEffect(() => {
    document.title = "Sentinel-Pfad · BioSteward";
    const meta = document.querySelector('meta[name="description"]');
    const c =
      "Der Weg vom erfahrenen Halter zum Sentinel: fünf Stationen, klare Selbstverpflichtung, Bewerbung im verifizierten Custody-Netzwerk.";
    meta?.setAttribute("content", c);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        {/* Page hero */}
        <section className="relative overflow-hidden border-b border-border bg-hero">
          <div className="container relative py-24 lg:py-32">
            <span className="eyebrow">§ Pfad · Sentinel</span>
            <h1 className="font-editorial mt-6 max-w-4xl text-5xl leading-[1.02] text-balance md:text-7xl">
              Vom Halter zum{" "}
              <em className="italic text-primary">Sentinel.</em>
              <br />
              Ein Weg in fünf Stationen.
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Dies ist kein Onboarding. Es ist ein Filter — entworfen, um nur die
              Menschen aufzunehmen, die das Tier wirklich vor sich selbst stellen
              können.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 px-6">
                <a href="#onboarding">Bewerbung beginnen</a>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 border-border bg-transparent px-6">
                <Link to="/pledge">Pledge ansehen</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-12 px-6">
                <Link to="/werte">Werte & FAQ</Link>
              </Button>
            </div>
          </div>
        </section>

        <PathwayFlow />
        <SentinelOnboarding />
      </main>
      <SiteFooter />
    </div>
  );
};

export default SentinelPath;
