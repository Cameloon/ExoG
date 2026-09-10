// ponytail: client-side Photon geocode (CSP-approved), session-cached.
// Only successful lookups are cached — failures stay retryable across
// navigation (a cached null previously made maps stay empty forever).
const cache = new Map<string, [number, number]>();

export async function geocode(query: string): Promise<[number, number] | null> {
  const key = query.trim();
  if (!key) return null;
  const cached = cache.get(key);
  if (cached) return cached;
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(key)}&limit=1`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number] } }[];
    };
    const pos = data.features?.[0]?.geometry?.coordinates;
    if (!pos || !Number.isFinite(pos[0]) || !Number.isFinite(pos[1])) return null;
    const result: [number, number] = [pos[1], pos[0]];
    cache.set(key, result);
    return result;
  } catch {
    return null;
  }
}
