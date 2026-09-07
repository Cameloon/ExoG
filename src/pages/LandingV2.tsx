import { Fragment, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  Eye,
  FileSignature,
  HeartHandshake,
  Microscope,
  Network,
  Repeat,
  type LucideIcon,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import heroImg from "@/assets/hero-evidence.jpg";
import { Button } from "@/components/ui/button";

// ponytail: bklit-flavored lab page. bklit OKLCH tokens → HSL scope below
// (light + dark, page-local — global theme untouched). Mono+stone,
// radius 0, switchable accent (orange default, lila option). No deps, one file.

// three.js PixelBlast (~600KB) is decorative — same idle-defer as the original.
const PixelBlast = lazy(() => import("@/components/backgrounds/PixelBlast"));

const V2_CSS = `
.v2scope{
  --background:68 0% 96%; --foreground:200 14% 4%;
  --card:63 100% 100%; --card-foreground:200 14% 4%;
  --popover:63 100% 100%; --popover-foreground:200 14% 4%;
  --primary:69 0% 24%; --primary-foreground:150 0% 93%;
  --secondary:240 18% 98%; --secondary-foreground:240 6% 10%;
  --muted:68 0% 92%; --muted-foreground:120 0% 46%;
  --accent:60 0% 92%; --accent-foreground:223 38% 15%;
  --border:68 0% 90%; --input:69 0% 95%; --ring:0 0% 0%;
  --radius:0rem;
  --success:152 55% 30%;
  --v2a:45 93% 47%; --v2ai:25 90% 36%;
  /* bklit chart tokens (stone scale, light) — dieselbe Art, Akzente zu setzen */
  --chart-1:30 6% 25%; --chart-2:25 5% 45%; --chart-3:24 3% 65%;
  --chart-4:24 6% 84%; --chart-5:60 5% 96%;
  background:hsl(var(--background)); color:hsl(var(--foreground));
}
html.dark .v2scope{
  --background:221 15% 4%; --foreground:180 20% 98%;
  --card:225 12% 6%; --card-foreground:180 20% 98%;
  --popover:227 12% 12%; --popover-foreground:180 20% 98%;
  --primary:192 11% 90%; --primary-foreground:197 13% 10%;
  --secondary:227 12% 15%; --secondary-foreground:180 20% 98%;
  --muted:230 12% 19%; --muted-foreground:224 8% 54%;
  --accent:229 12% 18%; --accent-foreground:180 20% 98%;
  --border:224 12% 16%; --input:224 12% 16%; --ring:225 84% 60%;
  --success:145 50% 45%;
  --v2a:45 93% 47%; --v2ai:43 96% 60%;
  /* bklit chart tokens (zinc scale, dark) */
  --chart-1:240 4% 16%; --chart-2:240 5% 34%; --chart-3:240 4% 46%;
  --chart-4:240 5% 65%; --chart-5:240 5% 84%;
}
.v2scope[data-acc="lila"]{ --v2a:239 84% 67%; --v2ai:243 75% 50%; }
html.dark .v2scope[data-acc="lila"]{ --v2a:239 84% 67%; --v2ai:234 89% 74%; }
/* Graphit = bklits Mono-Akzent, direkt aus den chart tokens */
.v2scope[data-acc="mono"]{ --v2a:var(--chart-2); --v2ai:var(--chart-1); }
html.dark .v2scope[data-acc="mono"]{ --v2a:var(--chart-4); --v2ai:var(--chart-5); }
/* Forest = bklits Teal-Skala auf --chart-1…5, Akzent daraus abgeleitet */
.v2scope[data-acc="forest"]{
  --chart-1:176 69% 22%; --chart-2:175 84% 32%; --chart-3:173 80% 40%;
  --chart-4:172 66% 50%; --chart-5:168 84% 78%;
  --v2a:var(--chart-3); --v2ai:var(--chart-1);
}
html.dark .v2scope[data-acc="forest"]{
  --chart-1:175 77% 26%; --chart-2:175 84% 32%; --chart-3:173 80% 40%;
  --chart-4:172 66% 50%; --chart-5:171 77% 64%;
  --v2a:var(--chart-3); --v2ai:var(--chart-4);
}
/* Lagoon = bklits Cyan-Skala, gleiche Mechanik */
.v2scope[data-acc="lagoon"]{
  --chart-1:194 70% 27%; --chart-2:192 91% 36%; --chart-3:189 94% 43%;
  --chart-4:188 86% 53%; --chart-5:186 94% 82%;
  --v2a:var(--chart-3); --v2ai:var(--chart-1);
}
html.dark .v2scope[data-acc="lagoon"]{
  --chart-1:193 82% 31%; --chart-2:192 91% 36%; --chart-3:189 94% 43%;
  --chart-4:188 86% 53%; --chart-5:187 92% 69%;
  --v2a:var(--chart-3); --v2ai:var(--chart-4);
}
.v2a{ color:hsl(var(--v2ai)); }
.v2ab{ background-color:hsl(var(--v2a)); }
.v2aglow{ background-color:hsl(var(--v2a) / .15); }
.v2scope ::selection{ background:hsl(var(--v2a)); color:#fff; }
.v2dots{
  background-image:radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0);
  background-size:22px 22px;
}
.v2caret{ animation:v2blink 1.06s step-end infinite; }
@keyframes v2blink{ 0%,100%{opacity:1} 50%{opacity:0} }
@media (prefers-reduced-motion: reduce){ .v2caret{ animation:none } }
.v2node{ border:1px solid hsl(var(--border)); background:hsl(var(--card)); }
.v2node-on{
  border-color:hsl(var(--v2a));
  background:hsl(var(--background));
  box-shadow:0 0 0 1px hsl(var(--v2a) / .45), 0 0 28px -8px hsl(var(--v2a) / .55);
}
.v2edge{ position:relative; display:block; background:hsl(var(--border)); }
.v2edge > span{ position:absolute; inset:0; display:block; background:hsl(var(--v2a)); transform:scaleX(0); transform-origin:left center; }
.v2edge-done > span{ transform:none; }
/* Loading-Bar: Dauer muss zu STEP_MS unten passen */
.v2edge-run > span{ animation:v2load 3.6s linear forwards; }
@keyframes v2load{ from{ transform:scaleX(0); } to{ transform:scaleX(1); } }
.v2paused .v2edge-run > span{ animation-play-state:paused; }
@media (max-width:1023.5px){
  .v2edge > span{ transform:scaleY(0); transform-origin:center top; }
  .v2edge-run > span{ animation-name:v2loadY; }
  @keyframes v2loadY{ from{ transform:scaleY(0); } to{ transform:scaleY(1); } }
}
@media (prefers-reduced-motion: reduce){ .v2edge-run > span{ animation:none } }
html:not(.dark) .v2scope .v2fx{ opacity:.45; filter:saturate(.8) brightness(1.05); }
`;

type FlowStep = { n: string; title: string; time: string; body: string; icon?: LucideIcon };

// bklit-style Wireframe: Dot-Canvas, Eck-Kreuze, Fig-Leiste.
const Wire = ({ fig, meta, children, className = "" }: { fig: string; meta: string; children: ReactNode; className?: string }) => (
  <div className={`relative border border-border bg-background ${className}`}>
    <div className="v2dots pointer-events-none absolute inset-0 text-foreground opacity-[0.05]" aria-hidden />
    {(["-left-[7px] -top-[12px]", "-right-[7px] -top-[12px]", "-left-[7px] -bottom-[12px]", "-right-[7px] -bottom-[12px]"] as const).map((pos) => (
      <span key={pos} aria-hidden className={`absolute ${pos} z-10 bg-background px-0.5 font-mono text-sm leading-none text-muted-foreground`}>+</span>
    ))}
    <div className="relative flex items-center justify-between gap-4 border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
      <span>{fig}</span>
      <span>{meta}</span>
    </div>
    <div className="relative p-4 md:p-6">{children}</div>
  </div>
);

// Muss zur .v2edge-run Animationsdauer im CSS oben passen.
const STEP_MS = 3600;

const BEH_FLOW: FlowStep[] = [
  { n: "01", title: "Intake ≤ 8 Min", time: "KI + Mensch", body: "Foto hochladen, KI klassifiziert Spezies, CITES und Gefahrenstufe — Veterinär bestätigt in Minuten." },
  { n: "02", title: "Triage & Routing", time: "Geo · Recht · Kapazität", body: "Nur zulässige Stewards im eigenen Bundesland, nach Sachkunde, Anlage und Reaktionszeit gefiltert." },
  { n: "03", title: "Transport", time: "Chain-of-Custody", body: "Versiegelt, GPS + Temperatur-Log, QR-Übergabe. Jeder Handwechsel kryptographisch signiert." },
  { n: "04", title: "Pflege & Doku", time: "Beweis-Tagebuch", body: "Fütterung, Häutung, Verhalten — gerichtsverwertbar dokumentiert, für euch jederzeit einsehbar." },
  { n: "05", title: "Outcome", time: "Sanctuary-first", body: "Auffangstation zuerst, Akte zu, Bericht automatisch raus. KPIs: Speed, Überleben, Verweildauer." },
];

const SEN_FLOW: FlowStep[] = [
  { n: "01", icon: Eye, title: "Selbstprüfung", time: "≈ 20 Min", body: "Haltung, Pfeiler, Pledge lesen. Kein Account, keine Daten — Drop-out jederzeit." },
  { n: "02", icon: FileSignature, title: "Bewerbung & Pledge", time: "≈ 30 Min", body: "Profil + Erfahrung dokumentieren, Selbstverpflichtung privat unterzeichnen, jederzeit widerrufbar." },
  { n: "03", icon: Microscope, title: "Verifikation", time: "2–6 Wochen", body: "Begehung durch Sentinel oder Amtsvet: Haltung, Hygiene, Quarantäne, Sachkunde. Gründlich, nicht feindselig." },
  { n: "04", icon: Network, title: "Aktivierung", time: "ab Freigabe", body: "Dein Profil geht live: Spezies, Kapazität, Reaktionszeit. Behörden können dich anfragen." },
  { n: "05", icon: Repeat, title: "Erster Einsatz", time: "Wochen–Monate", body: "Aufnahme, Stabilisierung, Doku, Übergabe. Jeder Fall endet mit Outcome-Bericht." },
];

const PLEDGE_SHORT = [
  ["I", "Kein Erwerb außerhalb der Pflege"],
  ["II", "Pflege ist temporär"],
  ["III", "Tier vor Ich"],
  ["IV", "Radikale Transparenz"],
  ["V", "Kein Status, kein Markt"],
  ["VI", "Reversibel — jederzeit raus"],
];

const FAQS = [
  {
    q: "Muss ich als Halter meine eigenen Tiere abgeben?",
    a: "Nein. Dein Bestand bleibt deiner und wird bei der Verifikation nur dokumentiert. Die Pledge heißt: kein Neuerwerb für die Sammlung — Aufnahmen nur als Pflege- oder Notfallplatzierung.",
  },
  {
    q: "Muss unsere Behörde Software installieren?",
    a: "Nein. Alles läuft im Browser: Akte anlegen, Foto hochladen, Steward bestätigen. Pilot-Ämter sind in unter einem Tag startklar — Schulung inklusive.",
  },
  {
    q: "Was passiert bei CITES-Anhang-A-Tieren?",
    a: "Das Routing schließt Privatpersonen systemseitig aus. Anhang-A-Spezies gehen ausschließlich an institutionelle Halter (Auffangstation, Zoo). Jede Entscheidung steht in der Akte.",
  },
  {
    q: "Was, wenn ein Tier in Pflege stirbt?",
    a: "Du dokumentierst es ehrlich — Pledge-Punkt IV. Sterbefälle gehören zu oft vorgeschädigten Tieren dazu und führen nicht automatisch zum Ausschluss. Verschweigen schon.",
  },
  {
    q: "Hält die Dokumentation vor Gericht?",
    a: "Jede Übergabe: Zeitstempel, GPS, Foto, Signatur — lückenlos vom Fund bis zum Outcome. Genau das schließt die 41 % Verfahren mit Beweisproblemen.",
  },
  {
    q: "Was kostet Piloten und Bewerbung?",
    a: "Die Sentinel-Bewerbung ist kostenlos. Behörden-Pilot: 90 Tage, ein Amt, 5–8 Stewards, drei KPIs. Anfrage an behoerden@exoguard.de — Antwort binnen 24 h.",
  },
];

export const LandingV2 = () => {
  const [audience, setAudience] = useState<"beh" | "sen">("sen");
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [acc, setAcc] = useState<"orange" | "lila" | "mono" | "forest" | "lagoon">(() => {
    try {
      const v = localStorage.getItem("v2.acc");
      return v === "lila" || v === "mono" || v === "forest" || v === "lagoon" ? v : "orange";
    } catch {
      return "orange";
    }
  });
  const [showFx, setShowFx] = useState(false);
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : true,
  );

  const flow = audience === "beh" ? BEH_FLOW : SEN_FLOW;

  useEffect(() => {
    document.title = "ExoGuard v2 · Custody für lebende Asservate";
    setStep(0);
  }, [audience]);

  // n8n-style auto-run: Nodes zünden nach und nach, Hover pausiert.
  useEffect(() => {
    if (paused) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setStep((s) => (s + 1) % flow.length), STEP_MS);
    return () => clearInterval(id);
  }, [audience, paused, flow.length]);

  useEffect(() => {
    try {
      localStorage.setItem("v2.acc", acc);
    } catch {
      /* ignore */
    }
  }, [acc]);

  // Theme für PixelBlast-Größe beobachten (hell braucht gröbere Pixel).
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setIsDark(el.classList.contains("dark"));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  // PixelBlast idle-defer wie im Original — three.js konkurriert nicht mit First Paint.
  useEffect(() => {
    const mount = () => setShowFx(true);
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(mount, { timeout: 1500 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(mount, 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    document.title = "ExoGuard v2 · Custody für lebende Asservate";
  }, []);

  return (
    <div className="v2scope min-h-screen font-sans antialiased" data-acc={acc}>
      <style>{V2_CSS}</style>
      <SiteHeader />

      <div className="border-b border-border">
        <div className="container flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <span className="v2a">● Design-Labor v2</span>
            <span className="mx-2 hidden sm:inline">·</span>
            <span className="hidden sm:inline">bklit-edition · light + dark</span>
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1   border border-border p-0.5 font-mono text-[10px] uppercase tracking-[0.15em]" role="group" aria-label="Akzentfarbe wählen">
              {(["orange", "lila", "mono", "forest", "lagoon"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAcc(v)}
                  aria-pressed={acc === v}
                  title={v === "mono" ? "Graphit — bklit chart tokens" : v === "forest" ? "Forest — bklit teal" : v === "lagoon" ? "Lagoon — bklit cyan" : v}
                  className={`flex items-center gap-1.5   px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${acc === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <span className="h-2 w-2  " style={{ background: v === "orange" ? "#eab308" : v === "lila" ? "#818cf8" : v === "mono" ? "#a1a1aa" : v === "forest" ? "#14b8a6" : "#06b6d4" }} aria-hidden />
                  {v === "mono" ? "graphit" : v}
                </button>
              ))}
            </div>
            <Link to="/" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              ← Original
            </Link>
          </div>
        </div>
      </div>

      <main id="main">
        {/* ── HERO ── */}
        <section className="relative overflow-hidden">
          <div className="v2fx absolute inset-0 z-0" aria-hidden>
            {showFx && (
              <Suspense fallback={null}>
                <PixelBlast
                  key={`${acc}-${isDark ? "d" : "l"}`}
                  color={acc === "orange" ? "#f2a92c" : acc === "lila" ? "#818cf8" : acc === "forest" ? (isDark ? "#2dd4bf" : "#0d9488") : acc === "lagoon" ? (isDark ? "#22d3ee" : "#0891b2") : isDark ? "#d4d4d8" : "#57534e"}
                  variant="circle"
                  pixelSize={isDark ? 3 : 6}
                  patternScale={2.25}
                  patternDensity={0.75}
                  pixelSizeJitter={0.35}
                  speed={0.35}
                  edgeFade={0.5}
                  enableRipples={true}
                  liquid={false}
                  transparent={true}
                />
              </Suspense>
            )}
          </div>
          <div className="pointer-events-none absolute inset-0 z-[1]" style={{ background: "linear-gradient(180deg, hsl(var(--background) / .72), transparent 38%, transparent 62%, hsl(var(--background)))" }} aria-hidden />
          <div className="container relative z-10 grid gap-12 pb-20 pt-20 md:pb-24 md:pt-24 lg:grid-cols-12 lg:items-center lg:pb-28 lg:pt-28">
            <div className="lg:col-span-7">
            <h1 className="mt-8 max-w-5xl text-5xl font-bold leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
              Vom Halter
              <br />
              zum Sentinel<span className="v2caret v2a">_</span>
            </h1>
            <p className="mt-5 font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground sm:text-sm">
              Beschlagnahmt in Minuten · versorgt in Stunden · dokumentiert fürs Gericht
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="h-11">
                <Link to="/sentinel">Pfad starten · 20 Min <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11">
                <Link to="/demo">Behörden-Demo</Link>
              </Button>
            </div>
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Zwei Eingänge · eine Akte · <Link to="/pledge" className="underline underline-offset-4 hover:text-foreground">Pledge lesen</Link>
            </p>

            </div>

            {/* Beweisfoto-Kachel: Akte fest unterm Bild */}
            <figure className="group border border-border bg-card lg:col-span-5">
              <div className="overflow-hidden">
                <img
                  src={heroImg}
                  alt="Beschlagnahmtes Reptil hinter Sichtglas — Asservatenkammer"
                  width={1600}
                  height={1200}
                  className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  loading="eager"
                />
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <span>Beweisfoto · Asservatenkammer</span>
              </div>
              <div>
                <div>
                  <div className="border-t border-border">
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="font-mono text-[10px] uppercase tracking-[0.22em] v2a">Akte EG-2026-00472</span>
                      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-success">
                        <span className="h-1.5 w-1.5 v2ab animate-pulse-dot" aria-hidden /> Kette intakt
                      </span>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
                      {[
                        ["Spezies", "A. squamigera"],
                        ["CITES", "Anhang II"],
                        ["Status", "Vermittlung"],
                      ].map(([k, v]) => (
                        <div key={k} className="px-4 py-3">
                          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{k}</div>
                          <div className="mt-1 text-sm font-medium">{v}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between border-t border-border px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
                      <span>hash a91f·c4 · GPS + Foto</span>
                      <a href="#ablauf" className="v2a uppercase tracking-[0.18em] hover:underline">Ablauf →</a>
                    </div>
                  </div>
                </div>
              </div>
            </figure>
          </div>
        </section>

        {/* ── TRUSTED ── */}
        <section aria-label="Anerkennung" className="border-y border-border bg-card">
          <div className="container py-6">
            <p className="text-center font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Gebaut für · geprüft nach_</p>
            <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 font-mono text-sm uppercase tracking-[0.15em] text-muted-foreground">
              {["Veterinärämter", "Polizei", "Zoll", "Tierheime", "CITES", "TierSchG §11", "DGHT"].map((t) => (
                <li key={t} className="transition-colors hover:text-foreground">{t}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── ZWEI EINGÄNGE ── */}
        <section className="container py-20 lg:py-28">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">Das System_</p>
          <h2 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            Zwei Eingänge. Eine Akte.
          </h2>
          <p className="mt-5 max-w-2xl leading-relaxed text-muted-foreground">
            Kein Marktplatz — ein geschlossenes Custody-Netzwerk. Jede Übergabe
            protokolliert, jede Person zertifiziert, jedes Tier nachverfolgt.
          </p>
          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            <article className="  border border-border bg-card p-8 md:p-10">
              <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] v2a"><Building2 className="h-4 w-4" aria-hidden /> Behörden · Tierheime</p>
              <h3 className="mt-4 text-3xl font-bold tracking-tight">Akte abgeben. Haftung senken.</h3>
              <ul className="mt-6 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
                {["Spezies-ID per KI + Expertenbestätigung in Minuten", "Lückenlose Custody-Chain als Gerichtsbeweis", "Automatisierte Meldepflicht & Berichte", "Nur zulässige Stewards im eigenen Bundesland"].map((b) => (
                  <li key={b} className="flex gap-3"><Check className="mt-1 h-4 w-4 shrink-0 v2a" aria-hidden /><span>{b}</span></li>
                ))}
              </ul>
              <Button asChild className="mt-8"><Link to="/demo">Behörden-Demo <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
            </article>
            <article className="  border border-border bg-card p-8 md:p-10">
              <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] v2a"><HeartHandshake className="h-4 w-4" aria-hidden /> Sentinels</p>
              <h3 className="mt-4 text-3xl font-bold tracking-tight">Wissen einsetzen. Nichts besitzen.</h3>
              <ul className="mt-6 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
                {["Aufträge statt Anzeigen — verifiziert bis Gifttier-Level", "Pflege als Brücke mit Ziel & Zeithorizont", "Kein Handel, keine Zucht, keine Sammlung", "Pate + Fachkanäle, Pause per Klick"].map((b) => (
                  <li key={b} className="flex gap-3"><Check className="mt-1 h-4 w-4 shrink-0 v2a" aria-hidden /><span>{b}</span></li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild variant="outline"><Link to="/sentinel">Sentinel-Pfad</Link></Button>
                <Button asChild variant="ghost"><Link to="/pledge">Pledge lesen</Link></Button>
              </div>
            </article>
          </div>
        </section>

        {/* ── ABLAUF mit Toggle ── */}
        <section id="ablauf" className="relative border-y border-border bg-card">
          <div className="v2dots pointer-events-none absolute inset-0 text-foreground opacity-[0.05]" aria-hidden />
          <div className="container relative py-20 lg:py-28">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">Der Ablauf_</p>
                <h2 className="mt-4 max-w-xl text-4xl font-bold tracking-tight md:text-5xl">
                  {audience === "beh" ? "Von der Beschlagnahme zur geschlossenen Akte." : "Vom Interesse zur ersten Aufnahme."}
                </h2>
              </div>
              <div className="inline-flex w-fit   border border-border bg-background p-1 font-mono text-[11px] uppercase tracking-[0.15em]" role="group" aria-label="Zielgruppe wählen">
                {([["beh", "Behörden"], ["sen", "Sentinels"]] as const).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAudience(v)}
                    aria-pressed={audience === v}
                    className={`  px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${audience === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-10 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              <span className="h-1.5 w-1.5 v2ab animate-pulse-dot" aria-hidden />
              Auto-run · Node klicken zum Springen · Hover pausiert
            </p>
            <ol
              className={`mt-4 flex flex-col lg:flex-row lg:items-stretch ${paused ? "v2paused" : ""}`}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              {flow.map((s, i) => (
                <Fragment key={s.n}>
                  {i > 0 && (
                    // lg:pt-73px = Button-Mitte (h-148), nicht Spalten-Mitte
                    <li aria-hidden="true" className="flex justify-center lg:flex-1 lg:items-start lg:pt-[73px]">
                      <span className={`v2edge h-6 w-[2px] lg:h-[2px] lg:w-full ${i <= step ? "v2edge-done" : i === step + 1 ? "v2edge-run" : ""}`}>
                        <span key={`${audience}-${step}`} />
                      </span>
                    </li>
                  )}
                  <li className="lg:flex lg:w-48 lg:shrink-0 lg:flex-col">
                    <button
                      type="button"
                      onClick={() => setStep(i)}
                      aria-pressed={step === i}
                      aria-label={`Schritt ${s.n}: ${s.title}`}
                      aria-expanded={step === i}
                      className={`v2node flex w-full items-center gap-3 p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-[148px] lg:flex-col lg:items-stretch lg:justify-between ${i === step ? "v2node-on" : ""}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className={`font-mono text-[11px] ${i <= step ? "v2a" : "text-muted-foreground"}`}>{s.n}</span>
                        {i < step ? (
                          <Check className="h-3.5 w-3.5 v2a" aria-hidden />
                        ) : i === step ? (
                          <span className="h-2 w-2 v2ab animate-pulse-dot" aria-hidden />
                        ) : (
                          <span className="h-2 w-2 border border-border" aria-hidden />
                        )}
                      </span>
                      <span>
                        <span className="flex items-center gap-2 text-sm font-semibold leading-snug">
                          {s.icon ? <s.icon className="h-4 w-4 shrink-0 v2a" aria-hidden /> : null}
                          {s.title}
                        </span>
                        <span className="mt-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{s.time}</span>
                      </span>
                    </button>
                    {/*
                      Slot immer rendern, inaktiv unsichtbar aber platzhaltend:
                      jede Spalte ist gleich hoch, die Sektion springt nie.
                    */}
                    <p
                      aria-hidden={i !== step}
                      className={`min-h-[72px] px-1 pb-1 pt-3 text-[13px] leading-relaxed text-muted-foreground lg:min-h-[120px] ${i === step ? "animate-fade-up" : "invisible"}`}
                    >
                      {s.body}
                    </p>
                  </li>
                </Fragment>
              ))}
            </ol>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              {audience === "beh" ? (
                <>
                  <Button asChild><Link to="/demo">Live-Demo öffnen <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
                  <Button asChild variant="outline"><a href="mailto:behoerden@exoguard.de">behoerden@exoguard.de</a></Button>
                </>
              ) : (
                <>
                  <Button asChild><Link to="/sentinel/apply">Bewerbung beginnen <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
                  <Button asChild variant="outline"><Link to="/pledge">Pledge vorab lesen</Link></Button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── RECHT ── */}
        <section className="container py-20 lg:py-28">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">Rechtsrahmen_</p>
          <h2 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">Für deutsches Recht gebaut — ab Tag eins.</h2>
          <Wire fig="Fig. 05 — Rechtsrahmen" meta="6 Module · DE" className="mt-10">
          <div className="grid gap-px overflow-hidden   border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["CITES A/B/C", "Anhang A nur an Institutionen — privat systemseitig ausgeschlossen."],
              ["TierSchG §2/§11", "Sachkunde geprüft & versioniert, DGHT-Mindestanforderungen."],
              ["16 Länder", "Geo-Berechtigungen: nur legale Übernahmen im eigenen Land."],
              ["Meldepflicht", "Bestandsänderungen auto-gemeldet inkl. Herkunftsnachweis."],
              ["Beweiskette", "Zeitstempel, GPS, Foto, Signatur — vom Fund bis Outcome."],
              ["DSGVO", "Anonyme Listings, E2E-verschlüsselte Behördenkommunikation."],
            ].map(([t, d]) => (
              <div key={t} className="bg-card p-6">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] v2a">{t}</span>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
          </Wire>
        </section>

        {/* ── PLEDGE + STIMMEN ── */}
        <section className="border-y border-border bg-card">
          <div className="container grid gap-12 py-20 lg:grid-cols-12 lg:py-24">
            <div className="lg:col-span-5">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">Die Pledge_</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">Sechs Sätze. Eine Haltung.</h2>
              <ol className="mt-8 space-y-2">
                {PLEDGE_SHORT.map(([n, t]) => (
                  <li key={n} className="flex items-baseline gap-4   border border-border bg-background px-4 py-3">
                    <span className="font-mono text-[11px] v2a">{n}</span>
                    <span className="text-sm font-medium">{t}</span>
                  </li>
                ))}
              </ol>
              <Button asChild variant="outline" className="mt-5"><Link to="/pledge">Volltext + unterzeichnen <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
            </div>
            <div className="lg:col-span-7">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">Feel the love_</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">Stimmen aus dem Pilot.</h2>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">What people are saying</p>
              <Wire fig="Fig. 06 — Stimmen" meta="3 Pilot-Stimmen" className="mt-8">
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {[
                  ["Sentinel, 15 J.", "@exhalter_sued", "EH", "Früher Sammlung, heute Notfall-Boxen — zum ersten Mal gibt mein Hobby etwas zurück."],
                  ["Veterinäramt", "@vetamt_pilot", "VA", "Eine Akte, die vor Gericht nicht auseinanderfällt. Übergabe in zwei Minuten dokumentiert."],
                  ["Sentinel #214", "@sentinel_214", "S+", "Strenge Verifikation — genau deshalb bin ich geblieben. Hier zählt Können, nicht Besitz."],
                ].map(([who, handle, initials, quote]) => (
                  <figure key={who} className="  flex flex-col border border-border bg-background p-5">
                    <div className="flex items-center gap-3">
                      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center bg-muted font-mono text-xs font-bold">{initials}</span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1 text-sm font-semibold leading-tight">
                          <span className="truncate">{who}</span>
                          <BadgeCheck className="h-4 w-4 shrink-0 v2a" aria-label="Verifiziert" />
                        </span>
                        <span className="block truncate font-mono text-[11px] text-muted-foreground">{handle}</span>
                      </span>
                    </div>
                    <blockquote className="mt-4 flex-1 text-sm leading-relaxed">{quote}</blockquote>
                    <figcaption className="mt-4 border-t border-border pt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Pilot-Stimme · 2026
                    </figcaption>
                  </figure>
                ))}
              </div>
              </Wire>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="container py-20 lg:py-28">
          <div className="mx-auto max-w-3xl">
            <p className="text-center font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">Einwände_</p>
            <h2 className="mt-4 text-center text-3xl font-bold tracking-tight md:text-5xl">Frag, was alle fragen.</h2>
            <div className="mt-10 space-y-3">
              {FAQS.map((f) => (
                <details key={f.q} className="  border border-border bg-card px-6 py-4">
                  <summary className="cursor-pointer list-none text-[15px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    {f.q}
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section id="kontakt" className="container pb-20 lg:pb-28">
          <div className="relative overflow-hidden   border border-border bg-background p-10 md:p-14">
            <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.09]">
              <filter id="v2grain">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
                <feColorMatrix type="saturate" values="0" />
              </filter>
              <rect width="100%" height="100%" filter="url(#v2grain)" />
            </svg>
            <div className="relative grid gap-10 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-7">
                <p className="font-mono text-xs uppercase tracking-[0.25em] v2a">Zwei Wege · ein Netz_</p>
                <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">Amt oder Terrarium. Fang an.</h2>
                <p className="mt-4 max-w-xl text-muted-foreground">Behörden: 90-Tage-Pilot, eine Region, drei KPIs. Halter: 20 Minuten Selbstprüfung, null Risiko.</p>
              </div>
              <div className="flex flex-col gap-3 lg:col-span-5">
                <Button asChild size="lg" className="h-12"><Link to="/demo">Behörden-Demo <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
                <Button asChild size="lg" variant="outline" className="h-12"><Link to="/sentinel">Sentinel-Pfad starten</Link></Button>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Antwort &lt; 24 h · DE / AT / CH</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default LandingV2;
