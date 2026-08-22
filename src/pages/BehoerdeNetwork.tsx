import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { LoadingSnake } from "@/components/ui/loading-snake";
import { Map as MapIcon, List, MapPin, Container, ShieldCheck, GraduationCap, Boxes, PawPrint, Thermometer, Lightbulb, Stethoscope, Phone } from "lucide-react";

// Leaflet marker assets (same pattern as ShelterMap — CSP-safe, no CDN).
const marker = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

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

// ponytail: client-side Photon geocode (same provider as shelter save), cached
// per query for the session. Fails silently → sentinels without coordinates
// just don't get a marker.
const geocodeCache = new Map<string, [number, number] | null>();
async function geocode(query: string): Promise<[number, number] | null> {
  const key = query;
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(key)}&limit=1`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number] } }[];
    };
    const pos = data.features?.[0]?.geometry?.coordinates;
    const r = pos ? ([pos[1], pos[0]] as [number, number]) : null;
    geocodeCache.set(key, r);
    return r;
  } catch {
    geocodeCache.set(key, null);
    return null;
  }
}

const SentinelMap = ({ points }: { points: { key: string; name: string; tier: string | null; capacity: string | null; lat: number; lng: number }[] }) => {
  const single = points.length === 1;
  const pos: [number, number][] = points.map((p) => [p.lat, p.lng]);
  return (
    <div className="h-96 w-full overflow-hidden border border-border">
      {single ? (
        <MapContainer center={pos[0]} zoom={13} className="h-full w-full" scrollWheelZoom={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={pos[0]} icon={marker}>
            <Popup>
              <strong>{points[0].name}</strong>
              <br />
              {points[0].tier ?? "—"} · {points[0].capacity}
            </Popup>
          </Marker>
        </MapContainer>
      ) : (
        <MapContainer bounds={L.latLngBounds(pos)} className="h-full w-full" scrollWheelZoom={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.map((p) => (
            <Marker key={p.key} position={[p.lat, p.lng]} icon={marker}>
              <Popup>
                <strong>{p.name}</strong>
                <br />
                {p.tier ?? "—"} · {p.capacity}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}
    </div>
  );
};

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
  const [view, setView] = useState<"list" | "map">("list");
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
      if (error) console.warn("network: sentinel load", error.message);
    })();
    return () => { cancelled = true; };
  }, [isBehoerde, region, user, supabase]);

  useEffect(() => {
    if (view !== "map" || points.length > 0 || sentinels.length === 0) return;
    let cancelled = false;
    void (async () => {
      setGeocoding(true);
      const results: { key: string; name: string; tier: string | null; capacity: string; lat: number; lng: number }[] = [];
      for (const s of sentinels) {
        const q = s.pledge_data?.questionnaire;
        if (!q?.city) continue;
        const addr = `${q.street?.trim() ?? ""} ${q.house_number?.trim() ?? ""}`.trim();
        const pos = await geocode(`${addr}, ${q.zip} ${q.city}, ${s.region}`);
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

        <div className="mt-6 max-w-sm flex gap-px bg-border">
          {([["list", "Liste", List], ["map", "Karte", MapIcon]] as const).map(([k, lbl, Icon]) => (
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
        ) : sentinels.length === 0 ? (
          <div className="mt-10 border border-border bg-surface p-10 text-sm text-muted-foreground">
            Keine freigeschalteten Sentinels in {region}. Sobald Anwendungen in dieser Region freigegeben sind, erscheinen sie hier.
          </div>
        ) : view === "map" ? (
          <div className="mt-8">
            {points.length > 0 ? (
              <SentinelMap points={points} />
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