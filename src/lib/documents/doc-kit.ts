/**
 * Wiederverwendbare Bausteine für behördentaugliche PDF-Dokumente:
 *  - einheitliches Deckblatt (Versionsnummer, Doc-ID, Seitenanzahl, Vertraulichkeit)
 *  - einheitlicher Footer mit Aktenzeichen, Doc-ID, Version, Seitenzahl
 *  - KV-Boxen, Section-Header, Signatur-Blöcke
 *  - ZIP-Build mit PDF + JSON + MANIFEST
 */
import jsPDF from "jspdf";
import JSZip from "jszip";
import { sign } from "@/lib/care-log-validation";

export const DOC_KIT_VERSION = "1.0.0";

/** Zentrale Absender-Stammdaten (Demo) — konsistent mit care-log-export. */
export const SENDER = {
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

export const CONFIDENTIALITY_NOTICE =
  "Dieses Dokument enthält personenbezogene Daten im Sinne der DSGVO sowie behördlich vertrauliche Informationen. Die Verarbeitung erfolgt zur Erfüllung einer rechtlichen Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO) und im öffentlichen Interesse (Art. 6 Abs. 1 lit. e DSGVO) im Rahmen des BNatSchG, TierSchG und der BArtSchV. Weitergabe ausschließlich an befugte Stellen. Unbefugte Vervielfältigung, Speicherung oder Weitergabe an Dritte ist untersagt und kann straf- sowie aufsichtsrechtliche Folgen haben (§ 203 StGB, Art. 83 DSGVO). Die enthaltenen Signaturen dienen der Integritätssicherung der Demo-Plattform und ersetzen keine qualifizierte elektronische Signatur (eIDAS).";

export const LEGAL_BASIS = [
  "Art. 6 (1) c DSGVO",
  "Art. 6 (1) e DSGVO",
  "BNatSchG",
  "TierSchG",
  "BArtSchV",
];

export const nowIso = () => new Date().toISOString();

export type DocMeta = {
  /** Sprechende Dokument-Bezeichnung, z. B. "Sicherstellungsprotokoll" */
  title: string;
  /** Untertitel, z. B. "Behördentaugliches Protokoll …" */
  subtitle: string;
  /** Aktenzeichen / Case-ID */
  fileNumber: string;
  /** Eindeutiger Bezeichner zur Wiedererkennung (Hash) */
  docId: string;
  /** semver des spezifischen Dokumentschemas */
  version: string;
  /** Erstellzeitpunkt ISO */
  generatedAt: string;
  /** Bearbeitende Person */
  authoredBy: string;
};

type CoverLayout = {
  pageCountAnchor: { x: number; y: number; clearW: number; clearH: number };
};

/** Erzeugt einen deterministischen, kurzen Doc-Identifier. */
export function makeDocId(parts: (string | number | undefined | null)[]) {
  return sign(parts.map((p) => String(p ?? "")).join("|"));
}

/** Helper: Key/Value-Paar in zwei Spalten */
function kv(doc: jsPDF, x: number, y: number, k: string, v: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text(k.toUpperCase(), x, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(20);
  doc.text(v, x, y + 12);
}

/** Section-Überschrift im Inhaltsteil */
export function sectionHeader(doc: jsPDF, y: number, label: string, margin: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(label, margin, y);
  doc.setDrawColor(220);
  doc.line(margin, y + 4, doc.internal.pageSize.getWidth() - margin, y + 4);
  return y + 16;
}

/** Einfache Definitionsliste; gibt das neue y zurück. */
export function defList(
  doc: jsPDF,
  startY: number,
  margin: number,
  rows: Array<[label: string, value: string]>,
) {
  let y = startY;
  const labelW = 150;
  doc.setFontSize(9);
  rows.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80);
    doc.text(k, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20);
    const wrapped = doc.splitTextToSize(
      v || "—",
      doc.internal.pageSize.getWidth() - 2 * margin - labelW,
    );
    doc.text(wrapped, margin + labelW, y);
    y += Math.max(12, wrapped.length * 11);
  });
  return y + 4;
}

