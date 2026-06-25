export const Manifest = () => {
  const principles = [
    { k: "01", t: "Schadensminderung", d: "vor moralischer Reinheit" },
    { k: "02", t: "Evidenz", d: "vor Tradition" },
    { k: "03", t: "Begleitung auf Zeit", d: "vor Eigentum" },
    { k: "04", t: "Transparenz", d: "vor Bequemlichkeit" },
  ];

  return (
    <section id="manifest" className="relative border-t border-border bg-background-neutral dark:bg-background">
      <div className="container py-24 lg:py-32">
        <div className="grid gap-16 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <span className="eyebrow">§ Haltung</span>
            <h2 className="font-editorial mt-4 text-5xl leading-[1.02] text-balance md:text-6xl">
              Wir sind nicht{" "}
              <em className="italic text-muted-foreground">gegen</em> Halter.
              <br />
              Wir sind <em className="italic text-primary">für</em> die Tiere,
              die schon da sind.
            </h2>
          </div>

          <div className="lg:col-span-8 lg:pl-12">
            <div className="space-y-10 text-base leading-relaxed text-muted-foreground">
              <p>
                Millionen exotischer Tiere leben bereits in privater Obhut —
                aus historischen, rechtlichen und kulturellen Gründen. Unsere
                Verantwortung gilt diesen Individuen. Nicht der Fortführung des
                Systems, das sie hervorgebracht hat.
              </p>
              <p className="text-foreground">
                Wir verfolgen einen Schadensminderungs-Ansatz: kompetente,
                befristete Pflege statt Wegsehen. Strukturierte Übergänge statt
                Schwarzmarkt. Datenbasierte Politik statt Symbolverbote.
              </p>
              <p>
                Erfolg messen wir nicht an Wachstum — sondern an{" "}
                <span className="text-foreground">kürzeren Verweildauern</span>,{" "}
                <span className="text-foreground">weniger Notaufnahmen</span>{" "}
                und einer Welt, in der Plattformen wie unsere irgendwann nicht
                mehr gebraucht werden.
              </p>
            </div>

            {/* Principles grid */}
            <dl className="mt-16 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {principles.map((p) => (
                <div key={p.k} className="bg-background p-6">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                    Prinzip {p.k}
                  </dt>
                  <dd className="mt-4">
                    <div className="font-display text-xl leading-tight text-foreground">
                      {p.t}
                    </div>
                    <div className="mt-1 text-xs italic text-muted-foreground">
                      {p.d}
                    </div>
                  </dd>
                </div>
              ))}
            </dl>

            {/* Anti-position */}
            <div className="mt-12 border border-border bg-surface-elevated p-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Was wir ausdrücklich nicht tun
              </div>
              <ul className="mt-6 grid gap-4 text-sm text-foreground/85 sm:grid-cols-2">
                {[
                  "Tiere als Statussymbole behandeln",
                  "Impulsanschaffungen normalisieren",
                  "„Rettungs“-Sprache zur Rechtfertigung von Handel nutzen",
                  "Menschen beschämen, die Tiere in gutem Glauben abgeben",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-px w-4 shrink-0 bg-destructive/70" />
                    <span>{item}</span>
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
