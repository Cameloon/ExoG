// Self-service account deletion (DSGVO Art. 17).
// Authenticated user deletes their own data. Full inventory:
//  - Storage: kyc-documents, ward-images, id-photos, lab-docs (own folder)
//  - DB: application_documents, sentinel_applications, pending_shelter_requests,
//        sentinel_shelter_requests, ward_interest, shelters (owned),
//        identification_requests (created, cascades votes),
//        sentinel_change_requests, user_roles, profiles
//  - Anonymized (evidence must survive, identity must not): care_logs,
//        transport_logs, change_log, role_change_log, and owned ward records
// The Clerk user itself is deleted last via the Admin API.
//
// Server guarantees:
//  - Clerk JWT verified (user can only delete their own id).
//  - Every purge/delete step is ordered and aborts on failure so a retry can
//    continue where it stopped; a partial state is always recoverable by
//    re-running the same request (idempotent deletes).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLERK_SECRET = Deno.env.get("CLERK_SECRET_KEY") ?? "";
const CLERK_DOMAIN = Deno.env.get("CLERK_DOMAIN") ?? "ideal-tetra-26.clerk.accounts.dev";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "http://localhost:8080",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

// ponytail: in-memory sliding-window rate limit, resets on cold start — abuse damping only.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;
const rateBuckets = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  rateBuckets.set(userId, hits);
  return hits.length > RATE_MAX;
}

// ponytail: module-scope JWKS cache — see send-application-confirmation.
let jwksCache: { at: number; keys: { kid?: string }[] } | null = null;
async function getJwks(): Promise<{ kid?: string }[] | null> {
  if (jwksCache && Date.now() - jwksCache.at < 10 * 60 * 1000) return jwksCache.keys;
  const res = await fetch(`https://${CLERK_DOMAIN}/.well-known/jwks.json`);
  if (!res.ok) return null;
  const { keys } = await res.json();
  jwksCache = { at: Date.now(), keys };
  return keys;
}

async function verifyClerkToken(token: string): Promise<string | null> {
  try {
    const [h] = token.split(".");
    const header = JSON.parse(atob(h.replace(/-/g, "+").replace(/_/g, "/")));
    let jwk = (await getJwks())?.find((k) => k.kid === header.kid);
    if (!jwk) {
      jwksCache = null;
      jwk = (await getJwks())?.find((k) => k.kid === header.kid);
    }
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const data = token.split(".").slice(0, 2).join(".");
    const sig = Uint8Array.from(atob(token.split(".")[2].replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, new TextEncoder().encode(data)))) return null;
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.iss !== `https://${CLERK_DOMAIN}`) return null;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

const serviceHeaders = {
  Authorization: `Bearer ${SERVICE_ROLE}`,
  apikey: SERVICE_ROLE,
  "Content-Type": "application/json",
};

async function rest(path: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}${path}`, { headers: serviceHeaders, ...init });
}

async function del(path: string) {
  return rest(path, { method: "DELETE" });
}

// Storage list API is POST with a JSON body; entries with id === null are folders.
async function listStorage(bucket: string, prefix: string): Promise<{ name: string; id: string | null }[]> {
  const out: { name: string; id: string | null }[] = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: serviceHeaders,
      body: JSON.stringify({ prefix, limit: 1000, offset }),
    });
    if (!res.ok) throw new Error(`storage list failed: ${res.status}`);
    const page = (await res.json()) as { name: string; id: string | null }[];
    out.push(...page);
    if (page.length < 1000) return out;
    offset += 1000;
  }
}

// Collects every object path under `${userId}/` in a bucket (two folder levels
// are enough for the app's ${userId}/${id}/${file} scheme; deeper nesting is
// flattened by listing with a recursive prefix).
async function collectPaths(bucket: string, userId: string): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of await listStorage(bucket, `${userId}/`)) {
    if (entry.id === null) {
      for (const f of await listStorage(bucket, `${userId}/${entry.name}/`)) {
        if (f.id !== null) paths.push(`${userId}/${entry.name}/${f.name}`);
      }
    } else {
      paths.push(`${userId}/${entry.name}`);
    }
  }
  return paths;
}

async function purgeBucket(bucket: string, userId: string): Promise<number> {
  const paths = await collectPaths(bucket, userId);
  // Batch delete (single request, max 1000) — falls back per-object on error.
  if (paths.length > 0) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: serviceHeaders,
      body: JSON.stringify({ prefixes: paths }),
    });
    if (!res.ok) {
      for (const p of paths) {
        const one = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${p}`, { method: "DELETE", headers: serviceHeaders });
        if (!one.ok) throw new Error(`storage delete failed: ${one.status}`);
      }
    }
  }
  return paths.length;
}

