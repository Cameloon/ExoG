import { useMemo, useRef, useState } from "react";
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
          value={pendingKind}
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
                  value={a.note ?? ""}
                  onChange={(e) => updateNote(i, e.target.value)}
                  placeholder="Notiz / Beschreibung (optional)"
                  className="mt-2 h-8 border-border bg-background font-mono text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={a.kind}
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
};

type DocKey = "seizure" | "found" | "adoption" | "cites";

const DOC_TYPES: { key: DocKey; label: string; icon: typeof FileText; desc: string }[] = [
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
    desc: "Herkunftsnachweis & Übergabeprotokoll an Behörde (BArtSchV / EG 338/97).",
  },
];

const labelCls =
  "font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground";
const inputCls = "mt-1 h-9 border-border bg-background font-mono text-sm";
const textareaCls = "mt-1 min-h-[72px] resize-none border-border bg-background font-mono text-sm";

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className={labelCls}>{label}</label>
    {children}
  </div>
);

export const DocumentsHub = ({ caseRecord, sentinel }: Props) => {
  const [active, setActive] = useState<DocKey>("seizure");
  const [busy, setBusy] = useState(false);

  // ---------- shared state per doc ----------
  // Sicherstellung
  const [seizure, setSeizure] = useState({
    location: "",
    occurredAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    legalBasis: "§ 16a TierSchG",
    circumstances: "",
    holder: "",
    identMarks: "",
    conditionAtSeizure: "",
    witnesses: "",
    custodyLocation: `${sentinel.name} · Region ${sentinel.region}`,
    authorityOfficer: caseRecord.authority,
  });

  // Fundtier
  const [found, setFound] = useState({
    foundAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    foundLocation: "",
    finderName: "",
    finderContact: "",
    circumstances: "",
    identMarks: "",
    estimatedAge: "",
    health: "",
    custodyLocation: `${sentinel.name} · Region ${sentinel.region}`,
    reportedAuthority: caseRecord.authority,
    reportedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
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
    conditions: "",
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
    markerType: "Transponder (ISO 11784/85)",
    markerId: "",
    acquisitionPath: "",
    handoverPurpose: "Übergabe an zuständige Behörde zur weiteren Verwahrung",
    receivingAuthority: caseRecord.authority,
    receivingOfficer: "",
    handoverLocation: "",
    handoverAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    attachments: "Pflege-Log-Export (PDF+JSON), Tierärztliches Attest",
  });

  // Hochgeladene Anhänge pro Dokumenttyp
  const [adoptionFiles, setAdoptionFiles] = useState<Attachment[]>([]);
  const [citesFiles, setCitesFiles] = useState<Attachment[]>([]);
  const wrap = async (fn: () => Promise<unknown>, name: string) => {
    try {
      setBusy(true);
      await fn();
      toast({ title: `${name} erstellt`, description: "ZIP-Download gestartet." });
    } catch (e) {
      toast({
        title: "Fehler",
        description: e instanceof Error ? e.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-border bg-surface">
      {/* Tab strip */}
      <div className="flex flex-wrap gap-px bg-border">
        {DOC_TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
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
              <FileText className="h-3 w-3" /> Behörden-Dokument
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

      <div className="p-6">
        {/* SEIZURE */}
        {active === "seizure" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Datum / Uhrzeit">
              <Input
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
            <div className="md:col-span-2 flex justify-end pt-2">
              <Button
                onClick={() =>
                  wrap(
                    () =>
                      exportSeizureProtocol({
                        caseRecord,
                        sentinel,
                        ...seizure,
                      }),
                    "Sicherstellungsprotokoll",
                  )
                }
                disabled={busy || !seizure.location.trim() || !seizure.circumstances.trim()}
              >
                <Download className="mr-2 h-4 w-4" />
                Erstellen (PDF + JSON)
              </Button>
            </div>
          </div>
        )}

        {/* FOUND */}
        {active === "found" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Datum / Uhrzeit Fund">
              <Input
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
              <Input
                value={found.reportedAt}
                onChange={(e) => setFound({ ...found, reportedAt: e.target.value })}
                className={inputCls}
              />
            </Field>
            <div className="md:col-span-2 flex justify-end pt-2">
              <Button
                onClick={() =>
                  wrap(
                    () => exportFoundAnimalReport({ caseRecord, sentinel, ...found }),
                    "Fundtier-Meldung",
                  )
                }
                disabled={
                  busy ||
                  !found.foundLocation.trim() ||
                  !found.finderName.trim() ||
                  !found.circumstances.trim()
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Erstellen (PDF + JSON)
              </Button>
            </div>
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

            <div className="flex items-center gap-3 pt-2">
              <Checkbox
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

            <div className="flex items-center gap-3 pt-2">
              <Checkbox
                checked={adoption.hasPermitIfRequired}
                onCheckedChange={(v) =>
                  setAdoption({ ...adoption, hasPermitIfRequired: Boolean(v) })
                }
              />
              <span className="font-mono text-[11px]">
                Behördl. Genehmigung vorgelegt {requiresPermitForCase(caseRecord) ? "(PFLICHT)" : "(falls erforderlich)"}
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
              <Input
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

            <AttachmentsField value={adoptionFiles} onChange={setAdoptionFiles} />

            <div className="md:col-span-2 flex justify-end pt-2">
              <Button
                onClick={() =>
                  wrap(
                    () =>
                      exportAdoptionContract({
                        caseRecord,
                        sentinel,
                        ...adoption,
                        attachmentFiles: adoptionFiles,
                      }),
                    "Adoptionsvertrag",
                  )
                }
                disabled={busy || !adoption.adopterName.trim()}
                title={!eligibility.ok ? "Vertrag wird mit Hinweis 'unvollständig' erstellt" : ""}
              >
                <Download className="mr-2 h-4 w-4" />
                Erstellen (PDF + JSON{adoptionFiles.length ? ` + ${adoptionFiles.length} Anhang` : ""})
              </Button>
            </div>
          </div>
        )}

        {/* CITES */}
        {active === "cites" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              <Input
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
              <Input
                value={cites.markerType}
                onChange={(e) => setCites({ ...cites, markerType: e.target.value })}
                className={inputCls}
              />
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
            <Field label="Empfangende Behörde">
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
              <Input
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

            <AttachmentsField value={citesFiles} onChange={setCitesFiles} />

            <div className="md:col-span-2 flex justify-end pt-2">
              <Button
                onClick={() =>
                  wrap(
                    () =>
                      exportCitesHandover({
                        caseRecord,
                        sentinel,
                        ...cites,
                        attachmentFiles: citesFiles,
                      }),
                    "CITES-Übergabeprotokoll",
                  )
                }
                disabled={
                  busy ||
                  !cites.citesCertificateNo.trim() ||
                  !cites.markerId.trim() ||
                  !cites.receivingOfficer.trim()
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Erstellen (PDF + JSON{citesFiles.length ? ` + ${citesFiles.length} Anhang` : ""})
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
