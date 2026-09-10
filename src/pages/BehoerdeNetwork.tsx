import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GlowMap } from "@/components/GlowMap";
import { mapRegionToState } from "@/lib/regionMap";
import { geocode } from "@/lib/geocode";

// bklit/visx (~180 kB) nur laden, wenn der Deutschland-Tab geöffnet wird.
const GermanyMap = lazy(() => import("@/components/GermanyMap").then((m) => ({ default: m.GermanyMap })));
import { useExternalSupabase } from "@/integrations/external/supabase";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { LoadingSnake } from "@/components/ui/loading-snake";
import { toast } from "@/hooks/use-toast";
import { Map as MapIcon, List, Globe, MapPin, Container, ShieldCheck, GraduationCap, Boxes, PawPrint, Thermometer, Lightbulb, Stethoscope, Phone } from "lucide-react";

type NetworkSentinel = {
  user_id: string;
  case_id: string;
  full_name: string;
  region: string;
  experience_years: number;
  species_focus: string | null;
  capacity: string | null;
  tier: string | null;
  pledge_data: {
    quarantine?: string;
    vet_contact?: string;
    questionnaire?: {
      street: string;
      house_number: string;
      zip: string;
      city: string;
      phone: string;
      feeding: string;
      sachkunde: "none" | "bna" | "dght" | "other";
      sachkunde_detail: string;
      enclosure: { size: string; lighting: string; climate: string; setup: string };
    };
  } | null;
};

const tierBadge: Record<string, string> = {
  S1: "border-border bg-muted text-muted-foreground",
  S2: "border-primary/40 bg-primary/10 text-primary",
  S3: "border-primary/40 bg-primary/10 text-primary",
  S4: "border-success/40 bg-success/10 text-success",
};

const tierLabel: Record<string, string> = {
  S1: "Stufe 1",
  S2: "Stufe 2",
  S3: "Stufe 3",
  S4: "Stufe 4 — Experte",
};

const sachkundeLabel: Record<string, string> = {
  none: "keine formelle Sachkunde",
  bna: "BNA-Schulung",
  dght: "DGHT-Fachwissen",
  other: "Sonstige Sachkunde",
};

const quarantineLabel: Record<string, string> = {
  yes: "Quarantäne: Ja",
  partial: "Quarantäne: teilweise",
  no: "Quarantäne: Nein",
};

const SentinelMap = ({ points }: { points: { key: string; name: string; tier: string | null; capacity: string | null; lat: number; lng: number }[] }) => (
  <GlowMap
    points={points.map((p) => ({
      key: p.key,
      name: p.name,
      detail: `${p.tier ?? "—"} · ${p.capacity ?? ""}`,
      lat: p.lat,
      lng: p.lng,
      tone: p.tier === "S4" ? "success" : "primary",
    }))}
  />
);

