import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { fetchCareLogPage, fetchAllCareLogs } from "@/lib/care-logs";

function fixture() {
  const rows = Array.from({ length: 105 }, (_, i) => ({
    id: `00000000-0000-0000-0000-${String(200-i).padStart(12,"0")}`,
    ward_id: "ward", author_name: "Sentinel", type: "Beobachtung", note: "Note",
    rationale: "Reason", metrics: {}, hash: `hash-${i}`, created_at: "2026-01-01T12:00:00+00:00",
  }));
  const requests: URL[] = [];
  const client = createClient<Database>("https://test.example", "test-key", {
    auth: { persistSession: false },
    global: { fetch: async (input) => {
      const url = new URL(String(input)); requests.push(url);
      const filter = url.searchParams.get("or");
      const before = filter?.match(/id\.lt\.([\w-]+)/)?.[1];
      const result = rows.filter(row => !before || row.id < before).slice(0, Number(url.searchParams.get("limit")));
      return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
    } },
  });
  return { client, requests, rows };
}

describe("care history pagination", () => {
  it("loads only the visible page and walks tied timestamps without duplicates", async () => {
    const {client, requests} = fixture();
    const first = await fetchCareLogPage(client,"ward");
    expect(requests).toHaveLength(1);
    expect(first.logs).toHaveLength(50);
    expect(first.next).not.toBeNull();
    const second = await fetchCareLogPage(client,"ward",first.next);
    expect(second.logs).toHaveLength(50);
    expect(new Set([...first.logs,...second.logs].map(log=>log.signature)).size).toBe(100);
    expect(requests[1].searchParams.get("order")).toBe("created_at.desc,id.desc");
  });
  it("exports the complete history and supports cancellation", async () => {
    const {client, rows} = fixture();
    const logs = await fetchAllCareLogs(client,"ward",50);
    expect(logs).toHaveLength(rows.length);
    expect(new Set(logs.map(log=>log.signature)).size).toBe(rows.length);
    const controller = new AbortController(); controller.abort();
    await expect(fetchAllCareLogs(client,"ward",50,controller.signal)).rejects.toBeDefined();
  });
});
