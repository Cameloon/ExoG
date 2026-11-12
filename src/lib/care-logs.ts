// Persistent care logs (care_logs table, migration 00014) — the live backend
// for SentinelView. Demo mode keeps using src/lib/dashboard-data.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { CareLog, CaseRecord, SentinelProfile } from "./dashboard-data";
import { fetchEnclosures, parseEnclosures } from "./enclosures";
import { parseCapacity, totalCapacity } from "./habitats";
import { intakeType } from "./animal-workflow";

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
  images: string[];
  intake_type?: string;
  origin_context?: string | null;
  background?: string;
  care_requirements?: string;
  space_requirements?: string;
  sex?: string | null;
  size_estimate?: string | null;
  urgency?: string;
  placement_type?: "endstelle" | "pflegestelle";
  legal_custody?: boolean;
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
    risk: w.urgency === "critical" ? "kritisch" : w.urgency === "urgent" ? "hoch" : "stabil",
    updated: "",
    origin: ({ confiscated: "Behörde", found: "Fund", surrendered: "Abgabe", transferred: "Übernahme", unknown: "Ungeklärt" } as const)[intakeType(w.intake_type)],
    wardId: w.id,
    intakeType: intakeType(w.intake_type),
    originContext: w.origin_context ?? "",
    background: w.background,
    careRequirements: w.care_requirements,
    spaceRequirements: w.space_requirements,
    sex: w.sex ?? "",
    size: w.size_estimate ?? "",
    placementType: w.placement_type,
    legalCustody: w.legal_custody,
  };
}

export async function fetchMyWards(client: Client, userId: string, page = 0, pageSize = 100): Promise<WardRow[]> {
  const from = page * pageSize;
  const { data, error } = await client
    .from("ward_listings")
    .select("id, case_code, common_name, scientific_name, cites_listing, age_estimate, region, status, images, intake_type, origin_context, background, care_requirements, space_requirements, sex, size_estimate, urgency, placement_type, legal_custody")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return (data ?? []) as WardRow[];
}

type LogRow = {
  id: string;
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
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return ((data ?? []) as LogRow[]).map(toCareLog);
}

export type CareLogCursor = { createdAt: string; id: string };
export async function fetchCareLogPage(client: Client, wardId: string, cursor: CareLogCursor | null = null,
  pageSize = 50, signal?: AbortSignal): Promise<{ logs: CareLog[]; next: CareLogCursor | null }> {
  const size = Math.max(1, Math.min(pageSize, 500));
  let query = client.from("care_logs")
    .select("id, ward_id, author_name, type, note, rationale, metrics, hash, created_at")
    .eq("ward_id", wardId)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(size + 1);
  if (cursor) query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as LogRow[];
  const visible = rows.slice(0, size);
  const last = visible[visible.length - 1];
  return { logs: visible.map(toCareLog), next: rows.length > size && last ? { createdAt: last.created_at, id: last.id } : null };
}

// Only explicit exports load the complete history. A timestamp + UUID cursor
// handles tied timestamps and new inserts without offset duplicates/skips.
export async function fetchAllCareLogs(client: Client, wardId: string, pageSize = 500, signal?: AbortSignal): Promise<CareLog[]> {
  const out: CareLog[] = [];
  let cursor: CareLogCursor | null = null;
  do {
    signal?.throwIfAborted();
    const page = await fetchCareLogPage(client, wardId, cursor, pageSize, signal);
    out.push(...page.logs);
    cursor = page.next;
  } while (cursor);
  return out;
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
  const { data, error } = await client
    .from("sentinel_applications")
    .select("full_name, email, region, capacity, tier, created_at, pledge_data")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
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
        /** Anlagen from the application wizard; carried over until edited live. */
        enclosures?: unknown;
      };
    } | null;
  } | null;

  const capacityByHabitat = parseCapacity(app?.capacity);
  const total = totalCapacity(capacityByHabitat);
  const savedEnclosures = await fetchEnclosures(client, userId);
  const enclosures = savedEnclosures.length > 0
    ? savedEnclosures
    : parseEnclosures(app?.pledge_data?.questionnaire?.enclosures);
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
    enclosures,
    insurance: { policy: "", coverEur: 0, validUntil: "" },
    vetOnCall: { name: "", phone: "" },
  };
}
