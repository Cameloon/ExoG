// Live enclosure list (profiles.enclosures, migration 00035). The DB is a
// trust boundary — parse every item and drop anything malformed.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { EnclosureSlot } from "./dashboard-data";

type Client = SupabaseClient<Database>;

export const ENCLOSURE_TYPES: EnclosureSlot["type"][] = [
  "Quarantäne",
  "Terrarium-Trocken",
  "Terrarium-Feucht",
  "Aquaterrarium",
  "Gifttier-Sicher",
];

export const ENCLOSURE_STATUSES: EnclosureSlot["status"][] = [
  "frei",
  "belegt",
  "reinigung",
  "wartung",
];

export function parseEnclosures(raw: unknown): EnclosureSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: EnclosureSlot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string" || !o.id.trim()) continue;
    if (!ENCLOSURE_TYPES.includes(o.type as EnclosureSlot["type"])) continue;
    if (!ENCLOSURE_STATUSES.includes(o.status as EnclosureSlot["status"])) continue;
    if (o.occupiedBy !== undefined && typeof o.occupiedBy !== "string") continue;
    out.push({
      id: o.id,
      type: o.type as EnclosureSlot["type"],
      sizeCm: typeof o.sizeCm === "string" ? o.sizeCm : "",
      status: o.status as EnclosureSlot["status"],
      occupiedBy: (o.occupiedBy as string | undefined) || undefined,
    });
  }
  return out;
}

/** Slot-derived capacity; null when no enclosures exist (caller falls back). */
export function capacityFromEnclosures(
  enclosures: EnclosureSlot[],
): { used: number; total: number } | null {
  if (enclosures.length === 0) return null;
  return {
    used: enclosures.filter((e) => e.status === "belegt").length,
    total: enclosures.length,
  };
}

export async function fetchEnclosures(client: Client, userId: string): Promise<EnclosureSlot[]> {
  const { data, error } = await client
    .from("profiles")
    .select("enclosures")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return parseEnclosures((data as { enclosures?: unknown } | null)?.enclosures);
}

export async function saveEnclosures(
  client: Client,
  userId: string,
  enclosures: EnclosureSlot[],
): Promise<void> {
  // 00022 revoked table-wide update; only (email, display_name, preferred_language,
  // enclosures) are writable. PostgREST upsert sets ALL payload columns in its
  // ON CONFLICT DO UPDATE — including id, which has no update grant — so update
  // only the enclosures column and insert the row if it doesn't exist yet.
  const payload = { enclosures: enclosures as unknown as Json };
  const { data, error } = await client
    .from("profiles")
    .update(payload)
    .eq("id", userId)
    .select("id");
  if (error) throw error;
  if (data && data.length > 0) return;
  const { error: insertError } = await client.from("profiles").insert({ id: userId, ...payload });
  if (insertError) throw insertError;
}
