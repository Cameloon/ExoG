import type { CaseRecord } from "./dashboard-data";

export const INTAKE_TYPES = {
  confiscated: "Beschlagnahmung / Sicherstellung",
  found: "Fundtier",
  surrendered: "Abgabe durch Halter:in",
  transferred: "Übernahme von anderer Stelle",
  unknown: "Aufnahmegrund noch ungeklärt",
} as const;
export type IntakeType = keyof typeof INTAKE_TYPES;
export type DocumentKey = "seizure" | "found" | "intake" | "adoption" | "cites";

export function intakeType(value?: string | null): IntakeType {
  return value && Object.prototype.hasOwnProperty.call(INTAKE_TYPES, value) ? value as IntakeType : "unknown";
}

// CITES appendices and EU annexes are different classifications. Unknown is
// never treated as unprotected, and compound/population listings stay intact.
export function protectionStatus(listing?: string | null) {
  const value = listing?.trim().toUpperCase() ?? "";
  if (/^(I|II|III)(\/(I|II|III|NC))*$/.test(value)) return { kind: "cites" as const, label: `CITES ${value}`, review: value.includes("/") };
  if (/^[ABCD]$/.test(value)) return { kind: "eu" as const, label: `EU-Anhang ${value}`, review: true };
  if (value === "NC") return { kind: "unlisted" as const, label: "CITES: nicht gelistet (Referenz)", review: true };
  return { kind: "unknown" as const, label: "Schutzstatus noch ungeklärt", review: true };
}

export function documentPlan(record: Pick<CaseRecord, "intakeType" | "cites" | "placementType">) {
  const origin = intakeType(record.intakeType);
  const primary: DocumentKey = origin === "confiscated" ? "seizure" : origin === "found" ? "found" : "intake";
  const recommended: DocumentKey[] = [primary];
  const protection = protectionStatus(record.cites);
  if (protection.kind === "cites" || protection.kind === "eu") recommended.push("cites");
  return { primary, recommended, protection, origin, adoptionRelevant: record.placementType === "endstelle" };
}

export const localDateTime = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

export const knownValue = (value?: string | null) => value && !["—", "Unbekannt"].includes(value) ? value : "";
