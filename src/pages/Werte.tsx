import { useEffect } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

type FaqGroup = {
  eyebrow: string;
  title: string;
  items: { q: string; a: string }[];
};

const groups: FaqGroup[] = [
  {
    eyebrow: "§01 · Haltung",
    title: "Wer wir sind — und wer nicht.",
    items: [
      {
        q: "Ist das eine Tierschutzorganisation?",
        a: "Nein. Wir sind eine Custody-Infrastruktur. Wir lehnen Haltung weder ab noch romantisieren wir sie. Wir bauen das System, das gebraucht wird, solange es Menschen gibt, die exotische Tiere halten — und arbeiten zugleich darauf hin, dass es immer weniger werden.",
      },
      {
        q: "Seid ihr gegen private Reptilienhaltung?",
        a: "Wir sind gegen Haltung als Konsum, Status oder Sammlung. Wir sind für temporäre, kompetente, dokumentierte Pflege im Notfall. Das ist ein Unterschied — und der Kern unserer Haltung.",
      },
      {
        q: "Warum nennt ihr das 'Sentinel' und nicht 'Halter'?",
        a: "Weil 'Halter' bedeutet: Ich besitze. 'Sentinel' bedeutet: Ich bewahre — befristet, im Auftrag, mit Verantwortung. Sprache formt Verhalten. Diese Umbenennung ist beabsichtigt.",
      },
    ],
  },
  {
    eyebrow: "§02 · Ethik",
    title: "Die unbequemen Fragen.",
    items: [
      {
        q: "Schafft ihr durch Pflegestellen nicht erst Anreize, weiter zu kaufen?",
        a: "Diese Sorge ist berechtigt. Deshalb bindet die Selbstverpflichtung jeden Sentinel an: kein Erwerb außerhalb der Pflege. Wer Sentinel wird, hört auf zu sammeln. Verstöße führen zum Ausschluss — Custody und Markt schließen sich aus.",
      },
      {
        q: "Was passiert, wenn ein Tier nicht vermittelt werden kann?",
        a: "Dauerpflege ist möglich, aber begründungspflichtig. Sie ist die Ausnahme, nicht das Ziel. In begründeten Fällen — keine Alternative, hohes Alter, schwere Vorerkrankung — bleibt das Tier. Dokumentation und Transparenz sind verpflichtend.",
      },
      {
        q: "Was, wenn ein Sentinel scheitert oder einen Fehler macht?",
        a: "Wir erwarten Fehler. Was wir nicht akzeptieren, ist Vertuschung. Outcome-Berichte werden unabhängig geführt — auch unangenehme Verläufe. Lernen ist Teil des Systems, Heroisieren nicht.",
      },
      {
        q: "Ist Euthanasie eine Option?",
        a: "Ja, unter veterinärmedizinischer Indikation. Tierwohl steht über Lebensverlängerung um jeden Preis. Diese Entscheidungen werden gemeinschaftlich getroffen, dokumentiert und nicht euphemisiert.",
      },
    ],
  },
  {
    eyebrow: "§03 · Praxis",
    title: "Wie es funktioniert.",
    items: [
      {
        q: "Wer bezahlt Futter, Tierarzt, Strom?",
        a: "Behörden, die ein Tier ins Custody-Netzwerk geben, übernehmen die Grundkosten. Sentinels stellen Zeit, Wissen und Infrastruktur. Wir sind keine Spenden- oder Crowdfunding-Plattform.",
      },
      {
        q: "Bin ich rechtlich abgesichert?",
        a: "Pflegeplatzierungen erfolgen auf Basis behördlicher Custody-Anordnung. Du handelst im Auftrag — nicht als Privathalter. Versicherung, Haftung und CITES-Status sind Teil jedes Custody-Vertrags.",
      },
      {
        q: "Wie viel Zeit kostet das?",
        a: "Variabel. Eine Aufnahme kann zwei Wochen oder neun Monate dauern. Du legst deine Kapazität selbst fest und kannst sie jederzeit pausieren. Niemand wird zur Aufnahme gezwungen.",
      },
      {
        q: "Was, wenn ich keine Erfahrung mit Beschlagnahmung habe?",
        a: "Erwartet — fast niemand hat sie zu Beginn. Das Verifikationsteam und ein Mentor begleiten deine ersten beiden Fälle. Ablehnung eines Falls ist immer möglich, ohne Begründung.",
      },
    ],
  },
  {
    eyebrow: "§04 · Zukunft",
    title: "Wohin das führt.",
    items: [
      {
        q: "Was ist das langfristige Ziel?",
        a: "Ein Netzwerk, das sich selbst verkleinert. Wenn private Exotenhaltung sinkt — durch bessere Regulierung, kulturellen Wandel, Aufklärung — sinkt der Bedarf an Sentinels. Das ist Erfolg.",
      },
      {
        q: "Werdet ihr ein gewinnorientiertes Unternehmen?",
        a: "Nein. Die Infrastruktur ist gemeinnützig konzipiert. Behördliche Verträge decken Betrieb, kein Gewinn aus Tierleid. Sollte sich das je ändern, lies bitte zuerst Punkt 1 unserer Pledge.",
      },
      {
        q: "Wie kann ich helfen, wenn ich kein Sentinel werden kann?",
        a: "Spreche mit Behörden in deinem Landkreis. Teile diese Seite. Korrigiere die Sprache, wenn jemand 'Pythonbesitzer' sagt. Kulturwandel beginnt im Vokabular.",
      },
    ],
  },
];

