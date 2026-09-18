import { useEffect, useMemo, useState } from "react";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { sniffImage } from "@/lib/uploads";
import { RegionSelect } from "@/components/RegionSelect";
import { BUNDESLAENDER } from "@/lib/germanRegions";
import { Plus, X, ImagePlus, PawPrint, MapPin } from "lucide-react";

type Ward = {
  id: string;
  owner_id: string;
  shelter_id: string | null;
  case_code: string;
  common_name: string;
  scientific_name: string | null;
  sex: string | null;
  age_estimate: string | null;
  size_estimate: string | null;
  origin_context: string | null;
  background: string;
  care_requirements: string;
  space_requirements: string;
  region: string | null;
  urgency: string;
  status: "available" | "under_review" | "placed" | "withdrawn";
  visibility: "vetted_only" | "admin_only";
  images: string[];
  created_at: string;
};

type FormState = {
  case_code: string;
  common_name: string;
  scientific_name: string;
  sex: string;
  age_estimate: string;
  size_estimate: string;
  region: string;
  urgency: string;
  origin_context: string;
  background: string;
  care_requirements: string;
  space_requirements: string;
};

const emptyForm: FormState = {
  case_code: "", common_name: "", scientific_name: "", sex: "",
  age_estimate: "", size_estimate: "", region: "", urgency: "standard",
  origin_context: "", background: "", care_requirements: "", space_requirements: "",
};

const urgencyTone: Record<string, string> = {
  standard: "bg-muted text-muted-foreground",
  urgent: "bg-primary/15 text-primary",
  critical: "bg-destructive/15 text-destructive",
};

const urgencyLabel: Record<string, string> = {
  standard: "Standard",
  urgent: "Erhöht",
  critical: "Kritisch",
};

const statusLabel: Record<Ward["status"], string> = {
  available: "Verfügbar", under_review: "In Prüfung", placed: "Vermittelt", withdrawn: "Zurückgezogen",
};

