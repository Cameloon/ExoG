import { formatCapacity } from "@/lib/habitats";
import { distanceKm, postalCityQuery } from "@/lib/location";
import { geocode } from "@/lib/geocode";
import { AppFeedback } from "@/components/AppFeedback";
import { DocumentsHub } from "@/components/dashboard/DocumentsHub";
import { fetchCareLogPage, wardToCase, type CareLogCursor } from "@/lib/care-logs";
import { fetchSentinels, type NetworkSentinel } from "@/lib/sentinel-directory";
import { fetchWardAssignmentRequestsForWard, requestWardAssignment, type WardAssignmentRequest } from "@/lib/ward-assignment-requests";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { useAuth } from "@/hooks/auth-context";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { fetchMyShelter, fetchShelters, fetchWardsByRegion } from "@/lib/shelters";
import type { CareLog } from "@/lib/dashboard-data";
import type { Shelter, Ward } from "@/lib/types";
import {
  AlertTriangle, ChevronLeft, ChevronRight, Clock, FileText, MapPin, ShieldCheck,
  Activity, Building2, Map as MapIcon, List as ListIcon,
  Truck,
} from "lucide-react";
import { LazyShelterMap } from "@/components/shelters/LazyShelterMap";
import { LoadingSnake } from "@/components/ui/loading-snake";
import { QuestionnaireBlock } from "@/components/QuestionnaireBlock";

type DetailTab = "chain" | "care" | "docs";

const urgencyColor: Record<string, string> = {
  critical: "text-destructive",
  urgent: "text-warning",
  kritisch: "text-destructive",
  hoch: "text-warning",
  mittel: "text-info",
  standard: "text-muted-foreground",
};

const riskBadge: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  urgent: "bg-warning/10 text-warning border-warning/30",
  kritisch: "bg-destructive/15 text-destructive border-destructive/30",
  hoch: "bg-warning/10 text-warning border-warning/30",
  mittel: "bg-info/10 text-info border-info/30",
  standard: "bg-success/10 text-success border-success/30",
};

const urgencyLabel: Record<string, string> = { critical: "Kritisch", urgent: "Erhöht", standard: "Standard", kritisch: "Kritisch", hoch: "Hoch", mittel: "Mittel" };

const statusLabel: Record<string, string> = {
  available: "Verfügbar",
  under_review: "In Prüfung",
  placed: "Platziert",
  withdrawn: "Zurückgezogen",
};

type LocatedSentinel = { sentinel: NetworkSentinel; distanceKm: number };

const assignmentStatusLabel: Record<WardAssignmentRequest["status"], string> = {
  open: "Anfrage offen",
  accepted: "Angenommen",
  declined: "Abgelehnt",
  cancelled: "Abgebrochen",
};

type TransportLog = {  id: string;
  ward_id: string;
  handler_id: string;
  from_location: string;
  to_location: string;
  mode: string;
  carrier: string;
  checklist: string[];
  notes: string;
  created_at: string;
};

const quarantineBadge: Record<string, string> = {
  unknown: "bg-muted text-muted-foreground border-border",
  in_quarantine: "bg-warning/10 text-warning border-warning/30",
  quarantine_safe: "bg-success/10 text-success border-success/30",
  suspected: "bg-destructive/10 text-destructive border-destructive/30",
};

const quarantineLabel: Record<string, string> = {
  unknown: "Q unbekannt",
  in_quarantine: "Quarantäne",
  quarantine_safe: "Q-Safe",
  suspected: "Verdacht",
};

