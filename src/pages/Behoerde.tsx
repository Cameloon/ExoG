import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { fetchShelters, fetchWardsByRegion } from "@/lib/shelters";
import { fetchCareLogs } from "@/lib/care-logs";
import type { CareLog } from "@/lib/dashboard-data";
import type { Shelter, Ward } from "@/lib/types";
import {
  AlertTriangle, ChevronRight, Clock, FileText, MapPin, ShieldCheck,
  Activity, Building2, Map as MapIcon, List as ListIcon,
  Truck,
} from "lucide-react";
import { LazyShelterMap } from "@/components/shelters/LazyShelterMap";
import { LoadingSnake } from "@/components/ui/loading-snake";
import { QuestionnaireBlock } from "@/components/QuestionnaireBlock";

type DetailTab = "chain" | "care" | "docs";

const urgencyColor: Record<string, string> = {
  kritisch: "text-destructive",
  hoch: "text-warning",
  mittel: "text-info",
  standard: "text-muted-foreground",
};

const riskBadge: Record<string, string> = {
  kritisch: "bg-destructive/15 text-destructive border-destructive/30",
  hoch: "bg-warning/10 text-warning border-warning/30",
  mittel: "bg-info/10 text-info border-info/30",
  standard: "bg-success/10 text-success border-success/30",
};

