import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export const CTA = () => (
  <section id="kontakt" className="relative border-t border-white/5 bg-[#09090B]">
    <div className="container py-24 lg:py-32">
      <div className="relative overflow-hidden rounded-lg border border-white/5 bg-white/[0.03] p-10 md:p-16">
        <div className="relative grid gap-12 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <span className="eyebrow">Pilot-Anfrage · Behörden</span>
            <h2 className="mt-4 text-4xl leading-tight text-balance md:text-5xl lg:text-6xl">
              Starten Sie einen Pilot in{" "}
              <em className="not-italic text-primary">einer Region.</em>
            </h2>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
              Wir empfehlen eine 90-Tage-Pilotphase mit einem Veterinäramt,
              5–8 verifizierten Stewards und gemessenen KPIs:
              Vermittlungs­geschwindigkeit, Überlebens­quote, Verweildauer.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:col-span-5 lg:items-end">
            <Button asChild size="lg" className="h-12 w-full px-6 lg:w-auto">
              <Link to="/demo">
                Live-Demo öffnen
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 w-full border-border bg-transparent px-6 hover:bg-surface lg:w-auto">
              <a href="mailto:behoerden@exoguard.de">behoerden@exoguard.de</a>
            </Button>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Antwort binnen 24 Std · DE / AT / CH
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
);