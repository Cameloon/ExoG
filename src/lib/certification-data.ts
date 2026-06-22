// Zentrale Definition der Zertifizierungs-Stufen und Bundesland-Zulässigkeit.
// Hybrid: Frontend-State jetzt, Backend-Anbindung (Lovable Cloud) später.

export type TierLevel = "basic" | "reptilien" | "grossreptilien" | "gifttiere";

export interface TierDefinition {
  id: TierLevel;
  order: number;
  label: string;
  short: string;
  scope: string;
  examples: string;
  requiredDocs: { key: string; label: string; hint?: string }[];
}

export const TIERS: TierDefinition[] = [
  {
    id: "basic",
    order: 1,
    label: "Basic",
    short: "S1",
    scope: "Kleinsäuger, ungefährliche Vögel, nicht-CITES Wirbellose.",
    examples: "Frettchen, Sittiche, Vogelspinnen (nicht-medizinisch relevant).",
    requiredDocs: [
      { key: "id", label: "Lichtbildausweis", hint: "Personalausweis oder Reisepass." },
      { key: "address", label: "Meldebescheinigung", hint: "Nicht älter als 3 Monate." },
      { key: "facility", label: "Anlagen-Foto­dokumentation", hint: "Übersicht der Haltungsräume." },
    ],
  },
  {
    id: "reptilien",
    order: 2,
    label: "Reptilien",
    short: "S2",
    scope: "Nicht-giftige Reptilien & Amphibien bis mittlere Endgröße.",
    examples: "Königspythons, Bartagamen, Kornnattern, ungiftige Warane.",
    requiredDocs: [
      { key: "sachkunde", label: "Sachkundenachweis Reptilien", hint: "DGHT, IHK oder gleichwertig." },
      { key: "haltung", label: "Haltungs­dokumentation", hint: "Terrarien-Datenblätter, Klimawerte." },
      { key: "vet", label: "Tierärztliche Stellungnahme", hint: "Bestätigung sachgerechter Haltung." },
    ],
  },
  {
    id: "grossreptilien",
    order: 3,
    label: "Großreptilien",
    short: "S3",
    scope: "Constrictoren > 3 m, große Warane, Krokodile (nach Landesrecht).",
    examples: "Tigerpython, Bindenwaran, Brillenkaiman.",
    requiredDocs: [
      { key: "sachkunde-plus", label: "Sachkunde Großreptilien", hint: "Aufbau auf S2 + Praxisstunden." },
      { key: "anlage", label: "Anlagen-Statik & Sicherung", hint: "Gutachten oder Bauplan, Ausbruchssicherung." },
      { key: "haftpflicht", label: "Halter­haftpflicht", hint: "Mind. Deckung gem. Landesrecht." },
      { key: "behoerde", label: "Behörd­liche Halte­erlaubnis", hint: "Nach § 11 TierSchG bzw. Landesgesetz." },
    ],
  },
  {
    id: "gifttiere",
    order: 4,
    label: "Gifttiere",
    short: "S4",
    scope: "Medizinisch relevant giftige Reptilien, Spinnen, Skorpione.",
    examples: "Vipern, Elapiden, Latrodectus, Atrax.",
    requiredDocs: [
      { key: "sachkunde-tox", label: "Sachkunde Gifttierhaltung", hint: "Speziallehrgang inkl. Erste-Hilfe-Modul." },
      { key: "antiserum", label: "Antiserum-Konzept", hint: "Nachweis Klinik-Anbindung & Notfallplan." },
      { key: "raum", label: "Gifttier-Raum­zertifikat", hint: "Doppeltür, Sicherungsstufe, Alarmierung." },
      { key: "behoerde-tox", label: "Behörd­liche Gifttier­erlaubnis", hint: "Nach Landes-Gifttiergesetz." },
      { key: "fuehrungszeugnis", label: "Erweitertes Führungs­zeugnis", hint: "Nicht älter als 6 Monate." },
    ],
  },
];

export interface RegionRule {
  code: string;
  name: string;
  // Höchste zulässige Stufe in diesem Bundesland (vereinfachte Demo-Logik)
  maxAllowed: TierLevel;
  // Stufen, die explizit verboten oder stark eingeschränkt sind
  restricted?: TierLevel[];
  note: string;
}

export const REGIONS: RegionRule[] = [
  { code: "BW", name: "Baden-Württemberg", maxAllowed: "grossreptilien", restricted: ["gifttiere"], note: "Gifttierhaltung nur mit gesonderter behördlicher Einzel­fall­prüfung." },
  { code: "BY", name: "Bayern", maxAllowed: "gifttiere", note: "Gifttiere zulässig nach BayGTG mit Erlaubnis." },
  { code: "BE", name: "Berlin", maxAllowed: "reptilien", restricted: ["grossreptilien", "gifttiere"], note: "Verbot gefährlicher Tiere wildlebender Arten (BlnGefTierG)." },
  { code: "BB", name: "Brandenburg", maxAllowed: "grossreptilien", note: "Großreptilien zulässig, Gifttiere derzeit nicht zugelassen." },
  { code: "HB", name: "Bremen", maxAllowed: "reptilien", restricted: ["grossreptilien", "gifttiere"], note: "Strenges Landesgesetz für gefährliche Tiere." },
  { code: "HH", name: "Hamburg", maxAllowed: "reptilien", restricted: ["grossreptilien", "gifttiere"], note: "HmbGefTierG: gefährliche Tiere grundsätzlich untersagt." },
  { code: "HE", name: "Hessen", maxAllowed: "gifttiere", note: "HGefTierG: Erlaubnis­pflicht, aber Haltung möglich." },
  { code: "MV", name: "Mecklenburg-Vorpommern", maxAllowed: "grossreptilien", restricted: ["gifttiere"], note: "Gifttiere nur in Ausnahmefällen." },
  { code: "NI", name: "Niedersachsen", maxAllowed: "grossreptilien", restricted: ["gifttiere"], note: "NGefTierG: Gifttierhaltung weitgehend untersagt." },
  { code: "NW", name: "Nordrhein-Westfalen", maxAllowed: "reptilien", restricted: ["grossreptilien", "gifttiere"], note: "GefTierG NRW: gefährliche Tiere grundsätzlich verboten." },
  { code: "RP", name: "Rheinland-Pfalz", maxAllowed: "gifttiere", note: "LGefTierG: Erlaubnispflicht, Haltung möglich." },
  { code: "SL", name: "Saarland", maxAllowed: "grossreptilien", restricted: ["gifttiere"], note: "Gifttierhaltung stark eingeschränkt." },
  { code: "SN", name: "Sachsen", maxAllowed: "gifttiere", note: "SächsGefTierG: Erlaubnis­pflicht." },
  { code: "ST", name: "Sachsen-Anhalt", maxAllowed: "gifttiere", note: "GefTierG LSA: Halterlaubnis möglich." },
  { code: "SH", name: "Schleswig-Holstein", maxAllowed: "reptilien", restricted: ["grossreptilien", "gifttiere"], note: "GefTierG SH: gefährliche Tiere untersagt." },
  { code: "TH", name: "Thüringen", maxAllowed: "grossreptilien", restricted: ["gifttiere"], note: "Gifttierhaltung restriktiv geregelt." },
];

export const tierIndex = (id: TierLevel) =>
  TIERS.findIndex((t) => t.id === id);

export const isAllowed = (region: RegionRule, tier: TierLevel) => {
  if (region.restricted?.includes(tier)) return false;
  return tierIndex(tier) <= tierIndex(region.maxAllowed);
};
