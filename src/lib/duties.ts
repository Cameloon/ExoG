// Live duties (Übersicht todo list) + 7-day activity for the Sentinel dashboard.
// Demo mode keeps using src/lib/dashboard-data.ts constants.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Duty, DutyPriority } from "./dashboard-data";

type Client = SupabaseClient<Database>;

type DutyRow = {
  id: string;
  case_code: string | null;
  title: string;
  category: string;
  priority: string;
  due_at: string | null;
  done: boolean;
};

export const formatDue = (iso: string | null): string => {
  if (!iso) return "Heute · spontan";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Heute · spontan";
  const now = new Date();
  const time = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const day = (offset: number) => {
    const x = new Date(now);
    x.setDate(now.getDate() + offset);
    return x.toDateString();
  };
  if (d.toDateString() === day(-1)) return `Gestern · ${time}`;
  if (d.toDateString() === day(0)) return `Heute · ${time}`;
  if (d.toDateString() === day(1)) return `Morgen · ${time}`;
  return `${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} · ${time}`;
};

const toDuty = (r: DutyRow): Duty => ({
  id: r.id,
  title: r.title,
  caseId: r.case_code ?? undefined,
  due: formatDue(r.due_at),
  dueIso: r.due_at ?? "",
  priority: r.priority as DutyPriority,
  done: r.done,
  category: r.category as Duty["category"],
});

export async function fetchDuties(client: Client, userId: string, page = 0, pageSize = 200): Promise<Duty[]> {
  const from = page * pageSize;
  const { data, error } = await client
    .from("duties")
    .select("id, case_code, title, category, priority, due_at, done")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return ((data ?? []) as DutyRow[]).map(toDuty);
}

export type NewDuty = {
  ownerId: string;
  title: string;
  caseCode: string | null;
  category: string;
  priority: DutyPriority;
  dueIso: string | null;
};

export async function addDuty(client: Client, input: NewDuty): Promise<Duty> {
  const due = input.dueIso ? new Date(input.dueIso) : null;
  const { data, error } = await client
    .from("duties")
    .insert({
      owner_id: input.ownerId,
      title: input.title,
      case_code: input.caseCode,
      category: input.category,
      priority: input.priority,
      // ponytail: guard malformed datetime-local strings instead of throwing a RangeError
      due_at: due && !Number.isNaN(due.getTime()) ? due.toISOString() : null,
    })
    .select("id, case_code, title, category, priority, due_at, done")
    .single();
  if (error) throw error;
  return toDuty(data as DutyRow);
}

export async function setDutyDone(client: Client, id: string, done: boolean): Promise<void> {
  const { error } = await client.from("duties").update({ done }).eq("id", id);
  if (error) throw error;
}

/** Care-log counts per day for the last 7 days, oldest → newest. */
export async function fetchActivity7d(client: Client, userId: string): Promise<{ day: string; logs: number }[]> {
  const days: { day: string; logs: number }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push({ day: d.toLocaleDateString("de-DE", { weekday: "short" }).replace(".", ""), logs: 0 });
  }
  const since = new Date(now);
  since.setDate(now.getDate() - 6);
  since.setHours(0, 0, 0, 0);
  const { data, error } = await client
    .from("care_logs")
    .select("created_at")
    .eq("author_id", userId)
    .gte("created_at", since.toISOString());
  if (error) return days;
  // ponytail: bucket by local calendar day (toDateString) instead of 86400000
  // arithmetic — DST days are 23/25h and would mis-bucket UTC-evening logs.
  const localDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const todayKey = localDay(now);
  for (const row of data ?? []) {
    const d = new Date((row as { created_at: string }).created_at);
    const daysAgo = Math.round((todayKey - localDay(d)) / 86400000);
    if (daysAgo >= 0 && daysAgo < 7) days[daysAgo].logs += 1;
  }
  return days;
}
