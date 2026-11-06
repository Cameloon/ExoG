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
// Clerk binds the request to its verified caller. A service-only DB command
// deletes/anonymizes database data in one transaction before files are purged.
// Durable progress records allow retries after storage or Clerk outages.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLERK_SECRET = Deno.env.get("CLERK_SECRET_KEY") ?? "";
const CLERK_DOMAIN = Deno.env.get("CLERK_DOMAIN") ?? "";

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

// Recurse through all nesting depths, including uploads made outside the UI.
async function collectPaths(bucket: string, userId: string): Promise<string[]> {
  const paths: string[] = [];
  const folders = [`${userId}/`];
  while (folders.length) {
    const prefix = folders.pop()!;
    for (const entry of await listStorage(bucket, prefix)) {
      const path = `${prefix}${entry.name}`;
      if (entry.id === null) folders.push(`${path}/`);
      else paths.push(path);
    }
  }
  return paths;
}

async function purgeBucket(bucket: string, userId: string): Promise<number> {
  const paths = await collectPaths(bucket, userId);
  for (let start = 0; start < paths.length; start += 1000) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
      method: "DELETE", headers: serviceHeaders,
      body: JSON.stringify({ prefixes: paths.slice(start, start + 1000) }),
    });
    if (!res.ok) throw new Error(`storage delete failed: ${res.status}`);
  }
  return paths.length;
}

async function markDeletion(userId: string, stage: string) {
  const res = await rest(`/rest/v1/account_deletion_jobs?user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH", body: JSON.stringify({ stage, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`deletion progress failed: ${res.status}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  // Fail closed before deleting anything. Without these secrets the function
  // cannot complete the cleanup contract and must not create a partial delete.
  if (!SUPABASE_URL || !SERVICE_ROLE || !CLERK_SECRET || !CLERK_DOMAIN) {
    return new Response(JSON.stringify({ error: "account deletion unavailable" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const userId = token ? await verifyClerkToken(token) : null;
  if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (rateLimited(userId)) {
    return new Response(JSON.stringify({ error: "rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    // RPC completes atomically and fails before any storage removal if the
    // migration/permissions are missing. Its durable stage makes retries safe.
    const dbResult = await rest("/rest/v1/rpc/delete_account_data", {
      method: "POST", body: JSON.stringify({ p_user_id: userId }),
    });
    if (!dbResult.ok) throw new Error(`database cleanup failed: ${dbResult.status}`);
    const stage = await dbResult.json();
    if (stage === "database_deleted") {
      for (const bucket of ["kyc-documents", "ward-images", "id-photos", "lab-docs"]) {
        await purgeBucket(bucket, userId);
      }
      await markDeletion(userId, "storage_deleted");
    }
  } catch (e) {
    console.error("account deletion failed", e);
    return new Response(JSON.stringify({ error: `cleanup failed: ${(e as Error).message}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // 4) Delete Clerk user (cascade revokes sessions).
  const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${CLERK_SECRET}`, "Content-Type": "application/json" },
  });
  if (!res.ok && res.status !== 404) {
    console.error("clerk delete failed:", res.status);
    return new Response(JSON.stringify({ error: "clerk delete failed, data already removed — retry or contact support" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  await markDeletion(userId, "complete").catch((e) => console.error("deletion completion marker", e));
  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
