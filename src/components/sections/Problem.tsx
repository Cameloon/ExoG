import { AlertTriangle, Clock, FileX2, Scale } from "lucide-react";

const problems = [
  {
    icon: Clock,
    stat: "72 Std",
    label: "Kritisches Zeitfenster",
    body: "Nach der Beschlagnahme entscheiden Stunden über das Überleben des Tieres — und damit über die Verwertbarkeit des Beweismittels.",
  },
  {
    icon: FileX2,
    stat: "41 %",
    label: "Verfahren mit Beweisproblemen",
    body: "Lückenhafte Pflegedokumentation und unklare Custody-Übergaben führen regelmäßig zu Beweismittelausfall vor Gericht.",
  },
  {
    icon: Scale,
    stat: "16",
    label: "Bundesländer · 16 Regelwerke",
    body: "Föderale Fragmentierung macht die rechtskonforme Unterbringung zum Vollzeitjob. ExoGuard kennt jede Landesregelung.",
  },
  {
    icon: AlertTriangle,
    stat: "Ø 8.400 €",
    label: "Kosten pro Fall",
    body: "Tierarzt, Transport, Notunterkunft, Personal — verteilt auf Ämter ohne spezialisierte Infrastruktur.",
  },
];

export const Problem = () => (
  <section id="problem" className="relative border-t border-border bg-background">
    <div className="container py-24 lg:py-32">
      <div className="grid gap-16 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <span className="eyebrow">§ 01 — Ausgangslage</span>
          <h2 className="mt-4 text-4xl leading-tight text-balance md:text-5xl">
            Ein lebendes Asservat ist eine{" "}
            <em className="not-italic text-primary">tickende Akte.</em>
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            Polizei, Zoll und Veterinärämter sind nicht für die Haltung
            tropischer Vipern, CITES-geschützter Echsen oder beschlagnahmter
            Greifvögel ausgestattet. Was fehlt, ist keine App — sondern eine
            Kette.
          </p>
        </div>

        <div className="lg:col-span-8">
          <div className="grid gap-px bg-border sm:grid-cols-2">
            {problems.map((p) => (
              <div
                key={p.label}
                className="group relative bg-background p-8 transition-colors hover:bg-surface-elevated"
              >
                <p.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                <div className="mt-6 font-display text-4xl tracking-tight">{p.stat}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {p.label}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </section>
);
