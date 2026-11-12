import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export type WardAssignmentRequest = {
  id: string;
  ward_id: string;
  authority_id: string;
  sentinel_id: string;
  message: string | null;
  status: "open" | "accepted" | "declined" | "cancelled";
  created_at: string;
};

export type IncomingWardAssignmentRequest = WardAssignmentRequest & {
  ward: { case_code: string; common_name: string; region: string | null; urgency: string };
};

export async function fetchWardAssignmentRequestsForWard(client: Client, wardId: string): Promise<WardAssignmentRequest[]> {
  const { data, error } = await client
    .from("authority_ward_assignment_requests")
    .select("id, ward_id, authority_id, sentinel_id, message, status, created_at")
    .eq("ward_id", wardId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WardAssignmentRequest[];
}

export async function fetchMyWardAssignmentRequests(client: Client, sentinelId: string): Promise<IncomingWardAssignmentRequest[]> {
  const { data, error } = await client
    .from("authority_ward_assignment_requests")
    .select("id, ward_id, authority_id, sentinel_id, message, status, created_at, ward:ward_listings!authority_ward_assignment_requests_ward_id_fkey(case_code, common_name, region, urgency)")
    .eq("sentinel_id", sentinelId)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as IncomingWardAssignmentRequest[];
}

export async function requestWardAssignment(
  client: Client,
  input: { ward_id: string; authority_id: string; sentinel_id: string },
): Promise<WardAssignmentRequest> {
  const { data, error } = await client
    .from("authority_ward_assignment_requests")
    .insert(input)
    .select("id, ward_id, authority_id, sentinel_id, message, status, created_at")
    .single();
  if (error) throw error;
  return data as WardAssignmentRequest;
}

export async function respondToWardAssignmentRequest(client: Client, id: string, accept: boolean): Promise<string> {
  const { data, error } = await client.rpc("respond_authority_ward_assignment_request", { p_id: id, p_accept: accept });
  if (error) throw error;
  return data;
}
