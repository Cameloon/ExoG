import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Activity,
  CalendarClock,
  ClipboardList,
  ShieldCheck,
  Thermometer,
  Utensils,
  PawPrint,
  Plus,
  Droplets,
  Eye,
  Fingerprint,
  AlertCircle,
  Download,
} from "lucide-react";
import { CASES, CARE_LOGS, ME_SENTINEL, DUTIES, ACTIVITY_7D, type CareLog, type Duty, type DutyPriority, type EnclosureSlot, type SentinelProfile } from "@/lib/dashboard-data";
import { RATIONALE_RULES, validateRationale, sign } from "@/lib/care-log-validation";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useExternalSupabase } from "@/integrations/external/supabase";
import {
  addCareLog,
  fetchAllCareLogs,
  fetchLiveSentinelProfile,
  fetchMyWards,
  wardToCase,
  type WardRow,
} from "@/lib/care-logs";
import { capacityFromEnclosures, saveEnclosures } from "@/lib/enclosures";
import { addDuty as persistDuty, fetchActivity7d, fetchDuties, formatDue, setDutyDone } from "@/lib/duties";
import { DocumentsHub } from "./DocumentsHub";
import { SentinelOverview } from "./SentinelOverview";
import { IdentificationQueue } from "./IdentificationQueue";
import { LoadingSnake } from "@/components/ui/loading-snake";

type SectionTab = "log" | "docs";
type TopTab = "overview" | "care";

const BEHAVIORS: NonNullable<CareLog["metrics"]>["behavior"][] = [
  "ruhig",
  "aktiv",
  "aggressiv",
  "apathisch",
  "stressbereit",
];



