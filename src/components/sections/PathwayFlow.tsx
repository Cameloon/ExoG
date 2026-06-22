import { Eye, FileSignature, Microscope, Network, Repeat } from "lucide-react";

const stages = [
  {
    n: "01",
    icon: Eye,
    title: "Selbstprüfung",
    duration: "≈ 20 Min.",
    body:
      "Du liest Haltung, Pfeiler und Selbstverpflichtung. Kein Account, keine Daten. Du entscheidest, ob das zu dir passt.",
  },
  {
    n: "02",
    icon: FileSignature,
    title: "Bewerbung & Pledge",
    duration: "≈ 30 Min.",
    body:
      "Du füllst das Sentinel-Profil aus, dokumentierst Erfahrung und unterzeichnest die Selbstverpflichtung — privat, jederzeit widerrufbar.",
  },
  {
    n: "03",
    icon: Microscope,
    title: "Verifikation",
    duration: "2 – 6 Wochen",
    body:
      "Vor-Ort-Begehung durch eine:n bestehende:n Sentinel oder Amtsveterinär:in. Geprüft werden Haltung, Hygiene, Quarantänekapazität und Sachkunde.",
  },
  {
    n: "04",
    icon: Network,
    title: "Aktivierung",
    duration: "Sofort nach Freigabe",
    body:
      "Du erscheinst im Custody-Netzwerk mit Spezies-Profil, Kapazität und Reaktionszeit. Ab jetzt können Behörden dich anfragen.",
  },
  {
    n: "05",
    icon: Repeat,
    title: "Pflege & Vermittlung",
    duration: "Pro Fall: Wochen – Monate",
    body:
      "Aufnahme, Stabilisierung, Dokumentation, Übergabe. Jeder Fall endet mit einem Outcome-Bericht — auch unangenehme Verläufe.",
  },
];

export const PathwayFlow = () => {
  return (
    <section className="border-t border-border bg-surface">
      <div className="container py-20 lg:py-28">
        <div className="max-w-2xl">
          <span className="eyebrow">§ Sentinel-Pfad</span>
          <h2 className="font-editorial mt-4 text-4xl leading-[1.05] md:text-5xl">
            Fünf Stationen vom <em className="italic text-primary">Interesse</em> bis
            zur ersten <em className="italic">Aufnahme.</em>
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            Es gibt keinen schnellen Weg in dieses Netzwerk — und das ist Absicht.
            Jede Station ist ein Filter, nicht ein Hindernis.
          </p>
        </div>

        <ol className="relative mt-16 grid gap-px border border-border bg-border md:grid-cols-5">
          {stages.map((s, i) => (
            <li
              key={s.n}
              className="group relative flex flex-col bg-background p-6 transition-colors hover:bg-surface-elevated"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] tracking-[0.22em] text-primary">
                  {s.n}
                </span>
                <s.icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
              <h3 className="font-display mt-6 text-xl leading-tight">{s.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
              <div className="mt-6 border-t border-border pt-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {s.duration}
                </span>
              </div>
              {i < stages.length - 1 && (
                <span className="absolute right-[-1px] top-1/2 hidden h-px w-4 -translate-y-1/2 bg-primary/40 md:block" />
              )}
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-border pt-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Drop-out an jeder Station möglich · Keine Daten verbleiben
          </span>
        </div>
      </div>
    </section>
  );
};
