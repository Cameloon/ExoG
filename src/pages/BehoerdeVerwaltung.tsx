import { useCallback, useEffect, useRef, useState } from "react";
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
import { fetchShelters } from "@/lib/shelters";
import type { Shelter } from "@/lib/types";
import { Building2, CheckCircle2, ImagePlus, PawPrint, X } from "lucide-react";
import { sniffDocument, uploadId } from "@/lib/uploads";
import { SpeciesInput } from "@/components/SpeciesInput";
import { LoadingSnake } from "@/components/ui/loading-snake";
import { consensusSpecies } from "@/lib/consensus";

type IdRequest = {
  id: string;
  common_name: string;
  description: string;
  photos: string[];
  status: "open" | "confirmed" | "closed";
  confirmed_species: string | null;
  confirmed_listing: string | null;
  notes: string;
  created_at: string;
};

type IdVote = {
  id: string;
  request_id: string;
  expert_id: string;
  species: string;
  listing: string | null;
  confidence: string;
  note: string;
  created_at: string;
};

const BehoerdeVerwaltung = () => {
  const { user, region, isBehoerde, loading } = useAuth();
  const supabase = useExternalSupabase();
  const { toast } = useToast();

  const [shelters, setShelters] = useState<Shelter[]>([]);

  // Ward creation
  const [wf, setWf] = useState({ common_name: "", background: "", care_requirements: "", space_requirements: "", case_code: "", scientific_name: "", cites_listing: "" });
  const [creating, setCreating] = useState(false);

  // Bestimmungshilfe: unknown-animal requests with expert votes
  const [idRequests, setIdRequests] = useState<IdRequest[]>([]);
  const [idVotes, setIdVotes] = useState<Record<string, IdVote[]>>({});
  const [idBusy, setIdsBusy] = useState(false);
  const [idHasMore, setIdHasMore] = useState(false);
  const idsFromRef = useRef(0);
  const [idFormOpen, setIdFormOpen] = useState(false);
  const [idForm, setIdForm] = useState({ common_name: "", description: "", photos: [] as File[] });
  const [idDraftUrls, setIdDraftUrls] = useState<string[]>([]);
  // Object URLs live exactly as long as their File in idForm.photos —
  // creating them during render leaks a URL per render.
  useEffect(() => {
    const urls = idForm.photos.map((f) => URL.createObjectURL(f));
    setIdDraftUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [idForm.photos]);
  const [idSubmitting, setIdSubmitting] = useState(false);
  const [idPhotoUrls, setIdPhotoUrls] = useState<Record<string, string>>({});

  const loadShelters = useCallback(async () => {
    if (!region) return;
    try {
      setShelters(await fetchShelters(supabase, { region }));
    } catch (e) {
      toast({ title: "Laden fehlgeschlagen", description: (e as Error).message, variant: "destructive" });
    }
  }, [region, supabase, toast]);

  useEffect(() => {
    document.title = "Verwaltung · ExoGuard";
  }, []);

  useEffect(() => {
    if (isBehoerde && region) { void loadShelters(); void loadIdRequests(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBehoerde, region, loadShelters]);

  const createWard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !region) return;
    setCreating(true);
    try {
      const { error } = await supabase.from("ward_listings").insert({
        owner_id: user.id, region, common_name: wf.common_name.trim(),
        case_code: wf.case_code.trim(), background: wf.background.trim(),
        care_requirements: wf.care_requirements.trim(), space_requirements: wf.space_requirements.trim(),
        scientific_name: wf.scientific_name.trim() || null, cites_listing: wf.cites_listing || null,
        urgency: "standard", visibility: "vetted_only",
      });
      if (error) throw error;
      toast({ title: "Ward erstellt" });
      setWf({ common_name: "", background: "", care_requirements: "", space_requirements: "", case_code: "", scientific_name: "", cites_listing: "" });
    } catch (e) {
      toast({ title: "Fehler", description: (e as Error).message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const loadIdRequests = useCallback(async (reset = false) => {
    setIdsBusy(true);
    try {
      const from = reset ? 0 : idsFromRef.current;
      const { data: reqs } = await supabase
        .from("identification_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, from + 19);
      const list = (reqs ?? []) as unknown as IdRequest[];
      setIdRequests(reset ? list : (prev) => [...prev, ...list]);
      idsFromRef.current = reset ? list.length : idsFromRef.current + list.length;
      setIdHasMore(list.length === 20);
      if (list.length === 0) return;
      const { data: votes } = await supabase
        .from("identification_votes")
        .select("*")
        .in("request_id", list.map((r) => r.id))
        .order("created_at", { ascending: true });
      const map: Record<string, IdVote[]> = {};
      (votes ?? []).forEach((v) => (map[v.request_id] ??= []).push(v as unknown as IdVote));
      setIdVotes((prev) => (reset ? map : { ...prev, ...map }));
      const photoPaths = list.flatMap((r) => r.photos);
      if (photoPaths.length > 0) {
        const { data: urls } = await supabase.storage.from("id-photos").createSignedUrls(photoPaths, 60 * 60);
        const urlMap: Record<string, string> = {};
        (urls ?? []).forEach((u, i) => { if (u.signedUrl) urlMap[photoPaths[i]] = u.signedUrl; });
        setIdPhotoUrls((prev) => ({ ...prev, ...urlMap }));
      }
    } finally {
      setIdsBusy(false);
    }
  }, [supabase]);

  const submitIdRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !region || !idForm.common_name.trim()) return;
    if (idForm.photos.length === 0) {
      toast({ title: "Foto fehlt", description: "Mindestens ein Foto ist für die Bestimmung erforderlich.", variant: "destructive" });
      return;
    }
    setIdSubmitting(true);
    const paths: string[] = [];
    try {
      for (const file of idForm.photos) {
        const img = await sniffDocument(file);
        if (!img) throw new Error(`${file.name}: nur JPG/PNG/WebP/GIF/AVIF/PDF bis 10 MB.`);
        const path = `${user.id}/${uploadId()}.${img.ext}`;
        const { error: upErr } = await supabase.storage
          .from("id-photos")
          .upload(path, file, { contentType: img.mime, upsert: false });
        if (upErr) throw new Error(`Foto-Upload: ${upErr.message}`);
        paths.push(path);
      }
      const { error } = await supabase.from("identification_requests").insert({
        created_by: user.id,
        region,
        common_name: idForm.common_name.trim(),
        description: idForm.description.trim(),
        photos: paths,
      });
      if (error) throw error;
      toast({ title: "Bestimmungsanfrage erstellt", description: "Verifizierte Experten werden um Einschätzung gebeten." });
      setIdForm({ common_name: "", description: "", photos: [] });
      setIdFormOpen(false);
      void loadIdRequests();
    } catch (err) {
      // Remove orphaned uploads so a failed insert doesn't leak storage.
      if (paths.length > 0) await supabase.storage.from("id-photos").remove(paths).catch(() => {});
      toast({ title: "Fehler", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIdSubmitting(false);
    }
  };

  const resolveIdRequest = async (reqId: string, confirmed_species: string, confirmed_listing: string | null) => {
    if (!window.confirm(`Art "${confirmed_species}" verbindlich bestätigen?`)) return;
    const { error } = await supabase
      .from("identification_requests")
      .update({ status: "confirmed", confirmed_species, confirmed_listing })
      .eq("id", reqId);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    // ponytail: confirmation lives on the request only — no ward linkage exists.
    // Auto-propagate into ward_listings if a ward_id FK is ever added.
    toast({ title: "Art bestätigt", description: `${confirmed_species} wurde als bestätigt gespeichert.` });
    void loadIdRequests();
  };

  const closeIdRequest = async (reqId: string) => {
    if (!window.confirm("Anfrage schließen? Danach können keine Voten mehr abgegeben werden.")) return;
    const { error } = await supabase.from("identification_requests").update({ status: "closed" }).eq("id", reqId);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    void loadIdRequests();
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

  return (
    <div className="min-h-screen bg-background text-foreground dashboard-bg">
      <SiteHeader />
      <main className="container py-8">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">§ Behörde · Verwaltung</span>
            <h1 className="font-editorial mt-2 text-4xl md:text-5xl">Verwaltung {region}</h1>
            <p className="mt-3 text-muted-foreground">Wards erfassen · Bestimmungshilfe · Einrichtungen</p>
          </div>
        </div>

        <div className="mt-8 grid gap-10">
          {/* Ward creation */}
          <section>
            <h2 className="font-display text-2xl flex items-center gap-2"><PawPrint className="h-5 w-5 text-primary" /> Ward erfassen</h2>
            <form onSubmit={createWard} className="mt-4 grid gap-4 border border-border bg-surface p-6 md:grid-cols-2">
              <div>
                <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Case-Code *</Label>
                <Input required value={wf.case_code} onChange={(e) => setWf((p) => ({ ...p, case_code: e.target.value }))} placeholder="WARD-2026-XXX" className="mt-1" />
              </div>
              <div>
                <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Bezeichnung *</Label>
                <Input required value={wf.common_name} onChange={(e) => setWf((p) => ({ ...p, common_name: e.target.value }))} placeholder="z. B. Bartagame" className="mt-1" />
              </div>
              <div className="md:col-span-2">
                <SpeciesInput
                  value={wf.scientific_name}
                  onChange={(v) => setWf((p) => ({ ...p, scientific_name: v }))}
                  onListingChange={(l) => setWf((p) => ({ ...p, cites_listing: l }))}
                />
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
          </section>

          {/* Bestimmungshilfe */}
          <section>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl flex items-center gap-2"><PawPrint className="h-5 w-5 text-primary" /> Bestimmungshilfe</h2>
              <Button size="sm" variant="outline" onClick={() => setIdFormOpen((v) => !v)}>
                <ImagePlus className="mr-1 h-4 w-4" /> Unbekanntes Tier melden
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Falsche Artbestimmung gefährdet Fälle. Lade Fotos hoch — Sentinels der höchsten Zertifizierungsstufe (S4) bestimmen Art und Schutzstatus, bevor das Tier offiziell vermittelt wird.
            </p>

            {idFormOpen && (
              <form onSubmit={submitIdRequest} className="mt-4 grid gap-4 border border-border bg-surface p-6 md:grid-cols-2">
                <div>
                  <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Bezeichnung (Beobachtung) *</Label>
                  <Input required value={idForm.common_name} onChange={(e) => setIdForm((p) => ({ ...p, common_name: e.target.value }))} placeholder="z. B. 'grüne Schlange, ca. 1 m'" className="mt-1" />
                </div>
                <div>
                  <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Beschreibung</Label>
                  <Textarea rows={2} value={idForm.description} onChange={(e) => setIdForm((p) => ({ ...p, description: e.target.value }))} placeholder="Fundumstände, auffällige Merkmale, Verhalten …" className="mt-1" />
                </div>
                <div className="md:col-span-2">
                  <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Fotos (auch Bauchschuppen/Detailaufnahmen helfen)</Label>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {idForm.photos.map((_, i) => (
                      <div key={i} className="relative h-20 w-20 overflow-hidden border border-border bg-background">
                        <img src={idDraftUrls[i]} alt="" className="h-full w-full object-cover" />
                        <button type="button" onClick={() => setIdForm((p) => ({ ...p, photos: p.photos.filter((_, x) => x !== i) }))}
                          className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground hover:text-destructive" aria-label="Foto entfernen">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-border bg-background text-xs text-muted-foreground hover:border-primary hover:text-primary transition">
                      <ImagePlus className="h-5 w-5" />
                      <span>Foto</span>
                      <input type="file" accept="image/*" multiple className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          setIdForm((p) => ({ ...p, photos: [...p.photos, ...files] }));
                          e.target.value = "";
                        }} />
                    </label>
                  </div>
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" disabled={idSubmitting}>
                    {idSubmitting ? "Erstelle …" : "Bestimmungsanfrage an Experten"}
                  </Button>
                </div>
              </form>
            )}

            <div className="mt-4">
              {idBusy ? (
                <div className="flex justify-center py-4">
                  <LoadingSnake label="Lade Anfragen" compact />
                </div>
              ) : idRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine offenen Bestimmungsanfragen.</p>
              ) : (
                <ul className="divide-y divide-border border border-border bg-surface">
                  {idRequests.map((r) => {
                    const votes = idVotes[r.id] ?? [];
                    const consensus = consensusSpecies(votes);
                    return (
                      <li key={r.id} className="px-5 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{r.common_name}</span>
                              <span className={`font-mono text-[9px] uppercase tracking-[0.18em] ${r.status === "open" ? "text-warning" : "text-success"}`}>
                                {r.status === "open" ? "offen" : "bestätigt"}
                              </span>
                            </div>
                            {r.description && <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>}
                            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                              {votes.length} {votes.length === 1 ? "Expertengutachten" : "Expertengutachten"}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {r.photos.slice(0, 3).map((p) => (
                              idPhotoUrls[p] ? (
                                <img key={p} src={idPhotoUrls[p]} alt="Fundtier" className="h-14 w-14 border border-border object-cover" />
                              ) : (
                                <div key={p} className="h-14 w-14 animate-pulse border border-border bg-muted" />
                              )
                            ))}
                          </div>
                        </div>

                        {votes.length > 0 && (
                          <ul className="mt-3 flex flex-wrap gap-2">
                            {votes.map((v) => (
                              <li key={v.id} className="border border-border bg-background px-2 py-1 text-[11px]">
                                <span className="italic">{v.species}</span>
                                {v.listing && <span className="ml-1 font-mono text-[9px] uppercase text-primary">CITES {v.listing}</span>}
                                <span className="ml-1 font-mono text-[9px] text-muted-foreground">· {v.confidence}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        {consensus && r.status === "open" && (
                          <div className="mt-3 flex flex-wrap items-center gap-3 border border-success/30 bg-success/5 px-3 py-2">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                            <span className="text-sm">
                              Konsens ({consensus.count} Experten): <strong className="italic">{consensus.species}</strong>
                              {consensus.listing && <span className="ml-1 font-mono text-[10px] uppercase text-primary">CITES Anhang {consensus.listing}</span>}
                            </span>
                            <div className="ml-auto flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => resolveIdRequest(r.id, consensus.species, consensus.listing)}>
                                Art bestätigen
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => closeIdRequest(r.id)}>Schließen</Button>
                            </div>
                          </div>
                        )}
                        {r.status === "confirmed" && (
                          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-success">
                            Art bestätigt durch {votes.length} Experten: {r.confirmed_species}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {idHasMore && (
                <div className="mt-4">
                  <Button size="sm" variant="outline" onClick={() => void loadIdRequests()}>
                    Weitere Anfragen laden
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* Einrichtungen */}
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
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default BehoerdeVerwaltung;
