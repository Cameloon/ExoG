import type jsPDF from "jspdf";
import {
  DOC_KIT_VERSION,
  FlowCursor,
  buildManifest,
  defList,
  downloadZip,
  drawCoverPage,
  finalizePages,
  makeDocId,
  nowIso,
  safeFileBase,
  sectionHeader,
  signatureLines,
  attachmentsTable,
  embedImageAttachments,
  ATTACHMENT_KIND_LABEL,
  type Attachment,
  SENDER,
  CONFIDENTIALITY_NOTICE,
  LEGAL_BASIS,
  type DocMeta,
} from "./doc-kit";
import type { CaseRecord, SentinelProfile } from "@/lib/dashboard-data";

export const ADOPTION_VERSION = "1.1.0";

export type AdoptionContractInput = {
  caseRecord: CaseRecord;
  sentinel: SentinelProfile;
  adopterName: string;
  adopterAddress: string;
  adopterContact: string;
  adopterIdNumber: string;
  /** Eignungsprüfung */
  housingDescription: string;
  experienceYears: string;
  hasSachkunde: boolean;
  sachkundeRef: string;
  hasPermitIfRequired: boolean;
  permitRef: string;
  vetReference: string;
  /** Vertragliches */
  protectionFee: string;
  handoverDate: string;
  conditions: string;
  /** Hochgeladene Anhänge — eingebunden in PDF + ZIP */
  attachmentFiles?: Attachment[];
  /** Eignungs-Score (auto) */
};

type EligibilityResult = {
  ok: boolean;
  score: number;
  max: number;
  missing: string[];
};

export const requiresPermitForCase = (caseRecord: CaseRecord) =>
  caseRecord.cites === "A" || ["kritisch", "hoch"].includes(caseRecord.risk);

export function evaluateEligibility(
  input: AdoptionContractInput,
  caseRecord: CaseRecord,
): EligibilityResult {
  const missing: string[] = [];
  let score = 0;
  const max = 6;

  if (input.adopterName.trim()) score++; else missing.push("Adoptant:in-Name");
  if (input.adopterAddress.trim()) score++; else missing.push("Anschrift");
  if (input.housingDescription.trim().length >= 40) score++;
  else missing.push("Haltung (≥40 Zeichen)");
  if (Number(input.experienceYears) >= 1) score++;
  else missing.push("Erfahrung (≥1 Jahr)");
  if (input.hasSachkunde && input.sachkundeRef.trim()) score++;
  else missing.push("Sachkundenachweis + Referenz");

  // CITES A oder Risiko kritisch/hoch → Genehmigung Pflicht
  const requiresPermit = requiresPermitForCase(caseRecord);
  if (!requiresPermit || (input.hasPermitIfRequired && input.permitRef.trim())) score++;
  else missing.push("Behördliche Genehmigung (Pflicht für CITES-A / Hochrisiko)");

  return { ok: missing.length === 0, score, max, missing };
}

