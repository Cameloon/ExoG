import { useEffect, useState, useCallback, useMemo, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useToast } from "@/hooks/use-toast";
import { Building2, MapPin, Clock, CheckCircle2, XCircle, List, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSnake } from "@/components/ui/loading-snake";
import { GlowMap } from "@/components/GlowMap";
import { mapRegionToState } from "@/lib/regionMap";
import { geocode } from "@/lib/geocode";

// bklit/visx (~180 kB) nur laden, wenn die Kartenansicht geöffnet wird.
const GermanyMap = lazy(() => import("@/components/GermanyMap").then((m) => ({ default: m.GermanyMap })));
import { fetchShelters, fetchMyRequests, sendShelterRequest } from "@/lib/shelters";
import type { Shelter, ShelterRequest } from "@/lib/types";

const SentinelNetwork = () => {
  const { user, role, loading } = useAuth();
  const supabase = useExternalSupabase();
  const { toast } = useToast();
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [requests, setRequests] = useState<ShelterRequest[]>([]);
  const [busy, setBusy] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  // Fallback-Positionen für Einrichtungen ohne Koordinaten (Adresse → Photon).
  const [fallbackPins, setFallbackPins] = useState<{ id: string; lat: number; lng: number; label: string }[]>([]);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (view !== "map" || shelters.length === 0) return;
    let cancelled = false;
    void (async () => {
      const missing = shelters.filter((s) => (s.lat == null || s.lng == null) && (s.address || s.region));
      if (missing.length === 0) return;
      setLocating(true);
      const out: { id: string; lat: number; lng: number; label: string }[] = [];
      for (const s of missing) {
        const pos = await geocode(`${s.address ?? ""} ${s.region ?? ""}, Deutschland`);
        if (cancelled) return;
        if (pos) out.push({ id: s.id, lat: pos[0], lng: pos[1], label: s.address ?? s.region });
      }
      if (!cancelled) { setFallbackPins(out); setLocating(false); }
    })();
    return () => { cancelled = true; };
  }, [view, shelters]);

  const apply = async (shelterId: string) => {
    if (!user) return;
    setApplying(shelterId);
    try {
      await sendShelterRequest(supabase, { shelter_id: shelterId, sentinel_id: user.id, message: null });
      toast({ title: "Anfrage gesendet" });
      setRequests(await fetchMyRequests(supabase, user.id));
    } catch (e) {
      toast({ title: "Anfrage fehlgeschlagen", description: (e as Error).message, variant: "destructive" });
    } finally {
      setApplying(null);
    }
  };

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const [s, r] = await Promise.all([
        fetchShelters(supabase),
        fetchMyRequests(supabase, user.id),
      ]);
      setShelters(s);
      setRequests(r);
    } catch (e) {
      toast({ title: "Laden fehlgeschlagen", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [user, supabase, toast]);

  useEffect(() => {
    document.title = "Sentinel-Netzwerk · ExoGuard";
  }, []);

  useEffect(() => {
    if (role === "sentinel" && user) void load();
  }, [role, user, load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-muted-foreground">
        <SiteHeader />
        <main className="container py-24 text-center">
          <LoadingSnake label="Lade Sentinel-Netzwerk" />
        </main>
      </div>
    );
  }

  if (role !== "sentinel") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="container max-w-xl py-24 text-center">
          <h1 className="font-editorial text-3xl">Nur für Sentinels</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Hier verbindest du dich mit Einrichtungen. Du musst ein verifizierter Sentinel sein.
          </p>
          <Link to="/sentinel" className="mt-6 inline-block text-primary underline">Zum Sentinel-Pfad</Link>
        </main>
      </div>
    );
  }

  const statusIcon = (s: ShelterRequest["status"]) =>
    s === "accepted" ? <CheckCircle2 className="h-4 w-4 text-green-400" />
    : s === "declined" ? <XCircle className="h-4 w-4 text-destructive" />
    : <Clock className="h-4 w-4 text-primary" />;

  const positioned = useMemo(
    () => shelters.filter((s) => s.lat != null && s.lng != null),
    [shelters],
  );
  const acceptedIds = useMemo(
    () => new Set(requests.filter((r) => r.status === "accepted").map((r) => r.shelter_id)),
    [requests],
  );
  const allPins = useMemo(
    () =>     [
      ...positioned.map((s) => ({
        key: s.id,
        name: s.name,
        detail: `${s.region}${acceptedIds.has(s.id) ? " · akzeptiert" : ""}`,
        href: `/shelters/${s.id}`,
        linkLabel: "Profil",
        lat: s.lat as number,
        lng: s.lng as number,
        tone: acceptedIds.has(s.id) ? ("success" as const) : ("info" as const),
      })),
      ...fallbackPins.map((p) => {
        const s = shelters.find((x) => x.id === p.id);
        const ok = s ? acceptedIds.has(s.id) : false;
        return {
          key: `${p.id}-ca`,
          name: s?.name ?? p.label,
          detail: `${s?.region ?? ""} · ca. Position${ok ? " · akzeptiert" : ""}`,
          href: `/shelters/${p.id}`,
          linkLabel: "Profil",
          lat: p.lat,
          lng: p.lng,
          tone: ok ? ("success" as const) : ("info" as const),
        };
      }),
    ],
    [positioned, fallbackPins, acceptedIds, shelters],
  );
  const countsByRegion = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of shelters) {
      const state = mapRegionToState(s.region ?? "");
      if (state) map[state] = (map[state] ?? 0) + 1;
    }
    return map;
  }, [shelters]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container py-12">
        <span className="eyebrow">§ Netzwerk</span>
        <h1 className="font-editorial mt-2 text-4xl md:text-5xl">Einrichtungen &amp; Sentinels</h1>
        <p className="mt-3 text-muted-foreground">
          Finde Tierheime / Einrichtungen und bewirb dich als Sentinel für deren Bestand.
        </p>

        {busy ? (
          <div className="mt-10 flex justify-center">
            <LoadingSnake label="Lade …" compact />
          </div>
        ) : (
          <div className="mt-10 grid gap-10">
            <section>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="font-display text-2xl flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Einrichtungen</h2>
                <div className="flex gap-px bg-border">
                  {([["list", "Liste", List], ["map", "Karte", MapIcon]] as const).map(([k, lbl, Icon]) => (
                    <button
                      key={k}
                      onClick={() => setView(k)}
                      aria-pressed={view === k}
                      className={`flex items-center gap-2 bg-surface px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                        view === k ? "bg-surface-elevated text-primary" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" /> {lbl}
                    </button>
                  ))}
                </div>
              </div>
              {view === "map" && (
                <div className="mt-4 grid gap-6">
                  <div>
                    <Suspense fallback={<div className="flex h-64 items-center justify-center border border-border text-xs text-muted-foreground">Lade Karte …</div>}>
                      <GermanyMap
                        values={countsByRegion}
                        valueLabel="Einrichtungen"
                        pins={allPins.map((p) => ({ lat: p.lat, lng: p.lng, name: p.name, detail: p.detail, tone: p.tone }))}
                      />
                    </Suspense>
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Einrichtungen je Bundesland · Zoomen möglich
                      {locating && <span className="mt-1 block normal-case tracking-normal">Positionen werden bestimmt …</span>}
                    </p>
                  </div>
                  {allPins.length > 0 ? (
                    <div>
                      <GlowMap points={allPins} />
                      <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-info" aria-hidden /> Tierheim / Einrichtung — Klick für Profil</span>
                        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" aria-hidden /> Akzeptiert</span>
                      </p>
                    </div>
                  ) : (
                    <p className="border border-border bg-surface p-8 text-sm text-muted-foreground">Noch keine Einrichtung mit Position erfasst — Bewerbung unten über die Liste.</p>
                  )}
                </div>
              )}
              {shelters.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Noch keine Einrichtungen erfasst.</p>
              ) : (
                <ul className="mt-4 divide-y divide-border border border-border bg-surface">
                  {shelters.map((s) => {
                    const existing = requests.find((r) => r.shelter_id === s.id && r.status !== "declined");
                    return (
                      <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-4">
                        <div className="min-w-0">
                          <Link to={`/shelters/${s.id}`} className="font-medium hover:text-primary transition-colors">{s.name}</Link>
                          <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {s.region}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          {existing ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                              {statusIcon(existing.status)} {existing.status}
                            </span>
                          ) : (
                            <Button size="sm" variant="outline" disabled={applying === s.id} onClick={() => apply(s.id)}>
                              {applying === s.id ? "Sende …" : "Bewerben"}
                            </Button>
                          )}
                          <Link to={`/shelters/${s.id}`} className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary hover:underline">Profil</Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <h2 className="font-display text-2xl">Meine Anfragen</h2>
              {requests.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Du hast noch keine Anfragen gesendet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-border border border-border bg-surface">
                  {requests.map((r) => {
                    const s = shelters.find((x) => x.id === r.shelter_id);
                    return (
                      <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-4">
                        <div>
                          <p className="text-sm">{s?.name ?? "Einrichtung"}</p>
                          <span className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            {statusIcon(r.status)} {r.status}
                          </span>
                        </div>
                        {s && <Link to={`/shelters/${s.id}`} className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-primary hover:underline">Profil</Link>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default SentinelNetwork;
