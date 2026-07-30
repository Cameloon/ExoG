import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Shelter, ShelterInput, Ward, ShelterRequest, ShelterRequestInput } from "./types";

export async function fetchShelters(
  supabase: SupabaseClient<Database>,
  opts?: { region?: string | null },
): Promise<Shelter[]> {
  let q = supabase.from("shelters").select("*").order("created_at", { ascending: false });
  if (opts?.region) q = q.eq("region", opts.region);
  const { data, error } = await q.limit(200);
  if (error) throw error;
  return (data ?? []) as Shelter[];
}

export async function fetchShelter(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<Shelter | null> {
  const { data, error } = await supabase
    .from("shelters")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Shelter | null;
}

export async function fetchMyShelter(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Shelter | null> {
  const { data, error } = await supabase
    .from("shelters")
    .select("*")
    .eq("owner_id", userId)
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
