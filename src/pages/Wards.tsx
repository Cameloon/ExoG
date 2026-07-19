import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { safeExtension } from "@/lib/uploads";
import { ShieldCheck, Lock, AlertTriangle, Plus, X, ImagePlus } from "lucide-react";

type Ward = {
  id: string;
  owner_id: string;
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

type AccessState =
  | { kind: "loading" }
  | { kind: "anon" }
  | { kind: "no_application" }
  | { kind: "pending" }
  | { kind: "rejected" }
  | { kind: "approved" };

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
  case_code: "",
  common_name: "",
  scientific_name: "",
  sex: "",
  age_estimate: "",
  size_estimate: "",
  region: "",
  urgency: "standard",
  origin_context: "",
  background: "",
  care_requirements: "",
  space_requirements: "",
};

const urgencyTone: Record<string, string> = {
  standard: "bg-muted text-muted-foreground",
  urgent: "bg-primary/15 text-primary",
  critical: "bg-destructive/15 text-destructive",
};

const statusLabel: Record<Ward["status"], string> = {
  available: "Verfügbar",
  under_review: "In Prüfung",
  placed: "Vermittelt",
  withdrawn: "Zurückgezogen",
};

const Wards = () => {
  const { user, isAdmin, isEinrichtung, loading: authLoading } = useAuth();
  const supabase = useExternalSupabase();
  const storage = supabase.storage;
  const { toast } = useToast();
  const [myShelterId, setMyShelterId] = useState<string | null>(null);
  const [access, setAccess] = useState<AccessState>({ kind: "loading" });
  const [wards, setWards] = useState<Ward[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [interestOpen, setInterestOpen] = useState<string | null>(null);
  const [interestMessage, setInterestMessage] = useState("");
  const [myInterests, setMyInterests] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<FormState>(emptyForm);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [carriedImages, setCarriedImages] = useState<string[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const myWards = useMemo(
    () => wards.filter((w) => user && w.owner_id === user.id),
    [wards, user],
  );

  useEffect(() => {
    document.title = "Wards · BioSteward";
  }, []);

  useEffect(() => {
    if (!isEinrichtung || !user) {
      setMyShelterId(null);
      return;
    }
    supabase
      .from("shelters")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle()
      .then(({ data }) => setMyShelterId((data as { id: string } | null)?.id ?? null));
  }, [isEinrichtung, user, supabase]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setAccess({ kind: "anon" }); return; }
    if (isAdmin || isEinrichtung) { setAccess({ kind: "approved" }); return; }
    supabase
      .from("sentinel_applications")
      .select("status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return setAccess({ kind: "no_application" });
        if (data.status === "approved") return setAccess({ kind: "approved" });
        if (data.status === "rejected") return setAccess({ kind: "rejected" });
        return setAccess({ kind: "pending" });
      });
  }, [user, isAdmin, isEinrichtung, authLoading, supabase]);

  useEffect(() => {
    if (access.kind !== "approved" || !user) return;
    void loadWards();
    void loadMyInterests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access.kind, user?.id]);

  // Sign URLs whenever ward image paths change
  useEffect(() => {
    const allPaths = Array.from(new Set(wards.flatMap((w) => w.images ?? [])));
    const missing = allPaths.filter((p) => !signedUrls[p]);
    if (missing.length === 0) return;
    void (async () => {
      const { data, error } = await storage
        .from("ward-images")
        .createSignedUrls(missing, 60 * 60);
      if (error || !data) return;
      const next: Record<string, string> = {};
      data.forEach((d, i) => {
        if (d.signedUrl) next[missing[i]] = d.signedUrl;
      });
      setSignedUrls((prev) => ({ ...prev, ...next }));
    })();
  }, [wards, signedUrls, storage]);

  const loadWards = async () => {
    const { data, error } = await supabase
      .from("ward_listings")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Fehler beim Laden", description: error.message, variant: "destructive" });
      return;
    }
    setWards((data ?? []) as Ward[]);
  };

  const loadMyInterests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("ward_interest")
      .select("ward_id")
      .eq("applicant_id", user.id);
    setMyInterests(new Set((data ?? []).map((r) => r.ward_id)));
  };

  const prefillFromWard = (id: string) => {
    const w = wards.find((x) => x.id === id);
    if (!w) return;
    setForm({
      case_code: w.case_code,
      common_name: w.common_name,
      scientific_name: w.scientific_name ?? "",
      sex: w.sex ?? "",
      age_estimate: w.age_estimate ?? "",
      size_estimate: w.size_estimate ?? "",
      region: w.region ?? "",
      urgency: w.urgency,
      origin_context: w.origin_context ?? "",
      background: w.background,
      care_requirements: w.care_requirements,
      space_requirements: w.space_requirements,
    });
    setCarriedImages(w.images ?? []);
    setPendingImages([]);
    toast({ title: "Daten übernommen", description: `${w.common_name} · ${w.case_code}` });
  };

  const resetForm = () => {
    setForm(emptyForm);
    setPendingImages([]);
    setCarriedImages([]);
  };

  const submitWard = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    // Upload new images first
    const uploadedPaths: string[] = [];
    for (const file of pendingImages) {
      const ext = safeExtension(file);
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("ward-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        setSubmitting(false);
        toast({ title: "Bild-Upload fehlgeschlagen", description: upErr.message, variant: "destructive" });
        return;
      }
      uploadedPaths.push(path);
    }

    const payload = {
      owner_id: user.id,
      shelter_id: isEinrichtung ? myShelterId : null,
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
      toast({ title: "Konnte nicht speichern", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Ward eingestellt", description: "Sichtbar nur für vetted Stewards." });
    setShowForm(false);
    resetForm();
    void loadWards();
  };

  const submitInterest = async (wardId: string) => {
    if (!user || !interestMessage.trim()) return;
    const { error } = await supabase.from("ward_interest").insert({
      ward_id: wardId,
      applicant_id: user.id,
      message: interestMessage.trim(),
    });
    if (error) {
      toast({ title: "Bekundung fehlgeschlagen", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Interesse eingereicht", description: "Der zuständige Sentinel wird benachrichtigt." });
    setInterestOpen(null);
    setInterestMessage("");
    void loadMyInterests();
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container py-16 lg:py-24">
        <div className="max-w-3xl">
          <span className="eyebrow">§ Wards · Vetted Disclosure</span>
          <h1 className="font-editorial mt-4 text-5xl leading-[1.02] md:text-6xl">
            Tiere, die einen <em className="italic text-primary">Steward</em> brauchen.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            Dies ist <strong className="text-foreground">kein Marktplatz</strong>, keine öffentliche Anzeige
            und keine Vermittlungsbörse. Tierprofile werden ausschließlich an
            geprüfte, qualifizierte Privathalter offengelegt — nach
            Sentinel-Prüfung, Sachkundenachweis und Platzbewertung. Vergabe vor Zoo,
            wo immer fachlich vertretbar.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <span className="border border-border px-3 py-1.5">Vetted-Only</span>
            <span className="border border-border px-3 py-1.5">Kein Handel</span>
            <span className="border border-border px-3 py-1.5">Kein Status</span>
            <span className="border border-border px-3 py-1.5">Reversibel</span>
          </div>
        </div>

        <div className="mt-16">
          {access.kind === "loading" && (
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Prüfe Zugang …
            </p>
          )}

          {access.kind === "anon" && (
            <Gate
              icon={Lock}
              title="Anmeldung erforderlich"
              body="Ward-Profile sind grundsätzlich nicht öffentlich. Melde dich an, um deine Eignung als qualifizierter Privathalter prüfen zu lassen."
              cta={{ label: "Anmelden / Registrieren", to: "/auth" }}
            />
          )}

          {access.kind === "no_application" && (
            <Gate
              icon={ShieldCheck}
              title="Sentinel-Pfad starten"
              body="Wards werden nur an geprüfte Stewards vergeben. Reiche zuerst einen Sentinel-Antrag mit Sachkundenachweis und Platzbewertung ein."
              cta={{ label: "Sentinel-Pfad starten", to: "/sentinel" }}
            />
          )}

          {access.kind === "pending" && (
            <Gate
              icon={ShieldCheck}
              title="Antrag in Prüfung"
              body="Dein Sentinel-Antrag wird noch geprüft. Sobald freigegeben, wird dieser Bereich automatisch sichtbar."
            />
          )}

          {access.kind === "rejected" && (
            <Gate
              icon={AlertTriangle}
              title="Kein Zugang"
              body="Auf Basis deines aktuellen Antrags konnte kein Steward-Status vergeben werden. Du kannst dich bei geänderten Voraussetzungen erneut bewerben."
              cta={{ label: "Werte & FAQ", to: "/werte" }}
            />
          )}

          {access.kind === "approved" && (
            <ApprovedView
              wards={wards}
              myWards={myWards}
              currentUserId={user!.id}
              isAdmin={isAdmin}
              myInterests={myInterests}
              showForm={showForm}
              setShowForm={(v) => { setShowForm(v); if (!v) resetForm(); }}
              submitting={submitting}
              submitWard={submitWard}
              form={form}
              setForm={setForm}
              pendingImages={pendingImages}
              setPendingImages={setPendingImages}
              carriedImages={carriedImages}
              setCarriedImages={setCarriedImages}
              prefillFromWard={prefillFromWard}
              resetForm={resetForm}
              signedUrls={signedUrls}
              interestOpen={interestOpen}
              setInterestOpen={setInterestOpen}
              interestMessage={interestMessage}
              setInterestMessage={setInterestMessage}
              submitInterest={submitInterest}
            />
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

const Gate = ({
  icon: Icon,
  title,
  body,
  cta,
}: {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
  cta?: { label: string; to: string };
}) => (
  <div className="border border-border bg-surface p-10">
    <div className="flex items-start gap-5">
      <Icon className="h-6 w-6 shrink-0 text-primary" />
      <div className="max-w-xl">
        <h2 className="font-display text-2xl">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
        {cta && (
          <Button asChild className="mt-6">
            <Link to={cta.to}>{cta.label}</Link>
          </Button>
        )}
      </div>
    </div>
  </div>
);

type ApprovedViewProps = {
  wards: Ward[];
  myWards: Ward[];
  currentUserId: string;
  isAdmin: boolean;
  myInterests: Set<string>;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  submitting: boolean;
  submitWard: (e: React.FormEvent<HTMLFormElement>) => void;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  pendingImages: File[];
  setPendingImages: React.Dispatch<React.SetStateAction<File[]>>;
  carriedImages: string[];
  setCarriedImages: React.Dispatch<React.SetStateAction<string[]>>;
  prefillFromWard: (id: string) => void;
  resetForm: () => void;
  signedUrls: Record<string, string>;
  interestOpen: string | null;
  setInterestOpen: (v: string | null) => void;
  interestMessage: string;
  setInterestMessage: (v: string) => void;
  submitInterest: (id: string) => void;
};

const ApprovedView = ({
  wards, myWards, currentUserId, isAdmin, myInterests,
  showForm, setShowForm, submitting, submitWard,
  form, setForm, pendingImages, setPendingImages, carriedImages, setCarriedImages,
  prefillFromWard, resetForm, signedUrls,
  interestOpen, setInterestOpen, interestMessage, setInterestMessage, submitInterest,
}: ApprovedViewProps) => {
  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setPendingImages((p) => [...p, ...files]);
    e.target.value = "";
  };

  return (
    <>
      <div className="flex items-end justify-between border-b border-border pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
            Steward-Zugang aktiv
          </p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {wards.length} {wards.length === 1 ? "Ward" : "Wards"} · vertraulich
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
          <Plus className="mr-1 h-4 w-4" />
          {showForm ? "Abbrechen" : "Ward einstellen"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={submitWard} className="mt-8 grid gap-5 border border-border bg-surface p-8 md:grid-cols-2">
          {myWards.length > 0 && (
            <div className="md:col-span-2 border border-dashed border-border bg-background p-5">
              <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Aus eigenen Wards übernehmen
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Wähle einen deiner bestehenden Wards — Felder & Bilder werden automatisch übernommen.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {myWards.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => prefillFromWard(w.id)}
                    className="border border-border px-3 py-2 text-left text-xs hover:border-primary hover:bg-primary/5 transition"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {w.case_code}
                    </span>
                    <span className="block text-foreground">{w.common_name}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={resetForm}
                  className="border border-border px-3 py-2 text-xs text-muted-foreground hover:border-destructive hover:text-destructive transition"
                >
                  Felder leeren
                </button>
              </div>
            </div>
          )}

          <Field label="Case-Code" required value={form.case_code} onChange={(v) => update("case_code", v)} placeholder="WARD-2026-001" />
          <Field label="Bezeichnung" required value={form.common_name} onChange={(v) => update("common_name", v)} placeholder="Bartagame, weiblich" />
          <Field label="Wiss. Name" value={form.scientific_name} onChange={(v) => update("scientific_name", v)} placeholder="Pogona vitticeps" />
          <Field label="Geschlecht" value={form.sex} onChange={(v) => update("sex", v)} placeholder="weiblich / männlich / unbekannt" />
          <Field label="Alter (geschätzt)" value={form.age_estimate} onChange={(v) => update("age_estimate", v)} placeholder="ca. 6 Jahre" />
          <Field label="Größe / Gewicht" value={form.size_estimate} onChange={(v) => update("size_estimate", v)} placeholder="48 cm / 420 g" />
          <Field label="Standortregion" value={form.region} onChange={(v) => update("region", v)} placeholder="DE-Süd, AT, …" />

          <div>
            <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Dringlichkeit
            </Label>
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
            <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Bilder (vetted-only sichtbar)
            </Label>
            <div className="mt-3 flex flex-wrap gap-3">
              {carriedImages.map((path) => (
                <div key={path} className="relative h-24 w-24 overflow-hidden border border-border bg-background">
                  {signedUrls[path]
                    ? <img src={signedUrls[path]} alt="" className="h-full w-full object-cover" />
                    : <div className="h-full w-full animate-pulse bg-muted" />}
                  <button
                    type="button"
                    onClick={() => setCarriedImages((p) => p.filter((x) => x !== path))}
                    className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground hover:bg-destructive hover:text-destructive-foreground"
                    aria-label="Bild entfernen"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {pendingImages.map((file, i) => (
                <div key={i} className="relative h-24 w-24 overflow-hidden border border-primary/40 bg-background">
                  <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPendingImages((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground hover:bg-destructive hover:text-destructive-foreground"
                    aria-label="Bild entfernen"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <span className="absolute bottom-1 left-1 bg-primary px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary-foreground">
                    Neu
                  </span>
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
              {submitting ? "Wird eingestellt …" : "Vetted-Only einstellen"}
            </Button>
          </div>
        </form>
      )}

      <div className="mt-10 grid gap-px bg-border md:grid-cols-2">
        {wards.length === 0 && (
          <div className="bg-background p-10 text-sm text-muted-foreground md:col-span-2">
            Aktuell sind keine Wards offen.
          </div>
        )}
        {wards.map((w) => {
          const owned = w.owner_id === currentUserId;
          const expressed = myInterests.has(w.id);
          const cover = (w.images ?? [])[0];
          return (
            <article key={w.id} className="bg-background p-8">
              {cover && (
                <div className="mb-5 aspect-[16/10] w-full overflow-hidden border border-border bg-muted">
                  {signedUrls[cover]
                    ? <img src={signedUrls[cover]} alt={w.common_name} className="h-full w-full object-cover" />
                    : <div className="h-full w-full animate-pulse bg-muted" />}
                </div>
              )}
              {(w.images?.length ?? 0) > 1 && (
                <div className="mb-5 flex flex-wrap gap-2">
                  {w.images.slice(1, 5).map((p) => (
                    <div key={p} className="h-14 w-14 overflow-hidden border border-border bg-muted">
                      {signedUrls[p] && <img src={signedUrls[p]} alt="" className="h-full w-full object-cover" />}
                    </div>
                  ))}
                  {w.images.length > 5 && (
                    <div className="flex h-14 w-14 items-center justify-center border border-border font-mono text-[10px] text-muted-foreground">
                      +{w.images.length - 5}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    {w.case_code} · {statusLabel[w.status]}
                  </p>
                  <h3 className="font-display mt-3 text-2xl leading-tight">{w.common_name}</h3>
                  {w.scientific_name && (
                    <p className="mt-1 text-xs italic text-muted-foreground">{w.scientific_name}</p>
                  )}
                </div>
                <Badge className={urgencyTone[w.urgency] ?? urgencyTone.standard}>
                  {w.urgency}
                </Badge>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                {w.sex && <Meta label="Geschl." value={w.sex} />}
                {w.age_estimate && <Meta label="Alter" value={w.age_estimate} />}
                {w.size_estimate && <Meta label="Maße" value={w.size_estimate} />}
                {w.region && <Meta label="Region" value={w.region} />}
              </dl>

              <Section label="Vorgeschichte" body={w.background} />
              <Section label="Pflege" body={w.care_requirements} />
              <Section label="Platz" body={w.space_requirements} />

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5">
                {owned || isAdmin ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                    {owned ? "Du betreust diesen Ward" : "Admin-Sicht"}
                  </span>
                ) : expressed ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    Interesse bekundet · in Prüfung
                  </span>
                ) : w.status === "available" ? (
                  interestOpen === w.id ? (
                    <div className="w-full">
                      <Textarea
                        value={interestMessage}
                        onChange={(e) => setInterestMessage(e.target.value)}
                        placeholder="Erfahrung, Haltungssituation, geplante Unterbringung, Zeitfenster …"
                        rows={4}
                      />
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" onClick={() => submitInterest(w.id)}>Bekundung senden</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setInterestOpen(null); setInterestMessage(""); }}>
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setInterestOpen(w.id)}>
                      Interesse als Steward bekunden
                    </Button>
                  )
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    {statusLabel[w.status]}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
};

const Field = ({
  label, required, placeholder, value, onChange,
}: { label: string; required?: boolean; placeholder?: string; value: string; onChange: (v: string) => void }) => (
  <div>
    <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
      {label}{required && " *"}
    </Label>
    <Input
      required={required}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-2"
    />
  </div>
);

const TextField = ({
  label, required, value, onChange,
}: { label: string; required?: boolean; value: string; onChange: (v: string) => void }) => (
  <div className="md:col-span-2">
    <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
      {label}{required && " *"}
    </Label>
    <Textarea
      required={required}
      rows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-2"
    />
  </div>
);

const Meta = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="font-mono text-[10px] uppercase tracking-[0.22em]">{label}</dt>
    <dd className="mt-1 text-foreground/85">{value}</dd>
  </div>
);

const Section = ({ label, body }: { label: string; body: string }) => (
  <div className="mt-5">
    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
    <p className="mt-2 text-sm leading-relaxed text-foreground/85 whitespace-pre-line">{body}</p>
  </div>
);

export default Wards;
