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

export const FOUND_VERSION = "1.0.0";

export type FoundAnimalInput = {
  caseRecord: CaseRecord;
  sentinel: SentinelProfile;
  foundAt: string;
  foundLocation: string;
  finderName: string;
  finderContact: string;
  circumstances: string;
  identMarks: string;
  estimatedAge: string;
  health: string;
  custodyLocation: string;
  reportedAuthority: string;
  reportedAt: string;
};

export async function exportFoundAnimalReport(input: FoundAnimalInput) {
  const meta: DocMeta = {
    title: "Fundtier-Meldung & Verwahrungsnachweis",
    subtitle: "Meldung gemäß §§ 965 ff. BGB i.V.m. TierSchG / BNatSchG",
    fileNumber: input.caseRecord.id,
    docId: makeDocId(["found", input.caseRecord.id, input.foundAt, input.foundLocation]),
    version: FOUND_VERSION,
    generatedAt: nowIso(),
    authoredBy: input.sentinel.name,
  };

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const subject = `${input.caseRecord.german} (${input.caseRecord.species}) · CITES Anhang ${input.caseRecord.cites} · Region ${input.caseRecord.region}`;
  const cover = drawCoverPage(doc, meta, subject);

  doc.addPage();
  const cur = new FlowCursor(doc, 48);

  cur.y = sectionHeader(doc, cur.y, "1 · Fundumstände", cur.margin);
  cur.y = defList(doc, cur.y, cur.margin, [
    ["Datum / Uhrzeit Fund", input.foundAt],
    ["Fundort", input.foundLocation],
    ["Beschreibung", input.circumstances],
  ]);

  cur.ensure(80);
  cur.y = sectionHeader(doc, cur.y, "2 · Finder:in", cur.margin);
  cur.y = defList(doc, cur.y, cur.margin, [
    ["Name", input.finderName],
    ["Kontakt", input.finderContact],
  ]);

  cur.ensure(120);
  cur.y = sectionHeader(doc, cur.y, "3 · Tier & Identmerkmale", cur.margin);
  cur.y = defList(doc, cur.y, cur.margin, [
    ["Art (deutsch)", input.caseRecord.german],
    ["Wissenschaftlich", input.caseRecord.species],
    ["CITES-Anhang", input.caseRecord.cites],
    ["Geschätztes Alter", input.estimatedAge],
    ["Identmerkmale (Chip/Ring/Marker)", input.identMarks],
    ["Gesundheitlicher Zustand", input.health],
  ]);

  cur.ensure(80);
  cur.y = sectionHeader(doc, cur.y, "4 · Verwahrung", cur.margin);
  cur.y = defList(doc, cur.y, cur.margin, [
    ["Verwahrungsstelle", input.custodyLocation],
    ["Verantwortlich", `${input.sentinel.name} (Sentinel · Stufe ${input.sentinel.tier})`],
    ["Region", input.sentinel.region],
  ]);

  cur.ensure(80);
  cur.y = sectionHeader(doc, cur.y, "5 · Behördliche Meldung", cur.margin);
  cur.y = defList(doc, cur.y, cur.margin, [
    ["Gemeldet an", input.reportedAuthority || input.caseRecord.authority],
    ["Gemeldet am", input.reportedAt],
  ]);

  cur.ensure(120);
  cur.y = sectionHeader(doc, cur.y, "6 · Bestätigung", cur.margin);
  cur.advance(20);
  cur.y = signatureLines(doc, cur.y, cur.margin, [
    { role: "Verwahrungsstelle", name: input.sentinel.name },
    { role: "Behördenvertreter:in" },
    { role: "Finder:in", name: input.finderName },
  ]);

  finalizePages(doc, meta, cover);
  const pdfBlob = doc.output("blob");

  const json = JSON.stringify(
    {
      schema: "exoguard.found-animal/1.0",
      docKitVersion: DOC_KIT_VERSION,
      documentVersion: meta.version,
      documentId: meta.docId,
      generatedAt: meta.generatedAt,
      sender: SENDER,
      confidentiality: { notice: CONFIDENTIALITY_NOTICE, legalBasis: LEGAL_BASIS },
      case: input.caseRecord,
      sentinel: input.sentinel,
      found: {
        foundAt: input.foundAt,
        foundLocation: input.foundLocation,
        finderName: input.finderName,
        finderContact: input.finderContact,
        circumstances: input.circumstances,
        identMarks: input.identMarks,
        estimatedAge: input.estimatedAge,
        health: input.health,
        custodyLocation: input.custodyLocation,
        reportedAuthority: input.reportedAuthority,
        reportedAt: input.reportedAt,
      },
    },
    null,
    2,
  );

  const base = safeFileBase("Fundtier", input.caseRecord.id);
  await downloadZip(
    base,
    pdfBlob,
    json,
    buildManifest(meta, { pdf: `${base}.pdf`, json: `${base}.json` }),
  );
}
