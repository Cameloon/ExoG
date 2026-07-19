import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, CheckCircle2, FileCheck2, MailCheck, Pencil, RefreshCw, ShieldCheck, Upload, X } from "lucide-react";
import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { EXTERNAL_CONFIG } from "@/config/external";
import { useAuth } from "@/hooks/useAuth";
import { RegionSelect } from "@/components/RegionSelect";
import { BUNDESLAENDER } from "@/lib/germanRegions";
import { HABITAT_CATEGORIES, parseCapacity, totalCapacity } from "@/lib/habitats";

const schema = z.object({
  fullName: z.string().trim().min(2, "Bitte vollständigen Namen angeben").max(120),
  email: z.string().trim().email("Ungültige E-Mail").max(255),
  region: z.string().trim().min(2, "Region/Bundesland angeben").max(80),
  yearsKeeping: z.coerce.number().min(0, "Ungültig").max(80),
  species: z.string().trim().min(3, "Bitte mindestens eine Spezies/Gruppe nennen").max(500),
  capacity: z.string().trim().min(1, "Kapazität angeben").max(500),
  quarantine: z.enum(["yes", "partial", "no"], { errorMap: () => ({ message: "Bitte auswählen" }) }),
  vetContact: z.string().trim().min(2, "Tierarztkontakt erforderlich").max(200),
  motivation: z.string().trim().min(40, "Bitte mindestens 40 Zeichen.").max(2000),
  p_noTrade: z.literal(true, { errorMap: () => ({ message: "Erforderlich" }) }),
  p_temporary: z.literal(true, { errorMap: () => ({ message: "Erforderlich" }) }),
  p_animalFirst: z.literal(true, { errorMap: () => ({ message: "Erforderlich" }) }),
  p_transparency: z.literal(true, { errorMap: () => ({ message: "Erforderlich" }) }),
  p_handover: z.literal(true, { errorMap: () => ({ message: "Erforderlich" }) }),
  p_truthful: z.literal(true, { errorMap: () => ({ message: "Erforderlich" }) }),
  selfPledge: z.literal(true, {
    errorMap: () => ({ message: "Ohne Selbstverpflichtung keine Einreichung." }),
  }),
});

type FormState = {
  fullName: string; email: string; region: string;
  yearsKeeping: string; species: string; capacity: string;
  quarantine: "yes" | "partial" | "no" | ""; vetContact: string;
  motivation: string;
  p_noTrade: boolean; p_temporary: boolean; p_animalFirst: boolean;
  p_transparency: boolean; p_handover: boolean; p_truthful: boolean;
  selfPledge: boolean;
};

const initial: FormState = {
  fullName: "", email: "", region: "",
  yearsKeeping: "", species: "", capacity: "",
  quarantine: "", vetContact: "", motivation: "",
  p_noTrade: false, p_temporary: false, p_animalFirst: false,
  p_transparency: false, p_handover: false, p_truthful: false,
  selfPledge: false,
};

const steps = [
  { id: 1, label: "Identität" },
  { id: 2, label: "Erfahrung & Kapazität" },
  { id: 3, label: "Haltung" },
  { id: 4, label: "KYC · Dokumente" },
  { id: 5, label: "Pledge" },
  { id: 6, label: "Prüfen & Einreichen" },
] as const;

const PLEDGES: { key: keyof FormState; text: string }[] = [
  { key: "p_noTrade", text: "Ich erwerbe keine neuen Tiere — außer für legitime Pflege/Beschlagnahme-Platzierungen." },
  { key: "p_temporary", text: "Ich akzeptiere, dass Pflege grundsätzlich temporär gedacht ist." },
  { key: "p_animalFirst", text: "Das Wohl des Tieres steht über meinem persönlichen Interesse." },
  { key: "p_transparency", text: "Ich dokumentiere Verläufe transparent — auch Misserfolge." },
  { key: "p_handover", text: "Ich übergebe Tiere an besser geeignete Stellen, wenn das Netzwerk dies entscheidet." },
  { key: "p_truthful", text: "Meine Angaben sind wahrheitsgemäß. Falsche Angaben führen zum Ausschluss." },
];

