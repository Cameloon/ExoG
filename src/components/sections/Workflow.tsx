const steps = [
  {
    n: "01",
    title: "Intake",
    desc: "Behörde fotografiert das Tier, die KI klassifiziert die Spezies (CITES, Gefahrenstufe), ein Veterinär bestätigt binnen Minuten.",
    meta: "≤ 8 Min · KI + Mensch",
  },
  {
    n: "02",
    title: "Triage & Routing",
    desc: "System filtert Stewards nach Bundesland-Recht, Sachkunde, Anlagen­kapazität und Reaktionszeit. Bestätigung in der App.",
    meta: "Geo · Recht · Kapazität",
  },
  {
    n: "03",
    title: "Transport",
    desc: "Versiegelter Transport mit GPS, Temperatur-Log und QR-Übergabe. Jeder Wechsel der Custody wird kryptographisch signiert.",
    meta: "Chain-of-Custody",
  },
  {
    n: "04",
    title: "Pflege & Doku",
    desc: "Steward dokumentiert Fütterung, Häutung, Verhalten. Pflegelog ist gerichtsverwertbar und für die Behörde jederzeit einsehbar.",
    meta: "Beweismittel-Tagebuch",
  },
  {
    n: "05",
    title: "Outcome",
    desc: "Vermittlung an Auffangstation, dauerhafte Pflegestelle oder Rückführung. Akte wird geschlossen, Bericht automatisch erstellt.",
    meta: "Sanctuary-First",
  },
];

export const Workflow = () => (
  <section id="workflow" className="relative border-t border-border bg-background">
    <div className="container py-24 lg:py-32">
      <div className="grid gap-16 lg:grid-cols-12">
        <div className="lg:col-span-4 lg:sticky lg:top-24 lg:self-start">
          <span className="eyebrow">§ 03 — Ablauf</span>
          <h2 className="mt-4 text-4xl leading-tight text-balance md:text-5xl">
            Von der Beschlagnahme bis zur{" "}
            <em className="not-italic text-primary">geschlossenen Akte.</em>
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            Ein einziger Workflow ersetzt Telefonketten, Excel-Listen und
            improvisierte Notunterbringung.
          </p>
        </div>

        <ol className="lg:col-span-8">
          {steps.map((s, i) => (
            <li
              key={s.n}
              className="group relative grid grid-cols-[80px_1fr] gap-6 border-t border-border py-10 first:border-t-0 first:pt-0 md:grid-cols-[120px_1fr] md:gap-10"
            >
              <div>
                <div className="font-display text-5xl text-muted-foreground/40 transition-colors group-hover:text-primary">
                  {s.n}
                </div>
                <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {s.meta}
                </div>
              </div>
              <div>
                <h3 className="text-2xl tracking-tight">{s.title}</h3>
                <p className="mt-3 max-w-prose text-base leading-relaxed text-muted-foreground">
                  {s.desc}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  </section>
);
