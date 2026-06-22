import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ShieldCheck, Compass, Hourglass, HeartHandshake } from "lucide-react";

const pillars = [
  {
    icon: Compass,
    title: "Vom Halter zum Sentinel",
    body:
      "Du gibst dein Wissen nicht auf — du richtest es neu aus. Statt zu sammeln, fängst du auf. Statt zu besitzen, begleitest du.",
  },
  {
    icon: Hourglass,
    title: "Pflege ist temporär",
    body:
      "Jedes Tier in deiner Obhut hat ein Ziel und einen Zeithorizont. Pflege ist eine Brücke — kein Dauerzustand.",
  },
  {
    icon: HeartHandshake,
    title: "Verantwortung statt Eigentum",
    body:
      "Die Tiere existieren bereits in menschlicher Obhut. Wegsehen hilft ihnen nicht. Kompetente, befristete Pflege schon.",
  },
  {
    icon: ShieldCheck,
    title: "Kein Markt, kein Status",
    body:
      "Sentinels handeln nicht. Keine Käufe, keine Zucht, keine Sammlung. Nur Aufnahme, Stabilisierung, Vermittlung.",
  },
];

export const Sentinel = () => {
  return (
    <section id="sentinel" className="relative border-t border-border bg-surface">
      <div className="container py-24 lg:py-32">
        <div className="grid gap-16 lg:grid-cols-12">
          {/* Left — manifesto column */}
          <div className="lg:col-span-5">
            <span className="eyebrow">§ Sentinels</span>
            <h2 className="font-editorial mt-4 text-5xl leading-[1.02] text-balance md:text-6xl">
              Du hast die{" "}
              <em className="italic text-primary">Erfahrung.</em>
              <br />
              Wir geben ihr eine{" "}
              <em className="italic text-foreground">Aufgabe.</em>
            </h2>

            <p className="mt-8 text-base leading-relaxed text-muted-foreground">
              Erfahrene Halter:innen wissen mehr über Reptilien und Wirbellose
              als die meisten Tierärzt:innen. Dieses Wissen ist selten — und es
              wird gebraucht. Nicht für die nächste Anschaffung. Für die Tiere,
              die jetzt schon da sind und niemanden haben.
            </p>

            <blockquote className="mt-10 border-l-2 border-primary pl-6">
              <p className="font-editorial text-2xl italic leading-snug text-foreground md:text-3xl">
                „Das Ziel ist nicht, bessere Halter zu schaffen — sondern die
                letzte Generation, die noch Halter sein muss."
              </p>
              <footer className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                — Leitsatz BioSteward
              </footer>
            </blockquote>

            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 px-6">
                <Link to="/sentinel">Sentinel-Pfad starten</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 border-border bg-transparent px-6 hover:bg-surface-elevated">
                <Link to="/werte">Werte & FAQ</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-12 px-6">
                <Link to="/pledge">Pledge ansehen</Link>
              </Button>
            </div>
          </div>

          {/* Right — pillars */}
          <div className="lg:col-span-7">
            <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
              {pillars.map((p) => (
                <article
                  key={p.title}
                  className="group relative bg-background p-8 transition-colors hover:bg-surface-elevated"
                >
                  <div className="flex items-center justify-between">
                    <p.icon className="h-5 w-5 text-primary" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      Pfeiler
                    </span>
                  </div>
                  <h3 className="font-display mt-8 text-2xl leading-tight">
                    {p.title}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {p.body}
                  </p>
                </article>
              ))}
            </div>

            {/* Pledge card */}
            <div className="mt-px border border-border bg-background p-8">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                  Sentinel-Selbstverpflichtung
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Privat · Reversibel · Jährlich
                </span>
              </div>
              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                {[
                  "Ich erwerbe keine neuen Tiere — außer für Notfall- oder Pflegeplatzierungen.",
                  "Ich akzeptiere, dass Pflege temporär sein soll, sofern nichts anderes begründet ist.",
                  "Ich stelle das Wohl des Tieres über mein persönliches Interesse.",
                  "Ich dokumentiere Verläufe transparent — auch unangenehme Ausgänge.",
                ].map((line) => (
                  <li key={line} className="flex gap-3">
                    <span className="mt-2 h-px w-4 shrink-0 bg-primary" />
                    <span className="text-foreground/85">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