const Detail = ({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) =>
  value ? (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-sm">{value}</div>
      </div>
    </div>
  ) : null;

const SentinelCard = ({ s }: { s: NetworkSentinel }) => {
  const q = s.pledge_data?.questionnaire;
  const enc = q?.enclosure;
  const terrarium = [enc?.setup, enc?.size].filter(Boolean).join(" · ");
  return (
    <article className="border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {s.case_id} · {s.region}
          </p>
          <h3 className="font-display mt-1 text-xl leading-tight">{s.full_name}</h3>
        </div>
        <span className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${tierBadge[s.tier ?? ""] ?? tierBadge.S1}`}>
          <ShieldCheck className="h-3 w-3" /> {s.tier ?? "—"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <Detail icon={<GraduationCap className="h-3.5 w-3.5" />} label="Zertifizierung" value={tierLabel[s.tier ?? ""]} />
        <Detail icon={<Boxes className="h-3.5 w-3.5" />} label="Kapazität" value={s.capacity ?? undefined} />
        <Detail icon={<PawPrint className="h-3.5 w-3.5" />} label="Artenspektrum" value={s.species_focus ?? undefined} />
        <Detail icon={<Thermometer className="h-3.5 w-3.5" />} label="Erfahrung" value={s.experience_years ? `${s.experience_years} Jahre` : undefined} />
        <Detail icon={<Container className="h-3.5 w-3.5" />} label="Terraristik" value={terrarium || undefined} />
        <Detail icon={<Lightbulb className="h-3.5 w-3.5" />} label="Licht & Klima" value={[enc?.lighting, enc?.climate].filter(Boolean).join(" · ") || undefined} />
      </div>

      <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
        {q?.sachkunde && q.sachkunde !== "none" && <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{sachkundeLabel[q.sachkunde] ?? sachkundeLabel.other}</p>}
        {s.pledge_data?.quarantine && <p>{quarantineLabel[s.pledge_data.quarantine] ?? ""}</p>}
        {s.pledge_data?.vet_contact && (
          <p className="flex items-center gap-2"><Stethoscope className="h-3 w-3" /> {s.pledge_data.vet_contact}</p>
        )}
        {q?.street && (
          <p className="flex items-center gap-2"><MapPin className="h-3 w-3" /> {[q.street, q.house_number].filter(Boolean).join(" ")}, {q.zip} {q.city}</p>
        )}
        {q?.phone && <p className="flex items-center gap-2"><Phone className="h-3 w-3" /> {q.phone}</p>}
      </div>
    </article>
  );
};

const BehoerdeNetwork = () => {
  const { user, region, isBehoerde, loading } = useAuth();
  const supabase = useExternalSupabase();
  const [sentinels, setSentinels] = useState<NetworkSentinel[]>([]);
  const [busy, setBusy] = useState(true);
  const [view, setView] = useState<"list" | "map" | "de">("list");
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [pins, setPins] = useState<{ lat: number; lng: number; name: string; detail?: string }[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [countsError, setCountsError] = useState(false);
  const [locating, setLocating] = useState(false);
  const [points, setPoints] = useState<{ key: string; name: string; tier: string | null; capacity: string; lat: number; lng: number }[]>([]);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    document.title = "Network · ExoGuard";
  }, []);

  useEffect(() => {
    if (!isBehoerde || !region || !user) { setBusy(false); return; }
    let cancelled = false;
    void (async () => {
      setBusy(true);
      const { data, error } = await supabase
        .from("sentinel_applications")
        .select("user_id, case_id, full_name, region, experience_years, species_focus, capacity, tier, pledge_data")
        .eq("status", "approved")
        .eq("region", region)
        .range(0, 199);
      if (cancelled) return;
      setSentinels((data ?? []) as NetworkSentinel[]);
      setBusy(false);
      // Fehlversorgung vermeiden: eine RLS-/Netzwerk-Fehlermeldung darf nicht
      // wie "keine Sentinels in der Region" aussehen.
      if (error) {
        console.warn("network: sentinel load", error.message);
        toast({ title: "Laden fehlgeschlagen", description: error.message, variant: "destructive" });
      }
    })();
    return () => { cancelled = true; };
  }, [isBehoerde, region, user, supabase]);

  useEffect(() => {
    if (view !== "de" || counts || !user) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("sentinel_applications")
        .select("full_name, region, tier, pledge_data")
        .eq("status", "approved")
        .range(0, 999);
      if (cancelled) return;
      if (error || !data) { setCountsError(true); return; }
      const rows = data as { full_name: string; region: string | null; tier: string | null; pledge_data: NetworkSentinel["pledge_data"] }[];
      const map: Record<string, number> = {};
      const raw = new Set<string>();
      for (const row of rows) {
        const r = (row.region ?? "").trim();
        if (!r) continue;
        const state = mapRegionToState(r);
        if (state) map[state] = (map[state] ?? 0) + 1;
        else raw.add(r);
      }
      setCounts(map);
      setUnmatched([...raw].slice(0, 8));
      // Pins auf City-Level (keine Hausadressen): eindeutige PLZ+Ort geokodieren.
      setLocating(true);
      const seen = new Map<string, [number, number]>();
      const out: { lat: number; lng: number; name: string; detail?: string }[] = [];
      for (const row of rows) {
        const q = row.pledge_data?.questionnaire;
        if (!q?.city) continue;
        const key = `${q.zip ?? ""} ${q.city}`.trim();
        if (!seen.has(key)) seen.set(key, await geocode(`${key}, Deutschland`));
        if (cancelled) return;
        const pos = seen.get(key);
        if (pos) out.push({ lat: pos[0], lng: pos[1], name: row.full_name, detail: `${row.tier ?? "—"} · ${q.city}` });
      }
      if (!cancelled) { setPins(out); setLocating(false); }
    })();
    return () => { cancelled = true; };
  }, [view, counts, user, supabase]);

  useEffect(() => {
    if (view !== "map" || points.length > 0 || sentinels.length === 0) return;
    let cancelled = false;
    void (async () => {
      setGeocoding(true);
      const results: { key: string; name: string; tier: string | null; capacity: string; lat: number; lng: number }[] = [];
      for (const s of sentinels) {
        const q = s.pledge_data?.questionnaire;
        if (!q?.city) continue;
        const pos = await geocode(`${q.zip} ${q.city}, ${s.region}`);
        if (cancelled) return;
        if (pos) results.push({ key: s.user_id, name: s.full_name, tier: s.tier, capacity: s.capacity ?? "", lat: pos[0], lng: pos[1] });
      }
      if (!cancelled) { setPoints(results); setGeocoding(false); }
    })();
    return () => { cancelled = true; };
  }, [view, points.length, sentinels]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-muted-foreground">
        <SiteHeader />
        <main className="container py-24 text-center"><LoadingSnake label="Lade Netzwerk" /></main>
      </div>
    );
  }

  if (!isBehoerde) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="container max-w-xl py-24 text-center">
          <h1 className="font-editorial text-3xl">Kein Behörden-Zugang</h1>
          <p className="mt-4 text-sm text-muted-foreground">Dieser Bereich ist Behörden mit Zuständigkeitsregion vorbehalten.</p>
          <Button asChild className="mt-6"><Link to="/start">Zur Startseite</Link></Button>
        </main>
      </div>
    );
  }

  if (!region) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="container max-w-xl py-24 text-center">
          <h1 className="font-editorial text-3xl">Zuständigkeitsregion fehlt</h1>
          <p className="mt-4 text-sm text-muted-foreground">Ein Admin muss deinem Behördenkonto eine Region zuweisen.</p>
          <Button asChild className="mt-6"><Link to="/account">Zum Konto</Link></Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">§ Behörde · Sentinel-Netzwerk</span>
            <h1 className="font-editorial mt-2 text-4xl md:text-5xl">Sentinels in {region}</h1>
            <p className="mt-3 text-muted-foreground">{sentinels.length} verfügbare Sentinels für Ward-Zuweisung</p>
          </div>
        </div>

        <div className="mt-6 max-w-xl flex gap-px bg-border">
          {([["list", "Liste", List], ["map", "Karte", MapIcon], ["de", "Deutschland", Globe]] as const).map(([k, lbl, Icon]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              aria-pressed={view === k}
              className={`flex flex-1 items-center justify-center gap-2 bg-surface px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                view === k ? "bg-surface-elevated text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {lbl}
            </button>
          ))}
        </div>

        {busy ? (
          <div className="mt-10 flex justify-center"><LoadingSnake label="Lade Sentinels" compact /></div>
        ) : view === "de" ? (
          <div className="mt-8 max-w-3xl">
            {counts ? (
              <>
                <Suspense fallback={<div className="flex h-64 items-center justify-center border border-border text-xs text-muted-foreground">Lade Karte …</div>}>
                  <GermanyMap values={counts} valueLabel="Freigegebene Sentinels" pins={pins} />
                </Suspense>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Freigegebene Sentinels je Bundesland · Pins auf Ortsebene · Zoomen möglich
                  {locating && <span className="mt-1 block normal-case tracking-normal">Orte werden bestimmt …</span>}
                  {unmatched.length > 0 && (
                    <span className="mt-1 block normal-case tracking-normal">Nicht zugeordnet: {unmatched.join(", ")}</span>
                  )}
                </p>
              </>
            ) : countsError ? (
              <div className="border border-border bg-surface p-8 text-sm text-muted-foreground">
                Bundesländer-Übersicht nicht verfügbar — dein Zugang ist auf {region} beschränkt.
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center border border-border text-xs text-muted-foreground">
                Zähle Sentinels …
              </div>
            )}
          </div>
        ) : sentinels.length === 0 ? (
          <div className="mt-10 border border-border bg-surface p-10 text-sm text-muted-foreground">
            Keine freigeschalteten Sentinels in {region}. Sobald Anwendungen in dieser Region freigegeben sind, erscheinen sie hier.
          </div>
        ) : view === "map" ? (
          <div className="mt-8">
            {points.length > 0 ? (
              <>
                <SentinelMap points={points} />
                <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" aria-hidden /> Sentinel</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" aria-hidden /> Stufe 4 · Experte</span>
                </p>
              </>
            ) : geocoding ? (
              <div className="flex h-40 items-center justify-center border border-border text-xs text-muted-foreground">
                Bestimme Positionen …
              </div>
            ) : (
              <div className="border border-border bg-surface p-8 text-sm text-muted-foreground">
                Keine Adressen gefunden — sobald Sentinels eine Adresse hinterlegen, erscheinen sie auf der Karte.
              </div>
            )}
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sentinels.map((s) => <SentinelCard key={s.user_id} s={s} />)}
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sentinels.map((s) => <SentinelCard key={s.user_id} s={s} />)}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default BehoerdeNetwork;
