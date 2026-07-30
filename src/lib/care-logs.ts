// Persistent care logs (care_logs table, migration 00014) — the live backend
// for SentinelView. Demo mode keeps using src/lib/dashboard-data.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { CareLog, CaseRecord, SentinelProfile } from "./dashboard-data";
import { sign } from "./care-log-validation";
import { parseCapacity, totalCapacity } from "./habitats";

type Client = SupabaseClient<Database>;

export type WardRow = {
  id: string;
  case_code: string;
  common_name: string;
  scientific_name: string | null;
  cites_listing: string | null;
  age_estimate: string | null;
  region: string | null;
};

/** Map a real ward onto the demo CaseRecord shape so the existing UI works. */
export function wardToCase(w: WardRow): CaseRecord {
  return {
    id: w.case_code,
    species: w.scientific_name ?? "—",
    german: w.common_name,
    cites: w.cites_listing ?? "—",
    status: "Pflege",
    region: w.region ?? "—",
    authority: "—",
    age: w.age_estimate ?? "—",
    risk: "stabil",
    updated: "",
    origin: "Behörde",
  };
}

export async function fetchMyWards(client: Client, userId: string): Promise<WardRow[]> {
  const { data, error } = await client
    .from("ward_listings")
    .select("id, case_code, common_name, scientific_name, cites_listing, age_estimate, region")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as WardRow[];
}

type LogRow = {
  ward_id: string;
  author_name: string;
  type: string;
  note: string;
  rationale: string;
  metrics: CareLog["metrics"];
  hash: string;
  created_at: string;
};

const toCareLog = (r: LogRow): CareLog => ({
  ts: new Date(r.created_at).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }),
  author: r.author_name,
  type: r.type as CareLog["type"],
  note: r.note,
  rationale: r.rationale,
  metrics: r.metrics ?? {},
  signature: r.hash,
});

export async function fetchCareLogs(client: Client, wardId: string): Promise<CareLog[]> {
  const { data, error } = await client
    .from("care_logs")
    .select("ward_id, author_name, type, note, rationale, metrics, hash, created_at")
    .eq("ward_id", wardId)
    .order("created_at", { ascending: false })
    // ponytail: newest 200 shown, add paging when a ward outgrows it
    .limit(200);
  if (error) throw error;
  return ((data ?? []) as LogRow[]).map(toCareLog);
}

export type NewCareLog = {
  wardId: string;
  authorId: string;
  authorName: string;
  type: CareLog["type"];
  note: string;
  rationale: string;
  metrics: CareLog["metrics"];
};

/**
 * Append one entry, hash-chained to the ward's previous entry so later
 * tampering with history breaks the chain.
 * ponytail: concurrent writers can fork the chain (same prev_hash) — add a
 * DB-side sequence/lock if multi-author wards ever matter.
 */
export async function addCareLog(client: Client, input: NewCareLog): Promise<CareLog> {
  const { data: last } = await client
    .from("care_logs")
    .select("hash")
    .eq("ward_id", input.wardId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevHash = (last as { hash: string } | null)?.hash ?? null;
  const ts = new Date().toISOString();
  const hash = sign(
    [input.wardId, input.type, input.note, input.rationale, input.authorName, ts, prevHash ?? ""].join("|"),
  );

  const { error } = await client.from("care_logs").insert({
    ward_id: input.wardId,
    author_id: input.authorId,
    author_name: input.authorName,
    type: input.type,
    note: input.note,
    rationale: input.rationale,
    metrics: input.metrics ?? {},
    prev_hash: prevHash,
    hash,
  });
  if (error) throw error;

  return {
    ts: new Date(ts).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    author: input.authorName,
    type: input.type,
    note: input.note,
    rationale: input.rationale,
    metrics: input.metrics,
    signature: hash,
  };
}

/** Live SentinelProfile built from the user's approved application. */
export async function fetchLiveSentinelProfile(
  client: Client,
  userId: string,
  fallbackName: string,
  fallbackEmail: string,
  wardCount: number,
): Promise<SentinelProfile> {
  const { data } = await client
    .from("sentinel_applications")
    .select("full_name, email, region, capacity, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const app = data as {
    full_name: string;
    email: string;
    region: string;
    capacity: string;
    created_at: string;
  } | null;

  const total = app ? totalCapacity(parseCapacity(app.capacity)) : 0;
  return {
    name: app?.full_name ?? fallbackName,
    region: app?.region ?? "—",
    tier: "S1", // ponytail: tiers don't exist in the live schema yet
    joined: app
      ? new Date(app.created_at).toLocaleDateString("de-DE", { month: "long", year: "numeric" })
      : "—",
    reactionMinutes: 0,
    contact: { email: app?.email ?? fallbackEmail, phone: "", address: "" },
    capacity: { used: wardCount, total },
    cases: [],
    certifications: [],
    enclosures: [],
    insurance: { policy: "", coverEur: 0, validUntil: "" },
    vetOnCall: { name: "", phone: "" },
  };
}
