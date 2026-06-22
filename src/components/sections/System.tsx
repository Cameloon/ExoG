import { Building2, ShieldCheck, HeartPulse } from "lucide-react";

const sides = [
  {
    code: "A",
    icon: Building2,
    role: "Behörde",
    title: "Sie geben die Akte ab — nicht die Verantwortung.",
    bullets: [
      "Spezies-Identifikation per KI + Expertenbestätigung",
      "Lückenlose Custody-Chain als Gerichtsbeweis",
      "Automatisierte Meldepflicht & Berichte",
      "Reduktion der Haftungsexposition",
    ],
    cta: "Veterinäramt · Polizei · Zoll",
  },
  {
    code: "B",
    icon: ShieldCheck,
    role: "Steward",
    title: "Sie erhalten Aufträge — keine Anzeigen.",
    bullets: [
      "Zertifizierungsstufen bis Gifttierhaltung",
      "Verifizierung von Sachkundenachweis & Anlage",
      "Mentor-System (Paten) und Fachkanäle",
      "Zugang zu seltenen Spezies — ohne Eigentum",
    ],
    cta: "Vetted · KYC · Anlagen-Audit",
  },
  {
    code: "C",
    icon: HeartPulse,
    role: "Tier",
    title: "Es bleibt Subjekt — nie Ware.",
    bullets: [
      "Priorität: Auffangstation oder Zoo",
      "Fallback: dauerhafte Pflegestelle",
      "Kein Verkauf · keine Weitergabe ohne Akte",
      "Outcome-Tracking über die gesamte Lebenszeit",
    ],
    cta: "Custody · nicht Eigentum",
  },
];

export const System = () => (
  <section id="system" className="relative border-t border-border bg-[#09090B]">
    <div className="container py-24 lg:py-32">
      <div className="mx-auto max-w-2xl text-center">
        <span className="eyebrow">§ 02 — Architektur</span>
        <h2 className="mt-4 text-4xl leading-tight text-balance md:text-5xl">
          Drei Seiten. <em className="not-italic text-primary">Eine Akte.</em>
        </h2>
        <p className="mt-6 text-base leading-relaxed text-muted-foreground">
          ExoGuard ist kein Marktplatz. Es ist ein geschlossenes
          Custody-Netzwerk, in dem jede Übergabe protokolliert,
          jede Person zertifiziert und jedes Tier nachverfolgt wird.
        </p>
      </div>

      <div className="mt-20 grid gap-4 lg:grid-cols-3">
        {sides.map((s, i) => (
          <article
            key={s.code}
            className="group relative rounded-lg border border-white/5 bg-white/[0.03] p-10 transition-all hover:bg-white/[0.06]"
          >
            <div className="flex items-start justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                Seite {s.code} · {String(i + 1).padStart(2, "0")}
              </span>
              <s.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
            </div>

            <div className="mt-12">
              <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary">
                {s.role}
              </div>
              <h3 className="mt-4 text-2xl leading-tight tracking-tight text-balance">
                {s.title}
              </h3>
            </div>

            <ul className="mt-8 space-y-3">
              {s.bullets.map((b) => (
                <li key={b} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="mt-2 h-px w-3 shrink-0 bg-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10 border-t border-border pt-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {s.cta}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);