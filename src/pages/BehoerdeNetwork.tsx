import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GlowMap } from "@/components/GlowMap";
import { mapRegionToState } from "@/lib/regionMap";
import { geocode } from "@/lib/geocode";

// bklit/visx (~180 kB) nur laden, wenn der Deutschland-Tab geöffnet wird.
const GermanyMap = lazy(() => import("@/components/GermanyMap").then((m) => ({ default: m.GermanyMap })));
import { useExternalSupabase } from "@/integrations/external/supabase";
import { useAuth } from "@/hooks/auth-context";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { LoadingSnake } from "@/components/ui/loading-snake";
import { Map as MapIcon, List, Globe, MapPin, Container, ShieldCheck, GraduationCap, Boxes, PawPrint, Thermometer, Lightbulb, Stethoscope, Phone } from "lucide-react";

import { fetchSentinelPage, type NetworkSentinel } from "@/lib/sentinel-directory";
import { parseEnclosures } from "@/lib/enclosures";
import { Input } from "@/components/ui/input";

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
  const slots = parseEnclosures(q?.enclosures);
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
        {s.email && <p><a href={`mailto:${s.email}`} className="underline">{s.email}</a></p>}
        {slots.length > 0 && <p>Anlagen: {slots.filter((e) => e.status === "frei").length} frei / {slots.length} gesamt</p>}
        {q?.phone && <p className="flex items-center gap-2"><Phone className="h-3 w-3" /> {q.phone}</p>}
      </div>
    </article>
  );
};

const BehoerdeNetwork = () => {
  const { user, canBrowseSentinels: canBrowse, loading } = useAuth();
  const userId = user?.id;
  const supabase = useExternalSupabase();
  const [sentinels, setSentinels] = useState<NetworkSentinel[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map" | "de">("list");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [points, setPoints] = useState<{ key: string; name: string; tier: string; capacity: string; lat: number; lng: number }[]>([]);
  const [geocoding, setGeocoding] = useState(false);
  const [regions, setRegions] = useState<{ region: string; total: number }[]>([]);
  const [countsError, setCountsError] = useState(false);
  const after = cursors[cursors.length - 1];
  const pageSize = 100;

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setCursors([undefined]); }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!userId || !canBrowse) { setBusy(false); return; }
    const controller = new AbortController();
    setBusy(true); setError(null); setPoints([]);
    void fetchSentinelPage(supabase, { after, search: query, limit: pageSize, signal: controller.signal })
      .then((rows) => { if (!controller.signal.aborted) setSentinels(rows); })
      .catch((e) => { if (!controller.signal.aborted) { setSentinels([]); setError(e.message); } })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [userId, canBrowse, supabase, after, query]);

  useEffect(() => {
    if (!userId || !canBrowse || view !== "de") return;
    const controller = new AbortController();
    void supabase.rpc("sentinel_region_counts").abortSignal(controller.signal).then(({ data, error }) => {
      if (controller.signal.aborted) return;
      setCountsError(Boolean(error)); setRegions(data ?? []);
    });
    return () => controller.abort();
  }, [userId, canBrowse, view, supabase]);

  // Geocode only the visible page, with bounded concurrency and city-level pins.
  useEffect(() => {
    if (view === "list" || busy) return;
    let cancelled = false;
    setGeocoding(true); setPoints([]);
    let index = 0;
    const out: typeof points = [];
    const worker = async () => {
      while (!cancelled && index < sentinels.length) {
        const s = sentinels[index++];
        const q = s.pledge_data?.questionnaire;
        const key = [q?.zip, q?.city, s.region, "Deutschland"].filter(Boolean).join(", ");
        const pos = await geocode(key);
        if (pos && !cancelled) out.push({ key: s.user_id, name: s.full_name, tier: s.tier, capacity: s.capacity, lat: pos[0], lng: pos[1] });
      }
    };
    void Promise.all([worker(), worker(), worker()]).then(() => {
      if (!cancelled) { setPoints(out); setGeocoding(false); }
    });
    return () => { cancelled = true; };
  }, [view, sentinels, busy]);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const row of regions) { const state = mapRegionToState(row.region); if (state) result[state] = (result[state] ?? 0) + Number(row.total); }
    return result;
  }, [regions]);

  if (loading) return <><SiteHeader /><main className="container py-24"><LoadingSnake label="Lade Netzwerk" /></main></>;
  if (!canBrowse) return <><SiteHeader /><main className="container py-24"><h1 className="font-editorial text-3xl">Zugang für Einrichtungen und Behörden</h1><Button asChild className="mt-6"><Link to="/start">Zur Startseite</Link></Button></main></>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container py-8">
        <span className="eyebrow">§ Triage · Sentinel-Netzwerk</span>
        <h1 className="font-editorial mt-2 text-4xl md:text-5xl">Sentinels finden</h1>
        <p className="mt-3 text-muted-foreground">Freigegebene Sentinels bundesweit · Erfahrung, Anlagen und Kontakt für die passende Unterbringung. Aufnahme bitte direkt abstimmen.</p>
        <label className="mt-6 block max-w-xl text-sm">Name, Ort, Region, Tierart oder Stufe
          <Input value={search} onChange={(e) => setSearch(e.target.value)} maxLength={200} placeholder="z. B. Bayern, Python oder S4" className="mt-2" />
        </label>
        <div className="mt-6 flex max-w-xl gap-2">
          {([["list", "Liste", List], ["map", "Karte", MapIcon], ["de", "Deutschland", Globe]] as const).map(([key,label,Icon]) =>
            <Button key={key} variant={view === key ? "default" : "outline"} onClick={() => setView(key)} aria-pressed={view === key}><Icon className="mr-2 h-4 w-4" />{label}</Button>)}
        </div>
        {error && <p role="alert" className="mt-6 text-destructive">Sentinels konnten nicht geladen werden: {error}</p>}
        {busy ? <div className="mt-10"><LoadingSnake label="Lade Sentinels" /></div> : <>
          {view === "de" && <div className="mt-6 max-w-3xl">
            {countsError ? <p role="alert">Die bundesweite Übersicht konnte nicht geladen werden.</p> : <Suspense fallback={<LoadingSnake label="Lade Karte" />}><GermanyMap values={counts} valueLabel="Freigegebene Sentinels" pins={points.map((p) => ({ ...p, detail: p.tier }))} /></Suspense>}
            <p className="mt-2 text-xs text-muted-foreground">Zahlen: gesamtes Netzwerk · Pins: aktuelle Ergebnisseite auf Ortsebene</p>
          </div>}
          {view === "map" && points.length > 0 && <div className="mt-6"><SentinelMap points={points} /></div>}
          {geocoding && view !== "list" && <p className="mt-3 text-sm">Orte werden bestimmt …</p>}
          {!error && sentinels.length === 0 && <p className="mt-8">Keine passenden freigegebenen Sentinels gefunden.</p>}
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{sentinels.map((s) => <SentinelCard key={s.user_id} s={s} />)}</div>
          <div className="mt-6 flex items-center gap-4">
            <Button variant="outline" disabled={cursors.length === 1} onClick={() => setCursors((c) => c.slice(0,-1))}>Zurück</Button>
            <span>Seite {cursors.length} · {sentinels.length} Ergebnisse</span>
            <Button variant="outline" disabled={sentinels.length < pageSize} onClick={() => setCursors((c) => [...c,sentinels[sentinels.length-1].user_id])}>Weiter</Button>
          </div>
        </>}
      </main>
      <SiteFooter />
    </div>
  );
};
export default BehoerdeNetwork;
