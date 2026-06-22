const items = [
  { tag: "CITES A/B/C", title: "Klassifizierung & restriktives Routing", body: "Anhang-A-Spezies werden ausschließlich an institutionelle Halter geroutet. Privatpersonen sind systemseitig ausgeschlossen." },
  { tag: "TierSchG", title: "Konform mit dem Tierschutzgesetz", body: "Alle Standards orientieren sich an §11 TierSchG sowie den DGHT-Leitlinien für die Mindestanforderungen." },
  { tag: "Sachkunde", title: "Nachweis verpflichtend", body: "Sachkundenachweis (§2 TierSchG) wird vor Aktivierung des Steward-Accounts geprüft und versioniert hinterlegt." },
  { tag: "Föderal", title: "16 Bundesländer · 16 Regelwerke", body: "Geo-basierte Berechtigungen sorgen dafür, dass Stewards nur Akten erhalten, die in ihrem Land legal übernommen werden dürfen." },
  { tag: "Meldepflicht", title: "Automatisierte Meldungen", body: "Bestandsänderungen werden automatisch an das zuständige Veterinäramt gemeldet — inkl. Herkunftsnachweis." },
  { tag: "DSGVO", title: "Behördliche Vertraulichkeit", body: "Anonymisierte Listings, kontrollierte Offenlegung, Ende-zu-Ende-verschlüsselte Behördenkommunikation." },
];

export const Legal = () => (
  <section id="recht" className="relative border-t border-border bg-surface">
    <div className="container py-24 lg:py-32">
      <div className="mx-auto max-w-2xl text-center">
        <span className="eyebrow">§ 04 — Rechtsrahmen</span>
        <h2 className="mt-4 text-4xl leading-tight text-balance md:text-5xl">
          Designed für deutsches Recht —{" "}
          <em className="not-italic text-primary">vom ersten Tag.</em>
        </h2>
        <p className="mt-6 text-base leading-relaxed text-muted-foreground">
          Wir verwalten Beweismittel, keine Haustiere. Jede Funktion ist
          gegen TierSchG, BNatSchG, BArtSchV und CITES geprüft.
        </p>
      </div>

      <div className="mt-16 grid gap-px bg-border md:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div key={it.title} className="bg-surface p-8 transition-colors hover:bg-surface-elevated">
            <span className="case-tag">{it.tag}</span>
            <h3 className="mt-6 text-lg leading-snug tracking-tight">{it.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{it.body}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);
