import jsPDF from "jspdf";
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

export const CITES_VERSION = "1.1.0";

export type CitesHandoverInput = {
  caseRecord: CaseRecord;
  sentinel: SentinelProfile;
  /** EG-Bescheinigung / Herkunftsnachweis Nr. */
  citesCertificateNo: string;
  /** Aussteller (Behörde) */
  issuingAuthority: string;
  /** Datum Ausstellung */
  issuedAt: string;
  /** Marker (Chip-ID, Ring-Nr. etc.) */
  markerType: string;
  markerId: string;
  /** Quoll-/Zuchtnachweis bzw. Importweg */
  acquisitionPath: string;
  /** Übergabezweck */
  handoverPurpose: string;
  /** Zielstelle / empfangende Behörde */
  receivingAuthority: string;
  receivingOfficer: string;
  handoverLocation: string;
  handoverAt: string;
  /** Begleitete Dokumente (Freitext-Liste) */
  attachments: string;
  /** Hochgeladene Anhänge — eingebunden in PDF + ZIP */
  attachmentFiles?: Attachment[];
};

export async function exportCitesHandover(input: CitesHandoverInput) {
  const meta: DocMeta = {
    title: "CITES- / Herkunftsnachweis & Übergabeprotokoll",
    subtitle: `Übergabe gemäß BArtSchV i.V.m. EG-VO 338/97 (CITES Anhang ${input.caseRecord.cites})`,
    fileNumber: input.caseRecord.id,
    docId: makeDocId([
      "cites",
      input.caseRecord.id,
      input.citesCertificateNo,
      input.handoverAt,
      input.markerId,
    ]),
    version: CITES_VERSION,
    generatedAt: nowIso(),
    authoredBy: input.sentinel.name,
  };

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const subject = `${input.caseRecord.german} (${input.caseRecord.species}) · CITES Anhang ${input.caseRecord.cites} · Herkunft: ${input.caseRecord.origin}`;
  const cover = drawCoverPage(doc, meta, subject);

  doc.addPage();
  const cur = new FlowCursor(doc, 48);

  cur.y = sectionHeader(doc, cur.y, "1 · Herkunfts- / CITES-Nachweis", cur.margin);
  cur.y = defList(doc, cur.y, cur.margin, [
    ["Bescheinigung Nr.", input.citesCertificateNo],
    ["Ausstellende Behörde", input.issuingAuthority],
    ["Ausgestellt am", input.issuedAt],
    ["CITES-Anhang", input.caseRecord.cites],
    ["Erwerbsweg / Herkunft", input.acquisitionPath],
  ]);

  cur.ensure(120);
  cur.y = sectionHeader(doc, cur.y, "2 · Tier & individuelle Markierung", cur.margin);
  cur.y = defList(doc, cur.y, cur.margin, [
    ["Aktenzeichen", input.caseRecord.id],
    ["Art (deutsch)", input.caseRecord.german],
    ["Wissenschaftlich", input.caseRecord.species],
    ["Marker-Typ", input.markerType],
    ["Marker-ID", input.markerId],
    ["Risiko", input.caseRecord.risk],
  ]);

  cur.ensure(120);
  cur.y = sectionHeader(doc, cur.y, "3 · Übergabe an Behörde", cur.margin);
  cur.y = defList(doc, cur.y, cur.margin, [
    ["Übergabezweck", input.handoverPurpose],
    ["Empfangende Behörde", input.receivingAuthority],
    ["Empfangende Person", input.receivingOfficer],
    ["Ort der Übergabe", input.handoverLocation],
    ["Datum / Uhrzeit", input.handoverAt],
  ]);

  cur.ensure(80);
  cur.y = sectionHeader(doc, cur.y, "4 · Begleitende Unterlagen (Freitext)", cur.margin);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(40);
  const att = doc.splitTextToSize(
    input.attachments || "—",
    doc.internal.pageSize.getWidth() - 2 * cur.margin,
  );
  cur.ensure(att.length * 12 + 4);
  doc.text(att, cur.margin, cur.y);
  cur.advance(att.length * 12 + 8);

  const files = input.attachmentFiles ?? [];
  cur.ensure(80);
  cur.y = sectionHeader(
    doc,
    cur.y,
    `5 · Beigefügte Anhänge (${files.length})`,
    cur.margin,
  );
  cur.y = attachmentsTable(doc, cur.y, cur.margin, files);

  cur.ensure(140);
  cur.y = sectionHeader(doc, cur.y, "6 · Bestätigung Übergabe / Übernahme", cur.margin);
  cur.advance(20);
  cur.y = signatureLines(doc, cur.y, cur.margin, [
    { role: "Übergebende Stelle", name: input.sentinel.name },
    { role: "Empfangende Behörde", name: input.receivingOfficer },
  ]);

  embedImageAttachments(doc, files);

  finalizePages(doc, meta, cover);
  const pdfBlob = doc.output("blob");

  const json = JSON.stringify(
    {
      schema: "exoguard.cites-handover/1.0",
      docKitVersion: DOC_KIT_VERSION,
      documentVersion: meta.version,
      documentId: meta.docId,
      generatedAt: meta.generatedAt,
      sender: SENDER,
      confidentiality: { notice: CONFIDENTIALITY_NOTICE, legalBasis: LEGAL_BASIS },
      case: input.caseRecord,
      sentinel: input.sentinel,
      cites: {
        certificateNo: input.citesCertificateNo,
        issuingAuthority: input.issuingAuthority,
        issuedAt: input.issuedAt,
        annex: input.caseRecord.cites,
        acquisitionPath: input.acquisitionPath,
        markerType: input.markerType,
        markerId: input.markerId,
      },
      handover: {
        purpose: input.handoverPurpose,
        receivingAuthority: input.receivingAuthority,
        receivingOfficer: input.receivingOfficer,
        location: input.handoverLocation,
        at: input.handoverAt,
        attachmentsText: input.attachments,
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

  const base = safeFileBase("CITES-Uebergabe", input.caseRecord.id);
  await downloadZip(
    base,
    pdfBlob,
    json,
    buildManifest(meta, { pdf: `${base}.pdf`, json: `${base}.json` }, input.attachmentFiles ?? []),
    input.attachmentFiles ?? [],
  );
}
