// Typabhängige Mindestanforderungen an die Begründung von Pflege-Logs.
// Identische Regeln werden im Composer (Live-Validierung) und im
// behördlichen PDF/JSON-Export (Audit-Nachweis) verwendet.
import type { CareLog } from "@/lib/dashboard-data";

export type RationaleRule = {
  minLen: number;
  hint: string;
  /** Gruppen von Keywords. Pro Gruppe muss min. eines vorkommen. */
  groups: { label: string; any: string[] }[];
};

export const RATIONALE_RULES: Record<CareLog["type"], RationaleRule> = {
  Beobachtung: {
    minLen: 20,
    hint: "Bezug auf Verhalten/Zustand + Vergleich zur Baseline.",
    groups: [
      { label: "Zustand", any: ["verhalten", "zustand", "aktiv", "ruhig", "apath", "stress", "häut", "haut"] },
      { label: "Vergleich", any: ["wie", "gegenüber", "vergleich", "baseline", "vortag", "gestern", "seit", "weiterhin", "unverändert"] },
    ],
  },
  Fütterung: {
    minLen: 25,
    hint: "Futterart, Menge/Intervall und Annahme/Verweigerung dokumentieren.",
    groups: [
      { label: "Futter", any: ["maus", "ratte", "küken", "insekt", "heuschreck", "frost", "lebend", "futter"] },
      { label: "Annahme", any: ["genommen", "verweigert", "gefressen", "angenommen", "abgelehnt", "interesse"] },
      { label: "Intervall", any: ["tag", "woche", "intervall", "letzte", "zyklus", "rhythm"] },
    ],
  },
  Medizin: {
    minLen: 30,
    hint: "Wirkstoff/Dosis, Indikation und Anordnung (Vet) angeben.",
    groups: [
      { label: "Wirkstoff/Dosis", any: ["mg", "ml", "dosis", "wirkstoff", "antibio", "metronid", "ivermec", "f10", "betaisodona"] },
      { label: "Indikation", any: ["parasit", "infekt", "verletz", "wunde", "stomat", "atemweg", "milben", "prophyl"] },
      { label: "Anordnung", any: ["vet", "tierarzt", "anordnung", "rezept", "verschrieb", "dr."] },
    ],
  },
  Klima: {
    minLen: 20,
    hint: "Mess-/Sollwerte und Korrekturmaßnahme nennen.",
    groups: [
      { label: "Parameter", any: ["temp", "°c", "luftfeucht", "%", "rf", "uv", "spot", "gradient", "nacht", "tag"] },
      { label: "Maßnahme", any: ["erhöht", "gesenkt", "korrigiert", "nachjustiert", "lampe", "nebler", "thermostat", "stabil"] },
    ],
  },
  Reinigung: {
    minLen: 15,
    hint: "Umfang (Teil/Komplett) und Hygienemaßnahme dokumentieren.",
    groups: [
      { label: "Umfang", any: ["teil", "komplett", "spot", "boden", "wasser", "näpfe", "becken", "terrarium"] },
      { label: "Hygiene", any: ["desinf", "f10", "gewechsel", "ersetzt", "gespült", "gereinigt", "sterilis"] },
    ],
  },
};

export type ValidationResult = {
  ok: boolean;
  missing: string[];
  covered: string[];
  reason: string;
  minLen: number;
  length: number;
};

export function validateRationale(type: CareLog["type"], text: string): ValidationResult {
  const rule = RATIONALE_RULES[type];
  const trimmed = (text ?? "").trim();
  const t = trimmed.toLowerCase();
  const length = trimmed.length;

  if (length < rule.minLen) {
    return {
      ok: false,
      missing: rule.groups.map((g) => g.label),
      covered: [],
      reason: `Min. ${rule.minLen} Zeichen erforderlich.`,
      minLen: rule.minLen,
      length,
    };
  }
  const covered: string[] = [];
  const missing: string[] = [];
  for (const g of rule.groups) {
    if (g.any.some((kw) => t.includes(kw))) covered.push(g.label);
    else missing.push(g.label);
  }
  return {
    ok: missing.length === 0,
    missing,
    covered,
    reason: missing.length ? `Fehlende Aspekte: ${missing.join(", ")}` : "",
    minLen: rule.minLen,
    length,
  };
}

// Lokaler, nicht kryptografischer Fingerprint zur optischen Unterscheidung
// von Einträgen. KEIN Beweismittel: client-seitig reproduzierbar, keine
// Manipulationssicherheit (kein Server-Hash, keine Schlüsselbindung).
// Für eine gerichtsfeste Kette muss die Signatur serverseitig erfolgen.
export function sign(payload: string): string {
  let h = 0;
  for (let i = 0; i < payload.length; i++) h = (h * 31 + payload.charCodeAt(i)) >>> 0;
  return `H-${h.toString(16).toUpperCase().padStart(8, "0").slice(0, 8)}`;
}
