// ponytail: DB-Regionen heißen nicht immer exakt wie Bundesländer
// ("Bayern (Süd)", Kleinschreibung …). Exakt → enthalten → null.
export const STATES = [
  "Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen",
  "Hamburg", "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen",
  "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen",
  "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen",
];

export function mapRegionToState(region: string): string | null {
  const t = region.trim().toLowerCase();
  if (!t) return null;
  return (
    STATES.find((s) => s.toLowerCase() === t) ??
    STATES.find((s) => t.includes(s.toLowerCase()) || s.toLowerCase().includes(t)) ??
    null
  );
}
