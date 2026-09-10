import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

// ponytail: hand-rolled SVG Germany map — same GeoJSON, same wireframe look,
// zero chart deps. Mercator fit + zoom buttons + hover tooltip.

type StatesFC = FeatureCollection<Polygon | MultiPolygon, { id: string | number; name: string; value?: number; state?: string }>;

let geoCache: Promise<StatesFC> | null = null;
const loadGeo = () => {
  geoCache ??= fetch("/geo/bundeslaender.geo.json").then((r) => {
    if (!r.ok) throw new Error(`GeoJSON ${r.status}`);
    return r.json() as Promise<StatesFC>;
  });
  return geoCache;
};

let kreiseCache: Promise<StatesFC> | null = null;
const loadKreise = () => {
  kreiseCache ??= fetch("/geo/landkreise.geo.json").then((r) => {
    if (!r.ok) throw new Error(`GeoJSON ${r.status}`);
    return r.json() as Promise<StatesFC>;
  });
  return kreiseCache;
};

const W = 420;
const H = 520;
const PAD = 12;
const RAD = Math.PI / 180;
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));

const SCALE = [
  "var(--chart-scale-01)",
  "var(--chart-scale-02)",
  "var(--chart-scale-03)",
  "var(--chart-scale-04)",
  "var(--chart-scale-05)",
];

export type GermanyPin = { lat: number; lng: number; name: string; detail?: string; tone?: "primary" | "success" | "info" };

const PIN_VAR = { primary: "--primary", success: "--success", info: "--info" } as const;