const Werte = () => {
  useEffect(() => {
    document.title = "Werte & FAQ · BioSteward";
    document.querySelector('meta[name="description"]')?.setAttribute(
      "content",
      "Die Werte hinter BioSteward: Custody statt Eigentum, Pflege statt Sammlung, Transparenz statt Status. Antworten auf die schwierigen Fragen.",
    );

    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: groups.flatMap((g) =>
        g.items.map((i) => ({
          "@type": "Question",
          name: i.q,
          acceptedAnswer: { "@type": "Answer", text: i.a },
        })),
      ),
    });
    document.head.appendChild(ld);
    return () => {
      document.head.removeChild(ld);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <section className="border-b border-border bg-hero">
          <div className="container py-20 lg:py-28">
            <span className="eyebrow">§ Werte · Häufige Fragen</span>
            <h1 className="font-editorial mt-6 max-w-4xl text-5xl leading-[1.02] md:text-7xl">
              Wir beantworten auch die{" "}
              <em className="italic text-primary">unbequemen</em> Fragen.
            </h1>
            <p className="mt-8 max-w-2xl text-lg text-muted-foreground">
              Wer ein System für lebende Tiere baut, schuldet Klarheit. Hier
              sind die Antworten — ohne Marketing, ohne Beschönigung.
            </p>
          </div>
        </section>

        {groups.map((g, gi) => (
          <section
            key={g.eyebrow}
            className={`border-b border-border ${gi % 2 === 0 ? "bg-surface" : "bg-background"}`}
          >
            <div className="container grid gap-12 py-20 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <span className="eyebrow">{g.eyebrow}</span>
                <h2 className="font-editorial mt-4 text-3xl leading-tight md:text-4xl">
                  {g.title}
                </h2>
              </div>
              <div className="lg:col-span-8">
                <Accordion type="single" collapsible className="border-t border-border">
                  {g.items.map((it, i) => (
                    <AccordionItem
                      key={it.q}
                      value={`${gi}-${i}`}
                      className="border-b border-border"
                    >
                      <AccordionTrigger className="py-6 text-left font-display text-lg leading-snug hover:no-underline md:text-xl">
                        <span className="flex gap-4">
                          <span className="font-mono text-[11px] tracking-[0.2em] text-primary">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          {it.q}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pb-6 pl-9 pr-4 text-base leading-relaxed text-muted-foreground">
                        {it.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>
          </section>
        ))}

        <section className="border-b border-border bg-hero">
          <div className="container flex flex-col items-start gap-6 py-20 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span className="eyebrow">§ Nächster Schritt</span>
              <h2 className="font-editorial mt-3 text-3xl md:text-4xl">
                Du hast genug gelesen.
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 px-6">
                <Link to="/sentinel">Sentinel-Pfad starten</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 border-border bg-transparent px-6">
                <Link to="/pledge">Pledge ansehen</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Werte;