/** Zeichnet das einheitliche Deckblatt und liefert die Position für das Seitenanzahl-Patch. */
export function drawCoverPage(doc: jsPDF, meta: DocMeta, subject: string): CoverLayout {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56;
  let y = margin;

  doc.setFillColor(20, 30, 50);
  doc.rect(0, 0, pageW, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("VERTRAULICH · BEHÖRDLICHER GEBRAUCH", margin, y + 18);
  y += 48;

  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(meta.title, margin, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(80);
  const sub = doc.splitTextToSize(meta.subtitle, pageW - 2 * margin);
  doc.text(sub, margin, y);
  y += sub.length * 14 + 14;

  // Metadaten-Box
  doc.setDrawColor(210);
  doc.setFillColor(248, 249, 251);
  const boxH = 132;
  doc.roundedRect(margin, y, pageW - 2 * margin, boxH, 4, 4, "FD");
  const colX1 = margin + 14;
  const colX2 = margin + (pageW - 2 * margin) / 2 + 6;
  let by = y + 20;
  kv(doc, colX1, by, "Aktenzeichen", meta.fileNumber);
  kv(doc, colX2, by, "Dokument-ID", meta.docId);
  by += 32;
  kv(doc, colX1, by, "Dokument-Version", meta.version);
  kv(doc, colX2, by, "Erstellt am", meta.generatedAt);
  by += 32;
  kv(doc, colX1, by, "Bearbeitet von", meta.authoredBy);
  kv(doc, colX2, by, "Seitenanzahl", "{{PAGES}}");
  const pageCountAnchor = {
    x: colX2,
    y: by + 12,
    clearW: (pageW - 2 * margin) / 2 - 20,
    clearH: 14,
  };
  y += boxH + 22;

  // Gegenstand
  y = sectionHeader(doc, y, "Gegenstand", margin);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40);
  const subj = doc.splitTextToSize(subject, pageW - 2 * margin);
  doc.text(subj, margin, y);
  y += subj.length * 12 + 8;

  // Absender
  y = sectionHeader(doc, y, "Absender / Verantwortliche Stelle", margin);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40);
  [
    SENDER.org,
    SENDER.unit,
    `${SENDER.street}, ${SENDER.city}, ${SENDER.country}`,
    `Tel.: ${SENDER.phone}    ·    E-Mail: ${SENDER.email}`,
    `Datenschutzbeauftragte/r: ${SENDER.dpo}`,
    `Registereintrag: ${SENDER.registry}`,
  ].forEach((l) => {
    doc.text(l, margin, y);
    y += 12;
  });
  y += 6;

  // Vertraulichkeit
  doc.setDrawColor(220, 200, 120);
  doc.setFillColor(253, 248, 230);
  const noticeH = 118;
  doc.roundedRect(margin, y, pageW - 2 * margin, noticeH, 4, 4, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(120, 80, 0);
  doc.text("Vertraulichkeits- und Datenschutzhinweis", margin + 12, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(60, 50, 20);
  const notice = doc.splitTextToSize(CONFIDENTIALITY_NOTICE, pageW - 2 * margin - 24);
  doc.text(notice, margin + 12, y + 32);

  // Footer Cover
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

/** Trägt nach dem Rendern Seitenanzahl + Footer auf allen Inhaltsseiten ein. */
export function finalizePages(doc: jsPDF, meta: DocMeta, cover: CoverLayout) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const pageCount = doc.getNumberOfPages();

  for (let p = 2; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(
      `ExoGuard / BioSteward · vertraulich · Az. ${meta.fileNumber} · Dok ${meta.docId} · v${meta.version} · Seite ${p}/${pageCount}`,
      margin,
      pageH - 20,
    );
  }

  doc.setPage(1);
  const valueText = `${pageCount} (inkl. Deckblatt)`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const placeholderW = doc.getTextWidth("{{PAGES}}");
  const valueW = doc.getTextWidth(valueText);
  const clearW = Math.max(cover.pageCountAnchor.clearW, placeholderW, valueW) + 4;
  doc.setFillColor(248, 249, 251);
  doc.rect(
    cover.pageCountAnchor.x - 2,
    cover.pageCountAnchor.y - 10,
    clearW,
    cover.pageCountAnchor.clearH,
    "F",
  );
  doc.setTextColor(20);
  doc.text(valueText, cover.pageCountAnchor.x, cover.pageCountAnchor.y);
}

/** Signaturzeile mit Unterschrift-Linie. */
export function signatureLines(
  doc: jsPDF,
  startY: number,
  margin: number,
  parties: Array<{ role: string; name?: string }>,
) {
  const pageW = doc.internal.pageSize.getWidth();
  const colW = (pageW - 2 * margin - 24) / 2;
  let y = startY;
  for (let i = 0; i < parties.length; i += 2) {
    const a = parties[i];
    const b = parties[i + 1];
    doc.setDrawColor(140);
    doc.line(margin, y, margin + colW, y);
    if (b) doc.line(margin + colW + 24, y, margin + 2 * colW + 24, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(`${a.role}${a.name ? ` · ${a.name}` : ""}`, margin, y + 12);
    if (b) doc.text(`${b.role}${b.name ? ` · ${b.name}` : ""}`, margin + colW + 24, y + 12);
    y += 44;
  }
  return y;
}

/** ===== Attachments (Anhänge) ===== */
export type AttachmentKind = "vet-attest" | "photo" | "certificate" | "other";

export const ATTACHMENT_KIND_LABEL: Record<AttachmentKind, string> = {
  "vet-attest": "Tierärztliches Attest",
  photo: "Foto-Dokumentation",
  certificate: "Zusatzbescheinigung",
  other: "Sonstiger Anhang",
};

export type Attachment = {
  name: string;
  mime: string;
  sizeBytes: number;
  bytes: Uint8Array;
  kind: AttachmentKind;
  note?: string;
  /** Hex-SHA-256 für Integritätsnachweis */
  sha256: string;
};

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
      return toHex(digest);
    } catch {
      /* fallthrough */
    }
  }
  // Fallback (nicht kryptografisch) — verwendet Demo-Signatur
  return sign(Array.from(bytes.slice(0, 4096)).join(","));
}