const Behoerde = () => {
  const { user, region, isBehoerde, loading } = useAuth();
  const supabase = useExternalSupabase();
  const { toast } = useToast();
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [busy, setBusy] = useState(true);
  const [selected, setSelected] = useState<Ward | null>(null);
  const [filter, setFilter] = useState<string>("Alle");
  const [detailTab, setDetailTab] = useState<DetailTab>("chain");
  const [documentDirty, setDocumentDirty] = useState(false);
  const [logs, setLogs] = useState<CareLog[]>([]);
  const [logsBusy, setLogsBusy] = useState(false);
  const [logsError, setLogsError] = useState(false);
  const [detailRevision, setDetailRevision] = useState(0);
  const [logCursors, setLogCursors] = useState<(CareLogCursor | null)[]>([null]);
  const [nextLogCursor, setNextLogCursor] = useState<CareLogCursor | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [labError, setLabError] = useState(false);
  const [transportsError, setTransportsError] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);
  const detailBackRef = useRef<HTMLButtonElement>(null);
  const detailTriggerRef = useRef<HTMLButtonElement>(null);

  // ponytail: sentinel assignment
  const [sentinels, setSentinels] = useState<NetworkSentinel[]>([]);
  const [assignTo, setAssignTo] = useState<string>("");
  const [selSentinelId, setSelSentinelId] = useState<string | null>(null);
  const [assignmentRequests, setAssignmentRequests] = useState<WardAssignmentRequest[]>([]);
  const [originCoordinates, setOriginCoordinates] = useState<[number, number] | null>(null);
  const [originLabel, setOriginLabel] = useState("");
  const [originApproximate, setOriginApproximate] = useState(true);
  const [originLoading, setOriginLoading] = useState(true);
  const [radiusKm, setRadiusKm] = useState<25 | 50 | 100>(25);
  const [locatedSentinels, setLocatedSentinels] = useState<{ sentinel: NetworkSentinel; coordinates: [number, number] }[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  const [labUrl, setLabUrl] = useState<string | null>(null);
  const [wardTransports, setWardTransports] = useState<TransportLog[]>([]);

  const loadSentinels = useCallback(async () => {
    try { setSentinels(await fetchSentinels(supabase)); }
    catch (e) { toast({ title: "Laden fehlgeschlagen", description: (e as Error).message, variant: "destructive" }); }
  }, [supabase, toast]);

  useEffect(() => {
    if (!isBehoerde || !user) { setOriginLoading(false); return; }
    let active = true;
    setOriginLoading(true);
    setOriginCoordinates(null);
    setOriginLabel("");
    void (async () => {
      try {
        const office = await fetchMyShelter(supabase, user.id);
        let coordinates: [number, number] | null = null;
        const postalCity = postalCityQuery(office?.address);
        const label = postalCity?.replace(", Deutschland", "") ?? office?.region ?? "";
        let approximate = true;
        if (office?.lat != null && office.lng != null && Number.isFinite(office.lat) && Number.isFinite(office.lng)) {
          coordinates = [office.lat, office.lng];
          approximate = false;
        } else if (postalCity) {
          coordinates = await geocode(postalCity);
        }
        if (active) {
          setOriginCoordinates(coordinates);
          setOriginLabel(label);
          setOriginApproximate(approximate);
        }
      } catch (e) {
        if (active) {
          setOriginCoordinates(null);
          toast({ title: "Behördenstandort konnte nicht geladen werden", description: (e as Error).message, variant: "destructive" });
        }
      } finally {
        if (active) setOriginLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isBehoerde, user, supabase, region, toast]);

  const requestSentinel = async (wardId: string) => {
    if (!user || !nearbySentinels.some(({ sentinel }) => sentinel.user_id === assignTo)
      || assigning || assignmentRequests.some((request) => request.sentinel_id === assignTo && request.status === "open")) return;
    setAssigning(true);
    try {
      const request = await requestWardAssignment(supabase, {
        ward_id: wardId,
        authority_id: user.id,
        sentinel_id: assignTo,
      });
      setAssignmentRequests((prev) => [request, ...prev]);
      toast({ title: "Anfrage an Sentinel gesendet" });
      setAssignTo("");
    } catch (e) {
      toast({ title: "Fehler", description: (e as Error).message, variant: "destructive" });
    } finally { setAssigning(false); }
  };

  const selectWard = (w: Ward, trigger: HTMLButtonElement) => {
    if (documentDirty && !window.confirm("Nicht heruntergeladene Dokumentangaben verwerfen?")) return;
    detailTriggerRef.current = trigger;
    setDocumentDirty(false); setSelected(w); setDetailTab("chain"); setLogCursors([null]);
    setMobileDetailOpen(true);
    setAssignTo(""); setSelSentinelId(null);
  };
  const closeMobileDetail = () => {
    setMobileDetailOpen(false);
    requestAnimationFrame(() => detailTriggerRef.current?.focus());
  };
  const selectedWard = wards.find((w) => w.id === selected?.id) ?? wards[0] ?? null;
  const selectedId = selectedWard?.id;
  const nearbySentinels = useMemo(() => !originCoordinates ? [] : locatedSentinels
    .map(({ sentinel, coordinates }) => ({ sentinel, distanceKm: distanceKm(originCoordinates, coordinates) }))
    .filter((candidate) => candidate.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm), [locatedSentinels, originCoordinates, radiusKm]);
  useEffect(() => {
    if (mobileDetailOpen && window.matchMedia("(max-width: 1023px)").matches) {
      detailRef.current?.scrollIntoView({ block: "start" });
      detailBackRef.current?.focus({ preventScroll: true });
    }
  }, [mobileDetailOpen, selectedId]);
  useEffect(() => {
    if (sentinels.length === 0 || !originCoordinates) { setLocatedSentinels([]); setNearbyLoading(false); return; }
    const controller = new AbortController();
    setNearbyLoading(true);
    setLocatedSentinels([]);
    void (async () => {
      const located: { sentinel: NetworkSentinel; coordinates: [number, number] }[] = [];
      for (let i = 0; i < sentinels.length; i += 4) {
        const batch = await Promise.all(sentinels.slice(i, i + 4).map(async (sentinel) => {
          const q = sentinel.pledge_data?.questionnaire;
          if (!q?.zip || !q.city) return null;
          const coordinates = await geocode(`${q.zip} ${q.city}, Deutschland`, controller.signal);
          return coordinates ? { sentinel, coordinates } : null;
        }));
        if (controller.signal.aborted) return;
        located.push(...batch.filter((candidate): candidate is { sentinel: NetworkSentinel; coordinates: [number, number] } => candidate !== null));
        setLocatedSentinels([...located]);
      }
    })().catch((e) => {
      if (!controller.signal.aborted) toast({ title: "Sentinel-Standorte konnten nicht geprüft werden", description: (e as Error).message, variant: "destructive" });
    }).finally(() => { if (!controller.signal.aborted) setNearbyLoading(false); });
    return () => controller.abort();
  }, [sentinels, originCoordinates, toast]);
  useEffect(() => {
    if (!selectedId) { setAssignmentRequests([]); return; }
    let active = true;
    setAssignmentRequests([]);
    void fetchWardAssignmentRequestsForWard(supabase, selectedId)
      .then((requests) => { if (active) setAssignmentRequests(requests); })
      .catch((e) => { if (active) toast({ title: "Anfragen konnten nicht geladen werden", description: (e as Error).message, variant: "destructive" }); });
    return () => { active = false; };
  }, [selectedId, supabase, toast]);
  const logCursor = logCursors[logCursors.length - 1];
  useEffect(() => {
    if (!selectedId) return;
    const abort = new AbortController();
    setLogs([]); setLogsBusy(true); setLogsError(false); setNextLogCursor(null);
    void fetchCareLogPage(supabase, selectedId, logCursor, 50, abort.signal)
      .then((page) => { if (!abort.signal.aborted) { setLogs(page.logs); setNextLogCursor(page.next); } })
      .catch(() => { if (!abort.signal.aborted) setLogsError(true); })
      .finally(() => { if (!abort.signal.aborted) setLogsBusy(false); });
    return () => abort.abort();
  }, [selectedId, logCursor, supabase, detailRevision]);
  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setWardTransports([]); setTransportsError(false);
    void supabase.from("transport_logs").select("*").eq("ward_id", selectedId).order("created_at", { ascending: false })
      .then(({ data, error }) => { if (active) { setWardTransports((data ?? []) as TransportLog[]); setTransportsError(Boolean(error)); } });
    return () => { active = false; };
  }, [selectedId, supabase, detailRevision]);
  useEffect(() => {
    let active = true;
    setLabUrl(null); setLabError(false);
    if (selectedWard?.lab_report_path) void supabase.storage.from("lab-docs")
      .createSignedUrls([selectedWard.lab_report_path], 60 * 60)
      .then(({ data, error }) => { if (active) { setLabUrl(data?.[0]?.signedUrl ?? null); setLabError(Boolean(error) || !data?.[0]?.signedUrl); } });
    return () => { active = false; };
  }, [selectedId, selectedWard?.lab_report_path, supabase, detailRevision]);

  const load = useCallback(async () => {
    if (!region) return;
    setBusy(true); setLoadError(false);
    try {
      const [s, w] = await Promise.all([
        fetchShelters(supabase, { region }),
        fetchWardsByRegion(supabase, region),
      ]);
      setShelters(s);
      setWards(w);
    } catch (e) {
      setLoadError(true);
      toast({ title: "Laden fehlgeschlagen", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [region, supabase, toast]);

  useEffect(() => { document.title = "Dashboard · ExoGuard"; }, []);

  useEffect(() => {
    if (isBehoerde && region) { void load(); void loadSentinels(); }
  }, [isBehoerde, region, load, loadSentinels]);

  const filtered = useMemo(() => (filter === "Alle" ? wards : wards.filter((w) => w.status === filter)), [wards, filter]);

  // KPIs — derived once per wards/filter change, not per render.
  const { activeCount, criticalCount, districtCounts } = useMemo(() => {
    const districtSet = new Set(wards.map((w) => w.region?.split(",")[0]?.trim()).filter(Boolean));
    return {
      activeCount: wards.filter((w) => w.status === "available" || w.status === "under_review").length,
      criticalCount: wards.filter((w) => ["critical", "urgent", "kritisch", "hoch"].includes(w.urgency)).length,
      districtCounts: [...districtSet].map((d) => ({
        d: d ?? "Unbekannt",
        n: wards.filter((w) => w.region?.startsWith(d ?? "")).length,
      })),
    };
  }, [wards]);

  const renderKpi = () => (
    <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
      {[
        { k: String(activeCount), l: "Aktive Wards", icon: FileText },
        { k: String(criticalCount), l: "Kritisch · hohe Dringlichkeit", icon: AlertTriangle, accent: true },
        { k: String(shelters.length), l: "Einrichtungen in der Region", icon: Building2 },
        { k: String(sentinels.length), l: "Freigegebene Sentinels bundesweit", icon: ShieldCheck },
      ].map((s) => (
        <div key={s.l} className="bg-background p-4 sm:p-6">
          <div className="flex items-start justify-between">
            <s.icon className={`h-4 w-4 ${s.accent ? "text-destructive" : "text-muted-foreground"}`} />
          </div>
          <div className={`mt-4 font-display text-4xl tracking-tight sm:mt-6 ${s.accent ? "text-destructive" : ""}`}>{s.k}</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{s.l}</div>
        </div>
      ))}
    </div>
  );

  const renderRegionDist = () => {
    if (districtCounts.length === 0) return null;
    return (
      <div className="mt-px grid grid-cols-2 gap-px bg-border sm:grid-cols-4 lg:grid-cols-8">
        {districtCounts.slice(0, 8).map((x) => (
          <div key={x.d} className="bg-background p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{x.d}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-xl">{x.n}</span>
              <div className="h-1 flex-1 bg-border">
                <div className="h-full bg-primary/60" style={{ width: `${Math.min(x.n * 25, 100)}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // --- Guard states ---
  if (loading) {
    return (
      <div className="min-h-screen bg-background text-muted-foreground">
        <SiteHeader />
        <main className="container py-24 text-center">
          <LoadingSnake label="Lade Behörde" />
        </main>
      </div>
    );
  }

  if (!isBehoerde) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="container max-w-xl py-24 text-center">
          <h1 className="font-editorial text-3xl">Kein Behörden-Zugang</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Dieser Bereich ist Behörden mit Zuständigkeitsregion vorbehalten.
          </p>
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
          <p className="mt-4 text-sm text-muted-foreground">
            Dieser Zugang braucht eine administrativ zugewiesene Region. Bitte
            einen Admin, die Region in Clerk für dein Behördenkonto zu setzen.
          </p>
          <Button asChild className="mt-6"><Link to="/account">Zum Konto</Link></Button>
        </main>
      </div>
    );
  }

  const sel = selectedWard;

  return (
    <div className="min-h-screen bg-background text-foreground dashboard-bg">
      <SiteHeader />
      <main className="container py-8">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">§ Behörde · Zuständigkeit</span>
            <h1 className="font-editorial mt-2 text-4xl md:text-5xl">Einzugsgebiet {region}</h1>
            <p className="mt-3 text-muted-foreground">{wards.length} Wards · {shelters.length} Einrichtungen · {sentinels.length} Sentinels</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm"><Link to="/wards?new=1">Tier aufnehmen</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/sentinels">Sentinels finden</Link></Button>
            <Button variant="outline" size="sm" onClick={() => setShowMap((v) => !v)}>
              {showMap ? <ListIcon className="mr-2 h-4 w-4" /> : <MapIcon className="mr-2 h-4 w-4" />}
              {showMap ? "Liste" : "Karte"}
            </Button>
          </div>
        </div>

        {busy ? (
          <div className="mt-10 flex justify-center">
            <LoadingSnake label="Lade Behörde" compact />
          </div>
        ) : (
          <>
            {/* Dashboard view */}
            <>
              {loadError && <AppFeedback title="Übersicht nicht verfügbar" message="Daten konnten nicht geladen werden." onRetry={() => void load()} />}
        {renderKpi()}
                {renderRegionDist()}

                {showMap && shelters.length > 0 && (
                  <section className="mt-8">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Einrichtungen-Karte</p>
                    <div className="mt-3"><LazyShelterMap shelters={shelters} /></div>
                  </section>
                )}

                <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
                  {/* Ward list */}
                  <section className={`min-w-0 lg:col-span-7 ${mobileDetailOpen ? "hidden lg:block" : ""}`}>
                    <h2 className="text-xl tracking-tight">Wards in der Region</h2>

                    <div className="mt-4 flex flex-wrap gap-px bg-border">
                      {(["Alle", "available", "under_review", "placed", "withdrawn"] as const).map((s) => (
                        <button key={s} onClick={() => setFilter(s)}
                          className={`bg-surface px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
                            filter === s ? "bg-surface-elevated text-primary" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >{s === "Alle" ? "Alle" : statusLabel[s] ?? s}</button>
                      ))}
                    </div>

                    <div className="mt-4 border border-border bg-surface">
                      <div className="hidden grid-cols-[1fr_80px_60px_90px_24px] items-center gap-4 border-b border-border px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground md:grid">
                        <div>Ward / Spezies</div>
                        <div>Status</div>
                        <div>CITES</div>
                        <div>Dringlichkeit</div>
                        <div />
                      </div>
                      {filtered.map((w) => (
                        <button key={w.id} onClick={(e) => selectWard(w, e.currentTarget)} aria-pressed={sel?.id === w.id}
                          className={`flex w-full items-start justify-between gap-3 border-b border-border px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-surface-elevated ${
                            sel?.id === w.id ? "bg-surface-elevated" : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-mono text-[11px] text-primary">{w.case_code}</span>
                              {w.placement_type === "pflegestelle" && (
                                <span className="border border-warning/40 bg-warning/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-warning">
                                  Pflegestelle
                                </span>
                              )}
                              {w.legal_custody && (
                                <span className="border border-warning/40 bg-warning/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-warning">
                                  Verwahrung
                                </span>
                              )}
                              <span className={`border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] ${quarantineBadge[w.quarantine_status] ?? ""}`}>
                                {quarantineLabel[w.quarantine_status] ?? ""}
                              </span>
                              <span className={`md:hidden font-mono text-[10px] uppercase ${urgencyColor[w.urgency] ?? ""}`}>● {urgencyLabel[w.urgency] ?? w.urgency}</span>
                              <span className="md:hidden font-mono text-[10px] text-muted-foreground">{w.cites_listing ?? "—"}</span>
                              <span className={`md:hidden inline-block border px-2 py-0.5 font-mono text-[9px] uppercase ${riskBadge[w.urgency] ?? riskBadge.standard}`}>
                                {urgencyLabel[w.urgency] ?? w.urgency}
                              </span>
                            </div>
                            <div className="mt-1 truncate text-sm">{w.common_name}</div>
                            <div className="font-mono text-[10px] italic text-muted-foreground">{w.scientific_name ?? "—"}</div>
                          </div>
                          <div className="hidden shrink-0 items-center gap-4 md:flex">
                            <div className={`w-20 font-mono text-[11px] uppercase ${urgencyColor[w.urgency] ?? ""}`}>{statusLabel[w.status] ?? w.status}</div>
                            <div className="w-14 font-mono text-xs text-muted-foreground">{w.cites_listing ?? "—"}</div>
                            <div className="w-20">
                              <span className={`inline-block border px-2 py-0.5 font-mono text-[10px] uppercase ${riskBadge[w.urgency] ?? riskBadge.standard}`}>
                                {urgencyLabel[w.urgency] ?? w.urgency}
                              </span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Detail panel */}
                  <aside className={`min-w-0 lg:col-span-5 ${mobileDetailOpen ? "" : "hidden lg:block"}`}>
                    {sel && (
                      <div ref={detailRef} className="scroll-mt-24 border border-border bg-surface lg:sticky lg:top-24">
                        <div className="border-b border-border p-6">
                          <Button ref={detailBackRef} variant="ghost" size="sm" className="mb-4 lg:hidden" onClick={closeMobileDetail}>
                            <ChevronLeft className="mr-2 h-4 w-4" /> Alle Wards
                          </Button>
                          <div className="flex items-center justify-between">
                            <span className="case-tag">Ward</span>
                            <span className={`font-mono text-[11px] uppercase ${urgencyColor[sel.urgency] ?? ""}`}>● {urgencyLabel[sel.urgency] ?? sel.urgency}</span>
                          </div>
                          <h3 className="mt-4 font-mono text-lg text-primary">{sel.case_code}</h3>
                          <p className="mt-2 text-2xl tracking-tight">{sel.common_name}</p>
                          <p className="font-mono text-xs italic text-muted-foreground">{sel.scientific_name ?? "—"}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-px bg-border">
                          {[
                            { l: "CITES", v: sel.cites_listing ?? "—", icon: ShieldCheck },
                            { l: "Region", v: sel.region ?? "—", icon: MapPin },
                            { l: "Alter", v: sel.age_estimate ?? "—", icon: Clock },
                            { l: "Dringlichkeit", v: urgencyLabel[sel.urgency] ?? sel.urgency, icon: Activity },
                            { l: "Verwahrung", v: sel.placement_type === "pflegestelle" ? "Pflegestelle (Staats-Eigentum)" : "Endstelle", icon: Building2 },
                            { l: "Quarantäne", v: quarantineLabel[sel.quarantine_status] ?? "—", icon: ShieldCheck },
                          ].map((m) => (
                            <div key={m.l} className="bg-surface p-4">
                              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                <m.icon className="h-3 w-3" /> {m.l}
                              </div>
                              <div className="mt-2 font-mono text-sm capitalize">{m.v}</div>
                            </div>
                          ))}
                        </div>

                        {/* Tab nav */}
                        <div className="flex border-t border-border bg-border gap-px">
                          {[
                            { k: "chain" as const, l: "Beweiskette", icon: ShieldCheck },
                            { k: "care" as const, l: "Pflege-Log", icon: FileText },
                            { k: "docs" as const, l: "Dokumente", icon: FileText },
                          ].map((t) => (
                            <button key={t.k} aria-pressed={detailTab === t.k}
                            onClick={() => { if (t.k !== detailTab && documentDirty && !window.confirm("Nicht heruntergeladene Dokumentangaben verwerfen?")) return; if (t.k !== detailTab) setDocumentDirty(false); setDetailTab(t.k); }}
                              className={`flex flex-1 items-center justify-center gap-2 bg-surface px-3 py-3 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                                detailTab === t.k ? "text-primary" : "text-muted-foreground hover:text-foreground"
                              }`}
                            ><t.icon className="h-3 w-3" /> {t.l}</button>
                          ))}
                        </div>

                        {detailTab === "chain" && (
                          <div className="p-6">
                            <div className="flex items-center justify-between">
                              <span className="eyebrow">Beweiskette</span>
                              <span className="font-mono text-[10px] text-success">● intakt</span>
                            </div>
                            <ol className="mt-4 space-y-3">
                              {[
                                { who: "Erfassung durch Behörde", role: "Ward angelegt", t: new Date(sel.created_at).toLocaleDateString("de-DE"), done: true },
                                ...logs.slice(0, 4).map((l) => ({
                                  who: l.author, role: l.type, t: l.ts, done: true,
                                })),
                                { who: "Aktuell · " + (statusLabel[sel.status] ?? sel.status), role: sel.owner_id === user?.id ? "In Behörden-Custody" : "Zugewiesen an Sentinel", t: "—", done: sel.status === "placed" },
                              ].map((s, i) => (
                                <li key={i} className="flex gap-3">
                                  <div className="flex flex-col items-center">
                                    <div className={`mt-1 h-2 w-2 rounded-full ${s.done ? "bg-primary" : "border border-border bg-background"}`} />
                                    {i < (logs.length > 0 ? logs.length : 0) + 1 && <div className="mt-1 w-px flex-1 bg-border" />}
                                  </div>
                                  <div className="flex-1 pb-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm">{s.who}</span>
                                      <span className="font-mono text-[10px] text-muted-foreground">{s.t}</span>
                                    </div>
                                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{s.role}</div>
                                  </div>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {detailTab === "care" && (
                          <div className="p-6">
                            <span className="eyebrow">Pflege-Einträge</span>
                            {logsError && <AppFeedback title="Verlauf nicht verfügbar" message="Bitte erneut laden." onRetry={() => setDetailRevision((v) => v + 1)} />}
                            <div className="mt-3 flex gap-2"><Button size="sm" variant="outline" disabled={logsBusy || logCursors.length < 2} onClick={() => setLogCursors((c) => c.slice(0, -1))}>Neuere</Button><Button size="sm" variant="outline" disabled={logsBusy || !nextLogCursor} onClick={() => setLogCursors((c) => [...c, nextLogCursor])}>Ältere</Button></div>
                            {logsBusy ? (
                              <div className="mt-4 flex justify-center">
                                <LoadingSnake label="Lade Pflege" compact />
                              </div>
                            ) : (
                              <ul className="mt-4 space-y-3">
                                {logs.map((l, i) => (
                                  <li key={i} className="border-l-2 border-primary/40 pl-3">
                                    <div className="flex items-center justify-between">
                                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">{l.type}</span>
                                      <span className="font-mono text-[10px] text-muted-foreground">{l.ts}</span>
                                    </div>
                                    <p className="mt-1 text-sm">{l.note}</p>
                                    {l.rationale && <p className="mt-1 italic text-muted-foreground text-xs">{l.rationale}</p>}
                                    <p className="font-mono text-[10px] text-muted-foreground">— {l.author}</p>
                                  </li>
                                ))}
                                {!logsBusy && !logsError && logs.length === 0 && (
                                  <li className="font-mono text-xs text-muted-foreground">Noch keine Einträge.</li>
                                )}
                              </ul>
                            )}
                          </div>
                        )}

                        {detailTab === "docs" && (
                          <div className="p-6">
                            <DocumentsHub key={sel.id} onDirtyChange={setDocumentDirty} caseRecord={{ ...wardToCase(sel), authority: user?.displayName ?? "Behörde" }} sentinel={{ name: user?.displayName ?? "Behörde", region: region ?? "—", tier: "S1", joined: "", reactionMinutes: 0, contact: { email: user?.email ?? "", phone: "", address: "" }, capacity: { used: 0, total: 0 }, cases: [], certifications: [], enclosures: [], insurance: { policy: "", coverEur: 0, validUntil: "" }, vetOnCall: { name: "", phone: "" } }} />
                            <span className="eyebrow mt-6 block">Laborbefund</span>
                            {sel.lab_report_path ? (
                              labError ? <AppFeedback title="Befund nicht verfügbar" message="Bitte erneut laden." onRetry={() => setDetailRevision((v) => v + 1)} /> : labUrl ? (
                                <a href={labUrl} target="_blank" rel="noopener noreferrer"
                                  className="mt-3 inline-flex items-center gap-2 text-sm text-primary underline">
                                  <FileText className="h-4 w-4" /> Laborbefund öffnen
                                </a>
                              ) : (
                                <div className="mt-3 flex justify-start">
                                  <LoadingSnake label="Lade Befund" compact />
                                </div>
                              )
                            ) : (
                              <p className="mt-3 text-xs text-muted-foreground">
                                Kein Labornachweis hinterlegt. Quarantäne und Befunde kannst du im Bereich Tiere dokumentieren.
                              </p>
                            )}

                            <div className="mt-6 border-t border-border pt-4">
                              <span className="eyebrow flex items-center gap-2"><Truck className="h-3.5 w-3.5" /> Transporte</span>
                              {transportsError ? <AppFeedback title="Transporte nicht verfügbar" message="Bitte erneut laden." onRetry={() => setDetailRevision((v) => v + 1)} /> : wardTransports.length === 0 ? (
                                <p className="mt-3 text-xs text-muted-foreground">Noch kein Transport dokumentiert.</p>
                              ) : (
                                <ul className="mt-3 space-y-3">
                                  {wardTransports.map((t) => (
                                    <li key={t.id} className="border-l-2 border-primary/40 pl-3">
                                      <div className="flex items-center justify-between">
                                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                                          {t.from_location || "?"} → {t.to_location || "?"}
                                        </span>
                                        <span className="font-mono text-[10px] text-muted-foreground">
                                          {new Date(t.created_at).toLocaleString("de-DE")}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {[t.mode, t.carrier, t.checklist.length > 0 ? `Checkliste: ${t.checklist.join(", ")}` : "", t.notes]
                                          .filter(Boolean).join(" · ")}
                                      </p>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Sentinel placement request */}
                        <div className="border-t border-border p-6">
                          <span className="eyebrow">Sentinel anfragen</span>
                          {sel.owner_id === user?.id && ["available", "under_review"].includes(sel.status) ? (
                            <div className="mt-3">
                              <p className="mb-3 text-xs text-muted-foreground">
                                Umkreis ab Behördenstandort{originLabel ? ` · ${originLabel}` : ""}{originApproximate ? " (ungefähr)" : ""}. Für Sentinel-Standorte werden nur PLZ und Ort geokodiert; Straße und Hausnummer werden nicht gesendet.
                              </p>
                              {assignmentRequests.length > 0 && (
                                <ul className="mb-4 space-y-2 border-y border-border py-3">
                                  {assignmentRequests.map((request) => {
                                    const candidate = sentinels.find((item) => item.user_id === request.sentinel_id);
                                    return (
                                      <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                        <span>{candidate?.full_name ?? "Sentinel"}{candidate?.region ? ` · ${candidate.region}` : ""}</span>
                                        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                                          {assignmentStatusLabel[request.status]}
                                        </span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                              <div className="flex flex-wrap items-end gap-2">
                                <label className="min-w-28">
                                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Radius</span>
                                  <select aria-label="Suchradius" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value) as 25 | 50 | 100)} className="mt-1 h-9 w-full border border-border bg-background px-2 text-sm">
                                    {[25, 50, 100].map((km) => <option key={km} value={km}>{km} km</option>)}
                                  </select>
                                </label>
                                <select aria-label="Sentinel anfragen"
                                  value={assignTo}
                                  onChange={(e) => { setAssignTo(e.target.value); setSelSentinelId(e.target.value || null); }}
                                  disabled={originLoading || !originCoordinates}
                                  className="h-9 min-w-0 flex-1 border border-border bg-background px-2 text-sm"
                                >
                                  <option value="">Sentinel wählen …</option>
                                  {nearbySentinels.map(({ sentinel: s, distanceKm: distance }) => {
                                    const alreadyRequested = assignmentRequests.some((request) => request.sentinel_id === s.user_id && request.status === "open");
                                    const location = [s.pledge_data?.questionnaire?.city, s.region].filter(Boolean).join(" · ");
                                    return (
                                    <option key={s.user_id} value={s.user_id} disabled={alreadyRequested}>
                                      {s.full_name} · {location} · ca. {Math.round(distance)} km{s.capacity ? ` — ${formatCapacity(s.capacity)}` : ""}{alreadyRequested ? " · angefragt" : ""}
                                    </option>
                                  );})}
                                </select>
                                <Button size="sm" disabled={!assignTo || !nearbySentinels.some(({ sentinel: s }) => s.user_id === assignTo) || assigning || assignmentRequests.some((request) => request.sentinel_id === assignTo && request.status === "open")} onClick={() => requestSentinel(sel.id)}>
                                  {assigning ? "Sende …" : "Anfrage senden"}
                                </Button>
                              </div>
                              {originLoading && <p className="mt-2 text-xs text-muted-foreground">Bestimme Behördenstandort …</p>}
                              {!originLoading && !originCoordinates && <p className="mt-2 text-xs text-destructive">Kein Behördenstandort geokodierbar. Bitte PLZ/Ort im Behördenprofil hinterlegen.</p>}
                              {!originLoading && !originCoordinates && <Button asChild size="sm" variant="outline" className="mt-2"><Link to="/shelters">Behördenstandort ergänzen</Link></Button>}
                              {nearbyLoading && <p className="mt-2 text-xs text-muted-foreground">Prüfe Sentinel-PLZ/Ort …</p>}
                              {!originLoading && originCoordinates && !nearbyLoading && nearbySentinels.length === 0 && (
                                <p className="mt-2 text-xs text-muted-foreground">Keine freigegebenen Sentinels mit PLZ/Ort innerhalb von {radiusKm} km gefunden.</p>
                              )}
                              {selSentinelId && nearbySentinels.find(({ sentinel: s }) => s.user_id === selSentinelId)?.sentinel.pledge_data?.questionnaire && (
                                <QuestionnaireBlock
                                  raw={nearbySentinels.find(({ sentinel: s }) => s.user_id === selSentinelId)!.sentinel.pledge_data!.questionnaire}
                                  className="mt-4 border-t border-border pt-4"
                                />
                              )}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-muted-foreground">
                              Bereits zugewiesen an {sentinels.find((s) => s.user_id === sel.owner_id)?.full_name ?? sel.owner_id.slice(0, 12)}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </aside>
                </div>
              </>
            </>
          )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default Behoerde;
