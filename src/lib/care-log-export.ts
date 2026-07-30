import type jsPDF from "jspdf";
import type JSZip from "jszip";
import type { CaseRecord, CareLog, SentinelProfile } from "@/lib/dashboard-data";
import { RATIONALE_RULES, validateRationale, sign } from "@/lib/care-log-validation";

type ExportInput = {
  caseRecord: CaseRecord;
  logs: CareLog[];
  sentinel: SentinelProfile;
};

/** Dokumenten-Version des Export-Schemas (semver) */
export const EXPORT_DOC_VERSION = "1.2.0";

/** Absender / verantwortliche Stelle (Demo-Stammdaten) */
const SENDER = {
  org: "ExoGuard / BioSteward gGmbH",
  unit: "Koordinationsstelle Wildtier-Sicherstellung",
  street: "Tiergartenstraße 14",
  city: "10117 Berlin",
  country: "Deutschland",
  phone: "+49 30 555 014-200",
  email: "akten@exoguard.example",
  dpo: "datenschutz@exoguard.example",
  registry: "AG Berlin-Charlottenburg, HRB 274519 B",
};

const nowIso = () => new Date().toISOString();

/** Kurzer, deterministischer Dokument-Hash zur Wiedererkennung */
function docHash(input: ExportInput): string {
  const payload = `${input.caseRecord.id}|${input.logs.length}|${input.logs.map((l) => l.ts + l.type).join(",")}`;
  return sign(payload);
}

type CoverLayout = {
  pageCountAnchor: { x: number; y: number; clearW: number; clearH: number; fillRGB: [number, number, number] };
};

