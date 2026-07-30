// Demo-Daten für die Plattform-Demo (Frontend-only).

export type CaseStatus = "Intake" | "Triage" | "Transport" | "Pflege" | "Outcome";
// ponytail: string, not a union — demo uses A/B/C, live wards carry the real
// CITES listing (I, II, III, I/II, …) from cites_species.
export type CitesAnnex = string;
export type RiskLevel = "kritisch" | "hoch" | "mittel" | "stabil";

export interface CaseRecord {
  id: string;
  species: string;
  german: string;
  cites: CitesAnnex;
  status: CaseStatus;
  region: string;
  authority: string;
  steward?: string;
  age: string;
  risk: RiskLevel;
  updated: string;
  origin: "Behörde" | "Zivile Übergabe";
  outcome?: "Sanctuary" | "Sentinel-Endpunkt" | "Rückführung Halter";
}

export const CASES: CaseRecord[] = [
  { id: "EG-2026-00471", species: "Trimeresurus albolabris", german: "Weißlippen-Bambusotter", cites: "B", status: "Triage", region: "BY", authority: "VetA München", age: "0:42", risk: "kritisch", updated: "vor 4 Min", origin: "Behörde" },
  { id: "EG-2026-00470", species: "Varanus salvadorii", german: "Papua-Waran", cites: "B", status: "Transport", region: "BW", authority: "Zoll Stuttgart", steward: "Dr. K. Hoffmann", age: "3:15", risk: "hoch", updated: "vor 12 Min", origin: "Behörde" },
  { id: "EG-2026-00469", species: "Iguana iguana", german: "Grüner Leguan", cites: "B", status: "Pflege", region: "NRW", authority: "OrdnungsA Köln", steward: "M. Albrecht", age: "1d 2h", risk: "stabil", updated: "vor 1 Std", origin: "Zivile Übergabe" },
  { id: "EG-2026-00468", species: "Pterinochilus murinus", german: "Usambara-Vogelspinne", cites: "C", status: "Intake", region: "HE", authority: "Polizei Frankfurt", age: "0:08", risk: "mittel", updated: "vor 2 Min", origin: "Behörde" },
  { id: "EG-2026-00467", species: "Python regius", german: "Königspython", cites: "B", status: "Outcome", region: "BE", authority: "VetA Berlin", steward: "Auffangstation Brandenburg", age: "14d", risk: "stabil", updated: "vor 3 Std", origin: "Zivile Übergabe", outcome: "Sanctuary" },
  { id: "EG-2026-00466", species: "Naja kaouthia", german: "Monokel-Kobra", cites: "B", status: "Pflege", region: "HH", authority: "Zoll Hamburg", steward: "T. Vogel (Gifttier-Spez.)", age: "5d", risk: "hoch", updated: "vor 22 Min", origin: "Behörde" },
  { id: "EG-2026-00465", species: "Boa constrictor", german: "Abgottschlange", cites: "B", status: "Pflege", region: "BY", authority: "—", steward: "Dr. K. Hoffmann", age: "21d", risk: "stabil", updated: "vor 6 Std", origin: "Zivile Übergabe" },
  { id: "EG-2026-00464", species: "Chamaeleo calyptratus", german: "Jemenchamäleon", cites: "B", status: "Outcome", region: "SN", authority: "VetA Dresden", steward: "Reptilienhilfe Sachsen", age: "32d", risk: "stabil", updated: "vor 1 Tag", origin: "Behörde", outcome: "Sentinel-Endpunkt" },
];

// Pflege-Logs pro Fall
export interface CareLog {
  ts: string;
  author: string;
  type: "Fütterung" | "Medizin" | "Beobachtung" | "Klima" | "Reinigung";
  note: string;
  /** Pflicht-Begründung pro Eintrag */
  rationale?: string;
  /** Strukturierte Messwerte (alle optional) */
  metrics?: {
    tempC?: number;
    humidity?: number; // %
    feedItem?: string;
    feedAmountG?: number;
    behavior?: "ruhig" | "aktiv" | "aggressiv" | "apathisch" | "stressbereit";
  };
  /** Auto-Signatur (Hash-Kurzform) */
  signature?: string;
}