export const SentinelView = ({ live = false }: { live?: boolean }) => {
  const { user, isExpert } = useAuth();
  const supabase = useExternalSupabase();

  // ── Live data (only fetched when live=true; demo uses hardcoded data) ──
  const [wards, setWards] = useState<WardRow[]>([]);
  const [liveLogs, setLiveLogs] = useState<Record<string, CareLog[]>>({});
  const [liveSentinel, setLiveSentinel] = useState<SentinelProfile>(ME_SENTINEL);
  const [logCount7d, setLogCount7d] = useState(0);
  const [booting, setBooting] = useState(live);

  const myCases = live
    ? wards.map(wardToCase)
    : CASES.filter((c) => ME_SENTINEL.cases.includes(c.id));
  const sentinel = live ? liveSentinel : ME_SENTINEL;

  const [activeId, setActiveId] = useState("");
  const [logs, setLogs] = useState<Record<string, CareLog[]>>(CARE_LOGS);
  const [section, setSection] = useState<SectionTab>("log");
  const [topTab, setTopTab] = useState<TopTab>("overview");

  // Duties + activity: demo uses local state on the constants, live persists
  // to the duties table and derives activity from care_logs.
  const [demoDuties, setDemoDuties] = useState<Duty[]>(DUTIES);
  const [liveDuties, setLiveDuties] = useState<Duty[]>([]);
  const [liveActivity, setLiveActivity] = useState<{ day: string; logs: number }[]>(ACTIVITY_7D);
  const duties = live ? liveDuties : demoDuties;
  const activity = live ? liveActivity : ACTIVITY_7D;

  // Per-toggle pre-toggle value, so a failed toggle rolls back to the state
  // before THAT toggle — not to whatever the user toggled afterwards.
  const dutyPrevRef = useRef<Record<string, boolean>>({});

  const handleToggleDuty = (id: string, done: boolean) => {
    if (!live) {
      setDemoDuties((prev) => prev.map((d) => (d.id === id ? { ...d, done } : d)));
      return;
    }
    dutyPrevRef.current[id] ??= !done;
    setLiveDuties((prev) => prev.map((d) => (d.id === id ? { ...d, done } : d)));
    setDutyDone(supabase, id, done)
      .then(() => delete dutyPrevRef.current[id])
      .catch((e) => {
        // rollback on failure — otherwise the UI lies until reload
        const before = dutyPrevRef.current[id] ?? !done;
        delete dutyPrevRef.current[id];
        setLiveDuties((prev) => prev.map((d) => (d.id === id ? { ...d, done: before } : d)));
        toast({ title: "Pflicht nicht gespeichert", description: (e as Error).message, variant: "destructive" });
      });
  };

  const handleSaveEnclosures = (next: EnclosureSlot[]) => {
    if (!live || !user) return;
    const before = liveSentinel.enclosures;
    setLiveSentinel((s) => ({ ...s, enclosures: next }));
    void saveEnclosures(supabase, user.id, next).catch((e) => {
      setLiveSentinel((s) => ({ ...s, enclosures: before }));
      toast({ title: "Anlagen nicht gespeichert", description: (e as Error).message, variant: "destructive" });
    });
  };

  const handleAddDuty = (input: { title: string; caseId?: string; dueIso: string; priority: DutyPriority; category: Duty["category"] }) => {
    if (!live) {
      const iso = input.dueIso;
      setDemoDuties((prev) => [
        {
          id: `D-${Date.now()}`,
          title: input.title,
          caseId: input.caseId,
          due: formatDue(iso),
          dueIso: iso,
          priority: input.priority,
          done: false,
          category: input.category,
        },
        ...prev,
      ]);
      return;
    }
    if (!user) return;
    void (async () => {
      try {
        const d = await persistDuty(supabase, {
          ownerId: user.id,
          title: input.title,
          caseCode: input.caseId ?? null,
          category: input.category,
          priority: input.priority,
          dueIso: input.dueIso || null,
        });
        setLiveDuties((prev) => [d, ...prev]);
      } catch (e) {
        toast({ title: "Pflicht nicht gespeichert", description: (e as Error).message, variant: "destructive" });
      }
    })();
  };

  // Bootstrap: pick first case, load live data.
  useEffect(() => {
    if (!activeId && myCases.length > 0) setActiveId(myCases[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, wards, activeId]);

  useEffect(() => {
    if (!live || !user) return;
    void (async () => {
      try {
        const w = await fetchMyWards(supabase, user.id);
        setWards(w);
        setLiveSentinel(
          await fetchLiveSentinelProfile(
            supabase,
            user.id,
            user.displayName ?? "Sentinel",
            user.email ?? "",
            w.length,
          ),
        );
        const [d, act] = await Promise.all([
          fetchDuties(supabase, user.id),
          fetchActivity7d(supabase, user.id),
        ]);
        setLiveDuties(d);
        setLiveActivity(act);
        // 7d count = sum of the activity buckets — one roundtrip saved.
        setLogCount7d(act.reduce((s, a) => s + a.logs, 0));
      } catch (e) {
        toast({ title: "Laden fehlgeschlagen", description: (e as Error).message, variant: "destructive" });
      } finally {
        setBooting(false);
      }
    })();
  }, [live, user, supabase]);

  const jumpToCase = (id: string) => {
    if (myCases.some((c) => c.id === id)) {
      setActiveId(id);
      setTopTab("care");
      setSection("log");
    }
  };

  const [type, setType] = useState<CareLog["type"]>("Beobachtung");
  const [note, setNote] = useState("");
  const [rationale, setRationale] = useState("");
  const [tempC, setTempC] = useState("");
  const [humidity, setHumidity] = useState("");
  const [feedItem, setFeedItem] = useState("");
  const [feedAmountG, setFeedAmountG] = useState("");
  const [behavior, setBehavior] =
    useState<NonNullable<CareLog["metrics"]>["behavior"] | "">("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const active = myCases.find((c) => c.id === activeId);
  const activeWard = live ? wards.find((w) => w.case_code === activeId) : undefined;
  const activeLogs = live ? liveLogs[activeId] ?? [] : logs[activeId] ?? [];

  // Load a ward's log history lazily on first select (live only).
  useEffect(() => {
    if (!live || !activeWard || liveLogs[activeId]) return;
    void (async () => {
      try {
        const l = await fetchAllCareLogs(supabase, activeWard.id);
        setLiveLogs((p) => ({ ...p, [activeId]: l }));
      } catch (e) {
        toast({ title: "Log-Verlauf nicht ladbar", description: (e as Error).message, variant: "destructive" });
      }
    })();
  }, [live, activeId, activeWard, liveLogs, supabase]);

  const reset = () => {
    setNote("");
    setRationale("");
    setTempC("");
    setHumidity("");
    setFeedItem("");
    setFeedAmountG("");
    setBehavior("");
    setError(null);
  };

  const addLog = async () => {
    if (!activeId) return;
    if (!note.trim()) return setError("Beobachtung darf nicht leer sein.");

    const num = (s: string, min: number, max: number): number | undefined => {
      const n = Number(s);
      return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
    };
    if (tempC && num(tempC, -50, 60) === undefined) return setError("Temperatur muss zwischen -50 °C und 60 °C liegen.");
    if (humidity && num(humidity, 0, 100) === undefined) return setError("Luftfeuchte muss zwischen 0 % und 100 % liegen.");

    const metrics: CareLog["metrics"] = {
      tempC: tempC ? num(tempC, -50, 60) : undefined,
      humidity: humidity ? num(humidity, 0, 100) : undefined,
      feedItem: feedItem.trim() || undefined,
      feedAmountG: feedAmountG ? num(feedAmountG, 0, 100000) : undefined,
      behavior: behavior || undefined,
    };

    const v = validateRationale(type, rationale, metrics);
    if (!v.ok) return setError(`Begründung unzureichend für „${type}": ${v.reason}`);

    // Live: persist hash-chained to care_logs and prepend the stored entry.
    if (live) {
      if (!activeWard || !user) return;
      setSaving(true);
      try {
        const entry = await addCareLog(supabase, {
          wardId: activeWard.id,
          authorName: sentinel.name,
          type,
          note: note.trim(),
          rationale: rationale.trim(),
          metrics,
        });
        setLiveLogs((p) => ({ ...p, [activeId]: [entry, ...(p[activeId] ?? [])] }));
        setLogCount7d((c) => c + 1);
        reset();
      } catch (e) {
        setError(`Speichern fehlgeschlagen: ${(e as Error).message}`);
      } finally {
        setSaving(false);
      }
      return;
    }

    const payload = `${activeId}|${type}|${note}|${rationale}|${ME_SENTINEL.name}|${Date.now()}`;
    const entry: CareLog = {
      ts: "soeben",
      author: ME_SENTINEL.name,
      type,
      note: note.trim(),
      rationale: rationale.trim(),
      metrics,
      signature: sign(payload),
    };
    setLogs((prev) => ({ ...prev, [activeId]: [entry, ...(prev[activeId] ?? [])] }));
    reset();
  };

  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    if (!active) return;
    try {
      setExporting(true);
      const { exportCareLogsZip } = await import("@/lib/care-log-export");
      await exportCareLogsZip({
        caseRecord: active,
        logs: activeLogs,
        sentinel,
      });
      const nonCompliant = activeLogs.filter(
        (l) => !validateRationale(l.type, l.rationale ?? "", l.metrics).ok,
      ).length;
      toast({
        title: "Export erstellt",
        description: `${activeLogs.length} Einträge · ${nonCompliant} nicht konform · ZIP-Download gestartet`,
      });
    } catch (e) {
      toast({
        title: "Export fehlgeschlagen",
        description: e instanceof Error ? e.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const rule = RATIONALE_RULES[type];
  // ponytail: memoize — the keyword scan runs on every keystroke otherwise
  const validation = useMemo(() => validateRationale(type, rationale, undefined), [type, rationale]);


  // Enclosure slots are the real capacity once maintained.
  const cap = capacityFromEnclosures(sentinel.enclosures) ?? sentinel.capacity;
  const capPct = cap.total > 0 ? (cap.used / cap.total) * 100 : 0;

  // ponytail: block render until live data arrives to avoid demo-flash
  if (live && booting) {
    return (
      <div className="flex justify-center py-10">
        <LoadingSnake label="Lade Sentinel-Profil" compact />
      </div>
    );
  }

  return (
    <>
      {/* Sentinel-Profil-Strip */}
      <div className="grid gap-px bg-border md:grid-cols-4">
        <div className="bg-background p-6">
          <div className="flex items-start justify-between">
            <PawPrint className="h-4 w-4 text-muted-foreground" />
            {!live && (
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                Stufe {ME_SENTINEL.tier}
              </span>
            )}
          </div>
          <div className="mt-6 font-display text-2xl tracking-tight">{sentinel.name}</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Sentinel · Region {sentinel.region}
          </div>
        </div>
        <div className="bg-background p-6">
          <div className="flex items-start justify-between">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Kapazität
            </span>
          </div>
          <div className="mt-6 font-display text-4xl tracking-tight">
            {cap.used}
            <span className="text-muted-foreground">/{cap.total}</span>
          </div>
          <div className="mt-2 h-1 w-full bg-border">
            <div className="h-full bg-primary" style={{ width: `${capPct}%` }} />
          </div>
        </div>
        <div className="bg-background p-6">
          <div className="flex items-start justify-between">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {live ? "Meine Wards" : "Nächste Pflicht"}
            </span>
          </div>
          <div className="mt-6 font-display text-2xl tracking-tight">{live ? wards.length : "14:00"}</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {live ? "in eigener Pflege" : "Vet-Telefonat · EG-2026-00466"}
          </div>
        </div>
        <div className="bg-background p-6">
          <div className="flex items-start justify-between">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              7-Tage-Logs
            </span>
          </div>
          <div className="mt-6 font-display text-4xl tracking-tight">{live ? logCount7d : 42}</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Einträge erfasst
          </div>
        </div>
      </div>

      {/* Top-Tabs */}
      <div className="mt-8 flex gap-px bg-border w-fit">
        {(
          [
            { k: "overview", label: "Übersicht" },
            { k: "care", label: "Pflege & Dokumente" },
          ] as const
        ).map((t) => (
          <button
            key={t.k}
            onClick={() => setTopTab(t.k)}
            className={`bg-surface px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
              topTab === t.k ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {topTab === "overview" && (
        <div className="mt-6">
          <SentinelOverview
            sentinel={sentinel}
            cases={myCases}
            activity={activity}
            duties={duties}
            onToggleDuty={handleToggleDuty}
            onAddDuty={handleAddDuty}
            onJumpToCase={jumpToCase}
            onSaveEnclosures={live ? handleSaveEnclosures : undefined}
            live={live}
          />
        </div>
      )}

      {topTab === "care" && (
      <div className="mt-6">
        {live && isExpert && (
          <div className="mb-8">
            <IdentificationQueue />
          </div>
        )}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* My animals */}
        <section className="lg:col-span-5">
          <h2 className="text-xl tracking-tight">Meine Pflegestellen</h2>
          <div className="mt-4 space-y-px bg-border">
            {live && booting && (
              <div className="bg-surface p-4">
                <LoadingSnake label="Lade Wards" compact />
              </div>
            )}
            {live && !booting && myCases.length === 0 && (
              <div className="bg-surface p-4 font-mono text-xs text-muted-foreground">
                Noch keine Wards zugewiesen — Einrichtungen oder Behörden weisen dir Wards zu.
              </div>
            )}
            {myCases.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`flex w-full items-center justify-between bg-surface p-4 text-left transition-colors hover:bg-surface-elevated ${
                  activeId === c.id ? "bg-surface-elevated" : ""
                }`}
              >
                <div>
                  <div className="font-mono text-[11px] text-primary">{c.id}</div>
                  <div className="mt-1 text-sm">{c.german}</div>
                  <div className="font-mono text-[10px] italic text-muted-foreground">
                    {c.species}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Im System
                  </div>
                  <div className="font-mono text-sm">{c.age}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 border border-border bg-surface p-4">
            <span className="eyebrow">Sentinel-Pledge</span>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              „Pflege ist temporär. Verantwortung ist dauerhaft. Ich übernehme,
              bis eine bessere Stelle gefunden ist — oder ich bin diese Stelle."
            </p>
          </div>
        </section>

        {/* Care log composer */}
        <section className="lg:col-span-7">
          {active && (
            <div className="border border-border bg-surface">
              <div className="border-b border-border p-6">
                <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <h3 className="text-2xl tracking-tight">{active.german}</h3>
                  <span className="font-mono text-[11px] text-primary">{active.id}</span>
                </div>
                <div className="mt-1 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <p className="font-mono text-xs italic text-muted-foreground">{active.species}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExport}
                    disabled={exporting || activeLogs.length === 0}
                  >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    {exporting ? "Erstelle…" : "Behörden-Export (PDF + JSON)"}
                  </Button>
                </div>
              </div>

              {/* Sub-tabs: Pflege-Log / Dokumente */}
              <div className="flex gap-px bg-border">
                {(
                  [
                    { k: "log", label: "Pflege-Log" },
                    { k: "docs", label: "Dokumente" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.k}
                    onClick={() => setSection(t.k)}
                    className={`flex-1 bg-surface px-4 py-2.5 text-center font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                      section === t.k
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {section === "log" && (
              <>
              <div className="border-b border-border p-6">
                <span className="eyebrow flex items-center gap-2">
                  <ClipboardList className="h-3 w-3" /> Neuer Pflege-Eintrag
                </span>

                {/* Type selector */}
                <div className="mt-4 flex flex-wrap gap-px bg-border">
                  {(["Beobachtung", "Fütterung", "Medizin", "Klima", "Reinigung"] as const).map(
                    (t) => (
                      <button
                        key={t}
                        onClick={() => setType(t)}
                        className={`flex flex-1 items-center justify-center gap-2 bg-surface px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                          type === t ? "text-primary" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t === "Fütterung" && <Utensils className="h-3 w-3" />}
                        {t === "Klima" && <Thermometer className="h-3 w-3" />}
                        {t}
                      </button>
                    ),
                  )}
                </div>

                {/* Strukturierte Messwerte */}
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      <Thermometer className="h-3 w-3" /> Temperatur (°C)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={tempC}
                      onChange={(e) => setTempC(e.target.value)}
                      placeholder="z. B. 28.5"
                      className="mt-1 h-9 border-border bg-background font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      <Droplets className="h-3 w-3" /> Luftfeuchte (%)
                    </label>
                    <Input
                      type="number"
                      value={humidity}
                      onChange={(e) => setHumidity(e.target.value)}
                      placeholder="z. B. 70"
                      className="mt-1 h-9 border-border bg-background font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      <Utensils className="h-3 w-3" /> Fütterung
                    </label>
                    <Input
                      value={feedItem}
                      onChange={(e) => setFeedItem(e.target.value)}
                      placeholder="z. B. Maus adult"
                      className="mt-1 h-9 border-border bg-background font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Menge (g)
                    </label>
                    <Input
                      type="number"
                      value={feedAmountG}
                      onChange={(e) => setFeedAmountG(e.target.value)}
                      placeholder="z. B. 35"
                      className="mt-1 h-9 border-border bg-background font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    <Eye className="h-3 w-3" /> Verhalten
                  </label>
                  <div className="mt-2 flex flex-wrap gap-px bg-border">
                    {BEHAVIORS.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBehavior(behavior === b ? "" : b)}
                        className={`flex-1 bg-surface px-3 py-2 text-center font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                          behavior === b
                            ? "text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5">
                  <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Beobachtung / Notiz
                  </label>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Werte, Auffälligkeiten, Sichtkontakt…"
                    className="mt-1 min-h-[80px] resize-none border-border bg-background font-mono text-sm"
                  />
                </div>

                <div className="mt-4">
                  <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                    Begründung · pflicht für „{type}" *
                  </label>
                  <p className="mt-1 font-mono text-[10px] italic text-muted-foreground">
                    {rule.hint}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {rule.groups.map((g) => {
                      const covered = !validation.missing.includes(g.label);
                      return (
                        <span
                          key={g.label}
                          className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors ${
                            covered
                              ? "border-primary/50 text-primary"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {covered ? "✓ " : "○ "}
                          {g.label}
                        </span>
                      );
                    })}
                  </div>
                  <Textarea
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    placeholder={`z. B. ${rule.groups.map((g) => g.any[0]).join(" · ")}`}
                    className="mt-2 min-h-[72px] resize-none border-border bg-background font-mono text-sm"
                  />
                  <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                    <span>Min. {rule.minLen} Zeichen · alle Aspekte abdecken</span>
                    <span>
                      {rationale.trim().length}/{rule.minLen}
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="mt-3 flex items-center gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-[11px] text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    {error}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between">
                  <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    <Fingerprint className="h-3 w-3" /> {live ? "Hash-Kette" : "Lokal-Hash"} · {sentinel.name}
                  </span>
                  <Button size="sm" onClick={addLog} disabled={!note.trim() || !validation.ok || saving}>
                    <Plus className="mr-2 h-4 w-4" /> {saving ? "Speichere …" : "Eintragen & signieren"}
                  </Button>
                </div>

              </div>

              <div className="p-6">
                <span className="eyebrow">Verlauf · {activeLogs.length}</span>
                <ul className="mt-4 space-y-4">
                  {activeLogs.map((l, i) => (
                    <li key={i} className="border-l-2 border-primary/40 pl-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                          {l.type}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">{l.ts}</span>
                      </div>
                      <p className="mt-1 text-sm">{l.note}</p>

                      {l.metrics &&
                        (l.metrics.tempC !== undefined ||
                          l.metrics.humidity !== undefined ||
                          l.metrics.feedItem ||
                          l.metrics.behavior) && (
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">
                            {l.metrics.tempC !== undefined && (
                              <span className="inline-flex items-center gap-1">
                                <Thermometer className="h-3 w-3" /> {l.metrics.tempC}°C
                              </span>
                            )}
                            {l.metrics.humidity !== undefined && (
                              <span className="inline-flex items-center gap-1">
                                <Droplets className="h-3 w-3" /> {l.metrics.humidity}%
                              </span>
                            )}
                            {l.metrics.feedItem && (
                              <span className="inline-flex items-center gap-1">
                                <Utensils className="h-3 w-3" /> {l.metrics.feedItem}
                                {l.metrics.feedAmountG ? ` · ${l.metrics.feedAmountG} g` : ""}
                              </span>
                            )}
                            {l.metrics.behavior && (
                              <span className="inline-flex items-center gap-1">
                                <Eye className="h-3 w-3" /> {l.metrics.behavior}
                              </span>
                            )}
                          </div>
                        )}

                      {l.rationale && (
                        <p className="mt-2 border-l border-border pl-2 font-mono text-[11px] italic text-muted-foreground">
                          Begründung: {l.rationale}
                        </p>
                      )}

                      <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                        <span>— {l.author}</span>
                        {l.signature && (
                          <span className="inline-flex items-center gap-1 text-primary/70">
                            <Fingerprint className="h-3 w-3" /> {l.signature}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                  {activeLogs.length === 0 && (
                    <li className="font-mono text-xs text-muted-foreground">Noch keine Einträge.</li>
                  )}
                </ul>
              </div>
              </>
              )}

              {section === "docs" && (
                <div className="p-6">
                  <DocumentsHub caseRecord={active} sentinel={sentinel} />
                </div>
              )}
            </div>
          )}
        </section>
      </div>
      </div>
      )}
    </>
  );
};
