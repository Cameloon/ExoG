import type { CaseRecord, SentinelProfile } from "../dashboard-data";
import { INTAKE_TYPES, intakeType } from "../animal-workflow";
import { DOC_KIT_VERSION, documentSender, FlowCursor, buildManifest, defList, downloadZip, drawCoverPage, finalizePages, makeDocId, nowIso, safeFileBase, sectionHeader, signatureLines, type DocMeta } from "./doc-kit";

export type IntakeHandoverInput = {
  caseRecord: CaseRecord; sentinel: SentinelProfile;
  handoverAt: string; fromName: string; fromContact: string;
  receivingLocation: string; circumstances: string; accompanyingDocuments: string;
  draft?: boolean; missingFields?: string[];
};

export async function exportIntakeHandover(input: IntakeHandoverInput) {
  const { default: jsPDF } = await import("jspdf");
  const meta: DocMeta = {
    title: "Aufnahme- und Übergabeprotokoll", subtitle: INTAKE_TYPES[intakeType(input.caseRecord.intakeType)],
    fileNumber: input.caseRecord.id, docId: makeDocId(["intake", input.caseRecord.id, input.handoverAt, input.fromName]),
    version: "1.0.0", generatedAt: nowIso(), authoredBy: input.sentinel.name,
    draft: input.draft, missingFields: input.missingFields, sender: documentSender(input.sentinel),
  };
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const cover = drawCoverPage(doc, meta, `${input.caseRecord.german} (${input.caseRecord.species}) · Schutzstatus: ${input.caseRecord.cites}`);
  doc.addPage();
  const cur = new FlowCursor(doc, 48);
  cur.y = sectionHeader(doc, cur.y, "1 · Aufnahme und Beteiligte", cur.margin);
  cur.y = defList(doc, cur.y, cur.margin, [
    ["Aufnahmegrund", meta.subtitle], ["Datum / Uhrzeit", input.handoverAt], ["Abgebende Person / Stelle", input.fromName],
    ["Kontakt", input.fromContact], ["Übernehmende Person / Stelle", input.sentinel.name], ["Aufnahmeort", input.receivingLocation],
  ]);
  cur.ensure(160);
  cur.y = sectionHeader(doc, cur.y, "2 · Tier und Übergabeangaben", cur.margin);
  cur.y = defList(doc, cur.y, cur.margin, [["Aktenzeichen", input.caseRecord.id], ["Art", input.caseRecord.species], ["Geschlecht", input.caseRecord.sex ?? ""], ["Alter", input.caseRecord.age], ["Anlass / Angaben", input.circumstances], ["Begleitende Unterlagen", input.accompanyingDocuments]]);
  cur.ensure(100);
  cur.y = sectionHeader(doc, cur.y, "3 · Bestätigung der tatsächlichen Übergabe", cur.margin);
  cur.y = defList(doc, cur.y, cur.margin, [["Hinweis", "Dieses Protokoll dokumentiert die Aufnahme. Eigentumsübertragung, behördliche Anordnungen und Artenschutznachweise sind gesondert zu prüfen."]]);
  cur.ensure(100); cur.advance(20);
  signatureLines(doc, cur.y, cur.margin, [{ role: "Abgebende Person / Stelle", name: input.fromName }, { role: "Übernehmende Person / Stelle", name: input.sentinel.name }]);
  finalizePages(doc, meta, cover);
  const base = safeFileBase("Aufnahme-Uebergabe", input.caseRecord.id);
  await downloadZip(base, doc.output("blob"), JSON.stringify({ schema: "exoguard.intake-handover/1.0", docKitVersion: DOC_KIT_VERSION, metadata: meta, ...input }, null, 2), buildManifest(meta, { pdf: `${base}.pdf`, json: `${base}.json` }));
}