const fieldsByStep: Record<number, (keyof FormState)[]> = {
  1: ["fullName", "email", "region"],
  2: ["yearsKeeping", "species", "capacity", "quarantine", "vetContact"],
  3: ["motivation"],
  4: [],
  5: ["p_noTrade", "p_temporary", "p_animalFirst", "p_transparency", "p_handover", "p_truthful"],
  6: ["selfPledge"],
};

type DocSlot = "id_front" | "id_back" | "facility" | "selfie";

export const SentinelWizard = ({ variant = "embedded" }: { variant?: "embedded" | "fullscreen" }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const { user: clerkUser } = useUser();
  const { getToken } = useClerkAuth();
  const supabase = useExternalSupabase();
  const [resending, setResending] = useState(false);

  const [data, setData] = useState<FormState>(initial);
  const [regState, setRegState] = useState(BUNDESLAENDER.find((s) => initial.region.endsWith(s)) ?? "");
  const [regDistrict, setRegDistrict] = useState(regState ? initial.region.replace(`, ${regState}`, "") : initial.region);
  const [capMap, setCapMap] = useState(parseCapacity(initial.capacity));
  const [step, setStep] = useState<number>(0);
  const [introAccepted, setIntroAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [caseId, setCaseId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [docs, setDocs] = useState<Record<DocSlot, File | null>>({
    id_front: null, id_back: null, facility: null, selfie: null,
  });
  const [docError, setDocError] = useState<string>("");

  // Redirect target after finishing (where the user came from)
  const after = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  useEffect(() => {
    if (user?.email && !data.email) setData((d) => ({ ...d, email: user.email ?? "" }));
  }, [user, data.email]);

  useEffect(() => {
    if (variant === "fullscreen" && !loading && !user) {
      navigate("/auth", { state: { from: "/sentinel/apply" }, replace: true });
    }
  }, [variant, loading, user, navigate]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const validateStep = (n: number): boolean => {
    if (n === 4) {
      if (!docs.id_front || !docs.id_back || !docs.selfie) { setDocError(t("onboarding.docs.required")); return false; }
      setDocError(""); return true;
    }
    const fields = fieldsByStep[n];
    if (fields.length === 0) return true;
    const partial: Record<string, unknown> = {};
    for (const f of fields) partial[f] = data[f];
    const partialSchema = schema.pick(Object.fromEntries(fields.map((f) => [f, true])) as never);
    const result = partialSchema.safeParse(partial);
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) next[issue.path[0] as string] = issue.message;
      setErrors(next);
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (step === 0) {
      if (!introAccepted) return;
      if (variant === "embedded" && !user) { navigate("/sentinel/apply"); return; }
      setStep(1);
      return;
    }
    if (validateStep(step)) setStep((s) => Math.min(steps.length, s + 1));
  };
  const goBack = () => { if (step === 0) { navigate("/start"); return; } setStep((s) => Math.max(0, s - 1)); };
  const goTo = (n: number) => { if (n < step) setStep(n); };

  const onSubmit = async () => {
    if (!user) return;
    if (!user.emailVerified) {
      toast({ title: t("onboarding.verify.blocked"), description: t("onboarding.verify.blockedDesc"), variant: "destructive" });
      return;
    }
    const full = schema.safeParse({ ...data, yearsKeeping: Number(data.yearsKeeping || 0) });
    if (!full.success) {
      const next: Record<string, string> = {};
      for (const issue of full.error.issues) next[issue.path[0] as string] = issue.message;
      setErrors(next);
      for (const s of steps) {
        const fields = fieldsByStep[s.id];
        if (fields.some((f) => next[f as string])) { setStep(s.id); break; }
      }
      toast({ title: "Bitte alle Felder prüfen", variant: "destructive" });
      return;
    }
    if (!docs.id_front || !docs.id_back || !docs.selfie) { setStep(4); setDocError(t("onboarding.docs.required")); return; }

    setSubmitting(true);
    try {
      const id = `ST-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const { data: app, error: appErr } = await supabase
        .from("sentinel_applications")
        .insert({
          user_id: user.id, case_id: id, full_name: data.fullName, email: data.email,
          region: data.region, experience_years: Number(data.yearsKeeping), species_focus: data.species,
          capacity: data.capacity, motivation: data.motivation, preferred_language: "de",
          pledge_data: {
            quarantine: data.quarantine, vet_contact: data.vetContact,
            commitments: {
              no_trade: data.p_noTrade, temporary: data.p_temporary, animal_first: data.p_animalFirst,
              transparency: data.p_transparency, handover: data.p_handover, truthful: data.p_truthful,
            },
            self_pledge: data.selfPledge, signed_at: new Date().toISOString(),
          },
          kyc_status: "documents_uploaded",
        })
        .select("id, case_id").single();
      if (appErr) throw appErr;

      const clerkToken = await getToken();
      const uploads: { slot: DocSlot; file: File }[] = [];
      if (docs.id_front) uploads.push({ slot: "id_front", file: docs.id_front });
      if (docs.id_back) uploads.push({ slot: "id_back", file: docs.id_back });
      if (docs.selfie) uploads.push({ slot: "selfie", file: docs.selfie });
      if (docs.facility) uploads.push({ slot: "facility", file: docs.facility });

      for (const u of uploads) {
        const res = await fetch(`${EXTERNAL_CONFIG.SUPABASE_URL}/functions/v1/kyc-upload`, {
          method: "POST",
          headers: {
            "Content-Type": u.file.type || "application/octet-stream",
            Authorization: `Bearer ${clerkToken}`,
            "x-application-id": app.id,
            "x-slot": u.slot,
          },
          body: u.file,
        });
        if (!res.ok) {
          const msg = (await res.json().catch(() => ({})))?.error ?? "Upload abgelehnt";
          throw new Error(msg);
        }
        const { path } = (await res.json()) as { path: string };
        await supabase.from("application_documents").insert({
          application_id: app.id, user_id: user.id, doc_type: u.slot,
          storage_path: path, file_name: u.file.name, mime_type: u.file.type, size_bytes: u.file.size,
        });
      }

      try {
        await fetch(`${EXTERNAL_CONFIG.SUPABASE_URL}/functions/v1/send-application-confirmation`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(clerkToken ? { Authorization: `Bearer ${clerkToken}` } : {}) },
          body: JSON.stringify({ email: data.email, fullName: data.fullName, caseId: id, language: "de" }),
        });
      } catch (e) { console.warn("email function failed", e); }

      setCaseId(id);
      setDone(true);
      toast({ title: "Bewerbung eingereicht", description: t("onboarding.confirmEmail", { email: data.email }) });
    } catch (e) {
      console.error("onboarding submit failed", (e as Error)?.message);
      toast({ title: "Fehler beim Einreichen", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const progress = useMemo(() => Math.round(((step - 1) / steps.length) * 100), [step]);

  if (loading || (variant === "fullscreen" && !user)) {
    return (
      <div className={variant === "fullscreen" ? "flex min-h-screen items-center justify-center bg-background text-muted-foreground" : ""}>
        {loading && <div className="container py-24 text-center text-muted-foreground">…</div>}
      </div>
    );
  }

  if (done) {
    return (
      <div className={variant === "fullscreen" ? "flex min-h-screen items-center justify-center bg-background" : "border-t border-border bg-background"}>
        <div className="container max-w-2xl py-24 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
          <h2 className="font-editorial mt-6 text-4xl leading-tight">Eingegangen. <em className="italic text-primary">Danke.</em></h2>
          <p className="mt-4 text-muted-foreground">Deine Bewerbung wurde verschlüsselt übermittelt. Eine Prüfer:in meldet sich innerhalb von 5 Werktagen.</p>
          <p className="mt-3 text-sm text-muted-foreground">{t("onboarding.confirmEmail", { email: data.email })}</p>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Vorgangs-ID · {caseId}</p>
          <Button asChild className="mt-8"><a href={after}>Zurück zur Startseite</a></Button>
        </div>
      </div>
    );
  }

  const shell = (children: React.ReactNode) => {
    if (variant === "fullscreen") {
      return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <button onClick={goBack} className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground">
              {step === 0 ? "Abbrechen" : "← Zurück"}
            </button>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Sentinel-Aufnahme</span>
            <span className="w-16 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{progress}%</span>
          </header>
          <div className="flex flex-1 items-start justify-center px-5 py-10">
            <div className="w-full max-w-xl">
              {step > 0 && (
                <div className="mb-8">
                  <Stepper step={step} onJump={goTo} />
                  <div className="mt-3 h-px w-full bg-border">
                    <div className="h-px bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
              {children}
            </div>
          </div>
        </div>
      );
    }
    return (
      <section id="onboarding" className="border-t border-border bg-background">
        <div className="container max-w-3xl py-20 lg:py-28">
          <span className="eyebrow">§ Bewerbung</span>
          <h2 className="font-editorial mt-4 text-4xl leading-[1.05] md:text-5xl">Sentinel-<em className="italic text-primary">Aufnahme.</em></h2>
          <p className="mt-4 text-muted-foreground">Sechs Schritte. Identitätsprüfung und Pledge eingeschlossen.</p>
          {step > 0 && (
            <>
              <Stepper step={step} onJump={goTo} />
              <div className="mt-6">
                <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  <span>Schritt {step} / {steps.length} · {steps[step - 1].label}</span>
                  <span>{progress}%</span>
                </div>
                <div className="mt-2 h-px w-full bg-border">
                  <div className="h-px bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </>
          )}
          {children}
        </div>
      </section>
    );
  };

  return shell(
    <>
      <div key={step} className="step-swipe border border-border bg-surface p-6 md:p-10">
        {step === 0 && (
          <div className="space-y-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Was dich erwartet</p>
            <h1 className="font-editorial text-3xl leading-tight md:text-4xl">Willkommen zur Sentinel-Aufnahme</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Dies ist der Abschluss deiner Anmeldung. Wir prüfen Identität,
              Haltungserfahrung und Verpflichtung, bevor du als Sentinel im
              Custody-Netzwerk aufnimmst. Sechs Schritte: Identität, Erfahrung,
              Motivation, Identitätsnachweis (KYC), Selbstverpflichtung, Prüfen.
            </p>
            {user && (
              <VerifyEmailBanner
                email={user.email} verified={user.emailVerified} resending={resending}
                onResend={async () => {
                  if (!clerkUser) return;
                  setResending(true);
                  try {
                    const primary = clerkUser.primaryEmailAddress;
                    if (!primary) throw new Error("Keine primäre E-Mail.");
                    await primary.prepareVerification({ strategy: "email_link", redirectUrl: `${window.location.origin}/sentinel/apply` });
                    toast({ title: t("onboarding.verify.sent"), description: user.email ?? "" });
                  } catch (e) {
                  toast({ title: t("onboarding.verify.sendFailed"), description: (e as Error).message, variant: "destructive" });
                } finally { setResending(false); }
              }}
              onRefresh={async () => { await clerkUser?.reload(); toast({ title: t("onboarding.verify.refreshed") }); }}
            />
            )}
            <label className="flex cursor-pointer items-start gap-3 border border-border bg-background p-4 text-sm text-foreground/85">
              <Checkbox checked={introAccepted} onCheckedChange={(v) => setIntroAccepted(Boolean(v))} className="mt-0.5" />
              <span>Ich habe den Ablauf gelesen und möchte mit der Sentinel-Aufnahme beginnen.</span>
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <StepHeading n={1} label="Identität" />
            <Field label="Vollständiger Name" error={errors.fullName}>
              <Input value={data.fullName} onChange={(e) => update("fullName", e.target.value)} maxLength={120} placeholder="Vor- und Nachname" />
            </Field>
            <Field label="E-Mail" error={errors.email}>
              <Input type="email" value={data.email} onChange={(e) => update("email", e.target.value)} maxLength={255} />
            </Field>
            <RegionSelect
              state={regState}
              district={regDistrict}
              onState={(v) => { setRegState(v); update("region", regDistrict ? `${regDistrict}, ${v}` : v); }}
              onDistrict={(v) => { setRegDistrict(v); update("region", v ? `${v}, ${regState}` : regState); }}
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <StepHeading n={2} label="Erfahrung & Kapazität" />
            <Field label="Jahre aktiver Haltung" error={errors.yearsKeeping}>
              <Input type="number" min={0} max={80} value={data.yearsKeeping} onChange={(e) => update("yearsKeeping", e.target.value)} />
            </Field>
            <Field label="Spezies / Gruppen" error={errors.species} hint="z.B. Varanidae, Crotalinae, Theraphosidae">
              <Textarea rows={3} value={data.species} onChange={(e) => update("species", e.target.value)} maxLength={500} />
            </Field>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Verfügbare Kapazität je Lebensraum</p>
              <p className="mt-1 text-xs text-muted-foreground">Wie viele Plätze hast du je Kategorie?</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {HABITAT_CATEGORIES.map((h) => (
                  <div key={h.key} className="border border-border bg-background p-3">
                    <Label className="text-xs text-muted-foreground">{h.label}</Label>
                    <Input
                      type="number" min={0} max={999}
                      value={capMap[h.key] ?? 0}
                      onChange={(e) => {
                        const next = { ...capMap, [h.key]: Math.max(0, Number(e.target.value) || 0) };
                        setCapMap(next);
                        update("capacity", JSON.stringify(next));
                      }}
                      className="mt-2"
                    />
                  </div>
                ))}
              </div>
            </div>
            <Field label="Separate Quarantäneeinheit" error={errors.quarantine}>
              <div className="grid grid-cols-3 gap-2">
                {([["yes", "Ja"], ["partial", "Teilweise"], ["no", "Nein"]] as const).map(([val, lbl]) => (
                  <button type="button" key={val} onClick={() => update("quarantine", val)}
                    className={`border px-3 py-3 text-xs uppercase tracking-wider transition-colors ${data.quarantine === val ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/50"}`}>
                    {lbl}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Behandelnde:r Tierärzt:in" error={errors.vetContact}>
              <Input value={data.vetContact} onChange={(e) => update("vetContact", e.target.value)} maxLength={200} />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <StepHeading n={3} label="Haltung" />
            <Field label="Warum willst du Sentinel werden?" error={errors.motivation}>
              <Textarea rows={8} value={data.motivation} onChange={(e) => update("motivation", e.target.value)} maxLength={2000} />
              <p className="mt-1 text-right font-mono text-[10px] text-muted-foreground">{data.motivation.length} / 2000</p>
            </Field>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <StepHeading n={4} label="KYC · Dokumente" />
            <div className="border border-border bg-background p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">{t("onboarding.docs.title")}</p>
              <p className="mt-3 text-sm text-muted-foreground">{t("onboarding.docs.hint")}</p>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <FileSlot label={t("onboarding.docs.idFront")} file={docs.id_front} onChange={(f) => setDocs((d) => ({ ...d, id_front: f }))} />
                <FileSlot label={t("onboarding.docs.idBack")} file={docs.id_back} onChange={(f) => setDocs((d) => ({ ...d, id_back: f }))} />
                <FileSlot label={t("onboarding.docs.selfie")} file={docs.selfie} onChange={(f) => setDocs((d) => ({ ...d, selfie: f }))} />
                <FileSlot label={t("onboarding.docs.facility")} file={docs.facility} onChange={(f) => setDocs((d) => ({ ...d, facility: f }))} optional />
              </div>
              {docError && <p className="mt-4 text-xs text-destructive">{docError}</p>}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <StepHeading n={5} label="Pledge" />
            <div className="border border-border bg-background p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Sentinel-Selbstverpflichtung</p>
              <div className="mt-6 space-y-4">
                {PLEDGES.map((p) => (
                  <CheckboxRow key={p.key as string} checked={Boolean(data[p.key])} onChange={(v) => update(p.key, v as never)} error={errors[p.key as string]} label={p.text} />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-8">
            <StepHeading n={6} label="Prüfen & Einreichen" />
            <ReviewBlock title="Identität" onEdit={() => setStep(1)} rows={[["Name", data.fullName], ["E-Mail", data.email], ["Region", data.region]]} />
            <ReviewBlock title="Erfahrung & Kapazität" onEdit={() => setStep(2)} rows={[
              ["Jahre", data.yearsKeeping],
              ["Spezies", data.species],
              ...HABITAT_CATEGORIES.map((h) => [h.label, String(capMap[h.key] ?? 0)] as [string, string]),
              ["Gesamtplätze", String(totalCapacity(capMap))],
              ["Quarantäne", data.quarantine || "—"],
              ["Tierarzt", data.vetContact],
            ]} />
            <ReviewBlock title="Motivation" onEdit={() => setStep(3)} rows={[["Text", data.motivation]]} />
            <ReviewBlock title="KYC" onEdit={() => setStep(4)} rows={[["Ausweis vorne", docs.id_front?.name ?? "—"], ["Ausweis hinten", docs.id_back?.name ?? "—"], ["Gesichtsbild", docs.selfie?.name ?? "—"], ["Anlage", docs.facility?.name ?? "—"]]} />
            <ReviewBlock title="Pledge" onEdit={() => setStep(5)} rows={PLEDGES.map((p) => [p.text, data[p.key] ? "✓" : "—"])} />
            <div className="border border-primary/40 bg-primary/[0.04] p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Ausdrückliche Selbstverpflichtung</p>
                  <p className="mt-2 text-sm text-foreground/85">Mit dem Einreichen verpflichte ich mich öffentlich gegenüber dem Sentinel-Netzwerk.</p>
                </div>
              </div>
              <div className="mt-5">
                <CheckboxRow checked={data.selfPledge} onChange={(v) => update("selfPledge", v)} error={errors.selfPledge} label="Ich bestätige diese Selbstverpflichtung ausdrücklich." />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={goBack}>
          {step === 0 ? "Abbrechen" : <><ArrowLeft className="mr-2 h-4 w-4" /> Zurück</>}
        </Button>
        {step < steps.length ? (
          <Button type="button" onClick={goNext} disabled={step === 0 && !introAccepted}>
            Weiter <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" onClick={onSubmit} disabled={!data.selfPledge || submitting || !user.emailVerified}>
            {submitting ? t("onboarding.submitting") : !user.emailVerified ? t("onboarding.verify.cta") : "Bewerbung einreichen"}
          </Button>
        )}
      </div>
    </>,
  );
};

const StepHeading = ({ n, label }: { n: number; label: string }) => (
  <div>
    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Schritt {n} / 6</p>
    <h2 className="font-editorial mt-2 text-3xl leading-tight">{label}</h2>
  </div>
);

const Stepper = ({ step, onJump }: { step: number; onJump: (n: number) => void }) => (
  <ol className="grid grid-cols-3 gap-2 md:grid-cols-6">
    {steps.map((s) => {
      const state = s.id < step ? "done" : s.id === step ? "active" : "todo";
      return (
        <li key={s.id}>
          <button type="button" onClick={() => onJump(s.id)} disabled={s.id > step}
            className={`flex w-full flex-col items-start gap-2 border-l-2 px-3 py-2 text-left transition-colors ${state === "active" ? "border-primary" : state === "done" ? "border-primary/60 hover:bg-surface" : "border-border opacity-60"} ${s.id <= step ? "cursor-pointer" : "cursor-not-allowed"}`}>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{String(s.id).padStart(2, "0")}</span>
            <span className={`text-sm ${state === "active" ? "text-foreground" : state === "done" ? "text-foreground/80" : "text-muted-foreground"}`}>{s.label}</span>
          </button>
        </li>
      );
    })}
  </ol>
);

const ReviewBlock = ({ title, rows, onEdit }: { title: string; rows: [string, string][]; onEdit: () => void }) => (
  <div className="border border-border bg-background">
    <div className="flex items-center justify-between border-b border-border px-5 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
      <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-primary hover:underline"><Pencil className="h-3 w-3" /> Bearbeiten</button>
    </div>
    <dl className="divide-y divide-border">
      {rows.map(([k, v], i) => (
        <div key={i} className="grid grid-cols-3 gap-4 px-5 py-3 text-sm md:grid-cols-4">
          <dt className="col-span-1 text-muted-foreground">{k}</dt>
          <dd className="col-span-2 whitespace-pre-wrap text-foreground/90 md:col-span-3">{v || <span className="text-muted-foreground">—</span>}</dd>
        </div>
      ))}
    </dl>
  </div>
);

const Field = ({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) => (
  <div>
    <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</Label>
    <div className="mt-2">{children}</div>
    {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
  </div>
);

const CheckboxRow = ({ checked, onChange, label, error }: { checked: boolean; onChange: (v: boolean) => void; label: string; error?: string }) => (
  <div>
    <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground/85">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} className="mt-0.5" />
      <span>{label}</span>
    </label>
    {error && <p className="ml-7 mt-1 text-xs text-destructive">{error}</p>}
  </div>
);

const MAX_KYC_BYTES = 10 * 1024 * 1024;
const FileSlot = ({ label, file, onChange, optional }: { label: string; file: File | null; onChange: (f: File | null) => void; optional?: boolean }) => {
  const inputId = `file-${label.replace(/\s+/g, "-")}`;
  const pick = (f: File | null) => {
    if (f && f.size > MAX_KYC_BYTES) {
      toast({ title: "Datei zu groß", description: "Maximal 10 MB pro Datei.", variant: "destructive" });
      return;
    }
    onChange(f);
  };
  return (
    <div className="border border-border bg-surface p-4">
      <Label htmlFor={inputId} className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label} {optional && <span className="text-muted-foreground/60">(optional)</span>}</Label>
      <label htmlFor={inputId} className={`mt-3 flex h-28 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed text-xs transition-colors ${file ? "border-primary/60 bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"}`}>
        {file ? <FileCheck2 className="h-5 w-5 text-primary" /> : <Upload className="h-5 w-5" />}
        <span className="px-2 text-center">{file ? file.name : "Klicken zum Hochladen"}</span>
      </label>
      <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
    </div>
  );
};

const VerifyEmailBanner = ({ email, verified, resending, onResend, onRefresh }:
  { email: string | null; verified: boolean; resending: boolean; onResend: () => void | Promise<void>; onRefresh: () => void | Promise<void>; }) => {
  if (verified) {
    return (
      <div className="flex items-center gap-3 border border-primary/30 bg-primary/[0.04] px-4 py-3">
        <MailCheck className="h-4 w-4 shrink-0 text-primary" />
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">E-Mail verifiziert · {email}</p>
      </div>
    );
  }
  return (
    <div className="border border-destructive/40 bg-destructive/[0.05] p-5">
      <div className="flex items-start gap-3">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-destructive">E-Mail-Verifizierung erforderlich</p>
          <p className="mt-2 text-sm text-foreground/85">Bestätige bitte deine E-Mail-Adresse{email ? <> <span className="font-mono">{email}</span></> : null}.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onResend} disabled={resending}>{resending ? "…" : "Verifizierungs-Mail senden"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={onRefresh}><RefreshCw className="mr-2 h-3 w-3" /> Status prüfen</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
