// Persistent care logs (care_logs table, migration 00014) — the live backend
// for SentinelView. Demo mode keeps using src/lib/dashboard-data.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { CareLog, CaseRecord, SentinelProfile } from "./dashboard-data";
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
  status: string | null;
};

const statusLabel: Record<string, string> = {
  available: "Verfügbar",
  under_review: "In Prüfung",
  placed: "Vermittelt",
  withdrawn: "Zurückgezogen",
};

/** Map a real ward onto the demo CaseRecord shape so the existing UI works. */
export function wardToCase(w: WardRow): CaseRecord {
  return {
    id: w.case_code,
    species: w.scientific_name ?? "—",
    german: w.common_name,
    cites: w.cites_listing ?? "—",
    status: (statusLabel[w.status ?? ""] ?? "Pflege") as CaseRecord["status"],
    region: w.region ?? "—",
    authority: "—",
    age: w.age_estimate ?? "—",
    risk: "stabil",
    updated: "",
    origin: "Behörde",
  };
}

export async function fetchMyWards(client: Client, userId: string, page = 0, pageSize = 100): Promise<WardRow[]> {
  const from = page * pageSize;
  const { data, error } = await client
    .from("ward_listings")
    .select("id, case_code, common_name, scientific_name, cites_listing, age_estimate, region, status")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
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

export async function fetchCareLogs(client: Client, wardId: string, page = 0, pageSize = 200): Promise<CareLog[]> {
  const from = page * pageSize;
  const { data, error } = await client
    .from("care_logs")
    .select("ward_id, author_name, type, note, rationale, metrics, hash, created_at")
    .eq("ward_id", wardId)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return ((data ?? []) as LogRow[]).map(toCareLog);
}

/**
 * All logs for a ward, looping pages until exhausted. The care log is the
 * audit document — silently truncating at 200 rows hides evidence from the
 * UI and the export.
 */
export async function fetchAllCareLogs(client: Client, wardId: string, pageSize = 200): Promise<CareLog[]> {
  const out: CareLog[] = [];
  for (let page = 0; ; page++) {
    const rows = await fetchCareLogs(client, wardId, page, pageSize);
    out.push(...rows);
    if (rows.length < pageSize) return out;
  }
}

export type NewCareLog = {
  wardId: string;
  authorName: string;
  type: CareLog["type"];
  note: string;
  rationale: string;
  metrics: CareLog["metrics"];
};

/** Append one entry through the DB-side lock/hash RPC. */
export async function addCareLog(client: Client, input: NewCareLog): Promise<CareLog> {
  const { data, error } = await client.rpc("append_care_log", {
    p_ward_id: input.wardId,
    p_author_name: input.authorName,
    p_type: input.type,
    p_note: input.note,
    p_rationale: input.rationale,
    p_metrics: input.metrics ?? {},
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("care log insert returned no row");
  return toCareLog(row as LogRow);
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
    .select("full_name, email, region, capacity, tier, created_at, pledge_data")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const app = data as {
    full_name: string;
    email: string;
    region: string;
    capacity: string;
    tier: "S4" | "S1" | "S2" | "S3";
    created_at: string;
    pledge_data: {
      questionnaire?: {
        street?: string;
        house_number?: string;
        zip?: string;
        city?: string;
        phone?: string;
      };
    } | null;
  } | null;

  const total = app ? totalCapacity(parseCapacity(app.capacity)) : 0;
  const q = app?.pledge_data?.questionnaire;
  const address = q && (q.street || q.house_number)
    ? `${q.street ?? ""} ${q.house_number ?? ""}, ${q.zip ?? ""} ${q.city ?? ""}`
    : "";
  return {
    name: app?.full_name ?? fallbackName,
    region: app?.region ?? "—",
    tier: app?.tier ?? "S1",
    joined: app
      ? new Date(app.created_at).toLocaleDateString("de-DE", { month: "long", year: "numeric" })
      : "—",
    reactionMinutes: 0,
    contact: { email: app?.email ?? fallbackEmail, phone: q?.phone ?? "", address },
    capacity: { used: wardCount, total },
    cases: [],
    certifications: [],
    enclosures: [],
    insurance: { policy: "", coverEur: 0, validUntil: "" },
    vetOnCall: { name: "", phone: "" },
  };
}