export const GermanyMap = ({ values, valueLabel = "Sentinels", pins = [] }: { values: Record<string, number>; valueLabel?: string; pins?: GermanyPin[] }) => {
  const [geo, setGeo] = useState<StatesFC | null>(null);
  const [error, setError] = useState(false);
  const [hov, setHov] = useState<{ name: string; sub: string; x: number; y: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [layer, setLayer] = useState<"laender" | "kreise">("laender");
  const [kreise, setKreise] = useState<StatesFC | null>(null);

  const showKreise = () => {
    setLayer("kreise");
    if (!kreise) loadKreise().then(setKreise, () => setLayer("laender"));
  };

  const drag = useRef<{ sx: number; sy: number; x: number; y: number } | null>(null);
  // Kamera: k = Zoom, x/y = Pan-Offset in viewBox-Einheiten.
  const [cam, setCam] = useState({ k: 1, x: 0, y: 0 });

  // Strg+Scroll zoomt auf den Cursor (nativer Listener: preventDefault braucht passive:false).
  // Ohne Strg scrollt die Seite normal weiter. Drag schiebt die Karte.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (W / rect.width) - W / 2;
      const sy = (e.clientY - rect.top) * (H / rect.height) - H / 2;
      setCam((v) => {
        const k = Math.min(8, Math.max(1, v.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
        const f = 1 - k / v.k;
        return { k, x: v.x + (sx - v.x) * f, y: v.y + (sy - v.y) * f };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, x: cam.x, y: cam.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    setCam((v) => ({
      ...v,
      x: d.x + ((e.clientX - d.sx) * W) / rect.width,
      y: d.y + ((e.clientY - d.sy) * H) / rect.height,
    }));
  };
  const endDrag = () => { drag.current = null; };

  useEffect(() => {
    let live = true;
    loadGeo().then(
      (g) => live && setGeo(g),
      () => live && setError(true),
    );
    return () => { live = false; };
  }, []);

  const proj = useMemo(() => {
    if (!geo) return null;
    let minLon = Infinity, maxLon = -Infinity, minY = Infinity, maxY = -Infinity;
    const each = (ring: number[][]) => {
      for (const [lon, lat] of ring) {
        const x = lon * RAD;
        const y = mercY(lat);
        if (x < minLon) minLon = x;
        if (x > maxLon) maxLon = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    };
    for (const f of geo.features) {
      const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const poly of polys) for (const ring of poly) each(ring);
    }
    const k = Math.min((W - PAD * 2) / (maxLon - minLon), (H - PAD * 2) / (maxY - minY));
    const ox = (W - PAD * 2 - (maxLon - minLon) * k) / 2;
    const oy = (H - PAD * 2 - (maxY - minY) * k) / 2;
    const X = (lon: number) => PAD + ox + (lon * RAD - minLon) * k;
    const Y = (lat: number) => PAD + oy + (maxY - mercY(lat)) * k;
    const ring = (r: number[][]) => `M${r.map(([lo, la]) => `${X(lo).toFixed(1)},${Y(la).toFixed(1)}`).join("L")}Z`;
    const toPaths = (fc: StatesFC) => {
      const m = new Map<string, string[]>();
      for (const f of fc.features) {
        const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
        const key = `${f.properties.state ?? ""}|${f.properties.name}`;
        m.set(key, polys.flatMap((poly) => poly.map(ring)));
      }
      return m;
    };
    const paths = new Map<string, string[]>();
    for (const f of geo.features) {
      const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      paths.set(f.properties.name, polys.flatMap((poly) => poly.map(ring)));
    }
    return { paths, toPaths, X, Y };
  }, [geo]);

  const kreisePaths = useMemo(
    () => (kreise && proj ? proj.toPaths(kreise) : null),
    [kreise, proj],
  );

  const max = useMemo(() => Math.max(1, ...Object.values(values)), [values]);
  const total = useMemo(() => Object.values(values).reduce((a, b) => a + b, 0), [values]);

  const colorOf = (v: number) =>
    v <= 0 ? "hsl(var(--muted))" : SCALE[Math.min(SCALE.length - 1, Math.floor((v / max) * SCALE.length))];

  const onMove = (e: React.MouseEvent, name: string, sub: string) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    setHov({ name, sub, x: e.clientX - box.left, y: e.clientY - box.top });
  };

  if (error) {
    return <p className="border border-border bg-surface p-8 text-sm text-muted-foreground">Deutschlandkarte konnte nicht geladen werden.</p>;
  }
  if (!proj || !geo) {
    return <div className="flex h-64 items-center justify-center border border-border text-xs text-muted-foreground">Lade Deutschlandkarte …</div>;
  }

  return (
    <div className="w-full border border-border bg-surface">
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        <div className="flex gap-px border border-border bg-background p-0.5" role="group" aria-label="Kartenebene">
          {(["laender", "kreise"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => (l === "kreise" ? showKreise() : setLayer(l))}
              aria-pressed={layer === l}
              className={`px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${layer === l ? "bg-primary text-primary-foreground" : "hover:text-foreground"}`}
            >
              {l === "laender" ? "Länder" : kreise ? "Kreise" : "Kreise …"}
            </button>
          ))}
        </div>
        <span>{total} gesamt</span>
      </div>
      <div ref={boxRef} className="relative mx-auto w-full max-w-[480px]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 text-foreground opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)", backgroundSize: "18px 18px" }}
        />
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="relative block h-auto w-full cursor-grab touch-pan-y select-none active:cursor-grabbing"
          role="img"
          aria-label="Deutschlandkarte mit Werten je Bundesland. Ziehen zum Verschieben, Strg plus Scrollen zum Zoomen."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
        >
          <g transform={`translate(${W / 2 + cam.x} ${H / 2 + cam.y}) scale(${cam.k}) translate(${-W / 2} ${-H / 2})`}>
            {geo.features.map((f) => {
              const name = f.properties.name;
              const v = values[name] ?? 0;
              const hot = hov?.name === name;
              return (
                <g key={name}>
                  {(proj.paths.get(name) ?? []).map((d, j) => (
                    <path
                      key={j}
                      d={d}
                      fill={colorOf(v)}
                      fillOpacity={v <= 0 ? 0.25 : 1}
                      stroke={hot ? "hsl(var(--primary))" : "hsl(var(--border))"}
                      strokeWidth={hot ? 1.5 : 1}
                      vectorEffect="non-scaling-stroke"
                      style={{ cursor: "pointer" }}
                      onMouseMove={(e) => onMove(e, name, `${v} ${valueLabel}`)}
                      onMouseLeave={() => setHov(null)}
                    />
                  ))}
                </g>
              );
            })}
            {layer === "kreise" && kreisePaths && (
              <g aria-label="Landkreise">
                {[...kreisePaths].map(([key, ds]) => {
                  const sep = key.indexOf("|");
                  const state = key.slice(0, sep);
                  const name = key.slice(sep + 1);
                  const hot = hov?.name === name;
                  return (
                    <g key={key}>
                      {ds.map((d, j) => (
                        <path
                          key={j}
                          d={d}
                          fill="transparent"
                          stroke={hot ? "hsl(var(--primary))" : "hsl(var(--foreground))"}
                          strokeOpacity={hot ? 1 : 0.28}
                          strokeWidth={hot ? 1.2 : 0.6}
                          vectorEffect="non-scaling-stroke"
                          style={{ cursor: "pointer" }}
                          onMouseMove={(e) => onMove(e, name, state)}
                          onMouseLeave={() => setHov(null)}
                        />
                      ))}
                    </g>
                  );
                })}
              </g>
            )}
            {pins.map((p, i) => {
              // Ungültige/ausserhalb Deutschlands liegende Koordinaten würden
              // als unsichtbares NaN oder außerhalb der ViewBox landen.
              if (
                !Number.isFinite(p.lat) || !Number.isFinite(p.lng) ||
                p.lat < 47 || p.lat > 55.2 || p.lng < 5.5 || p.lng > 15.5
              ) return null;
              // Winziger deterministischer Offset gegen exaktes Übereinanderliegen.
              const x = proj.X(p.lng) + ((i * 37) % 5 - 2) * 1.5;
              const y = proj.Y(p.lat) + ((i * 53) % 5 - 2) * 1.5;
              const r = 2.2 / Math.sqrt(cam.k);
              const c = `hsl(var(${PIN_VAR[p.tone ?? "primary"]}))`;
              return (
                <g
                  key={`${p.lat},${p.lng},${i}`}
                  style={{ cursor: "pointer" }}
                  onMouseMove={(e) => onMove(e, p.name, p.detail ?? "")}
                  onMouseLeave={() => setHov(null)}
                >
                  <circle cx={x} cy={y} r={r * 2.6} fill="none" stroke={c} strokeWidth={1} strokeOpacity={0.45} vectorEffect="non-scaling-stroke" />
                  <circle
                    cx={x}
                    cy={y}
                    r={r}
                    fill={c}
                    style={{ filter: `drop-shadow(0 0 ${1 + 2 / Math.sqrt(cam.k)}px ${c})` }}
                  />
                </g>
              );
            })}
          </g>
        </svg>
        {hov && (
          <div
            className="pointer-events-none absolute z-10 border border-border bg-popover px-3 py-2 font-mono text-[11px]"
            style={{ left: Math.min(hov.x + 14, (boxRef.current?.clientWidth ?? 300) - 150), top: Math.max(hov.y - 10, 8) }}
          >
            <div className="font-semibold">{hov.name}</div>
            {hov.sub && <div className="mt-0.5 text-muted-foreground">{hov.sub}</div>}
          </div>
        )}
        <div className="absolute right-3 top-3 flex gap-px border border-border bg-background font-mono text-xs" role="group" aria-label="Kartenzoom">
          {([["−", Math.max(1, +(cam.k - 1).toFixed(2))], ["+", Math.min(8, +(cam.k + 1).toFixed(2))], ["1:1", 0]] as const).map(([lbl, z]) => (
            <button
              key={lbl}
              type="button"
              onClick={() => setCam((v) => (z === 0 ? { k: 1, x: 0, y: 0 } : { ...v, k: z }))}
              aria-pressed={lbl === "1:1" ? cam.k === 1 && cam.x === 0 && cam.y === 0 : cam.k === z}
              className={`px-2.5 py-1.5 transition-colors hover:text-foreground ${cam.k === z || (lbl === "1:1" && cam.k === 1) ? "text-primary" : "text-muted-foreground"}`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 border-t border-border px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
        <span className="mr-1 uppercase tracking-[0.18em]">0</span>
        {SCALE.map((c) => (
          <span key={c} aria-hidden className="h-3 w-6 border border-border" style={{ background: c }} />
        ))}
        <span className="ml-1">{max}</span>
      </div>
    </div>
  );
};
