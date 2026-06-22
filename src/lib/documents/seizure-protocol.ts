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
  SENDER,
  CONFIDENTIALITY_NOTICE,
  LEGAL_BASIS,
  type DocMeta,
} from "./doc-kit";
import type { CaseRecord, SentinelProfile } from "@/lib/dashboard-data";

export const SEIZURE_VERSION = "1.0.0";

export type SeizureInput = {
  caseRecord: CaseRecord;
  sentinel: SentinelProfile;
  /** Ort der Sicherstellung */
  location: string;
  /** Datum/Zeit ISO-ähnlich, freie Eingabe ok */
  occurredAt: string;
  /** Rechtsgrundlage, z. B. § 16a TierSchG, § 47 BNatSchG */
  legalBasis: string;
  /** Anlass / Sachverhaltsdarstellung */
  circumstances: string;
  /** Halter / Verantwortlicher (Name, Adresse) */
  holder: string;
  /** Identmerkmale (Chip, Ring, Markierung) */
  identMarks: string;
  /** Zustand bei Sicherstellung */
  conditionAtSeizure: string;
  /** Zeugen */
  witnesses: string;
  /** Übernehmende Stelle / Verwahrort */
  custodyLocation: string;
  /** Beteiligte Behörde */
  authorityOfficer: string;
};

export async function exportSeizureProtocol(input: SeizureInput) {
  const meta: DocMeta = {
    title: "Sicherstellungs- / Beschlagnahmungsprotokoll",
    subtitle: `Protokoll gemäß ${input.legalBasis || "§ 16a TierSchG"} – Tier-Sicherstellung`,
    fileNumber: input.caseRecord.id,
    docId: makeDocId([
      "seizure",
      input.caseRecord.id,
      input.occurredAt,
      input.location,
      input.holder,
    ]),
    version: SEIZURE_VERSION,
    generatedAt: nowIso(),
    authoredBy: input.sentinel.name,
  };

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const subject = `${input.caseRecord.german} (${input.caseRecord.species}) · CITES Anhang ${input.caseRecord.cites} · Region ${input.caseRecord.region} · zuständig: ${input.caseRecord.authority}`;
  const cover = drawCoverPage(doc, meta, subject);

  doc.addPage();
  const cur = new FlowCursor(doc, 48);

  cur.y = sectionHeader(doc, cur.y, "1 · Sachverhalt & Rechtsgrundlage", cur.margin);
  cur.y = defList(doc, cur.y, cur.margin, [
    ["Aktenzeichen", input.caseRecord.id],
    ["Datum / Uhrzeit", input.occurredAt],
    ["Ort der Maßnahme", input.location],
    ["Rechtsgrundlage", input.legalBasis],
    ["Beteiligte Behörde", input.authorityOfficer],
  ]);

  cur.ensure(80);
  cur.y = sectionHeader(doc, cur.y, "2 · Anlass / Sachverhalt", cur.margin);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(20);
  const circ = doc.splitTextToSize(
    input.circumstances || "—",
    doc.internal.pageSize.getWidth() - 2 * cur.margin,
  );
  cur.ensure(circ.length * 12 + 4);
  doc.text(circ, cur.margin, cur.y);
  cur.advance(circ.length * 12 + 8);

  cur.ensure(120);
  cur.y = sectionHeader(doc, cur.y, "3 · Tier & Identmerkmale", cur.margin);
  cur.y = defList(doc, cur.y, cur.margin, [
    ["Art (deutsch)", input.caseRecord.german],
    ["Wissenschaftlich", input.caseRecord.species],
    ["CITES-Anhang", input.caseRecord.cites],
    ["Herkunft (vermutet)", input.caseRecord.origin],
    ["Risiko-Einstufung", input.caseRecord.risk],
    ["Identmerkmale", input.identMarks],
    ["Zustand bei Sicherstellung", input.conditionAtSeizure],
  ]);

  cur.ensure(80);
  cur.y = sectionHeader(doc, cur.y, "4 · Halter / Verantwortlicher", cur.margin);
  cur.y = defList(doc, cur.y, cur.margin, [["Halter / Anschrift", input.holder]]);

  cur.ensure(80);
  cur.y = sectionHeader(doc, cur.y, "5 · Übernahme / Verwahrung", cur.margin);
  cur.y = defList(doc, cur.y, cur.margin, [
    ["Verwahrungsstelle", input.custodyLocation],
    ["Übernehmende Person", `${input.sentinel.name} (Sentinel · Stufe ${input.sentinel.tier})`],
    ["Region", input.sentinel.region],
  ]);

  cur.ensure(60);
  cur.y = sectionHeader(doc, cur.y, "6 · Zeugen", cur.margin);
  cur.y = defList(doc, cur.y, cur.margin, [["Zeugen", input.witnesses || "—"]]);

  cur.ensure(140);
  cur.y = sectionHeader(doc, cur.y, "7 · Unterschriften", cur.margin);
  cur.advance(20);
  cur.y = signatureLines(doc, cur.y, cur.margin, [
    { role: "Übernehmende Person", name: input.sentinel.name },
    { role: "Behördenvertreter:in", name: input.authorityOfficer },
    { role: "Halter / Verantwortlicher", name: input.holder.split("\n")[0] },
    { role: "Zeuge:in" },
  ]);

  finalizePages(doc, meta, cover);
  const pdfBlob = doc.output("blob");

  const json = JSON.stringify(
    {
      schema: "exoguard.seizure-protocol/1.0",
      docKitVersion: DOC_KIT_VERSION,
      documentVersion: meta.version,
      documentId: meta.docId,
      generatedAt: meta.generatedAt,
      sender: SENDER,
      confidentiality: { notice: CONFIDENTIALITY_NOTICE, legalBasis: LEGAL_BASIS },
      case: input.caseRecord,
      sentinel: input.sentinel,
      seizure: {
        location: input.location,
        occurredAt: input.occurredAt,
        legalBasis: input.legalBasis,
        circumstances: input.circumstances,
        holder: input.holder,
        identMarks: input.identMarks,
        conditionAtSeizure: input.conditionAtSeizure,
        witnesses: input.witnesses,
        custodyLocation: input.custodyLocation,
        authorityOfficer: input.authorityOfficer,
      },
    },
    null,
    2,
  );

  const base = safeFileBase("Sicherstellung", input.caseRecord.id);
  await downloadZip(
    base,
    pdfBlob,
    json,
    buildManifest(meta, { pdf: `${base}.pdf`, json: `${base}.json` }),
  );
}