export async function exportAdoptionContract(input: AdoptionContractInput) {
  const { default: jsPDF } = await import("jspdf");
  const eligibility = evaluateEligibility(input, input.caseRecord);
  const meta: DocMeta = {
    title: "Vermittlungs- / Adoptionsvertrag",
    subtitle: "Vertrag inkl. Eignungsprüfung, Halterpflichten und Schutzgebühr",
    fileNumber: input.caseRecord.id,
    docId: makeDocId([
      "adoption",
      input.caseRecord.id,
      input.adopterName,
      input.handoverDate,
      eligibility.score,
    ]),
    version: ADOPTION_VERSION,
    generatedAt: nowIso(),
    authoredBy: input.sentinel.name,
  };

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const subject = `Vermittlung: ${input.caseRecord.german} (${input.caseRecord.species}) · CITES ${input.caseRecord.cites} · Risiko ${input.caseRecord.risk}`;
  const cover = drawCoverPage(doc, meta, subject);

  doc.addPage();
  const cur = new FlowCursor(doc, 48);

  // Eligibility-Banner
  cur.ensure(60);
  doc.setDrawColor(eligibility.ok ? 60 : 180, eligibility.ok ? 140 : 60, eligibility.ok ? 80 : 60);
  doc.setFillColor(eligibility.ok ? 235 : 253, eligibility.ok ? 247 : 235, eligibility.ok ? 240 : 235);
  doc.roundedRect(cur.margin, cur.y, doc.internal.pageSize.getWidth() - 2 * cur.margin, 44, 4, 4, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(eligibility.ok ? 30 : 160, eligibility.ok ? 110 : 30, eligibility.ok ? 60 : 30);
  doc.text(
    `Eignungsprüfung: ${eligibility.ok ? "BESTANDEN" : "UNVOLLSTÄNDIG"} (${eligibility.score}/${eligibility.max})`,
    cur.margin + 12,
    cur.y + 18,
  );
  if (!eligibility.ok) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(80);
    doc.text(`Fehlend: ${eligibility.missing.join(", ")}`, cur.margin + 12, cur.y + 34);
  }
  cur.advance(56);

  cur.y = sectionHeader(doc, cur.y, "1 · Vertragsparteien", cur.margin);
  cur.y = defList(doc, cur.y, cur.margin, [
    ["Vermittlungsstelle", `${SENDER.org} · ${SENDER.unit}`],
    ["Vertretung (Sentinel)", `${input.sentinel.name} (Stufe ${input.sentinel.tier})`],
    ["Adoptant:in", input.adopterName],
    ["Anschrift", input.adopterAddress],
    ["Kontakt", input.adopterContact],
    ["Ausweis-Nr.", input.adopterIdNumber],
  ]);

  cur.ensure(120);
  cur.y = sectionHeader(doc, cur.y, "2 · Vermittelte:s Tier", cur.margin);
  cur.y = defList(doc, cur.y, cur.margin, [
    ["Aktenzeichen", input.caseRecord.id],
    ["Art (deutsch)", input.caseRecord.german],
    ["Wissenschaftlich", input.caseRecord.species],
    ["CITES-Anhang", input.caseRecord.cites],
    ["Risiko", input.caseRecord.risk],
    ["Herkunft", input.caseRecord.origin],
  ]);

  cur.ensure(140);
  cur.y = sectionHeader(doc, cur.y, "3 · Eignungsprüfung", cur.margin);
  cur.y = defList(doc, cur.y, cur.margin, [
    ["Haltungsbeschreibung", input.housingDescription],
    ["Erfahrung (Jahre)", input.experienceYears],
    ["Sachkundenachweis", input.hasSachkunde ? `Ja · ${input.sachkundeRef}` : "Nein"],
    [
      "Behördl. Genehmigung",
      input.hasPermitIfRequired ? `Ja · ${input.permitRef}` : "Nicht vorgelegt",
    ],
    ["Tierärztliche Referenz", input.vetReference || "—"],
  ]);

  cur.ensure(100);
  cur.y = sectionHeader(doc, cur.y, "4 · Konditionen", cur.margin);
  cur.y = defList(doc, cur.y, cur.margin, [
    ["Schutzgebühr", input.protectionFee],
    ["Übergabedatum", input.handoverDate],
    ["Auflagen / Bedingungen", input.conditions || "—"],
  ]);

  cur.ensure(120);
  cur.y = sectionHeader(doc, cur.y, "5 · Halterpflichten (Auszug)", cur.margin);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(40);
  const duties = [
    "• Artgerechte Haltung gemäß TierSchG und einschlägigen Gutachten.",
    "• Kontroll- und Besuchsrecht der Vermittlungsstelle nach Voranmeldung.",
    "• Untersagung der Weitergabe an Dritte ohne schriftliche Zustimmung.",
    "• Meldung von Krankheit, Tod oder Entweichen binnen 48 Stunden.",
    "• Rückgabepflicht bei Nichterfüllung der Auflagen.",
  ];
  duties.forEach((d) => {
    const w = doc.splitTextToSize(d, doc.internal.pageSize.getWidth() - 2 * cur.margin);
    cur.ensure(w.length * 12 + 2);
    doc.text(w, cur.margin, cur.y);
    cur.advance(w.length * 12 + 2);
  });

  const files = input.attachmentFiles ?? [];
  cur.ensure(80);
  cur.y = sectionHeader(doc, cur.y, `6 · Beigefügte Anhänge (${files.length})`, cur.margin);
  cur.y = attachmentsTable(doc, cur.y, cur.margin, files);

  cur.ensure(140);
  cur.advance(8);
  cur.y = sectionHeader(doc, cur.y, "7 · Unterschriften", cur.margin);
  cur.advance(20);
  cur.y = signatureLines(doc, cur.y, cur.margin, [
    { role: "Vermittlungsstelle", name: input.sentinel.name },
    { role: "Adoptant:in", name: input.adopterName },
  ]);

  embedImageAttachments(doc, files);

  finalizePages(doc, meta, cover);
  const pdfBlob = doc.output("blob");

  const json = JSON.stringify(
    {
      schema: "exoguard.adoption-contract/1.0",
      docKitVersion: DOC_KIT_VERSION,
      documentVersion: meta.version,
      documentId: meta.docId,
      generatedAt: meta.generatedAt,
      sender: SENDER,
      confidentiality: { notice: CONFIDENTIALITY_NOTICE, legalBasis: LEGAL_BASIS },
      case: input.caseRecord,
      sentinel: input.sentinel,
      eligibility,
      adopter: {
        name: input.adopterName,
        address: input.adopterAddress,
        contact: input.adopterContact,
        idNumber: input.adopterIdNumber,
      },
      assessment: {
        housingDescription: input.housingDescription,
        experienceYears: input.experienceYears,
        hasSachkunde: input.hasSachkunde,
        sachkundeRef: input.sachkundeRef,
        hasPermitIfRequired: input.hasPermitIfRequired,
        permitRef: input.permitRef,
        vetReference: input.vetReference,
      },
      contract: {
        protectionFee: input.protectionFee,
        handoverDate: input.handoverDate,
        conditions: input.conditions,
      },
      attachments: (input.attachmentFiles ?? []).map((a) => ({
        name: a.name,
        kind: a.kind,
        kindLabel: ATTACHMENT_KIND_LABEL[a.kind],
        mime: a.mime,
        sizeBytes: a.sizeBytes,
        sha256: a.sha256,
        note: a.note ?? null,
        path: `attachments/${a.name}`,
      })),
    },
    null,
    2,
  );

  const base = safeFileBase("Adoption", input.caseRecord.id);
  await downloadZip(
    base,
    pdfBlob,
    json,
    buildManifest(meta, { pdf: `${base}.pdf`, json: `${base}.json` }, input.attachmentFiles ?? []),
    input.attachmentFiles ?? [],
  );

  return eligibility;
}
