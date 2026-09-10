import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Shelter, ShelterInput, Ward, ShelterRequest, ShelterRequestInput, WardInterest } from "./types";

// Migration 00029 introduces the `shelter_directory` view (public columns +
// rounded coordinates). Until it is applied server-side, fall back to the
// base table but project only the same public columns, so the app works
// without ever shipping address/contact fields to the client.
const DIRECTORY_COLUMNS = "id, name, kind, region, description, capacity_notes, lat, lng, created_at, updated_at";

function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "PGRST205" || error.code === "42P01" || /schema cache/i.test(error.message ?? "");
}

const round2 = (value: number | null) => (value == null ? null : Math.round(value * 100) / 100);

async function fetchDirectory(
  supabase: SupabaseClient<Database>,
  opts?: { region?: string | null },
): Promise<Shelter[]> {
  let q = supabase.from("shelter_directory").select("*").order("created_at", { ascending: false });
  if (opts?.region) q = q.eq("region", opts.region);
  const { data, error } = await q.limit(200);
  if (!error) return (data ?? []) as Shelter[];
  if (!isMissingRelation(error)) throw error;

  let fq = supabase.from("shelters").select(DIRECTORY_COLUMNS).order("created_at", { ascending: false });
  if (opts?.region) fq = fq.eq("region", opts.region);
  const fallback = await fq.limit(200);
  if (fallback.error) throw fallback.error;
  return (fallback.data ?? []).map((row) => ({
    ...row,
    lat: round2(row.lat),
    lng: round2(row.lng),
  })) as unknown as Shelter[];
}

export async function fetchShelters(
  supabase: SupabaseClient<Database>,
  opts?: { region?: string | null },
): Promise<Shelter[]> {
  return fetchDirectory(supabase, opts);
}

export async function fetchShelter(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<Shelter | null> {
  const { data, error } = await supabase
    .from("shelter_directory")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!error) return (data ?? null) as Shelter | null;
  if (!isMissingRelation(error)) throw error;

  const fallback = await supabase
    .from("shelters")
    .select(DIRECTORY_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (fallback.error) throw fallback.error;
  if (!fallback.data) return null;
  return { ...fallback.data, lat: round2(fallback.data.lat), lng: round2(fallback.data.lng) } as unknown as Shelter;
}

export async function fetchMyShelter(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Shelter | null> {
  const { data, error } = await supabase
    .from("shelters")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Shelter | null;
}

export async function upsertShelter(
  supabase: SupabaseClient<Database>,
  input: ShelterInput,
): Promise<Shelter> {
  const { data, error } = await supabase
    .from("shelters")
    .upsert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as Shelter;
}

export async function fetchWardsByRegion(
  supabase: SupabaseClient<Database>,
  region: string,
): Promise<Ward[]> {
  const { data, error } = await supabase
    .from("ward_listings")
    .select("*")
    .eq("region", region)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as Ward[];
}

export async function fetchShelterWards(
  supabase: SupabaseClient<Database>,
  shelterId: string,
): Promise<Ward[]> {
  const { data, error } = await supabase
    .from("ward_listings")
    .select("*")
    .eq("shelter_id", shelterId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as Ward[];
}

export async function fetchRequestsForShelter(
  supabase: SupabaseClient<Database>,
  shelterId: string,
): Promise<ShelterRequest[]> {
  const { data, error } = await supabase
    .from("sentinel_shelter_requests")
    .select("*")
    .eq("shelter_id", shelterId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as ShelterRequest[];
}

export async function fetchMyRequests(
  supabase: SupabaseClient<Database>,
  sentinelId: string,
): Promise<ShelterRequest[]> {
  const { data, error } = await supabase
    .from("sentinel_shelter_requests")
    .select("*")
    .eq("sentinel_id", sentinelId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as ShelterRequest[];
}

export async function sendShelterRequest(
  supabase: SupabaseClient<Database>,
  input: ShelterRequestInput,
): Promise<void> {
  const { error } = await supabase.from("sentinel_shelter_requests").insert(input);
  if (error) throw error;
}

export async function setRequestStatus(
  supabase: SupabaseClient<Database>,
  id: string,
  status: ShelterRequest["status"],
): Promise<void> {
  const { error } = await supabase
    .from("sentinel_shelter_requests")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export async function fetchWardInterests(
  supabase: SupabaseClient<Database>,
  shelterId: string,
): Promise<WardInterest[]> {
  const { data, error } = await supabase
    .from("ward_interest")
    .select("id, ward_id, applicant_id, message, consultation_requested, status, created_at, ward:ward_listings!inner(common_name, case_code)")
    .eq("ward_listings.shelter_id", shelterId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as WardInterest[];
}

export async function setInterestStatus(
  supabase: SupabaseClient<Database>,
  id: string,
  status: "matched" | "declined",
): Promise<void> {
  const { error } = await supabase
    .from("ward_interest")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}