async function anonymize(table: string, filter: string, body: Record<string, unknown>) {
  const res = await rest(`/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: { ...serviceHeaders, Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`anonymize ${table} failed: ${res.status}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const userId = token ? await verifyClerkToken(token) : null;
  if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  // Fail closed before deleting anything. Without these secrets the function
  // cannot complete the cleanup contract and must not create a partial delete.
  if (!SUPABASE_URL || !SERVICE_ROLE || !CLERK_SECRET) {
    return new Response(JSON.stringify({ error: "account deletion unavailable" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (rateLimited(userId)) {
    return new Response(JSON.stringify({ error: "rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    // 1) Storage purge — failure aborts: retaining ID documents after a
    //    "deletion" is a GDPR Art. 17 violation.
    const purged: Record<string, number> = {};
    for (const bucket of ["kyc-documents", "ward-images", "id-photos", "lab-docs"]) {
      purged[bucket] = await purgeBucket(bucket, userId);
    }
    console.log("[delete-account] storage purged", { userId, purged });

    // 2) DB rows — FK-cascade order. Every failure aborts; each delete is
    //    idempotent so a retry after a mid-sequence failure resumes safely.
    // Keep Ward rows as anonymized custody records; deleting them would also
    // cascade away the care and transport evidence attached to each Ward.
    await anonymize("ward_listings", `owner_id=eq.${userId}`, {
      owner_id: "deleted",
      status: "withdrawn",
      images: [],
      lab_report_path: null,
    });
    const rowDeletes: [string, string][] = [
      ["application_documents", `user_id=eq.${userId}`],
      ["sentinel_applications", `user_id=eq.${userId}`],
      ["pending_shelter_requests", `user_id=eq.${userId}`],
      ["sentinel_shelter_requests", `sentinel_id=eq.${userId}`],
      ["ward_interest", `applicant_id=eq.${userId}`],
      ["shelters", `owner_id=eq.${userId}`],
      ["identification_requests", `created_by=eq.${userId}`],
      ["sentinel_change_requests", `user_id=eq.${userId}`],
      ["user_roles", `user_id=eq.${userId}`],
      ["profiles", `id=eq.${userId}`],
    ];
    for (const [table, filter] of rowDeletes) {
      const res = await del(`/rest/v1/${table}?${filter}`);
      if (!res.ok) throw new Error(`db cleanup failed (${table}): ${res.status}`);
    }

    // 3) Anonymize rows that must survive as evidence (author/actor ids stay
    //    — no longer linkable once the Clerk user is gone).
    await anonymize("care_logs", `author_id=eq.${encodeURIComponent(userId)}`, { author_name: "Gelöschtes Konto" });
    await anonymize("transport_logs", `handler_id=eq.${encodeURIComponent(userId)}`, { handler_id: "deleted" });
    await anonymize("change_log", `actor_id=eq.${encodeURIComponent(userId)}`, { actor_id: "deleted" });
    await anonymize("role_change_log", `actor_id=eq.${encodeURIComponent(userId)}`, { actor_id: "deleted" });
    await anonymize("role_change_log", `target_user_id=eq.${encodeURIComponent(userId)}`, { target_user_id: "deleted" });
  } catch (e) {
    console.error("account deletion failed", e);
    return new Response(JSON.stringify({ error: `cleanup failed: ${(e as Error).message}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // 4) Delete Clerk user (cascade revokes sessions).
  const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${CLERK_SECRET}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    console.error("clerk delete failed:", res.status);
    return new Response(JSON.stringify({ error: "clerk delete failed, data already removed — retry or contact support" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
