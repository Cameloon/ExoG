export type ConsensusVote = { species: string; listing: string | null };

/**
 * Species voted by >=2 experts = consensus candidate (Bestimmungshilfe).
 * Winner is the species with the most votes; ties break lexicographically so
 * the outcome does not depend on row order. The CITES listing is only
 * confirmed when a strict majority (> half) of that species' votes agree on
 * it; a 2-2 tie yields no listing instead of an arbitrary one.
 */
export function consensusSpecies(votes: ConsensusVote[]): { species: string; listing: string | null; count: number } | null {
  const bySpecies = new Map<string, { listings: Map<string, number>; count: number }>();
  for (const v of votes) {
    const c = bySpecies.get(v.species) ?? { listings: new Map<string, number>(), count: 0 };
    c.count += 1;
    const key = v.listing ?? "";
    c.listings.set(key, (c.listings.get(key) ?? 0) + 1);
    bySpecies.set(v.species, c);
  }
  let best: { species: string; count: number } | null = null;
  for (const [species, c] of bySpecies) {
    if (c.count < 2) continue;
    if (!best || c.count > best.count || (c.count === best.count && species < best.species)) {
      best = { species, count: c.count };
    }
  }
  if (!best) return null;
  const c = bySpecies.get(best.species)!;
  let bestListing = "";
  let bestListingCount = 0;
  for (const [listing, n] of c.listings) {
    if (n > bestListingCount || (n === bestListingCount && listing < bestListing)) {
      bestListing = listing;
      bestListingCount = n;
    }
  }
  const listing = bestListingCount * 2 > best.count ? bestListing || null : null;
  return { species: best.species, listing, count: best.count };
}
