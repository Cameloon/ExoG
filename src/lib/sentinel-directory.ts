import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type DirectoryRow = Database["public"]["Functions"]["list_sentinels"]["Returns"][number];
export type NetworkSentinel = Omit<DirectoryRow, "pledge_data"> & {
  pledge_data: {
    quarantine?: string; vet_contact?: string;
    questionnaire?: {
      street?: string; house_number?: string; zip?: string; city?: string; phone?: string;
      feeding?: string; current_stock?: string; overwintering?: string;
      sachkunde?: string; sachkunde_detail?: string;
      enclosures?: { id: string; type: string; sizeCm: string; status: string }[];
      enclosure?: { size?: string; lighting?: string; climate?: string; setup?: string };
    };
  } | null;
};

export async function fetchSentinelPage(client: SupabaseClient<Database>,
  options: { after?: string; search?: string; userIds?: string[]; signal?: AbortSignal; limit?: number } = {},
): Promise<NetworkSentinel[]> {
  const query = client.rpc("list_sentinels", {
    p_after: options.after, p_limit: options.limit ?? 100,
    p_search: options.search ?? "", p_user_ids: options.userIds,
  });
  const { data, error } = await (options.signal ? query.abortSignal(options.signal) : query);
  if (error) throw error;
  return (data ?? []) as NetworkSentinel[];
}

// Assignment pickers and a shelter's own applicant cards must not silently
// lose candidates at PostgREST's row limit. The directory screen uses pages.
export async function fetchSentinels(client: SupabaseClient<Database>, userIds?: string[]): Promise<NetworkSentinel[]> {
  const rows: NetworkSentinel[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await fetchSentinelPage(client, { after, userIds, limit: 200 });
    rows.push(...page);
    if (page.length < 200) return rows;
    after = page[page.length - 1].user_id;
  }
}