export const CARE_LOGS: Record<string, CareLog[]> = {
  "EG-2026-00471": [
    { ts: "00:42", author: "Dr. R. Wendler", type: "Beobachtung", note: "Eingang. Dehydriert, leichte Häutungsreste. Stress hoch." },
    { ts: "00:55", author: "Dr. R. Wendler", type: "Klima", note: "Quarantäne 28°C / 75% rF eingestellt." },
  ],
  "EG-2026-00470": [
    { ts: "01:10", author: "Zoll Stuttgart", type: "Beobachtung", note: "Sicherstellung am Flughafen, Transportbox unzureichend." },
    { ts: "02:48", author: "Dr. K. Hoffmann", type: "Medizin", note: "Erstuntersuchung gebucht für Ankunft." },
  ],
  "EG-2026-00469": [
    { ts: "Tag 1", author: "M. Albrecht", type: "Fütterung", note: "Erstmals selbstständig gefressen." },
    { ts: "Tag 2", author: "M. Albrecht", type: "Reinigung", note: "Komplettreinigung Terrarium, neue Einrichtung." },
  ],
  "EG-2026-00466": [
    { ts: "Tag 3", author: "T. Vogel", type: "Beobachtung", note: "Frisst regelmäßig, kein Aggressionsverhalten." },
    { ts: "Tag 5", author: "T. Vogel", type: "Klima", note: "Temperaturgradient stabil 26-32°C." },
  ],
  "EG-2026-00465": [
    { ts: "Tag 14", author: "Dr. K. Hoffmann", type: "Medizin", note: "Parasitenbehandlung abgeschlossen." },
    { ts: "Tag 21", author: "Dr. K. Hoffmann", type: "Beobachtung", note: "Gewichtszunahme +280g. Aktivität normal." },
  ],
};

// Dokumente pro Fall (Demo)
export interface CaseDocument {
  name: string;
  type: "Beschlagnahme­protokoll" | "Vet-Bericht" | "CITES-Dok" | "Übergabe­schein" | "Foto-Dok";
  size: string;
  signed: boolean;
}

export const CASE_DOCS: Record<string, CaseDocument[]> = {
  "EG-2026-00471": [
    { name: "Beschlagnahme_BY-2026-3344.pdf", type: "Beschlagnahme­protokoll", size: "412 kB", signed: true },
    { name: "Vet_Triage_initial.pdf", type: "Vet-Bericht", size: "180 kB", signed: true },
  ],
  "EG-2026-00470": [
    { name: "Zoll_Sicherstellung.pdf", type: "Beschlagnahme­protokoll", size: "298 kB", signed: true },
    { name: "CITES_Anhang_B_Bescheid.pdf", type: "CITES-Dok", size: "521 kB", signed: true },
  ],
  "EG-2026-00469": [
    { name: "Zivile_Uebergabe_Erklaerung.pdf", type: "Übergabe­schein", size: "144 kB", signed: true },
    { name: "Fotodokumentation_Eingang.zip", type: "Foto-Dok", size: "2.1 MB", signed: false },
  ],
};

// Sentinel-Profil
export interface EnclosureSlot {
  id: string;
  type: "Quarantäne" | "Terrarium-Trocken" | "Terrarium-Feucht" | "Aquaterrarium" | "Gifttier-Sicher";
  sizeCm: string;
  status: "frei" | "belegt" | "reinigung" | "wartung";
  occupiedBy?: string; // case id
}

export interface Certification {
  label: string;
  authority: string;
  validUntil: string;
  ref: string;
}

export interface SentinelProfile {
  name: string;
  region: string;
  tier: "S1" | "S2" | "S3" | "S4";
  joined: string;
  reactionMinutes: number;
  contact: { email: string; phone: string; address: string };
  capacity: { used: number; total: number };
  cases: string[];
  certifications: Certification[];
  enclosures: EnclosureSlot[];
  insurance: { policy: string; coverEur: number; validUntil: string };
  vetOnCall: { name: string; phone: string };
}

export const ME_SENTINEL: SentinelProfile = {
  name: "Dr. K. Hoffmann",
  region: "BY",
  tier: "S4",
  joined: "März 2024",
  reactionMinutes: 38,
  contact: {
    email: "k.hoffmann@sentinel-by.de",
    phone: "+49 89 4711-0",
    address: "Reptilienpraxis Hoffmann · Maximilianstraße 14 · 80539 München",
  },
  capacity: { used: 3, total: 6 },
  cases: ["EG-2026-00470", "EG-2026-00466", "EG-2026-00465"],
  certifications: [
    { label: "Sachkunde § 11 TierSchG", authority: "VetA München", validUntil: "2027-08-14", ref: "SK-BY-2024-0931" },
    { label: "Gifttierhaltung BayGTG", authority: "LRA München", validUntil: "2026-11-30", ref: "GT-BY-2024-117" },
    { label: "CITES-Halter Anhang A/B", authority: "BfN Bonn", validUntil: "2028-02-01", ref: "CITES-DE-44021" },
    { label: "Erste Hilfe Reptilien", authority: "DGHT", validUntil: "2027-04-22", ref: "DGHT-EH-9912" },
  ],
  enclosures: [
    { id: "Q-01", type: "Quarantäne", sizeCm: "120×60×60", status: "belegt", occupiedBy: "EG-2026-00470" },
    { id: "T-02", type: "Gifttier-Sicher", sizeCm: "150×80×80", status: "belegt", occupiedBy: "EG-2026-00466" },
    { id: "T-03", type: "Terrarium-Trocken", sizeCm: "200×80×100", status: "belegt", occupiedBy: "EG-2026-00465" },
    { id: "T-04", type: "Terrarium-Feucht", sizeCm: "180×80×100", status: "frei" },
    { id: "T-05", type: "Aquaterrarium", sizeCm: "160×60×80", status: "reinigung" },
    { id: "T-06", type: "Quarantäne", sizeCm: "100×50×50", status: "wartung" },
  ],
  insurance: { policy: "Tierhalter-Haftpflicht XL · Allianz", coverEur: 5_000_000, validUntil: "2026-12-31" },
  vetOnCall: { name: "Dr. R. Wendler", phone: "+49 89 4711-22" },
};