export async function fileToAttachment(
  file: File,
  kind: AttachmentKind,
  note?: string,
): Promise<Attachment> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const sha = await sha256Hex(buf);
  return {
    name: file.name,
    mime: file.type || "application/octet-stream",
    sizeBytes: file.size,
    bytes: buf,
    kind,
    note,
    sha256: sha,
  };
}

const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} kB` : `${(n / 1048576).toFixed(2)} MB`;

/** Render einer Anhangs-Übersicht als Tabelle (Name, Typ, Größe, SHA-256). */
export function attachmentsTable(
  doc: jsPDF,
  startY: number,
  margin: number,
  list: Attachment[],
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const innerW = pageW - 2 * margin;
  let y = startY;

  if (!list.length) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text("— Keine Anhänge beigefügt.", margin, y);
    return y + 14;
  }

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text("ANHANG", margin, y);
  doc.text("TYP", margin + innerW * 0.42, y);
  doc.text("GRÖSSE", margin + innerW * 0.66, y);
  doc.text("SHA-256", margin + innerW * 0.78, y);
  doc.setDrawColor(220);
  doc.line(margin, y + 3, margin + innerW, y + 3);
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(20);
  list.forEach((a, i) => {
    const nameLines = doc.splitTextToSize(`${i + 1}. ${a.name}`, innerW * 0.40);
    doc.text(nameLines, margin, y);
    doc.text(ATTACHMENT_KIND_LABEL[a.kind], margin + innerW * 0.42, y);
    doc.text(fmtBytes(a.sizeBytes), margin + innerW * 0.66, y);
    doc.setFont("courier", "normal");
    doc.setFontSize(7.5);
    doc.text(a.sha256.slice(0, 16) + "…", margin + innerW * 0.78, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    let h = Math.max(12, nameLines.length * 11);
    if (a.note) {
      const noteLines = doc.splitTextToSize(`Notiz: ${a.note}`, innerW - 12);
      doc.setTextColor(110);
      doc.text(noteLines, margin + 12, y + h);
      doc.setTextColor(20);
      h += noteLines.length * 10 + 2;
    }
    y += h + 2;
  });
  return y + 4;
}

/** Hängt jedes Bild-Attachment auf einer eigenen Seite an. */
export function embedImageAttachments(doc: jsPDF, list: Attachment[]) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const images = list.filter((a) => /^image\/(png|jpe?g|webp)$/i.test(a.mime));
  images.forEach((a) => {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(`Bild-Anhang · ${a.name}`, margin, margin);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(110);
    doc.text(
      `${ATTACHMENT_KIND_LABEL[a.kind]} · ${fmtBytes(a.sizeBytes)} · SHA-256 ${a.sha256.slice(0, 24)}…`,
      margin,
      margin + 14,
    );
    if (a.note) {
      const lines = doc.splitTextToSize(a.note, pageW - 2 * margin);
      doc.setTextColor(60);
      doc.text(lines, margin, margin + 28);
    }

    try {
      // jsPDF benötigt Base64; binary string ist okay
      let bin = "";
      for (let i = 0; i < a.bytes.length; i++) bin += String.fromCharCode(a.bytes[i]);
      const b64 = btoa(bin);
      const fmt = /png/i.test(a.mime) ? "PNG" : /webp/i.test(a.mime) ? "WEBP" : "JPEG";
      const dataUrl = `data:${a.mime};base64,${b64}`;
      const maxW = pageW - 2 * margin;
      const maxH = pageH - margin - 80;
      // Provisorisch full-width; jsPDF skaliert mit Höhe = auto, deshalb beide setzen
      const props = (doc as unknown as { getImageProperties: (d: string) => { width: number; height: number } }).getImageProperties(dataUrl);
      const ratio = props.width / props.height;
      let w = maxW;
      let h = w / ratio;
      if (h > maxH) {
        h = maxH;
        w = h * ratio;
      }
      doc.addImage(dataUrl, fmt, margin + (maxW - w) / 2, margin + 60, w, h, undefined, "FAST");
    } catch (e) {
      doc.setTextColor(180, 60, 60);
      doc.text("Bild konnte nicht eingebettet werden.", margin, margin + 80);
    }
  });
}

/** Manifest-Generator. */
export function buildManifest(
  meta: DocMeta,
  files: { pdf: string; json: string },
  attachments: Attachment[] = [],
) {
  return [
    `ExoGuard / BioSteward — ${meta.title}`,
    "----------------------------------------",
    `Dokument-Version: ${meta.version}`,
    `Dokument-ID:    ${meta.docId}`,
    `Aktenzeichen:   ${meta.fileNumber}`,
    `Erstellt:       ${meta.generatedAt}`,
    `Bearbeiter:     ${meta.authoredBy}`,
    "",
    "Absender / Verantwortliche Stelle:",
    `  ${SENDER.org}`,
    `  ${SENDER.unit}`,
    `  ${SENDER.street}, ${SENDER.city}, ${SENDER.country}`,
    `  Tel.: ${SENDER.phone}  ·  E-Mail: ${SENDER.email}`,
    `  Datenschutz: ${SENDER.dpo}`,
    `  Register:    ${SENDER.registry}`,
    "",
    "Inhalt:",
    `  - ${files.pdf}   (behördentaugliches PDF inkl. Deckblatt)`,
    `  - ${files.json}  (maschinenlesbarer JSON-Export)`,
    ...(attachments.length
      ? [
          `  - attachments/   (${attachments.length} Anhang${attachments.length === 1 ? "" : "e"})`,
          "",
          "Anhänge (Integrität SHA-256):",
          ...attachments.map(
            (a, i) =>
              `  ${String(i + 1).padStart(2, "0")}. ${a.name} · ${ATTACHMENT_KIND_LABEL[a.kind]} · ${fmtBytes(a.sizeBytes)} · ${a.sha256}`,
          ),
        ]
      : []),
    "",
    "Vertraulichkeit: VERTRAULICH — Behördlicher Gebrauch.",
    `Rechtsgrundlage: ${LEGAL_BASIS.join(", ")}.`,
    "Weitergabe ausschließlich an befugte Stellen.",
    "Hinweis: Signaturen sind UI-Demo (deterministischer Hash) und nicht",
    "kryptografisch im Sinne von eIDAS.",
    "",
  ].join("\n");
}

/** Versendet ZIP mit PDF + JSON + Manifest (+ optional Anhänge) als Browser-Download. */
export async function downloadZip(
  baseName: string,
  pdfBlob: Blob,
  jsonStr: string,
  manifestStr: string,
  attachments: Attachment[] = [],
) {
  const pdfName = `${baseName}.pdf`;
  const jsonName = `${baseName}.json`;
  const zip = new JSZip();
  zip.file(pdfName, pdfBlob);
  zip.file(jsonName, jsonStr);
  zip.file("MANIFEST.txt", manifestStr);
  if (attachments.length) {
    const folder = zip.folder("attachments")!;
    const seen = new Map<string, number>();
    attachments.forEach((a) => {
      const n = (seen.get(a.name) ?? 0) + 1;
      seen.set(a.name, n);
      const safeName = n > 1 ? `${n}_${a.name}` : a.name;
      folder.file(safeName, a.bytes);
    });
  }
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

/** Fortlaufendes Y-Tracking mit Auto-Page-Break. */
export class FlowCursor {
  y: number;
  margin = 48;
  constructor(public doc: jsPDF, startY: number) {
    this.y = startY;
  }
  ensure(needed: number) {
    if (this.y + needed > this.doc.internal.pageSize.getHeight() - this.margin) {
      this.doc.addPage();
      this.y = this.margin;
    }
  }
  advance(d: number) {
    this.y += d;
  }
}

export function safeFileBase(prefix: string, fileNumber: string) {
  const safe = fileNumber.replace(/[^A-Za-z0-9_-]/g, "_");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}_${safe}_${stamp}`;
}
