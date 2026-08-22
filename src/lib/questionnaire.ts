// Placement-questionnaire data (submitted with the Sentinel-Aufnahme and
// stored in sentinel_applications.pledge_data.questionnaire). Read by
// Einrichtungen (00024 policy) and Behörden (00025 policy) for review.
export type Questionnaire = {
  street: string;
  zip: string;
  city: string;
  phone: string;
  birth_date: string;
  enclosure: { size: string; lighting: string; climate: string; setup: string };
  current_stock: string;
  feeding: string;
  overwintering: string;
  info_sources: string[];
  sachkunde: "none" | "bna" | "dght" | "other";
  sachkunde_detail: string;
};

export function parseQuestionnaire(raw: unknown): Questionnaire | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Partial<Questionnaire>;
  if (typeof q.street !== "string") return null;
  return {
    street: q.street,
    zip: letS(q.zip),
    city: letS(q.city),
    phone: letS(q.phone),
    birth_date: q.birth_date ?? "",
    enclosure: {
      size: letS(q.enclosure?.size),
      lighting: letS(q.enclosure?.lighting),
      climate: letS(q.enclosure?.climate),
      setup: letS(q.enclosure?.setup),
    },
    current_stock: letS(q.current_stock),
    feeding: letS(q.feeding),
    overwintering: letS(q.overwintering),
    info_sources: Array.isArray(q.info_sources) ? q.info_sources.filter((s): s is string => typeof s === "string") : [],
    sachkunde: (["none", "bna", "dght", "other"] as const).includes(q.sachkunde as never) ? q.sachkunde as Questionnaire["sachkunde"] : "none",
    sachkunde_detail: letS(q.sachkunde_detail),
  };
}

const letS = (v: unknown): string => (typeof v === "string" ? v : "");

export const SACHKUNDE_LABEL: Record<Questionnaire["sachkunde"], string> = {
  none: "Keiner",
  bna: "BNA",
  dght: "DGHT",
  other: "Sonstige",
};

export const BIRTHDATE_LABEL = "Geburtsdatum";