const statusLabel: Record<string, string> = {
  available: "Verfügbar",
  under_review: "In Prüfung",
  placed: "Platziert",
  withdrawn: "Zurückgezogen",
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
  const [logs, setLogs] = useState<CareLog[]>([]);
  const [logsBusy, setLogsBusy] = useState(false);
  const [logsCache, setLogsCache] = useState<Record<string, { at: number; logs: CareLog[] }>>({});
  const [showMap, setShowMap] = useState(false);

  // ponytail: sentinel assignment
  const [sentinels, setSentinels] = useState<{ user_id: string; full_name: string; capacity: string | null; pledge_data: { questionnaire?: unknown } | null }[]>([]);
  const [assignTo, setAssignTo] = useState<string>("");
  const [selSentinelId, setSelSentinelId] = useState<string | null>(null);

  const [labUrl, setLabUrl] = useState<string | null>(null);
  const [wardTransports, setWardTransports] = useState<TransportLog[]>([]);

  const loadSentinels = useCallback(async () => {
    if (!region) return;
    const { data } = await supabase
      .from("sentinel_applications")
      .select("user_id, full_name, capacity, pledge_data")
      .eq("region", region)
      .eq("status", "approved")
      .range(0, 99);
    setSentinels((data ?? []) as { user_id: string; full_name: string; capacity: string | null; pledge_data: { questionnaire?: unknown } | null }[]);
  }, [region, supabase]);

  const assignSentinel = async (wardId: string) => {
    if (!assignTo) return;
    try {
      const { error } = await supabase.from("ward_listings").update({ owner_id: assignTo }).eq("id", wardId);
      if (error) throw error;
      toast({ title: "Sentinel zugewiesen" });
      setAssignTo("");
      void load();
    } catch (e) {
      toast({ title: "Fehler", description: (e as Error).message, variant: "destructive" });
    }
  };

  const loadLogs = async (wardId: string) => {
    const hit = logsCache[wardId];
    // 60 s TTL: log entries change during active care; cached forever would
    // show stale entries even though the ward list refreshes.
    if (hit && Date.now() - hit.at < 60_000) { setLogs(hit.logs); return; }
    setLogsBusy(true);
    try {
      const l = await fetchCareLogs(supabase, wardId);
      setLogsCache((p) => ({ ...p, [wardId]: { at: Date.now(), logs: l } }));
      setLogs(l);
    } catch {
      setLogs([]);
    } finally {
      setLogsBusy(false);
    }
  };

  const transportsCache = useRef<Record<string, TransportLog[]>>({});
  const loadTransports = async (wardId: string) => {
    if (transportsCache.current[wardId]) { setWardTransports(transportsCache.current[wardId]); return; }
    const { data } = await supabase
      .from("transport_logs")
      .select("*")
      .eq("ward_id", wardId)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as TransportLog[];
    transportsCache.current[wardId] = rows;
    setWardTransports(rows);
  };

  const selectWard = (w: Ward) => {
    setSelected(w);
    setDetailTab("chain");
    void loadLogs(w.id);
    void loadTransports(w.id);
  };

  const selectedWard = selected ?? wards[0] ?? null;

  useEffect(() => {
    setLabUrl(null);
    if (!selectedWard?.lab_report_path) return;
    supabase.storage
      .from("lab-docs")
      .createSignedUrls([selectedWard.lab_report_path], 60 * 60)
      .then(({ data }) => setLabUrl(data?.[0]?.signedUrl ?? null));
  }, [selectedWard?.id, selectedWard?.lab_report_path, supabase]);

  const load = useCallback(async () => {
    if (!region) return;
    setBusy(true);
    try {
      const [s, w] = await Promise.all([
        fetchShelters(supabase, { region }),
        fetchWardsByRegion(supabase, region),
      ]);
      setShelters(s);
      setWards(w);
    } catch (e) {
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
  const defaultWard = wards[0] ?? null;

  // KPIs — derived once per wards/filter change, not per render.
  const { activeCount, criticalCount, districtCounts } = useMemo(() => {
    const districtSet = new Set(wards.map((w) => w.region?.split(",")[0]?.trim()).filter(Boolean));
    return {
      activeCount: wards.length,
      criticalCount: wards.filter((w) => w.urgency === "kritisch" || w.urgency === "hoch").length,
      districtCounts: [...districtSet].map((d) => ({
        d: d ?? "Unbekannt",
        n: wards.filter((w) => w.region?.startsWith(d ?? "")).length,
      })),
    };
  }, [wards]);

  const renderKpi = () => (
    <div className="grid gap-px bg-border md:grid-cols-4">
      {[
        { k: String(activeCount), l: "Aktive Wards", icon: FileText },
        { k: String(criticalCount), l: "Kritisch · hohe Dringlichkeit", icon: AlertTriangle, accent: true },
        { k: String(shelters.length), l: "Einrichtungen in der Region", icon: Building2 },
        { k: String(sentinels.length), l: "Verfügbare Sentinels", icon: ShieldCheck },
      ].map((s) => (
        <div key={s.l} className="bg-background p-6">
          <div className="flex items-start justify-between">
            <s.icon className={`h-4 w-4 ${s.accent ? "text-destructive" : "text-muted-foreground"}`} />
          </div>
          <div className={`mt-6 font-display text-4xl tracking-tight ${s.accent ? "text-destructive" : ""}`}>{s.k}</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{s.l}</div>
        </div>
      ))}
    </div>
  );

  const renderRegionDist = () => {
    if (districtCounts.length === 0) return null;
    return (
      <div className="mt-px grid gap-px bg-border" style={{ gridTemplateColumns: `repeat(${Math.min(districtCounts.length, 8)}, 1fr)` }}>
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

  const sel = selected ?? defaultWard;

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
              {renderKpi()}
                {renderRegionDist()}

                {showMap && shelters.length > 0 && (
                  <section className="mt-8">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Einrichtungen-Karte</p>
                    <div className="mt-3"><LazyShelterMap shelters={shelters} /></div>
                  </section>
                )}

                <div className="mt-8 grid gap-8 lg:grid-cols-12">
                  {/* Ward list */}
                  <section className="lg:col-span-7">
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
                        <button key={w.id} onClick={() => selectWard(w)}
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
                              <span className={`md:hidden font-mono text-[10px] uppercase ${urgencyColor[w.urgency] ?? ""}`}>● {w.urgency}</span>
                              <span className="md:hidden font-mono text-[10px] text-muted-foreground">{w.cites_listing ?? "—"}</span>
                              <span className={`md:hidden inline-block border px-2 py-0.5 font-mono text-[9px] uppercase ${riskBadge[w.urgency] ?? riskBadge.standard}`}>
                                {w.urgency}
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
                                {w.urgency}
                              </span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Detail panel */}
                  <aside className="lg:col-span-5">
                    {sel && (
                      <div className="sticky top-24 border border-border bg-surface">
                        <div className="border-b border-border p-6">
                          <div className="flex items-center justify-between">
                            <span className="case-tag">Ward</span>
                            <span className={`font-mono text-[11px] uppercase ${urgencyColor[sel.urgency] ?? ""}`}>● {sel.urgency}</span>
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
                            { l: "Dringlichkeit", v: sel.urgency, icon: Activity },
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
                            <button key={t.k} onClick={() => { setDetailTab(t.k); if (t.k !== "docs") void loadLogs(sel.id); }}
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
                                {!logsBusy && logs.length === 0 && (
                                  <li className="font-mono text-xs text-muted-foreground">Noch keine Einträge.</li>
                                )}
                              </ul>
                            )}
                          </div>
                        )}

                        {detailTab === "docs" && (
                          <div className="p-6">
                            <span className="eyebrow">Laborbefund</span>
                            {sel.lab_report_path ? (
                              labUrl ? (
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
                                Kein Labornachweis hinterlegt — Platzierung nur mit Q-Safe möglich.
                              </p>
                            )}

                            <div className="mt-6 border-t border-border pt-4">
                              <span className="eyebrow flex items-center gap-2"><Truck className="h-3.5 w-3.5" /> Transporte</span>
                              {wardTransports.length === 0 ? (
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

                        {/* Sentinel assignment */}
                        <div className="border-t border-border p-6">
                          <span className="eyebrow">Sentinel-Zuweisung</span>
                          {sel.owner_id === user?.id ? (
                            <div className="mt-3">
                              <div className="flex items-center gap-2">
                                <select
                                  value={assignTo}
                                  onChange={(e) => { setAssignTo(e.target.value); setSelSentinelId(e.target.value || null); }}
                                  className="h-9 flex-1 border border-border bg-background px-2 text-sm"
                                >
                                  <option value="">Sentinel wählen …</option>
                                  {sentinels.map((s) => (
                                    <option key={s.user_id} value={s.user_id}>
                                      {s.full_name}{s.capacity ? ` — ${s.capacity.slice(0, 60)}` : ""}
                                    </option>
                                  ))}
                                </select>
                                <Button size="sm" disabled={!assignTo} onClick={() => assignSentinel(sel.id)}>Zuweisen</Button>
                              </div>
                              {selSentinelId && sentinels.find((s) => s.user_id === selSentinelId)?.pledge_data?.questionnaire && (
                                <QuestionnaireBlock
                                  raw={sentinels.find((s) => s.user_id === selSentinelId)!.pledge_data!.questionnaire}
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
