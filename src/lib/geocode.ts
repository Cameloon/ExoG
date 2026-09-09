// ponytail: client-side Photon geocode (CSP-approved), session-cached.
// Fails silently → callers skip ungeocodierbare Adressen.
const cache = new Map<string, [number, number] | null>();

export async function geocode(query: string): Promise<[number, number] | null> {
  const key = query.trim();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key)!;
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(key)}&limit=1`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number] } }[];
    };
    const pos = data.features?.[0]?.geometry?.coordinates;
    const r = pos ? ([pos[1], pos[0]] as [number, number]) : null;
    cache.set(key, r);
    return r;
  } catch {
    cache.set(key, null);
    return null;
  }
}
