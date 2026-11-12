import type { CaseRecord } from "../dashboard-data";
import type { DocumentKey } from "../animal-workflow";
import { requiresPermitForCase } from "./adoption-contract";

export type DocumentDraft = Record<string, unknown>;
export type Requirement = { key: string; label: string; minLength?: number; min?: number };
// These are completeness rules for our templates, not a legal determination.
export function documentRequirements(key: DocumentKey, values: DocumentDraft, record: CaseRecord): Requirement[] {
  const field = (key: string, label: string): Requirement => ({ key, label });
  switch (key) {
    case "seizure": return [field("occurredAt", "Datum / Uhrzeit"), field("location", "Ort der Maßnahme"), field("legalBasis", "Rechtsgrundlage"), field("authorityOfficer", "Beteiligte:r Behördenvertreter:in"), field("circumstances", "Sachverhalt / Anlass"), field("custodyLocation", "Verwahrungsstelle")];
    case "found": return [field("foundAt", "Datum / Uhrzeit Fund"), field("foundLocation", "Fundort"), field("finderName", "Finder:in (Name)"), field("circumstances", "Fundumstände"), field("custodyLocation", "Verwahrungsstelle")];
    case "intake": return [field("handoverAt", "Datum / Uhrzeit Aufnahme"), field("fromName", "Abgebende Person / Stelle"), field("fromContact", "Kontakt der abgebenden Stelle"), field("receivingLocation", "Aufnahmeort"), field("circumstances", "Anlass / Angaben zur Übergabe")];
    case "adoption": return [field("adopterName", "Adoptant:in (Name)"), field("adopterAddress", "Anschrift"), field("adopterContact", "Kontakt (Tel / Mail)"), field("handoverDate", "Übergabedatum"),
      { key: "housingDescription", label: "Haltungsbeschreibung (Terrarium, Klima, Sicherung)", minLength: 40 }, { key: "experienceYears", label: "Erfahrung (Jahre)", min: 1 },
      field("hasSachkunde", "Sachkundenachweis bestätigt"), field("sachkundeRef", "Sachkunde-Referenz"),
      ...(requiresPermitForCase(record) ? [field("hasPermitIfRequired", "Behördliche Freigabe bestätigt"), field("permitRef", "Genehmigungs-Referenz")] : [])];
    case "cites": return [field("acquisitionPath", "Erwerbsweg / Herkunft"), field("handoverPurpose", "Übergabezweck"), field("receivingAuthority", "Empfangende Behörde / Stelle"), field("receivingOfficer", "Empfangende Person"), field("handoverLocation", "Ort der Übergabe"), field("handoverAt", "Datum / Uhrzeit Übergabe"),
      ...(values.certificateStatus === "available" ? [field("citesCertificateNo", "CITES-Bescheinigung Nr."), field("issuingAuthority", "Ausstellende Behörde"), field("issuedAt", "Ausgestellt am")] : [field("missingEvidence", "Fehlende Nachweise / weiterer Klärungsbedarf")]),
      ...(values.markerType && values.markerType !== "Noch ungeklärt / keine Kennzeichnung dokumentiert" ? [field("markerId", "Marker-ID")] : [])];
  }
}

export function missingRequirements(requirements: Requirement[], values: DocumentDraft) {
  return requirements.filter(({ key, min, minLength }) => {
    const value = values[key];
    if (typeof value === "boolean") return !value;
    if (typeof value !== "string" || !value.trim()) return true;
    if (min !== undefined && (!Number.isFinite(Number(value)) || Number(value) < min)) return true;
    return minLength !== undefined && value.trim().length < minLength;
  });
}
