import { createContext, useContext, useEffect, useId, cloneElement, isValidElement, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { documentPlan, INTAKE_TYPES, knownValue, localDateTime, type DocumentKey } from "@/lib/animal-workflow";
import { documentRequirements, missingRequirements, type Requirement } from "@/lib/documents/requirements";
import { exportIntakeHandover } from "@/lib/documents/intake-handover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileText,
  Download,
  ShieldAlert,
  PackageSearch,
  HeartHandshake,
  FileCheck2,
  Paperclip,
  X,
  Upload,
} from "lucide-react";
import type { CaseRecord, SentinelProfile } from "@/lib/dashboard-data";
import { exportSeizureProtocol } from "@/lib/documents/seizure-protocol";
import { exportFoundAnimalReport } from "@/lib/documents/found-animal";
import {
  exportAdoptionContract,
  evaluateEligibility,
  requiresPermitForCase,
  type AdoptionContractInput,
} from "@/lib/documents/adoption-contract";
import { exportCitesHandover } from "@/lib/documents/cites-handover";
import {
  ATTACHMENT_KIND_LABEL,
  fileToAttachment,
  type Attachment,
  type AttachmentKind,
} from "@/lib/documents/doc-kit";
import { toast } from "@/hooks/use-toast";

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";

const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} kB` : `${(n / 1048576).toFixed(2)} MB`;

function AttachmentsField({
  value,
  onChange,
}: {
  value: Attachment[];
  onChange: (next: Attachment[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingKind, setPendingKind] = useState<AttachmentKind>("vet-attest");

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const accepted: Attachment[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX_ATTACHMENT_BYTES) {
        toast({
          title: "Anhang zu groß",
          description: `${f.name} überschreitet ${fmtBytes(MAX_ATTACHMENT_BYTES)}.`,
          variant: "destructive",
        });
        continue;
      }
      try {
        accepted.push(await fileToAttachment(f, pendingKind));
      } catch (e) {
        toast({
          title: "Anhang nicht lesbar",
          description: e instanceof Error ? e.message : f.name,
          variant: "destructive",
        });
      }
    }
    if (accepted.length) onChange([...value, ...accepted]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const updateKind = (idx: number, kind: AttachmentKind) =>
    onChange(value.map((a, i) => (i === idx ? { ...a, kind } : a)));
  const updateNote = (idx: number, note: string) =>
    onChange(value.map((a, i) => (i === idx ? { ...a, note } : a)));
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div className="md:col-span-2">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Anhänge (Atteste, Fotos, Bescheinigungen)
        </label>
        <span className="font-mono text-[10px] text-muted-foreground">
          PDF / PNG / JPEG / WEBP · max {fmtBytes(MAX_ATTACHMENT_BYTES)} pro Datei
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 border border-dashed border-border bg-background/40 p-3">
        <select
          aria-label="Art des Anhangs" value={pendingKind}
          onChange={(e) => setPendingKind(e.target.value as AttachmentKind)}
          className="h-9 border border-border bg-background px-2 font-mono text-xs"
        >
          {(Object.keys(ATTACHMENT_KIND_LABEL) as AttachmentKind[]).map((k) => (
            <option key={k} value={k}>
              {ATTACHMENT_KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-2 h-3.5 w-3.5" />
          Datei(en) hochladen
        </Button>
        <span className="font-mono text-[10px] text-muted-foreground">
          Bilder werden zusätzlich eingebettet · SHA-256 im Manifest.
        </span>
      </div>

      {value.length > 0 && (
        <ul className="mt-2 divide-y divide-border border border-border">
          {value.map((a, i) => (
            <li key={`${a.sha256}-${i}`} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate font-mono text-xs">{a.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {fmtBytes(a.sizeBytes)} · {a.mime}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                  SHA-256 {a.sha256.slice(0, 24)}…
                </div>
                <Input
                  aria-label={`Beschreibung für ${a.name}`} value={a.note ?? ""}
                  onChange={(e) => updateNote(i, e.target.value)}
                  placeholder="Notiz / Beschreibung (optional)"
                  className="mt-2 h-8 border-border bg-background font-mono text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  aria-label={`Art des Anhangs ${a.name}`} value={a.kind}
                  onChange={(e) => updateKind(i, e.target.value as AttachmentKind)}
                  className="h-8 border border-border bg-background px-2 font-mono text-xs"
                >
                  {(Object.keys(ATTACHMENT_KIND_LABEL) as AttachmentKind[]).map((k) => (
                    <option key={k} value={k}>
                      {ATTACHMENT_KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(i)}
                  aria-label="Anhang entfernen"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Props = {
  caseRecord: CaseRecord;
  sentinel: SentinelProfile;
  onDirtyChange?: (dirty: boolean) => void;
};

type DocKey = DocumentKey;
const RequiredFields = createContext<Requirement[]>([]);

const DOC_TYPES: { key: DocKey; label: string; icon: typeof FileText; desc: string }[] = [
  { key: "intake", label: "Aufnahme / Abgabe", icon: HeartHandshake, desc: "Aufnahme und tatsächliche Übergabe bei Abgabe, Übernahme oder ungeklärtem Aufnahmegrund dokumentieren." },
  {
    key: "seizure",
    label: "Sicherstellung",
    icon: ShieldAlert,
    desc: "Beschlagnahmungsprotokoll mit Rechtsgrundlage, Zeugen, Übergabe-Kette.",
  },
  {
    key: "found",
    label: "Fundtier",
    icon: PackageSearch,
    desc: "Fundmeldung & Verwahrungsnachweis nach §§ 965 ff. BGB / TierSchG.",
  },
  {
    key: "adoption",
    label: "Adoption",
    icon: HeartHandshake,
    desc: "Vermittlungsvertrag inkl. Eignungsprüfung und Halterpflichten.",
  },
  {
    key: "cites",
    label: "CITES-Übergabe",
    icon: FileCheck2,
    desc: "Vorhandene Herkunftsnachweise und offene Fragen zur Übergabe festhalten. Erstellt keine amtliche CITES-Bescheinigung.",
  },
];

const labelCls =
  "font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground";
const inputCls = "mt-1 h-9 border-border bg-background font-mono text-sm";
const textareaCls = "mt-1 min-h-[72px] resize-none border-border bg-background font-mono text-sm";

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => {
  const id = useId();
  const rule = useContext(RequiredFields).find((item) => item.label === label);
  return <div className="min-w-0" data-document-field={label} tabIndex={-1}>
    <label htmlFor={id} className={labelCls}>{label}{rule && <span className="ml-2 text-primary">Verpflichtend</span>}</label>
    {isValidElement<{ id?: string; required?: boolean; "aria-required"?: boolean; minLength?: number; min?: number }>(children)
      ? cloneElement(children, { id, required: Boolean(rule), "aria-required": Boolean(rule), minLength: rule?.minLength, min: rule?.min }) : children}
    {rule?.minLength && <p className="mt-1 text-xs text-muted-foreground">Mindestens {rule.minLength} Zeichen.</p>}
  </div>;
};

export const DocumentsHub = ({ caseRecord, sentinel, onDirtyChange }: Props) => {
  const [dirtyDocs, setDirtyDocs] = useState<Partial<Record<DocKey, boolean>>>({});
  const dirty = Object.values(dirtyDocs).some(Boolean);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const plan = documentPlan(caseRecord);
  const [active, setActive] = useState<DocKey>(plan.primary);
  const formRef = useRef<HTMLFormElement>(null);
  const [attempted, setAttempted] = useState(false);
  const [completed, setCompleted] = useState<Partial<Record<DocKey, boolean>>>({});
  const [busy, setBusy] = useState(false);

  // ---------- shared state per doc ----------
  // Sicherstellung
  const [seizure, setSeizure] = useState({
    location: "",
    occurredAt: localDateTime(),
    legalBasis: "",
    circumstances: caseRecord.originContext || caseRecord.background || "",
    holder: "",
    identMarks: "",
    conditionAtSeizure: "",
    witnesses: "",
    custodyLocation: `${sentinel.name} · Region ${sentinel.region}`,
    authorityOfficer: knownValue(caseRecord.authority),
  });

  // Fundtier
  const [found, setFound] = useState({
    foundAt: localDateTime(),
    foundLocation: "",
    finderName: "",
    finderContact: "",
    circumstances: caseRecord.originContext || caseRecord.background || "",
    identMarks: "",
    estimatedAge: knownValue(caseRecord.age),
    health: "",
    custodyLocation: `${sentinel.name} · Region ${sentinel.region}`,
    reportedAuthority: "",
    reportedAt: "",
  });

  // Adoption
  const [adoption, setAdoption] = useState<
    Omit<AdoptionContractInput, "caseRecord" | "sentinel">
  >({
    adopterName: "",
    adopterAddress: "",
    adopterContact: "",
    adopterIdNumber: "",
    housingDescription: "",
    experienceYears: "",
    hasSachkunde: false,
    sachkundeRef: "",
    hasPermitIfRequired: false,
    permitRef: "",
    vetReference: "",
    protectionFee: "",
    handoverDate: "",
    conditions: [caseRecord.careRequirements, caseRecord.spaceRequirements].filter(Boolean).join("\n"),
  });

  const eligibility = useMemo(
    () =>
      evaluateEligibility(
        { ...adoption, caseRecord, sentinel } as AdoptionContractInput,
        caseRecord,
      ),
    [adoption, caseRecord, sentinel],
  );

  // CITES
  const [cites, setCites] = useState({
    citesCertificateNo: "",
    issuingAuthority: "",
    issuedAt: "",
    certificateStatus: "unknown",
    missingEvidence: "",
    markerType: "Noch ungeklärt / keine Kennzeichnung dokumentiert",
    markerId: "",
    acquisitionPath: plan.origin === "unknown" ? "" : `${INTAKE_TYPES[plan.origin]}${caseRecord.originContext ? ` · ${caseRecord.originContext}` : ""}`,
    handoverPurpose: "Übergabe an zuständige Behörde zur weiteren Verwahrung",
    receivingAuthority: knownValue(caseRecord.authority),
    receivingOfficer: "",
    handoverLocation: "",
    handoverAt: localDateTime(),
    attachments: "",
  });

  const [intake, setIntake] = useState({
    handoverAt: localDateTime(), fromName: "", fromContact: "",
    receivingLocation: `${sentinel.name} · ${sentinel.region}`,
    circumstances: caseRecord.originContext || caseRecord.background || "", accompanyingDocuments: "",
  });
  const [adoptionFiles, setAdoptionFiles] = useState<Attachment[]>([]);
  const [citesFiles, setCitesFiles] = useState<Attachment[]>([]);
  const values = { seizure, found, intake, adoption, cites };
  const requirements = documentRequirements(active, values[active], caseRecord);
  const missing = missingRequirements(requirements, values[active]);
  const focusField = (label: string) => {
    const field = [...(formRef.current?.querySelectorAll<HTMLElement>("[data-document-field]") ?? [])].find((node) => node.dataset.documentField === label);
    field?.scrollIntoView({ block: "center", behavior: "smooth" });
    (field?.querySelector<HTMLElement>("input, textarea, select, button[role=checkbox]") ?? field)?.focus({ preventScroll: true });
  };
  const exportCurrent = async (draft: boolean) => {
    if (busy) return;
    setAttempted(true);
    if (!draft && missing.length) { focusField(missing[0].label); return; }
    if (!draft && !formRef.current?.reportValidity()) return;
    const common = { caseRecord, sentinel, draft, missingFields: missing.map((item) => item.label) };
    try {
      setBusy(true);
      if (active === "seizure") await exportSeizureProtocol({ ...common, ...seizure });
      else if (active === "found") await exportFoundAnimalReport({ ...common, ...found });
      else if (active === "intake") await exportIntakeHandover({ ...common, ...intake });
      else if (active === "adoption") await exportAdoptionContract({ ...common, ...adoption, attachmentFiles: adoptionFiles });
      else await exportCitesHandover({ ...common, ...cites, attachmentFiles: citesFiles });
      setCompleted((previous) => ({ ...previous, [active]: !draft }));
      setDirtyDocs((previous) => ({ ...previous, [active]: false }));
      toast({ title: draft ? "Entwurf heruntergeladen" : "Dokument erstellt", description: "ZIP mit PDF und JSON heruntergeladen. Bitte prüfen und gegebenenfalls unterschreiben." });
    } catch (error) {
      toast({ title: "Dokument konnte nicht erstellt werden", description: error instanceof Error ? error.message : "Bitte erneut versuchen.", variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <div className="border border-border bg-surface">
      <div className="border-b border-border p-5">
        <h3 className="font-display text-xl">Dokumente für diesen Fall</h3>
        <p className="mt-2 text-sm">{caseRecord.german} · {plan.protection.label} · {INTAKE_TYPES[plan.origin]}</p>
        <p className="mt-2 text-xs text-muted-foreground">Tierdaten werden aus der Akte übernommen. Vorausgewählte Vorlagen passen zum Aufnahmegrund; weitere Vorlagen bleiben erreichbar.</p>
        {plan.protection.review && <p className="mt-2 text-xs text-warning">Schutzstatus prüfen: EU-Anhang, Population und mögliche Ausnahmen anhand der Unterlagen klären. Ein fehlender Treffer bedeutet nicht „ungeschützt“.</p>}
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Empfohlene Dokumente">
          {plan.recommended.map((key) => <button type="button" key={key} onClick={() => { setActive(key); setAttempted(false); }} className="border border-primary/30 px-3 py-2 text-left text-xs hover:bg-primary/5">
            {DOC_TYPES.find((item) => item.key === key)?.label} · {completed[key] ? "Heruntergeladen" : key === plan.primary ? "Aufnahme dokumentieren" : "Nachweise prüfen"}
          </button>)}
          {plan.adoptionRelevant && <button type="button" onClick={() => { setActive("adoption"); setAttempted(false); }} className="border border-border px-3 py-2 text-xs">Bei Vermittlung: Adoptionsvertrag</button>}
        </div>
        {caseRecord.wardId && <Link onClick={(event) => { if (dirty && !window.confirm("Dokumentangaben verwerfen und Tierdaten bearbeiten?")) event.preventDefault(); }} to={`/wards?search=${encodeURIComponent(caseRecord.id)}&edit=${caseRecord.wardId}`} className="mt-3 inline-block text-xs text-primary underline">Tierdaten / Aufnahmegrund bearbeiten</Link>}
      </div>
      {/* Tab strip */}
      <div className="flex flex-wrap gap-px bg-border">
        {DOC_TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              aria-pressed={active === t.key}
              onClick={() => { setActive(t.key); setAttempted(false); }}
              className={`flex flex-1 items-center justify-center gap-2 bg-surface px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                active === t.key ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="border-b border-border p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <span className="eyebrow flex items-center gap-2">
              <FileText className="h-3 w-3" /> Falldokument
            </span>
            <h3 className="mt-2 text-xl tracking-tight">
              {DOC_TYPES.find((d) => d.key === active)!.label}
            </h3>
            <p className="mt-1 max-w-xl font-mono text-[11px] text-muted-foreground">
              {DOC_TYPES.find((d) => d.key === active)!.desc}
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Aktenzeichen
            </div>
            <div className="font-mono text-sm text-primary">{caseRecord.id}</div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              {caseRecord.german}
            </div>
          </div>
        </div>
      </div>

      <RequiredFields.Provider value={requirements}>
      <form ref={formRef} noValidate onSubmit={(event) => { event.preventDefault(); void exportCurrent(false); }} className="p-4 sm:p-6" onChange={() => { setDirtyDocs((previous) => ({ ...previous, [active]: true })); setCompleted((previous) => ({ ...previous, [active]: false })); }}>
        <p className="mb-4 text-xs text-muted-foreground">„Verpflichtend“ kennzeichnet die Angaben für diese Vorlage. Bekannte Daten sind vorausgefüllt. Entwürfe können auch mit offenen Angaben heruntergeladen werden.</p>
        {missing.length > 0 && <div className={`mb-5 border p-3 ${attempted ? "border-destructive/50" : "border-border"}`} role={attempted ? "alert" : "status"}>
          <p className="text-sm">Noch {missing.length} verpflichtende {missing.length === 1 ? "Angabe" : "Angaben"}:</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">{missing.map((item) => <li key={item.key}><button type="button" className="text-left text-xs text-primary underline" onClick={() => focusField(item.label)}>{item.label}</button></li>)}</ul>
        </div>}
        {active === "intake" && <div className="grid gap-4 md:grid-cols-2">
          <Field label="Datum / Uhrzeit Aufnahme"><Input type="datetime-local" className={inputCls} value={intake.handoverAt} onChange={(e) => setIntake({ ...intake, handoverAt: e.target.value })} /></Field>
          <Field label="Aufnahmeort"><Input className={inputCls} value={intake.receivingLocation} onChange={(e) => setIntake({ ...intake, receivingLocation: e.target.value })} /></Field>
          <Field label="Abgebende Person / Stelle"><Input className={inputCls} value={intake.fromName} onChange={(e) => setIntake({ ...intake, fromName: e.target.value })} /></Field>
          <Field label="Kontakt der abgebenden Stelle"><Input className={inputCls} value={intake.fromContact} onChange={(e) => setIntake({ ...intake, fromContact: e.target.value })} /></Field>
          <Field label="Anlass / Angaben zur Übergabe"><Textarea className={textareaCls} value={intake.circumstances} onChange={(e) => setIntake({ ...intake, circumstances: e.target.value })} /></Field>
          <Field label="Mitgegebene Dokumente / offene Nachweise"><Textarea className={textareaCls} value={intake.accompanyingDocuments} onChange={(e) => setIntake({ ...intake, accompanyingDocuments: e.target.value })} /></Field>
        </div>}
        <datalist id="document-legal-basis"><option value="§ 16a TierSchG" /><option value="§ 47 BNatSchG" /></datalist>
        {/* SEIZURE */}
        {active === "seizure" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Datum / Uhrzeit">
              <Input type="datetime-local"
                value={seizure.occurredAt}
                onChange={(e) => setSeizure({ ...seizure, occurredAt: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Ort der Maßnahme">
              <Input
                value={seizure.location}
                onChange={(e) => setSeizure({ ...seizure, location: e.target.value })}
                placeholder="Adresse / Koordinaten"
                className={inputCls}
              />
            </Field>
            <Field label="Rechtsgrundlage">
              <Input
                list="document-legal-basis"
                placeholder="Aus Anordnung / Bescheid übernehmen"
                value={seizure.legalBasis}
                onChange={(e) => setSeizure({ ...seizure, legalBasis: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Beteiligte:r Behördenvertreter:in">
              <Input
                value={seizure.authorityOfficer}
                onChange={(e) => setSeizure({ ...seizure, authorityOfficer: e.target.value })}
                className={inputCls}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Sachverhalt / Anlass">
                <Textarea
                  value={seizure.circumstances}
                  onChange={(e) => setSeizure({ ...seizure, circumstances: e.target.value })}
                  placeholder="Was wurde wann beobachtet, welche Gefahr für das Tier?"
                  className={textareaCls}
                />
              </Field>
            </div>
            <Field label="Halter / Anschrift">
              <Textarea
                value={seizure.holder}
                onChange={(e) => setSeizure({ ...seizure, holder: e.target.value })}
                className={textareaCls}
              />
            </Field>
            <Field label="Identmerkmale (Chip / Marker)">
              <Textarea
                value={seizure.identMarks}
                onChange={(e) => setSeizure({ ...seizure, identMarks: e.target.value })}
                className={textareaCls}
              />
            </Field>
            <Field label="Zustand bei Sicherstellung">
              <Textarea
                value={seizure.conditionAtSeizure}
                onChange={(e) =>
                  setSeizure({ ...seizure, conditionAtSeizure: e.target.value })
                }
                className={textareaCls}
              />
            </Field>
            <Field label="Zeugen">
              <Textarea
                value={seizure.witnesses}
                onChange={(e) => setSeizure({ ...seizure, witnesses: e.target.value })}
                className={textareaCls}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Verwahrungsstelle">
                <Input
                  value={seizure.custodyLocation}
                  onChange={(e) =>
                    setSeizure({ ...seizure, custodyLocation: e.target.value })
                  }
                  className={inputCls}
                />
              </Field>
            </div>

          </div>
        )}

        {/* FOUND */}
        {active === "found" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Datum / Uhrzeit Fund">
              <Input type="datetime-local"
                value={found.foundAt}
                onChange={(e) => setFound({ ...found, foundAt: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Fundort">
              <Input
                value={found.foundLocation}
                onChange={(e) => setFound({ ...found, foundLocation: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Finder:in (Name)">
              <Input
                value={found.finderName}
                onChange={(e) => setFound({ ...found, finderName: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Finder:in (Kontakt)">
              <Input
                value={found.finderContact}
                onChange={(e) => setFound({ ...found, finderContact: e.target.value })}
                className={inputCls}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Fundumstände">
                <Textarea
                  value={found.circumstances}
                  onChange={(e) => setFound({ ...found, circumstances: e.target.value })}
                  className={textareaCls}
                />
              </Field>
            </div>
            <Field label="Identmerkmale">
              <Textarea
                value={found.identMarks}
                onChange={(e) => setFound({ ...found, identMarks: e.target.value })}
                className={textareaCls}
              />
            </Field>
            <Field label="Geschätztes Alter">
              <Input
                value={found.estimatedAge}
                onChange={(e) => setFound({ ...found, estimatedAge: e.target.value })}
                className={inputCls}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Gesundheitlicher Zustand">
                <Textarea
                  value={found.health}
                  onChange={(e) => setFound({ ...found, health: e.target.value })}
                  className={textareaCls}
                />
              </Field>
            </div>
            <Field label="Verwahrungsstelle"><Input value={found.custodyLocation} onChange={(e) => setFound({ ...found, custodyLocation: e.target.value })} className={inputCls} /></Field>
            <Field label="Gemeldet an (Behörde)">
              <Input
                value={found.reportedAuthority}
                onChange={(e) =>
                  setFound({ ...found, reportedAuthority: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Gemeldet am">
              <Input type="datetime-local"
                value={found.reportedAt}
                onChange={(e) => setFound({ ...found, reportedAt: e.target.value })}
                className={inputCls}
              />
            </Field>

          </div>
        )}

        {/* ADOPTION */}
        {active === "adoption" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Eligibility live */}
            <div
              className={`md:col-span-2 border px-3 py-2 font-mono text-[11px] ${
                eligibility.ok
                  ? "border-primary/40 bg-primary/5 text-primary"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              Eignungsprüfung: {eligibility.ok ? "BESTANDEN" : "UNVOLLSTÄNDIG"} ·{" "}
              {eligibility.score}/{eligibility.max}
              {!eligibility.ok && (
                <span className="ml-2 text-muted-foreground">
                  · fehlend: {eligibility.missing.join(", ")}
                </span>
              )}
            </div>

            <Field label="Adoptant:in (Name)">
              <Input
                value={adoption.adopterName}
                onChange={(e) => setAdoption({ ...adoption, adopterName: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Ausweis-Nr.">
              <Input
                value={adoption.adopterIdNumber}
                onChange={(e) =>
                  setAdoption({ ...adoption, adopterIdNumber: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Anschrift">
                <Textarea
                  value={adoption.adopterAddress}
                  onChange={(e) =>
                    setAdoption({ ...adoption, adopterAddress: e.target.value })
                  }
                  className={textareaCls}
                />
              </Field>
            </div>
            <Field label="Kontakt (Tel / Mail)">
              <Input
                value={adoption.adopterContact}
                onChange={(e) =>
                  setAdoption({ ...adoption, adopterContact: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Erfahrung (Jahre)">
              <Input
                type="number"
                value={adoption.experienceYears}
                onChange={(e) =>
                  setAdoption({ ...adoption, experienceYears: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Haltungsbeschreibung (Terrarium, Klima, Sicherung)">
                <Textarea
                  value={adoption.housingDescription}
                  onChange={(e) =>
                    setAdoption({ ...adoption, housingDescription: e.target.value })
                  }
                  className={textareaCls}
                  placeholder="Maße, Klima, Sicherung gegen Entweichen, Gefahrenabwehr…"
                />
              </Field>
            </div>

            <div data-document-field="Sachkundenachweis bestätigt" className="flex items-center gap-3 pt-2">
              <Checkbox aria-label="Sachkundenachweis bestätigt"
                checked={adoption.hasSachkunde}
                onCheckedChange={(v) =>
                  setAdoption({ ...adoption, hasSachkunde: Boolean(v) })
                }
              />
              <span className="font-mono text-[11px]">Sachkundenachweis liegt vor</span>
            </div>
            <Field label="Sachkunde-Referenz">
              <Input
                value={adoption.sachkundeRef}
                onChange={(e) =>
                  setAdoption({ ...adoption, sachkundeRef: e.target.value })
                }
                className={inputCls}
                placeholder="z. B. IHK-Nr., Kursnachweis"
              />
            </Field>

            <div data-document-field="Behördliche Freigabe bestätigt" className="flex items-center gap-3 pt-2">
              <Checkbox aria-label="Behördliche Freigabe bestätigt"
                checked={adoption.hasPermitIfRequired}
                onCheckedChange={(v) =>
                  setAdoption({ ...adoption, hasPermitIfRequired: Boolean(v) })
                }
              />
              <span className="font-mono text-[11px]">
                Behördliche Klärung / Freigabe dokumentiert {requiresPermitForCase(caseRecord) ? "(für diese Vorlage verpflichtend)" : "(falls erforderlich)"}
              </span>
            </div>
            <Field label="Genehmigungs-Referenz">
              <Input
                value={adoption.permitRef}
                onChange={(e) => setAdoption({ ...adoption, permitRef: e.target.value })}
                className={inputCls}
              />
            </Field>

            <Field label="Tierärztliche Referenz">
              <Input
                value={adoption.vetReference}
                onChange={(e) =>
                  setAdoption({ ...adoption, vetReference: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Schutzgebühr (€)">
              <Input
                value={adoption.protectionFee}
                onChange={(e) =>
                  setAdoption({ ...adoption, protectionFee: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Übergabedatum">
              <Input type="date"
                value={adoption.handoverDate}
                onChange={(e) =>
                  setAdoption({ ...adoption, handoverDate: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Auflagen / Bedingungen">
                <Textarea
                  value={adoption.conditions}
                  onChange={(e) =>
                    setAdoption({ ...adoption, conditions: e.target.value })
                  }
                  className={textareaCls}
                />
              </Field>
            </div>

            <AttachmentsField value={adoptionFiles} onChange={(files) => { setAdoptionFiles(files); setDirtyDocs((previous) => ({ ...previous, adoption: true })); }} />


          </div>
        )}

        {/* CITES */}
        {active === "cites" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Stand der Herkunftsnachweise"><select className={inputCls + " w-full"} value={cites.certificateStatus} onChange={(e) => setCites({ ...cites, certificateStatus: e.target.value })}>
              <option value="unknown">Noch ungeklärt</option><option value="available">Bescheinigung liegt vor</option><option value="missing">Bescheinigung fehlt / Anwendbarkeit zu prüfen</option>
            </select></Field>
            {cites.certificateStatus !== "available" && <Field label="Fehlende Nachweise / weiterer Klärungsbedarf"><Textarea className={textareaCls} value={cites.missingEvidence} onChange={(e) => setCites({ ...cites, missingEvidence: e.target.value })} placeholder="Was fehlt und wer klärt es?" /></Field>}
            <Field label="CITES-Bescheinigung Nr.">
              <Input
                value={cites.citesCertificateNo}
                onChange={(e) =>
                  setCites({ ...cites, citesCertificateNo: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Ausstellende Behörde">
              <Input
                value={cites.issuingAuthority}
                onChange={(e) =>
                  setCites({ ...cites, issuingAuthority: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Ausgestellt am">
              <Input type="date"
                value={cites.issuedAt}
                onChange={(e) => setCites({ ...cites, issuedAt: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Erwerbsweg / Herkunft">
              <Input
                value={cites.acquisitionPath}
                onChange={(e) =>
                  setCites({ ...cites, acquisitionPath: e.target.value })
                }
                className={inputCls}
                placeholder="Nachzucht, Import, Sicherstellung…"
              />
            </Field>
            <Field label="Marker-Typ">
              <select value={cites.markerType} onChange={(e) => setCites({ ...cites, markerType: e.target.value })} className={inputCls + " w-full"}>{["Noch ungeklärt / keine Kennzeichnung dokumentiert", "Transponder (ISO 11784/85)", "Geschlossener Ring", "Fotodokumentation", "Andere Kennzeichnung"].map((type) => <option key={type}>{type}</option>)}</select>
            </Field>
            <Field label="Marker-ID">
              <Input
                value={cites.markerId}
                onChange={(e) => setCites({ ...cites, markerId: e.target.value })}
                className={inputCls}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Übergabezweck">
                <Textarea
                  value={cites.handoverPurpose}
                  onChange={(e) =>
                    setCites({ ...cites, handoverPurpose: e.target.value })
                  }
                  className={textareaCls}
                />
              </Field>
            </div>
            <Field label="Empfangende Behörde / Stelle">
              <Input
                value={cites.receivingAuthority}
                onChange={(e) =>
                  setCites({ ...cites, receivingAuthority: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Empfangende Person">
              <Input
                value={cites.receivingOfficer}
                onChange={(e) =>
                  setCites({ ...cites, receivingOfficer: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Ort der Übergabe">
              <Input
                value={cites.handoverLocation}
                onChange={(e) =>
                  setCites({ ...cites, handoverLocation: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Datum / Uhrzeit Übergabe">
              <Input type="datetime-local"
                value={cites.handoverAt}
                onChange={(e) => setCites({ ...cites, handoverAt: e.target.value })}
                className={inputCls}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Begleitende Unterlagen">
                <Textarea
                  value={cites.attachments}
                  onChange={(e) => setCites({ ...cites, attachments: e.target.value })}
                  className={textareaCls}
                />
              </Field>
            </div>

            <AttachmentsField value={citesFiles} onChange={(files) => { setCitesFiles(files); setDirtyDocs((previous) => ({ ...previous, cites: true })); }} />


          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-border pt-5">
          <Button type="button" variant="outline" disabled={busy} onClick={() => void exportCurrent(true)}>Entwurf herunterladen</Button>
          <Button type="submit" disabled={busy}><Download className="mr-2 h-4 w-4" />{busy ? "Wird erstellt …" : "Dokument erstellen (PDF + JSON)"}</Button>
        </div>
      </form>
      </RequiredFields.Provider>
    </div>
  );
};