export const WardManager = ({ shelterId }: { shelterId: string | null }) => {
  const { user, isAdmin, isEinrichtung } = useAuth();
  const supabase = useExternalSupabase();
  const storage = supabase.storage;
  const { toast } = useToast();
  const [wards, setWards] = useState<Ward[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [regState, setRegState] = useState(
    BUNDESLAENDER.find((s) => form.region.endsWith(s)) ?? "",
  );
  const [regDistrict, setRegDistrict] = useState(
    regState ? form.region.replace(`, ${regState}`, "") : form.region,
  );
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [carriedImages, setCarriedImages] = useState<string[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // Object URLs live exactly as long as their File in pendingImages —
  // creating them during render leaks a URL per render.
  useEffect(() => {
    const urls = pendingImages.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [pendingImages]);

  const myWards = useMemo(
    () => wards.filter((w) => (shelterId ? w.shelter_id === shelterId : user && w.owner_id === user.id)),
    [wards, shelterId, user],
  );

  useEffect(() => {
    if (!user) return;
    void loadWards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, shelterId]);

  useEffect(() => {
    const allPaths = Array.from(new Set(wards.flatMap((w) => (w.images ?? []).slice(0, 1))));
    const missing = allPaths.filter((p) => !signedUrls[p]);
    if (missing.length === 0) return;
    void (async () => {
      const { data, error } = await storage.from("ward-images").createSignedUrls(missing, 60 * 60);
      if (error || !data) return;
      const next: Record<string, string> = {};
      data.forEach((d, i) => { if (d.signedUrl) next[missing[i]] = d.signedUrl; });
      setSignedUrls((prev) => ({ ...prev, ...next }));
    })();
  }, [wards, signedUrls, storage]);

  const loadWards = async () => {
    let q = supabase.from("ward_listings").select("*").order("created_at", { ascending: false });
    if (shelterId) q = q.eq("shelter_id", shelterId);
    q = q.limit(200);
    const { data, error } = await q;
    if (error) {
      toast({ title: "Fehler beim Laden", description: error.message, variant: "destructive" });
      return;
    }
    setWards((data ?? []) as Ward[]);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setRegState("");
    setRegDistrict("");
    setPendingImages([]);
    setCarriedImages([]);
  };

  const submitWard = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const uploadedPaths: string[] = [];
    const cleanupUploads = async () => {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from("ward-images").remove(uploadedPaths).catch(() => {});
      }
    };
    for (const file of pendingImages) {
      const img = await sniffImage(file);
      if (!img) {
        setSubmitting(false);
        await cleanupUploads();
        toast({ title: "Ungültiges Bild", description: `${file.name}: nur JPG/PNG/WebP/GIF/AVIF bis 10 MB.`, variant: "destructive" });
        return;
      }
      const path = `${user.id}/${crypto.randomUUID()}.${img.ext}`;
      const { error: upErr } = await supabase.storage
        .from("ward-images").upload(path, file, { contentType: img.mime, upsert: false });
      if (upErr) {
        setSubmitting(false);
        await cleanupUploads();
        toast({ title: "Bild-Upload fehlgeschlagen", description: upErr.message, variant: "destructive" });
        return;
      }
      uploadedPaths.push(path);
    }
    const payload = {
      owner_id: user.id,
      shelter_id: shelterId,
      case_code: form.case_code.trim(),
      common_name: form.common_name.trim(),
      scientific_name: form.scientific_name.trim() || null,
      sex: form.sex.trim() || null,
      age_estimate: form.age_estimate.trim() || null,
      size_estimate: form.size_estimate.trim() || null,
      origin_context: form.origin_context.trim() || null,
      background: form.background.trim(),
      care_requirements: form.care_requirements.trim(),
      space_requirements: form.space_requirements.trim(),
      region: form.region.trim() || null,
      urgency: form.urgency || "standard",
      images: [...carriedImages, ...uploadedPaths],
    };
    const { error } = await supabase.from("ward_listings").insert(payload);
    setSubmitting(false);
    if (error) {
      await cleanupUploads();
      toast({ title: "Konnte nicht speichern", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Tier erfasst", description: "Sichtbar nur für vetted Stewards." });
    setShowForm(false);
    resetForm();
    void loadWards();
  };

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((p) => ({ ...p, [k]: v }));
  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPendingImages((p) => [...p, ...Array.from(e.target.files ?? [])]);
    e.target.value = "";
  };

  return (
    <div>
      <div className="flex items-end justify-between border-b border-border pb-4">
        <p className="font-mono text-xs text-muted-foreground">
          {myWards.length} {myWards.length === 1 ? "eigenes Tier" : "eigene Tiere"} erfasst
        </p>
        <Button
          onClick={() => { if (showForm) resetForm(); setShowForm(!showForm); }}
          variant={showForm ? "outline" : "default"}
        >
          <Plus className="mr-1 h-4 w-4" />
          {showForm ? "Abbrechen" : "Tier erfassen"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={submitWard} className="mt-8 grid gap-5 border border-border bg-surface p-8 md:grid-cols-2">
          <Field label="Case-Code" required value={form.case_code} onChange={(v) => update("case_code", v)} placeholder="WARD-2026-001" />
          <Field label="Bezeichnung" required value={form.common_name} onChange={(v) => update("common_name", v)} placeholder="Bartagame, weiblich" />
          <Field label="Wiss. Name" value={form.scientific_name} onChange={(v) => update("scientific_name", v)} placeholder="Pogona vitticeps" />
          <Field label="Geschlecht" value={form.sex} onChange={(v) => update("sex", v)} placeholder="weiblich / männlich / unbekannt" />
          <Field label="Alter (geschätzt)" value={form.age_estimate} onChange={(v) => update("age_estimate", v)} placeholder="ca. 6 Jahre" />
          <Field label="Größe / Gewicht" value={form.size_estimate} onChange={(v) => update("size_estimate", v)} placeholder="48 cm / 420 g" />
          <RegionSelect
            state={regState}
            district={regDistrict}
            onState={(v) => { setRegState(v); setRegDistrict(""); update("region", v); }}
            onDistrict={(v) => { setRegDistrict(v); update("region", v ? `${v}, ${regState}` : regState); }}
          />

          <div>
            <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Dringlichkeit</Label>
            <select
              value={form.urgency}
              onChange={(e) => update("urgency", e.target.value)}
              className="mt-2 h-10 w-full border border-border bg-background px-3 text-sm"
            >
              <option value="standard">Standard</option>
              <option value="urgent">Erhöht</option>
              <option value="critical">Kritisch</option>
            </select>
          </div>

          <TextField label="Hintergrund / Herkunft (intern)" value={form.origin_context} onChange={(v) => update("origin_context", v)} />
          <TextField label="Vorgeschichte & Verhalten" required value={form.background} onChange={(v) => update("background", v)} />
          <TextField label="Pflegeanforderungen" required value={form.care_requirements} onChange={(v) => update("care_requirements", v)} />
          <TextField label="Platz- & Haltungsanforderungen" required value={form.space_requirements} onChange={(v) => update("space_requirements", v)} />

          <div className="md:col-span-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Bilder (vetted-only sichtbar)</Label>
            <div className="mt-3 flex flex-wrap gap-3">
              {carriedImages.map((path) => (
                <div key={path} className="relative h-24 w-24 overflow-hidden border border-border bg-background">
                  {signedUrls[path]
                    ? <img src={signedUrls[path]} alt="Tierfoto Vorschau" className="h-full w-full object-cover" />
                    : <div className="h-full w-full animate-pulse bg-muted" />}
                  <button type="button" onClick={() => setCarriedImages((p) => p.filter((x) => x !== path))}
                    className="absolute right-1 top-1 rounded-full bg-background/90 p-1 hover:bg-destructive hover:text-destructive-foreground" aria-label="Bild entfernen">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {pendingImages.map((_file, i) => (
                <div key={i} className="relative h-24 w-24 overflow-hidden border border-primary/40 bg-background">
                  {previewUrls[i] && <img src={previewUrls[i]} alt="Tierfoto Vorschau" className="h-full w-full object-cover" />}
                  <button type="button" onClick={() => setPendingImages((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute right-1 top-1 rounded-full bg-background/90 p-1 hover:bg-destructive hover:text-destructive-foreground" aria-label="Bild entfernen">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-border bg-background text-xs text-muted-foreground hover:border-primary hover:text-primary transition">
                <ImagePlus className="h-5 w-5" />
                <span>Hinzufügen</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} />
              </label>
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Wird erfasst …" : "Tier speichern"}
            </Button>
          </div>
        </form>
      )}

      <h2 className="font-display text-2xl flex items-center gap-2 mt-10"><PawPrint className="h-5 w-5 text-primary" /> Tiere</h2>
      <div className="mt-4 grid gap-px bg-border md:grid-cols-2">
        {myWards.length === 0 && (
          <div className="bg-background p-10 text-sm text-muted-foreground md:col-span-2">
            Noch keine Tiere erfasst.
          </div>
        )}
        {myWards.map((w) => {
          const cover = (w.images ?? [])[0];
          return (
            <article key={w.id} className="bg-background p-6 transition-colors hover:bg-surface">
              {cover && (
                <div className="mb-5 aspect-[16/10] w-full overflow-hidden border border-border bg-muted">
                  {signedUrls[cover]
                    ? <img src={signedUrls[cover]} alt={w.common_name} loading="lazy" className="h-full w-full object-cover" />
                    : <div className="h-full w-full animate-pulse bg-muted" />}
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    {w.case_code} · {statusLabel[w.status]}
                  </p>
                  <h3 className="font-display mt-2 text-xl">{w.common_name}</h3>
                  {w.scientific_name && <p className="mt-1 text-xs italic text-muted-foreground">{w.scientific_name}</p>}
                </div>
                <Badge className={urgencyTone[w.urgency] ?? urgencyTone.standard}>{urgencyLabel[w.urgency] ?? w.urgency}</Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{w.background}</p>
              {w.region && (
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {w.region}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};

const Field = ({ label, required, placeholder, value, onChange }:
  { label: string; required?: boolean; placeholder?: string; value: string; onChange: (v: string) => void }) => (
  <div>
    <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}{required && " *"}</Label>
    <Input required={required} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="mt-2" />
  </div>
);

const TextField = ({ label, required, value, onChange }:
  { label: string; required?: boolean; value: string; onChange: (v: string) => void }) => (
  <div className="md:col-span-2">
    <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}{required && " *"}</Label>
    <Textarea required={required} rows={3} value={value} onChange={(e) => onChange(e.target.value)} className="mt-2" />
  </div>
);

// ponytail: card mirrors Behoerde/Sentinel ward styling.
