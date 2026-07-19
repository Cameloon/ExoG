// Single source of truth for husbandry habitat categories used to record
// a sentinel's available capacity. Stored as JSON in sentinel_applications.capacity.

export const HABITAT_CATEGORIES: { key: string; label: string }[] = [
  { key: "forest", label: "Wald / Temperiert" },
  { key: "desert", label: "Wüste / Trocken" },
  { key: "jungle", label: "Dschungel / Tropisch" },
  { key: "aquatic", label: "Aquatisch / Semi" },
  { key: "inverts", label: "Invertebraten" },
];

export type CapacityMap = Record<string, number>;

export function parseCapacity(raw: string | null | undefined): CapacityMap {
  const empty: CapacityMap = {};
  for (const h of HABITAT_CATEGORIES) empty[h.key] = 0;
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const h of HABITAT_CATEGORIES) {
      const v = parsed[h.key];
      empty[h.key] = typeof v === "number" && v >= 0 ? v : 0;
    }
    return empty;
  } catch {
    // legacy free-text capacity: stash under "forest" as a best-effort fallback
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n)) empty.forest = n;
    return empty;
  }
}

export function totalCapacity(map: CapacityMap): number {
  return Object.values(map).reduce((a, b) => a + (b || 0), 0);
}
