import { useEffect, useState, useCallback } from "react";
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
import { MapPin, Building2, PawPrint, Map as MapIcon, List as ListIcon, FileText, Plus, UserPlus } from "lucide-react";
import { fetchShelters, fetchWardsByRegion } from "@/lib/shelters";
import { fetchCareLogs } from "@/lib/care-logs";
import type { CareLog } from "@/lib/dashboard-data";
import type { Shelter, Ward } from "@/lib/types";
import { LazyShelterMap } from "@/components/shelters/LazyShelterMap";
import { RegionSelect } from "@/components/RegionSelect";
import { BUNDESLAENDER } from "@/lib/germanRegions";

const Behoerde = () => {
  const { user, region, isBehoerde, loading } = useAuth();
  const supabase = useExternalSupabase();
  const { toast } = useToast();
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [busy, setBusy] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [logsFor, setLogsFor] = useState<string | null>(null);
  const [logs, setLogs] = useState<CareLog[]>([]);
  const [logsBusy, setLogsBusy] = useState(false);
  const [logsCache, setLogsCache] = useState<Record<string, CareLog[]>>({});

  // ponytail: inline ward creation for behoerde (no image upload, minimal fields)
  const [showWardForm, setShowWardForm] = useState(false);
  const [wf, setWf] = useState({ common_name: "", background: "", care_requirements: "", space_requirements: "", case_code: "" });
  const [creating, setCreating] = useState(false);

  // ponytail: sentinel assignment for each ward
  const [sentinels, setSentinels] = useState<{ user_id: string; full_name: string }[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignTo, setAssignTo] = useState<string>("");

  // ponytail: behoerde self-set region on first login
  const [rsState, setRsState] = useState("");
  const [rsDistrict, setRsDistrict] = useState("");
  const [rsBusy, setRsBusy] = useState(false);
  const setRegion = async () => {
    if (!user || !rsState) return;
    setRsBusy(true);
    try {
      const regionValue = rsDistrict ? `${rsDistrict}, ${rsState}` : rsState;
      const { error } = await supabase.from("profiles").upsert({ id: user.id, region: regionValue });
      if (error) throw error;
      toast({ title: "Region gespeichert", description: regionValue });
      window.location.reload();
    } catch (e) {
      toast({ title: "Fehler", description: (e as Error).message, variant: "destructive" });
    } finally {
      setRsBusy(false);
    }
  };

  // fetch approved sentinels in the region for assignment
  const loadSentinels = useCallback(async () => {
    if (!region) return;
    const { data } = await supabase
      .from("sentinel_applications")
      .select("user_id, full_name")
      .eq("region", region)
      .eq("status", "approved")
      .limit(100);
    setSentinels((data ?? []) as { user_id: string; full_name: string }[]);
  }, [region, supabase]);

  const createWard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !region) return;
    setCreating(true);
    try {
      const { error } = await supabase.from("ward_listings").insert({
        owner_id: user.id,
        region,
        common_name: wf.common_name.trim(),
        case_code: wf.case_code.trim(),
        background: wf.background.trim(),
        care_requirements: wf.care_requirements.trim(),
        space_requirements: wf.space_requirements.trim(),
        urgency: "standard",
        visibility: "vetted_only",
      });
      if (error) throw error;
      toast({ title: "Ward erstellt" });
      setShowWardForm(false);
      setWf({ common_name: "", background: "", care_requirements: "", space_requirements: "", case_code: "" });
      void load();
    } catch (e) {
      toast({ title: "Fehler", description: (e as Error).message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const assignSentinel = async (wardId: string) => {
    if (!assignTo) return;
    try {
      const { error } = await supabase.from("ward_listings").update({ owner_id: assignTo }).eq("id", wardId);
      if (error) throw error;
      toast({ title: "Sentinel zugewiesen" });
      setAssigning(null);
      setAssignTo("");
      void load();
    } catch (e) {
      toast({ title: "Fehler", description: (e as Error).message, variant: "destructive" });
    }
  };

  const toggleLogs = async (wardId: string) => {
    if (logsFor === wardId) { setLogsFor(null); return; }
    setLogsFor(wardId);
    if (logsCache[wardId]) { setLogs(logsCache[wardId]); return; }
    setLogsBusy(true);
    try {
      const l = await fetchCareLogs(supabase, wardId);
      setLogsCache((p) => ({ ...p, [wardId]: l }));
      setLogs(l);
    } catch (e) {
      toast({ title: "Laden fehlgeschlagen", description: (e as Error).message, variant: "destructive" });
      setLogsFor(null);
    } finally {
      setLogsBusy(false);
    }
  };

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

  useEffect(() => {
    document.title = "Behörde · ExoGuard";
  }, []);

  useEffect(() => {
    if (isBehoerde && region) { void load(); void loadSentinels(); }
  }, [isBehoerde, region, load, loadSentinels]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-muted-foreground">
        <SiteHeader />
        <main className="container py-24 text-center">…</main>
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
        <main className="container max-w-xl py-24">
          <h1 className="font-editorial text-3xl">Zuständigkeitsregion festlegen</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Wähle deine Region — sie wird in deinem Profil gespeichert und
            bestimmt, welche Einrichtungen und Wards du siehst.
          </p>
          <div className="mt-8 space-y-4">
            <RegionSelect state={rsState} district={rsDistrict} onState={setRsState} onDistrict={setRsDistrict} />
            <Button disabled={!rsState || rsBusy} onClick={setRegion}>
              {rsBusy ? "Speichere …" : "Region speichern"}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">§ Behörde · Zuständigkeit</span>
            <h1 className="font-editorial mt-2 text-4xl md:text-5xl">Einzugsgebiet {region}</h1>
            <p className="mt-3 text-muted-foreground">
              Wards und Einrichtungen in deiner Region. {wards.length} Wards · {shelters.length} Einrichtungen.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowMap((v) => !v)}>
            {showMap ? <ListIcon className="mr-2 h-4 w-4" /> : <MapIcon className="mr-2 h-4 w-4" />}
            {showMap ? "Liste" : "Karte"}
          </Button>
        </div>

        {busy ? (
          <p className="mt-10 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">Lade …</p>
        ) : (
          <div className="mt-10 grid gap-10">
            {showMap && shelters.length > 0 && (
              <section>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Einrichtungen-Karte</p>
                <div className="mt-3"><LazyShelterMap shelters={shelters} /></div>
              </section>
            )}

            <section>
              <h2 className="font-display text-2xl flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Einrichtungen</h2>
              {shelters.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Keine Einrichtungen in {region} erfasst.</p>
              ) : (
                <ul className="mt-4 divide-y divide-border border border-border bg-surface">
                  {shelters.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="min-w-0">
                        <p className="font-medium">{s.name}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{s.region} · {s.description ?? "—"}</p>
                      </div>
                      <Link to={`/shelters/${s.id}`} className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-primary hover:underline">Profil</Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <div className="flex items-end justify-between">
                <h2 className="font-display text-2xl flex items-center gap-2"><PawPrint className="h-5 w-5 text-primary" /> Wards in Region</h2>
                <Button size="sm" variant="outline" onClick={() => setShowWardForm(!showWardForm)}>
                  <Plus className="mr-1 h-4 w-4" /> {showWardForm ? "Abbrechen" : "Ward erfassen"}
                </Button>
              </div>

              {showWardForm && (
                <form onSubmit={createWard} className="mt-6 grid gap-4 border border-border bg-surface p-6 md:grid-cols-2">
                  <div>
                    <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Case-Code *</Label>
                    <Input required value={wf.case_code} onChange={(e) => setWf((p) => ({ ...p, case_code: e.target.value }))} placeholder="WARD-2026-XXX" className="mt-1" />
                  </div>
                  <div>
                    <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Bezeichnung *</Label>
                    <Input required value={wf.common_name} onChange={(e) => setWf((p) => ({ ...p, common_name: e.target.value }))} placeholder="z. B. Bartagame" className="mt-1" />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Hintergrund *</Label>
                    <Textarea required rows={2} value={wf.background} onChange={(e) => setWf((p) => ({ ...p, background: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Pflegeanforderungen *</Label>
                    <Textarea required rows={2} value={wf.care_requirements} onChange={(e) => setWf((p) => ({ ...p, care_requirements: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Haltungsanforderungen *</Label>
                    <Textarea required rows={2} value={wf.space_requirements} onChange={(e) => setWf((p) => ({ ...p, space_requirements: e.target.value }))} className="mt-1" />
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <Button type="submit" disabled={creating}>{creating ? "Erstelle …" : "Ward speichern"}</Button>
                  </div>
                </form>
              )}

              {wards.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Keine Wards in {region} erfasst.</p>
              ) : (
                <div className="mt-4 grid gap-px bg-border md:grid-cols-2">
                  {wards.map((w) => (
                    <article key={w.id} className="bg-background p-6">
                      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{w.case_code} · {w.status}</p>
                      <h3 className="font-display mt-2 text-xl">{w.common_name}</h3>
                      {w.scientific_name && (
                        <p className="mt-1 text-xs italic text-muted-foreground">
                          {w.scientific_name}
                          {w.cites_listing && (
                            <span className="ml-2 not-italic font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                              CITES {w.cites_listing}
                            </span>
                          )}
                        </p>
                      )}
                      <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{w.background}</p>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {w.region}</span>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setAssigning(assigning === w.id ? null : w.id); setAssignTo(""); }}>
                            <UserPlus className="mr-1 h-3 w-3" /> Zuweisen
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => toggleLogs(w.id)}>
                            <FileText className="mr-1 h-3 w-3" /> {logsFor === w.id ? "Schließen" : "Pflegeprotokoll"}
                          </Button>
                        </div>
                      </div>
                      {assigning === w.id && (
                        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                          <select
                            value={assignTo}
                            onChange={(e) => setAssignTo(e.target.value)}
                            className="h-9 flex-1 border border-border bg-background px-2 text-sm"
                          >
                            <option value="">Sentinel wählen …</option>
                            {sentinels.map((s) => (
                              <option key={s.user_id} value={s.user_id}>{s.full_name}</option>
                            ))}
                          </select>
                          <Button size="sm" disabled={!assignTo} onClick={() => assignSentinel(w.id)}>Zuweisen</Button>
                        </div>
                      )}
                      {logsFor === w.id && (
                        <div className="mt-4 border-t border-border pt-4">
                          {logsBusy ? (
                            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Lade …</p>
                          ) : logs.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Noch keine Protokolleinträge.</p>
                          ) : (
                            <ul className="space-y-3">
                              {logs.map((l, i) => (
                                <li key={i} className="text-xs">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{l.type}</span>
                                    <span className="font-mono text-[10px] text-muted-foreground">{l.ts} · {l.author}</span>
                                  </div>
                                  <p className="mt-1 text-foreground/85">{l.note}</p>
                                  {l.rationale && <p className="mt-1 italic text-muted-foreground">{l.rationale}</p>}
                                  <p className="mt-1 font-mono text-[9px] text-muted-foreground/70">⛓ {l.signature}</p>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default Behoerde;
