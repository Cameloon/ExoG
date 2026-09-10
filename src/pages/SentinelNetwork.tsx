import { useEffect, useState, useCallback, useMemo, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useToast } from "@/hooks/use-toast";
import { Building2, MapPin, Clock, CheckCircle2, XCircle, List, Map as MapIcon, Globe, X, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSnake } from "@/components/ui/loading-snake";
import { mapRegionToState } from "@/lib/regionMap";
import { geocode } from "@/lib/geocode";

// Beide Karten lazy: GlowMap zieht Leaflet (~154 kB) nach, DeutschlandMap die
// SVG-Grafik — erst wenn die jeweilige Ansicht gewählt wird.
const GermanyMap = lazy(() => import("@/components/GermanyMap").then((m) => ({ default: m.GermanyMap })));
const GlowMap = lazy(() => import("@/components/GlowMap").then((m) => ({ default: m.GlowMap })));
import { fetchShelters, fetchMyRequests, sendShelterRequest, deleteShelterRequest } from "@/lib/shelters";
import type { Shelter, ShelterRequest } from "@/lib/types";

const toneFor = (kind: string | null | undefined, accepted: boolean) =>
  kind === "gov" ? ("primary" as const) : accepted ? ("success" as const) : ("info" as const);

const SentinelNetwork = () => {
  const { user, role, loading } = useAuth();
  const supabase = useExternalSupabase();
  const { toast } = useToast();
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [requests, setRequests] = useState<ShelterRequest[]>([]);
  const [busy, setBusy] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  // GlowMap (Leaflet, einzeln zoombar) vs. Deutschland-Grafik (Choropleth).
  const [mapMode, setMapMode] = useState<"glow" | "de">("glow");
  // Einrichtungen ohne Koordinaten: grobe Region-Geokodierung, damit Pins
  // trotzdem erscheinen (nur der öffentliche Region-Text, keine Adresse).
  const [fallbackPins, setFallbackPins] = useState<{ id: string; name: string; region: string; kind: string; lat: number; lng: number }[]>([]);
  const [showHidden, setShowHidden] = useState(false);
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

  const positioned = useMemo(
    () => shelters.filter((s) => s.lat != null && s.lng != null),
    [shelters],
  );
  const acceptedIds = useMemo(
    () => new Set(requests.filter((r) => r.status === "accepted").map((r) => r.shelter_id)),
    [requests],
  );

  useEffect(() => {
    if (view !== "map" || shelters.length === 0) return;
    const missing = shelters.filter((s) => (s.lat == null || s.lng == null) && (s.region ?? "").trim());
    if (missing.length === 0) {
      setFallbackPins([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const seen = new Map<string, [number, number] | null>();
      const out: { id: string; name: string; region: string; kind: string; lat: number; lng: number }[] = [];
      for (const s of missing) {
        const region = (s.region ?? "").trim();
        if (!seen.has(region)) seen.set(region, await geocode(`${region}, Deutschland`));
        if (cancelled) return;
        const pos = seen.get(region);
        if (pos) out.push({ id: s.id, name: s.name, region, kind: s.kind, lat: pos[0], lng: pos[1] });
      }
      if (!cancelled) setFallbackPins(out);
    })();
    return () => { cancelled = true; };
  }, [view, shelters]);

  const allPins = useMemo(
    () => [
      ...positioned.map((s) => ({
        key: s.id,
        name: s.name,
        detail: `${s.kind === "gov" ? "Behörde" : "Einrichtung"} · ${s.region}${acceptedIds.has(s.id) ? " · akzeptiert" : ""}`,
        href: `/shelters/${s.id}`,
        linkLabel: "Profil",
        lat: s.lat as number,
        lng: s.lng as number,
        tone: toneFor(s.kind, acceptedIds.has(s.id)),
      })),
      ...fallbackPins.map((p) => ({
        key: `${p.id}-ca`,
        name: p.name,
        detail: `${p.kind === "gov" ? "Behörde" : "Einrichtung"} · ${p.region} · ca. Lage`,
        href: `/shelters/${p.id}`,
        linkLabel: "Profil",
        lat: p.lat,
        lng: p.lng,
        tone: toneFor(p.kind, false),
      })),
    ],
    [positioned, fallbackPins, acceptedIds],
  );
  const countsByRegion = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of shelters) {
      const state = mapRegionToState(s.region ?? "");
      if (state) map[state] = (map[state] ?? 0) + 1;
    }
    return map;
  }, [shelters]);

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

  const withdraw = async (id: string) => {
    if (!window.confirm("Anfrage wirklich zurückziehen? Der Eintrag wird endgültig entfernt.")) return;
    try {
      await deleteShelterRequest(supabase, id);
      setRequests((r) => r.filter((x) => x.id !== id));
      toast({ title: "Anfrage zurückgezogen" });
    } catch (e) {
      toast({ title: "Fehler", description: (e as Error).message, variant: "destructive" });
    }
  };

  // Nur die eigene Ansicht: der Eintrag verschwindet aus "Meine Anfragen",
  // die Anfrage/Verbindung (z.B. akzeptiert) bleibt unangetastet.
  const setHiddenFlag = async (id: string, hidden: boolean) => {
    try {
      const { error } = await supabase
        .from("sentinel_shelter_requests")
        .update({ sentinel_hidden: hidden })
        .eq("id", id);
      if (error) throw error;
      setRequests((rs) => rs.map((x) => (x.id === id ? { ...x, sentinel_hidden: hidden } : x)));
      toast({
        title: hidden ? "Aus deiner Liste ausgeblendet" : "Wieder eingeblendet",
        description: hidden ? "Die Verbindung zur Einrichtung bleibt bestehen." : undefined,
      });
    } catch (e) {
      toast({ title: "Fehler", description: (e as Error).message, variant: "destructive" });
    }
  };

  const hiddenCount = requests.filter((r) => r.sentinel_hidden).length;
  const visibleRequests = showHidden ? requests : requests.filter((r) => !r.sentinel_hidden);

  const statusIcon = (s: ShelterRequest["status"]) =>
    s === "accepted" ? <CheckCircle2 className="h-4 w-4 text-green-400" />
    : s === "declined" ? <XCircle className="h-4 w-4 text-destructive" />
    : <Clock className="h-4 w-4 text-primary" />;

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
                <div className="mt-4 grid gap-4">
                  <div className="flex justify-end">
                    <div className="flex gap-px bg-border" role="group" aria-label="Kartenstil wählen">
                      {([["glow", "Glow", MapIcon], ["de", "Deutschland", Globe]] as const).map(([k, lbl, Icon]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setMapMode(k)}
                          aria-pressed={mapMode === k}
                          className={`flex items-center gap-2 bg-surface px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                            mapMode === k ? "bg-surface-elevated text-primary" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" /> {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  {mapMode === "de" ? (
                    <div>
                      <Suspense fallback={<div className="flex h-64 items-center justify-center border border-border text-xs text-muted-foreground">Lade Karte …</div>}>
                        <GermanyMap
                          values={countsByRegion}
                          valueLabel="Einrichtungen"
                          pins={allPins.map((p) => ({ lat: p.lat, lng: p.lng, name: p.name, detail: p.detail, tone: p.tone }))}
                        />
                      </Suspense>
                      <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 bg-info" aria-hidden /> Einrichtung</span>
                        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 bg-primary" aria-hidden /> Behörde</span>
                        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 bg-success" aria-hidden /> Akzeptiert</span>
                      </p>
                    </div>
                  ) : allPins.length > 0 ? (
                    <div>
                      <Suspense fallback={<div className="flex h-96 items-center justify-center border border-border text-xs text-muted-foreground">Lade Glow-Map …</div>}>
                        <GlowMap points={allPins} />
                      </Suspense>
                      <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 bg-info" aria-hidden /> Einrichtung — Klick für Profil</span>
                        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 bg-primary" aria-hidden /> Behörde</span>
                        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 bg-success" aria-hidden /> Akzeptiert</span>
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
                          <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            {s.kind === "gov" && (
                              <span className="border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-primary">Behörde</span>
                            )}
                            <MapPin className="h-3 w-3" /> {s.region}
                          </p>
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
                <>
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowHidden((v) => !v)}
                      className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
                    >
                      {showHidden ? `Ausgeblendete verbergen (${hiddenCount})` : `${hiddenCount} ausgeblendet · einblenden`}
                    </button>
                  )}
                  {visibleRequests.length === 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">Keine sichtbaren Anfragen — ausgeblendete einblenden.</p>
                  ) : (
                    <ul className="mt-4 divide-y divide-border border border-border bg-surface">
                      {visibleRequests.map((r) => {
                        const s = shelters.find((x) => x.id === r.shelter_id);
                        return (
                          <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-4">
                            <div>
                              <p className="text-sm">{s?.name ?? "Einrichtung"}</p>
                              <span className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                {statusIcon(r.status)} {r.status}
                                {r.sentinel_hidden && <span className="text-muted-foreground/70">· ausgeblendet</span>}
                              </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {s && <Link to={`/shelters/${s.id}`} className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary hover:underline">Profil</Link>}
                              {r.sentinel_hidden ? (
                                <Button size="sm" variant="outline" onClick={() => setHiddenFlag(r.id, false)}>
                                  <Eye className="mr-1 h-3 w-3" /> Einblenden
                                </Button>
                              ) : (
                                <>
                                  {r.status === "open" && (
                                    <Button size="sm" variant="ghost" onClick={() => withdraw(r.id)}>
                                      <X className="mr-1 h-3 w-3" /> Zurückziehen
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setHiddenFlag(r.id, true)}
                                    title="Nur aus deiner Liste ausblenden — die Verbindung zur Einrichtung bleibt bestehen"
                                  >
                                    <EyeOff className="mr-1 h-3 w-3" /> Ausblenden
                                  </Button>
                                </>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
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
