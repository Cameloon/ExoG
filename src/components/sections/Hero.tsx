import { lazy, Suspense } from "react";
import heroImg from "@/assets/hero-evidence.jpg";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

// three.js (~600KB) is decorative background — load it after first paint.
const PixelBlast = lazy(() => import("@/components/backgrounds/PixelBlast"));

export const Hero = () => {
  return (
    <section className="relative overflow-hidden hero-bg">
      <div className="absolute inset-0 z-0">
        <Suspense fallback={null}>
        <PixelBlast
          color="#f2a92c"
          variant="circle"
          pixelSize={3}
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
      </div>

      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-[#09090B]/70 via-transparent to-[#09090B]" />

      {/* Top hairline meta bar */}
      <div className="relative z-10 border-b border-white/5">
        <div className="container flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 bg-[#eab308] animate-pulse-dot" />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40">
              Aktive Akten · 247 · Region DE-Süd
            </span>
          </div>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-white/40 sm:inline">
            Stand {new Date().toLocaleDateString("de-DE")}
          </span>
        </div>
      </div>

      <div className="container relative z-10 grid gap-12 py-20 lg:grid-cols-12 lg:gap-8 lg:py-28">
        {/* Left — copy */}
        <div className="lg:col-span-7">
          <div className="animate-fade-up">
            <h1 className="font-editorial mt-8 text-6xl leading-[0.98] tracking-tight text-balance md:text-7xl lg:text-[5.5rem]">
              Wenn ein Exot beschlagnahmt wird,<br className="hidden md:block" />
              <span className="text-white/40">beginnt das </span>
              <em className="not-italic text-[#eab308]">Risiko.</em>
              <br className="hidden md:block" />
              <span className="text-white/40">Und die </span>
              <em className="not-italic text-white/90">Verantwortung.</em>
            </h1>

            <p className="mt-8 max-w-xl text-lg leading-relaxed text-white/50">
              ExoGuard ist die dezentrale Custody-Infrastruktur für lebende
              Asservate — gebaut für{" "}
              <span className="text-white/90">Behörden</span>, getragen von{" "}
              <span className="text-white/90">Sentinels</span>: erfahrenen
              Halter:innen, die ihr Wissen einsetzen, um Tiere durch das System
              zu bringen — nicht, um sie zu besitzen.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 bg-[#eab308] px-6 font-medium text-[#09090B] hover:bg-[#eab308]/90">
                <Link to="/demo">
                  Behörden-Demo öffnen
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 border-white/15 bg-white/[0.03] px-6 text-white/70 hover:bg-white/[0.08] hover:text-white">
                <a href="#sentinel">Sentinel werden</a>
              </Button>
            </div>

            {/* Stats strip */}
            <dl className="mt-16 grid grid-cols-3 gap-4 border-t border-white/5 pt-8">
              {[
                { k: "< 6 Std", l: "Vermittlungszeit" },
                { k: "98,2 %", l: "Überlebensquote" },
                { k: "0", l: "Verlorene Verfahren" },
              ].map((s) => (
                <div key={s.l}>
                  <dt className="font-display text-3xl text-white md:text-4xl">{s.k}</dt>
                  <dd className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                    {s.l}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Right — evidence frame */}
        <div className="lg:col-span-5">
          <div className="relative animate-fade-up [animation-delay:200ms]">
            <div className="absolute -left-3 -top-3 z-10 rounded border border-[#eab308]/20 bg-[#09090B]/80 px-2.5 py-1.5 backdrop-blur-sm">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#eab308]">
                Akte EG-2026-00471
              </span>
            </div>

            <div className="relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] shadow-2xl shadow-[#eab308]/5 backdrop-blur-sm">
              <img
                src={heroImg}
                alt="Beschlagnahmtes Reptil hinter Sichtglas — Asservatenkammer"
                width={1600}
                height={1200}
                className="aspect-[4/3] w-full object-cover opacity-90"
              />
              <div className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-white/10 ring-inset" />
              {/* Scanline overlay */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
                <div className="h-px w-full bg-[#eab308]/30 animate-scan" />
              </div>
              {/* Bottom meta */}
              <div className="absolute bottom-0 left-0 right-0 grid grid-cols-3 gap-px border-t border-white/5 bg-[#09090B]/60 backdrop-blur-sm">
                {[
                  ["Spezies", "Atheris squamigera"],
                  ["CITES", "Anhang II"],
                  ["Status", "Vermittlung"],
                ].map(([k, v]) => (
                  <div key={k} className="px-3 py-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-white/40">{k}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-white/80">{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute -bottom-3 -right-3 rounded border border-green-500/20 bg-[#09090B]/80 px-2.5 py-1.5 backdrop-blur-sm">
              <span className="font-mono text-[10px] uppercase tracking-widest text-green-400">
                ● Beweiskette intakt
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};