function drawCoverPage(
  doc: jsPDF,
  input: ExportInput,
  meta: { version: string; docId: string; generatedAt: string },
): CoverLayout {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56;
  let y = margin;

  // Top brand bar
  doc.setFillColor(20, 30, 50);
  doc.rect(0, 0, pageW, 8, "F");

  // Eyebrow
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("VERTRAULICH · BEHÖRDLICHER GEBRAUCH", margin, y + 18);
  y += 48;

  // Title
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Pflege-Log-Export", margin, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(80);
  doc.text("Behördentaugliches Dossier zur Tier-Sicherstellung", margin, y);
  y += 28;

  // Dokument-Metadaten Box
  doc.setDrawColor(210);
  doc.setFillColor(248, 249, 251);
  const boxH = 132;
  doc.roundedRect(margin, y, pageW - 2 * margin, boxH, 4, 4, "FD");
  const colX1 = margin + 14;
  const colX2 = margin + (pageW - 2 * margin) / 2 + 6;
  let by = y + 20;

  const kv = (x: number, yy: number, k: string, v: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(k.toUpperCase(), x, yy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(20);
    doc.text(v, x, yy + 12);
  };

  kv(colX1, by, "Aktenzeichen", input.caseRecord.id);
  kv(colX2, by, "Dokument-ID", meta.docId);
  by += 32;
  kv(colX1, by, "Dokument-Version", meta.version);
  kv(colX2, by, "Erstellt am", meta.generatedAt);
  by += 32;
  kv(colX1, by, "Einträge gesamt", String(input.logs.length));
  // Seitenanzahl wird später eingesetzt — Platzhalter rendern
  kv(colX2, by, "Seitenanzahl", "{{PAGES}}");
  // Anker für späteren Patch: y-Position der Wert-Zeile = by + 12 (siehe kv())
  const pageCountAnchor = {
    x: colX2,
    y: by + 12,
    clearW: (pageW - 2 * margin) / 2 - 20,
    clearH: 14,
    fillRGB: [248, 249, 251] as [number, number, number],
  };

  y += boxH + 22;

  // Fall-Zusammenfassung
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text("Gegenstand", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40);
  const subj = doc.splitTextToSize(
    `${input.caseRecord.german} (${input.caseRecord.species}) · CITES Anhang ${input.caseRecord.cites} · Region ${input.caseRecord.region} · zuständig: ${input.caseRecord.authority}`,
    pageW - 2 * margin,
  );
  doc.text(subj, margin, y);
  y += subj.length * 12 + 10;

  // Absender / Behördenkontakt
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text("Absender / Verantwortliche Stelle", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40);
  const senderLines = [
    SENDER.org,
    SENDER.unit,
    `${SENDER.street}, ${SENDER.city}, ${SENDER.country}`,
    `Tel.: ${SENDER.phone}    ·    E-Mail: ${SENDER.email}`,
    `Datenschutzbeauftragte/r: ${SENDER.dpo}`,
    `Registereintrag: ${SENDER.registry}`,
  ];
  senderLines.forEach((l) => {
    doc.text(l, margin, y);
    y += 12;
  });
  y += 6;

  // Bearbeiter (Sentinel)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text("Bearbeitende Person (Sentinel)", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40);
  doc.text(
    `${input.sentinel.name} · Stufe ${input.sentinel.tier} · Region ${input.sentinel.region}`,
    margin,
    y,
  );
  y += 18;

  // Vertraulichkeits- / Datenschutzhinweis
  doc.setDrawColor(220, 200, 120);
  doc.setFillColor(253, 248, 230);
  const noticeY = y;
  const noticeH = 118;
  doc.roundedRect(margin, noticeY, pageW - 2 * margin, noticeH, 4, 4, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(120, 80, 0);
  doc.text("Vertraulichkeits- und Datenschutzhinweis", margin + 12, noticeY + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(60, 50, 20);
  const notice = doc.splitTextToSize(
    "Dieses Dokument enthält personenbezogene Daten im Sinne der DSGVO sowie behördlich vertrauliche Informationen zu einer Tier-Sicherstellung. Die Verarbeitung erfolgt zur Erfüllung einer rechtlichen Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO) und im öffentlichen Interesse (Art. 6 Abs. 1 lit. e DSGVO) im Rahmen des BNatSchG, TierSchG und der BArtSchV. Weitergabe ausschließlich an befugte Stellen. Unbefugte Vervielfältigung, Speicherung oder Weitergabe an Dritte ist untersagt und kann straf- sowie aufsichtsrechtliche Folgen haben (§ 203 StGB, Art. 83 DSGVO). Die enthaltenen Signaturen dienen der Integritätssicherung der Demo-Plattform und ersetzen keine qualifizierte elektronische Signatur (eIDAS).",
    pageW - 2 * margin - 24,
  );
  doc.text(notice, margin + 12, noticeY + 32);
  y = noticeY + noticeH + 18;

  // Fußleiste auf Cover
  doc.setDrawColor(220);
  doc.line(margin, pageH - margin + 8, pageW - margin, pageH - margin + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(120);
  doc.text(
    `Dokument-ID ${meta.docId} · Version ${meta.version} · ${meta.generatedAt}`,
    margin,
    pageH - margin + 20,
  );
  const right = "Deckblatt · Seite 1";
  doc.text(right, pageW - margin - doc.getTextWidth(right), pageH - margin + 20);

  return { pageCountAnchor };
}

function buildPdf({ caseRecord, logs, sentinel }: ExportInput, jsPDF: typeof import("jspdf").default): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  // 1) Deckblatt zuerst rendern
  const generatedAt = nowIso();
  const docId = docHash({ caseRecord, logs, sentinel });
  const coverLayout = drawCoverPage(doc, { caseRecord, logs, sentinel }, {
    version: EXPORT_DOC_VERSION,
    docId,
    generatedAt,
  });

  // 2) Inhaltsseiten auf neuer Seite beginnen
  doc.addPage();
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("ExoGuard / BioSteward — Pflege-Log-Export", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(`Aktenzeichen: ${caseRecord.id}    ·    Erstellt: ${nowIso()}`, margin, y);
  y += 10;
  doc.text(
    `Sentinel: ${sentinel.name} (${sentinel.tier}, Region ${sentinel.region})`,
    margin,
    y,
  );
  y += 16;

  // Case meta block
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 14;
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${caseRecord.german}`, margin, y);
  y += 13;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(caseRecord.species, margin, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  const meta = [
    `CITES Anhang: ${caseRecord.cites}`,
    `Status: ${caseRecord.status}`,
    `Region: ${caseRecord.region}`,
    `Behörde: ${caseRecord.authority}`,
    `Herkunft: ${caseRecord.origin}`,
    `Risiko: ${caseRecord.risk}`,
  ];
  meta.forEach((line) => {
    doc.text(line, margin, y);
    y += 11;
  });
  y += 6;

  // Validation summary
  const validations = logs.map((l) => ({ log: l, v: validateRationale(l.type, l.rationale ?? "") }));
  const okCount = validations.filter((x) => x.v.ok).length;
  const failCount = validations.length - okCount;

  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 14;
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Validierungs-Zusammenfassung", margin, y);
  y += 13;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(
    `Einträge gesamt: ${logs.length}    ·    konform: ${okCount}    ·    nicht konform: ${failCount}`,
    margin,
    y,
  );
  y += 16;

  // Entries
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Pflege-Einträge (chronologisch absteigend)", margin, y);
  y += 14;

  validations.forEach(({ log, v }, i) => {
    ensureSpace(110);
    const rule = RATIONALE_RULES[log.type];

    // Header row
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 10, pageW - 2 * margin, 16, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text(`#${i + 1}  ${log.type}`, margin + 6, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90);
    const right = `${log.ts}  ·  ${log.author}`;
    doc.text(right, pageW - margin - 6 - doc.getTextWidth(right), y);
    y += 14;

    // Note
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const note = doc.splitTextToSize(`Beobachtung: ${log.note}`, pageW - 2 * margin);
    ensureSpace(note.length * 11 + 4);
    doc.text(note, margin, y);
    y += note.length * 11 + 2;

    // Metrics
    if (log.metrics) {
      const parts: string[] = [];
      if (log.metrics.tempC !== undefined) parts.push(`Temp ${log.metrics.tempC}°C`);
      if (log.metrics.humidity !== undefined) parts.push(`rF ${log.metrics.humidity}%`);
      if (log.metrics.feedItem)
        parts.push(
          `Futter: ${log.metrics.feedItem}${log.metrics.feedAmountG ? ` (${log.metrics.feedAmountG} g)` : ""}`,
        );
      if (log.metrics.behavior) parts.push(`Verhalten: ${log.metrics.behavior}`);
      if (parts.length) {
        doc.setTextColor(80);
        doc.text(`Messwerte: ${parts.join("  ·  ")}`, margin, y);
        y += 11;
      }
    }

    // Rationale
    if (log.rationale) {
      const rText = doc.splitTextToSize(`Begründung: ${log.rationale}`, pageW - 2 * margin);
      ensureSpace(rText.length * 11 + 4);
      doc.setTextColor(0);
      doc.text(rText, margin, y);
      y += rText.length * 11 + 2;
    }

    // Validation block
    ensureSpace(34);
    doc.setFontSize(8);
    doc.setTextColor(v.ok ? 30 : 160, v.ok ? 110 : 30, v.ok ? 60 : 30);
    doc.text(
      `Validierung: ${v.ok ? "KONFORM" : "NICHT KONFORM"}  ·  Länge ${v.length}/${v.minLen}`,
      margin,
      y,
    );
    y += 10;
    doc.setTextColor(60);
    doc.text(
      `Aspekte abgedeckt: ${v.covered.join(", ") || "—"}`,
      margin,
      y,
    );
    y += 10;
    if (v.missing.length) {
      doc.setTextColor(160, 30, 30);
      doc.text(`Fehlend: ${v.missing.join(", ")}`, margin, y);
      y += 10;
    }
    doc.setTextColor(60);
    const sigPayload = `${caseRecord.id}|${log.type}|${log.note}|${log.rationale ?? ""}|${log.author}|${log.ts}`;
    const signature = log.signature ?? sign(sigPayload);
    doc.text(`Signatur: ${signature}`, margin, y);
    y += 14;

    // Separator
    doc.setDrawColor(220);
    doc.line(margin, y, pageW - margin, y);
    y += 10;
    doc.setFontSize(9);
  });

  // Footer auf jeder Inhaltsseite (Cover hat eigenen Footer)
  const pageCount = doc.getNumberOfPages();
  for (let p = 2; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(
      `ExoGuard / BioSteward · vertraulich · Aktenzeichen ${caseRecord.id} · Dok ${docId} · v${EXPORT_DOC_VERSION} · Seite ${p}/${pageCount}`,
      margin,
      pageH - 20,
    );
  }

  // Seitenanzahl-Platzhalter auf dem Deckblatt nachtragen — Position vom Renderer geliefert,
  // damit Layoutänderungen (Seitengröße, Fonts, Margins) nicht zu Drift führen.
  doc.setPage(1);
  const anchor = coverLayout.pageCountAnchor;
  const valueText = `${pageCount} (inkl. Deckblatt)`;

  // Vorher exakt die Breite des Platzhalters/neuen Werts ermitteln, um sauber zu überdecken.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const placeholderW = doc.getTextWidth("{{PAGES}}");
  const valueW = doc.getTextWidth(valueText);
  const clearW = Math.max(anchor.clearW, placeholderW, valueW) + 4;

  doc.setFillColor(...anchor.fillRGB);
  // y in jsPDF ist die Baseline → Box knapp oberhalb beginnen, Höhe großzügig
  doc.rect(anchor.x - 2, anchor.y - 10, clearW, anchor.clearH, "F");
  doc.setTextColor(20);
  doc.text(valueText, anchor.x, anchor.y);

  return doc.output("blob");
}

function buildJson({ caseRecord, logs, sentinel }: ExportInput): string {
  const validations = logs.map((log) => {
    const v = validateRationale(log.type, log.rationale ?? "");
    const sigPayload = `${caseRecord.id}|${log.type}|${log.note}|${log.rationale ?? ""}|${log.author}|${log.ts}`;
    return {
      ts: log.ts,
      author: log.author,
      type: log.type,
      note: log.note,
      rationale: log.rationale ?? null,
      metrics: log.metrics ?? null,
      validation: {
        compliant: v.ok,
        length: v.length,
        minLen: v.minLen,
        coveredAspects: v.covered,
        missingAspects: v.missing,
        rule: RATIONALE_RULES[log.type],
      },
      signature: log.signature ?? sign(sigPayload),
    };
  });

  const summary = {
    total: logs.length,
    compliant: validations.filter((e) => e.validation.compliant).length,
    nonCompliant: validations.filter((e) => !e.validation.compliant).length,
  };

  return JSON.stringify(
    {
      schema: "exoguard.care-log.export/1.0",
      documentVersion: EXPORT_DOC_VERSION,
      documentId: docHash({ caseRecord, logs, sentinel }),
      generatedAt: nowIso(),
      sender: SENDER,
      confidentiality: {
        classification: "VERTRAULICH — Behördlicher Gebrauch",
        legalBasis: ["Art. 6 (1) c DSGVO", "Art. 6 (1) e DSGVO", "BNatSchG", "TierSchG", "BArtSchV"],
        notice:
          "Personenbezogene und behördlich vertrauliche Daten. Weitergabe nur an befugte Stellen. Signaturen ersetzen keine qualifizierte elektronische Signatur (eIDAS).",
      },
      case: caseRecord,
      sentinel,
      summary,
      entries: validations,
    },
    null,
    2,
  );
}

function buildManifest(input: ExportInput, fileNames: { pdf: string; json: string }) {
  return [
    "ExoGuard / BioSteward — Export-Manifest",
    "----------------------------------------",
    `Dokument-Version: ${EXPORT_DOC_VERSION}`,
    `Dokument-ID:    ${docHash(input)}`,
    `Aktenzeichen:   ${input.caseRecord.id}`,
    `Tier:           ${input.caseRecord.german} (${input.caseRecord.species})`,
    `CITES Anhang:   ${input.caseRecord.cites}`,
    `Sentinel:       ${input.sentinel.name} (${input.sentinel.tier})`,
    `Erstellt:       ${nowIso()}`,
    `Einträge:       ${input.logs.length}`,
    "",
    "Absender / Verantwortliche Stelle:",
    `  ${SENDER.org}`,
    `  ${SENDER.unit}`,
    `  ${SENDER.street}, ${SENDER.city}, ${SENDER.country}`,
    `  Tel.: ${SENDER.phone}  ·  E-Mail: ${SENDER.email}`,
    `  Datenschutz: ${SENDER.dpo}`,
    `  Register: ${SENDER.registry}`,
    "",
    "Inhalt:",
    `  - ${fileNames.pdf}   (behördentaugliches PDF inkl. Deckblatt)`,
    `  - ${fileNames.json}  (maschinenlesbarer JSON-Export inkl. Validierung)`,
    "",
    "Vertraulichkeit: VERTRAULICH — Behördlicher Gebrauch.",
    "Rechtsgrundlage: Art. 6 (1) c und e DSGVO i.V.m. BNatSchG, TierSchG, BArtSchV.",
    "Weitergabe ausschließlich an befugte Stellen. Unbefugte Vervielfältigung",
    "kann straf- und aufsichtsrechtliche Folgen haben (§ 203 StGB, Art. 83 DSGVO).",
    "",
    "Hinweis: Signaturen sind UI-Demo (deterministischer Hash) und nicht",
    "kryptografisch im Sinne von eIDAS. Für rechtsverbindliche Signaturen",
    "ist die Anbindung eines qualifizierten Trust-Service-Providers vorgesehen.",
    "",
  ].join("\n");
}

export async function exportCareLogsZip(input: ExportInput): Promise<void> {
  // ponytail: dynamic import — jspdf/jszip are ~400KB and only needed on export click
  const [{ default: jsPDF }, { default: JSZip }] = await Promise.all([
    import("jspdf"),
    import("jszip"),
  ]);
  const safeId = input.caseRecord.id.replace(/[^A-Za-z0-9_-]/g, "_");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = `Pflegelog_${safeId}_${stamp}`;
  const pdfName = `${baseName}.pdf`;
  const jsonName = `${baseName}.json`;
  const manifestName = "MANIFEST.txt";

  const pdfBlob = buildPdf(input, jsPDF);
  const jsonStr = buildJson(input);
  const manifestStr = buildManifest(input, { pdf: pdfName, json: jsonName });

  const zip = new JSZip();
  zip.file(pdfName, pdfBlob);
  zip.file(jsonName, jsonStr);
  zip.file(manifestName, manifestStr);

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
