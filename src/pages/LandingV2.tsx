import { Fragment, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronDown,
  Compass,
  Eye,
  FileSignature,
  HeartHandshake,
  Hourglass,
  Microscope,
  Network,
  Repeat,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import heroImg from "@/assets/hero-evidence.jpg";
import { Button } from "@/components/ui/button";
import { V2_CSS } from "@/lib/v2Theme";
import { useAccentTheme } from "@/hooks/useAccentTheme";

// ponytail: bklit-flavored lab page. bklit OKLCH tokens → HSL scope below
// (light + dark, page-local — global theme untouched). Mono+stone,
// radius 0, switchable accent (orange default, lila option). No deps, one file.

// three.js PixelBlast (~600KB) is decorative — same idle-defer as the original.
const PixelBlast = lazy(() => import("@/components/backgrounds/PixelBlast"));



type FlowStep = { n: string; title: string; time: string; body: string; icon?: LucideIcon };

// bklit framed grid (gem-portfolio-2 /reference): section rulers + corner
// hatches around the frame; dots punched on the grid intersections.
const RULER_CORNERS = ["tl", "tr", "bl", "br"] as const;

const Wire = ({ children, hatch = "both", className = "" }: { children: ReactNode; hatch?: "both" | "bl" | "none"; className?: string }) => (
  <div className={`v2wire ${className}`}>
    {RULER_CORNERS.map((c) => (
      <Fragment key={c}>
        <i aria-hidden className={`v2rule v2rule-${c}-v`} />
        <i aria-hidden className={`v2rule v2rule-${c}-h`} />
      </Fragment>
    ))}
    {hatch === "both" && <i aria-hidden className="v2hatch v2hatch-tr" />}
    {hatch !== "none" && <i aria-hidden className="v2hatch v2hatch-bl" />}
    {children}
  </div>
);

// bklit GridDots: markers centered on every grid intersection (cols×rows
// cells). `square` renders the smaller gray-filled squares (Rechtsrahmen);
// `anchor="bottom"` renders a single dot row on the parent's bottom border;
// `omitCenterBottom` drops only the center-column marker on the bottom line
// (Sentinels: the single dot one level beneath the grid center).
const GridDots = ({ cols, rows = 0, square = false, anchor = "full", omitCenterBottom = false, className = "" }: { cols: number; rows?: number; square?: boolean; anchor?: "full" | "bottom"; omitCenterBottom?: boolean; className?: string }) => {
  const at = (i: number, n: number) => `calc(5px + ${i / n} * (100% - 10px))`;
  if (anchor === "bottom") {
    return (
      <div aria-hidden className={`v2dotrow ${className}`}>
        {Array.from({ length: cols + 1 }, (_, c) => {
          if (omitCenterBottom && cols % 2 === 0 && c === cols / 2) return null;
          return <i key={c} className={square ? "v2gridsq" : "v2griddot"} style={{ left: at(c, cols), top: "50%" }} />;
        })}
      </div>
    );
  }
  const lines = rows + 1;
  const markers: { c: number; r: number }[] = [];
  for (let r = 0; r < lines; r++) {
    for (let c = 0; c <= cols; c++) {
      markers.push({ c, r });
    }
  }
  return (
    <div aria-hidden className={`v2griddots ${className}`}>
      {markers.map(({ c, r }) => (
        <i
          key={`${c}-${r}`}
          className={square ? "v2gridsq" : "v2griddot"}
          style={{ left: at(c, cols), top: at(r, rows) }}
        />
      ))}
    </div>
  );
};

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
  const { accent: acc, setAccent: setAcc } = useAccentTheme();
  const [showFx, setShowFx] = useState(false);
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : true,
  );

  const flow = audience === "beh" ? BEH_FLOW : SEN_FLOW;

  useEffect(() => {
    document.title = "ExoGuard v2 · Custody für lebende Asservate";
    setStep(0);
  }, [audience]);

  // Ablauf-Timeline: Auto-Run erst starten, wenn die Sektion wirklich im
  // Viewport ist (und anhalten, sobald sie wieder raus scrollt).
  const ablaufRef = useRef<HTMLElement | null>(null);
  const [ablaufInView, setAblaufInView] = useState(false);

  useEffect(() => {
    const el = ablaufRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setAblaufInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setAblaufInView(entry.isIntersecting),
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // n8n-style auto-run: Nodes zünden nach und nach, Hover pausiert.
  useEffect(() => {
    if (!ablaufInView || paused) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setStep((s) => (s + 1) % flow.length), STEP_MS);
    return () => clearInterval(id);
  }, [ablaufInView, audience, paused, flow.length]);

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
    <div className="v2scope min-h-screen overflow-x-clip antialiased" data-acc={acc}>
      <style>{V2_CSS}</style>
      <SiteHeader />

      <div className="border-b border-border">
        <div className="container flex flex-wrap items-center justify-end gap-x-4 gap-y-2 py-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex flex-wrap items-center gap-1   border border-border p-0.5 font-mono text-[10px] uppercase tracking-[0.15em]" role="group" aria-label="Akzentfarbe wählen">
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
        <section id="ablauf" ref={ablaufRef} className="relative border-y border-border bg-card">
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
                    <li aria-hidden="true" className="hidden lg:flex lg:flex-1 lg:items-start lg:pt-[73px]">
                      <span className={`v2edge h-[2px] w-full ${i <= step ? "v2edge-done" : i === step + 1 ? "v2edge-run" : ""}`}>
                        <span key={`${audience}-${step}`} />
                      </span>
                    </li>
                  )}
                  <li className="grid grid-cols-[clamp(9rem,26vw,11rem)_minmax(0,clamp(12rem,48vw,22rem))] justify-center gap-x-4 px-3 sm:grid-cols-[1fr_clamp(11rem,18vw,12rem)_minmax(0,1fr)] sm:px-0 lg:flex lg:w-48 lg:shrink-0 lg:flex-col">
                    {/* mobil: Node-Kette horizontal mittig, Text rechts davon */}
                    <div className="flex flex-col sm:col-start-2">
                      {i > 0 && (
                        <span
                          aria-hidden="true"
                          className={`v2edge v2edge-delay mx-auto mb-2 min-h-6 w-[2px] grow lg:!hidden ${i <= step ? "v2edge-done" : i === step + 1 ? "v2edge-run" : ""}`}
                        >
                          <span key={`${audience}-${step}`} />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setStep(i)}
                        aria-pressed={step === i}
                        aria-label={`Schritt ${s.n}: ${s.title}`}
                        aria-expanded={step === i}
                        className={`v2node flex w-full flex-col items-stretch justify-between gap-2 p-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-[148px] lg:gap-3 lg:p-3 ${i === step ? "v2node-on" : ""}`}
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
                          <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground lg:mt-1.5">{s.time}</span>
                        </span>
                      </button>
                      {i < flow.length - 1 && (
                        <span
                          aria-hidden="true"
                          className={`v2edge mx-auto mt-2 min-h-6 w-[2px] grow lg:!hidden ${i < step ? "v2edge-done" : i === step ? "v2edge-run" : ""}`}
                        >
                          <span key={`${audience}-${step}`} />
                        </span>
                      )}
                    </div>
                    {/*
                      Slot immer rendern, inaktiv unsichtbar aber platzhaltend:
                      jede Spalte ist gleich hoch, die Sektion springt nie.
                    */}
                    <p
                      aria-hidden={i !== step}
                      className={`flex min-h-[72px] items-center self-center px-1 text-[13px] leading-relaxed text-muted-foreground sm:col-start-3 lg:block lg:min-h-[120px] lg:self-auto lg:pb-1 lg:pt-3 ${i === step ? "animate-fade-up" : "invisible"}`}
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
          {/* Handy: 12px einrücken — die 32px-Eckdeko des Wire-Rahmens passt dann in den Viewport */}
          <Wire className="mx-3 mt-10 sm:mx-0">
          <div className="relative">
            {/* Dots je Breakpoint-Layout: 1×6 → 2×3 → 3×2 (Quadrat-Marker) */}
            <GridDots cols={1} rows={6} square className="sm:hidden" />
            <GridDots cols={2} rows={3} square className="hidden sm:block lg:hidden" />
            <GridDots cols={3} rows={2} square className="hidden lg:block" />
            <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
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
          </div>
          </Wire>
        </section>

        {/* ── SENTINELS (Original-Layout, v2-Stil) ── */}
        <section id="sentinel" className="border-y border-border bg-card">
          <div className="container grid gap-12 py-20 lg:grid-cols-12 lg:py-28">
            <div className="lg:col-span-5">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">§ Sentinels_</p>
              <h2 className="mt-4 text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
                Du hast die <span className="v2a">Erfahrung.</span>
                <br />
                Wir geben ihr eine Aufgabe.
              </h2>
              <p className="mt-6 leading-relaxed text-muted-foreground">
                Erfahrene Halter:innen wissen mehr über Reptilien und Wirbellose
                als die meisten Tierärzt:innen. Dieses Wissen ist selten — und es
                wird gebraucht. Nicht für die nächste Anschaffung. Für die Tiere,
                die jetzt schon da sind und niemanden haben.
              </p>
              <blockquote className="mt-8 border-l-2 border-[hsl(var(--v2a))] pl-6">
                <p className="text-2xl font-medium italic leading-snug md:text-3xl">
                  „Das Ziel ist nicht, bessere Halter zu schaffen — sondern die
                  letzte Generation, die noch Halter sein muss."
                </p>
                <footer className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">— Leitsatz BioSteward</footer>
              </blockquote>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild><Link to="/sentinel">Sentinel-Pfad starten</Link></Button>
                <Button asChild variant="outline"><Link to="/werte">Werte & FAQ</Link></Button>
                <Button asChild variant="ghost"><Link to="/pledge">Pledge ansehen</Link></Button>
              </div>
            </div>
            <div className="lg:col-span-7">
              <Wire hatch="none">
                <div className="relative">
                  {/* Dots je Breakpoint-Layout: 1×4 → 2×2, komplett */}
                  <GridDots cols={1} rows={4} className="sm:hidden" />
                  <GridDots cols={2} rows={2} className="hidden sm:block" />
                  <div className="grid gap-px bg-border sm:grid-cols-2">
                    {[
                      { icon: Compass, title: "Vom Halter zum Sentinel", body: "Du gibst dein Wissen nicht auf — du richtest es neu aus. Statt zu sammeln, fängst du auf. Statt zu besitzen, begleitest du." },
                      { icon: Hourglass, title: "Pflege ist temporär", body: "Jedes Tier in deiner Obhut hat ein Ziel und einen Zeithorizont. Pflege ist eine Brücke — kein Dauerzustand." },
                      { icon: HeartHandshake, title: "Verantwortung statt Eigentum", body: "Die Tiere existieren bereits in menschlicher Obhut. Wegsehen hilft ihnen nicht. Kompetente, befristete Pflege schon." },
                      { icon: ShieldCheck, title: "Kein Markt, kein Status", body: "Sentinels handeln nicht. Keine Käufe, keine Zucht, keine Sammlung. Nur Aufnahme, Stabilisierung, Vermittlung." },
                    ].map((p) => (
                      <article key={p.title} className="bg-card p-6">
                        <div className="flex items-center justify-between">
                          <p.icon className="h-5 w-5 v2a" aria-hidden />
                          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Pfeiler</span>
                        </div>
                        <h3 className="mt-5 text-xl font-bold leading-tight">{p.title}</h3>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                      </article>
                    ))}
                  </div>
                </div>
                <div className="relative border-t border-border bg-card p-6">
                  {/* Grid-Border-Dots auf der Frame-Unterkante — ohne den mittleren Marker */}
                  <GridDots cols={1} anchor="bottom" omitCenterBottom className="sm:hidden" />
                  <GridDots cols={2} anchor="bottom" omitCenterBottom className="hidden sm:block" />
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] v2a">Sentinel-Selbstverpflichtung</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Privat · Reversibel · Jährlich</span>
                  </div>
                  <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
                    {[
                      "Ich erwerbe keine neuen Tiere — außer für Notfall- oder Pflegeplatzierungen.",
                      "Ich akzeptiere, dass Pflege temporär sein soll, sofern nichts anderes begründet ist.",
                      "Ich stelle das Wohl des Tieres über mein persönliches Interesse.",
                      "Ich dokumentiere Verläufe transparent — auch unangenehme Ausgänge.",
                    ].map((line) => (
                      <li key={line} className="flex gap-3">
                        <span className="mt-2 h-px w-4 shrink-0 bg-[hsl(var(--v2a))]" aria-hidden />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Wire>
            </div>
          </div>
        </section>

        {/* ── PLEDGE + STIMMEN ── */}
        <section className="container py-20 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-12">
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
              {/* About-„expertise-card"-Muster: Rahmenlinie + 13px-Reticle exakt auf den Ecken */}
              <div className="mt-8 grid gap-[14px] md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {[
                  ["Sentinel, 15 J.", "@exhalter_sued", "EH", "Früher Sammlung, heute Notfall-Boxen — zum ersten Mal gibt mein Hobby etwas zurück."],
                  ["Veterinäramt", "@vetamt_pilot", "VA", "Eine Akte, die vor Gericht nicht auseinanderfällt. Übergabe in zwei Minuten dokumentiert."],
                  ["Sentinel #214", "@sentinel_214", "S+", "Strenge Verifikation — genau deshalb bin ich geblieben. Hier zählt Können, nicht Besitz."],
                ].map(([who, handle, initials, quote]) => (
                  <figure key={who} className="v2cross flex flex-col p-5">
                    <span className="v2ret tl" aria-hidden />
                    <span className="v2ret tr" aria-hidden />
                    <span className="v2ret bl" aria-hidden />
                    <span className="v2ret br" aria-hidden />
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
                <details key={f.q} className="group border border-border bg-card px-6 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                      aria-hidden
                    />
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