// Pflichten / Todos
export type DutyPriority = "kritisch" | "hoch" | "normal";
export interface Duty {
  id: string;
  title: string;
  caseId?: string;
  due: string; // human readable
  dueIso: string; // for sorting
  priority: DutyPriority;
  done: boolean;
  category: "Fütterung" | "Medizin" | "Klima" | "Behörde" | "Reinigung" | "Übergabe";
}

export const DUTIES: Duty[] = [
  { id: "D-9001", title: "Vet-Telefonat · Statusupdate Kobra", caseId: "EG-2026-00466", due: "Heute · 14:00", dueIso: "2026-05-15T14:00", priority: "hoch", done: false, category: "Medizin" },
  { id: "D-9002", title: "Fütterung Königspython (alle 7 Tage)", caseId: "EG-2026-00465", due: "Heute · 18:00", dueIso: "2026-05-15T18:00", priority: "normal", done: false, category: "Fütterung" },
  { id: "D-9003", title: "Klimaprotokoll Quarantäne T-01 erfassen", caseId: "EG-2026-00470", due: "Heute · 20:00", dueIso: "2026-05-15T20:00", priority: "normal", done: false, category: "Klima" },
  { id: "D-9004", title: "Behörden-Export an VetA München übermitteln", caseId: "EG-2026-00470", due: "Morgen · 09:00", dueIso: "2026-05-16T09:00", priority: "kritisch", done: false, category: "Behörde" },
  { id: "D-9005", title: "Komplettreinigung T-05 abschließen", due: "Morgen · 12:00", dueIso: "2026-05-16T12:00", priority: "normal", done: false, category: "Reinigung" },
  { id: "D-9006", title: "Übergabe-Vorbereitung Sanctuary Brandenburg", caseId: "EG-2026-00465", due: "Fr · 10:00", dueIso: "2026-05-22T10:00", priority: "hoch", done: false, category: "Übergabe" },
  { id: "D-9007", title: "Erstuntersuchung Papua-Waran dokumentiert", caseId: "EG-2026-00470", due: "Gestern", dueIso: "2026-05-14T10:00", priority: "hoch", done: true, category: "Medizin" },
];

// 7-Tage Aktivität (logs pro Tag)
export const ACTIVITY_7D: { day: string; logs: number }[] = [
  { day: "Sa", logs: 4 },
  { day: "So", logs: 3 },
  { day: "Mo", logs: 7 },
  { day: "Di", logs: 6 },
  { day: "Mi", logs: 8 },
  { day: "Do", logs: 9 },
  { day: "Fr", logs: 5 },
];

// Admin-Review Queue für Zertifizierungen
export interface CertReviewItem {
  id: string;
  applicant: string;
  region: string;
  tier: "S1" | "S2" | "S3" | "S4";
  submitted: string;
  docsCount: number;
  status: "pending" | "in_review" | "approved" | "rejected";
}

export const CERT_QUEUE: CertReviewItem[] = [
  { id: "ZRT-2026-1102", applicant: "L. Brenner", region: "BY", tier: "S2", submitted: "vor 6 Min", docsCount: 3, status: "pending" },
  { id: "ZRT-2026-1101", applicant: "M. Albrecht", region: "NW", tier: "S3", submitted: "vor 38 Min", docsCount: 4, status: "in_review" },
  { id: "ZRT-2026-1100", applicant: "T. Vogel", region: "HH", tier: "S4", submitted: "vor 2 Std", docsCount: 5, status: "in_review" },
  { id: "ZRT-2026-1099", applicant: "S. Ostermann", region: "BY", tier: "S3", submitted: "vor 5 Std", docsCount: 4, status: "approved" },
  { id: "ZRT-2026-1098", applicant: "J. Krämer", region: "BE", tier: "S4", submitted: "vor 1 Tag", docsCount: 3, status: "rejected" },
];
