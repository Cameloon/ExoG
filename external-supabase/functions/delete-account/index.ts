// Self-service account deletion (DSGVO Art. 17).
// Authenticated user deletes their own data: profile, roles, applications,
// documents, shelter requests, and KYC files in storage. The Clerk user
// itself is deleted via the Admin API using CLERK_SECRET_KEY.
//
// Server guarantees:
//  - Clerk JWT verified (user can only delete their own id).
//  - Storage purge scoped to the caller's own folder, and its failure
//    aborts the request instead of silently retaining ID documents.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLERK_SECRET = Deno.env.get("CLERK_SECRET_KEY") ?? "";
const CLERK_DOMAIN = Deno.env.get("CLERK_DOMAIN") ?? "ideal-tetra-26.clerk.accounts.dev";
const BUCKET = "kyc-documents";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "http://localhost:5173",
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

async function del(path: string) {
  return fetch(`${SUPABASE_URL}${path}`, { method: "DELETE", headers: serviceHeaders });
}

// Storage list API is POST with a JSON body; entries with id === null are folders.
async function listStorage(prefix: string): Promise<{ name: string; id: string | null }[]> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: serviceHeaders,
    body: JSON.stringify({ prefix, limit: 1000 }),
  });
  if (!res.ok) throw new Error(`storage list failed: ${res.status}`);
  return await res.json();
}

// Files live at ${userId}/${applicationId}/${slot}.ext (two levels).
async function purgeKycFiles(userId: string): Promise<number> {
  const paths: string[] = [];
  for (const entry of await listStorage(`${userId}/`)) {
    if (entry.id === null) {
      for (const f of await listStorage(`${userId}/${entry.name}/`)) {
        if (f.id !== null) paths.push(`${userId}/${entry.name}/${f.name}`);
      }
    } else {
      paths.push(`${userId}/${entry.name}`);
    }
  }
  for (const p of paths) {
    const res = await del(`/storage/v1/object/${BUCKET}/${p}`);
    if (!res.ok) throw new Error(`storage delete failed: ${res.status}`);
  }
  return paths.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const userId = token ? await verifyClerkToken(token) : null;
  if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (rateLimited(userId)) {
    return new Response(JSON.stringify({ error: "rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // 1) Purge own KYC files. Failure here must abort: retaining ID documents
  //    after "deletion" is a GDPR Art. 17 violation.
  try {
    await purgeKycFiles(userId);
  } catch (e) {
    console.error("kyc purge failed", e);
    return new Response(JSON.stringify({ error: "storage purge failed, account NOT deleted" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // 2) Delete own DB rows (FKs cascade where defined). Any failure aborts:
  //    the Clerk user must not be deleted while orphaned rows survive.
  const rowDeletes: [string, string][] = [
    ["application_documents", `user_id=eq.${userId}`],
    ["sentinel_applications", `user_id=eq.${userId}`],
    ["pending_shelter_requests", `user_id=eq.${userId}`],
    ["sentinel_shelter_requests", `user_id=eq.${userId}`],
    ["user_roles", `user_id=eq.${userId}`],
    ["profiles", `id=eq.${userId}`],
  ];
  for (const [table, filter] of rowDeletes) {
    const res = await del(`/rest/v1/${table}?${filter}`);
    if (!res.ok) {
      console.error(`delete ${table} failed: ${res.status}`);
      return new Response(JSON.stringify({ error: `db cleanup failed (${table}), account NOT deleted` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // 2b) Anonymize the human-readable name on rows that must survive as
  //     evidence. The author id column is NOT NULL and stays — it is no
  //     longer linkable to a person once the Clerk user is deleted.
  const anon = await fetch(`${SUPABASE_URL}/rest/v1/care_logs?author_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { ...serviceHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ author_name: "Gelöschtes Konto" }),
  });
  if (!anon.ok) {
    console.error("anonymize care_logs failed:", anon.status);
    return new Response(JSON.stringify({ error: "db cleanup failed (care_logs), account NOT deleted" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // 3) Delete Clerk user (cascade revokes sessions).
  if (CLERK_SECRET) {
    const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${CLERK_SECRET}`, "Content-Type": "application/json" },
    });
    if (!res.ok) {
      console.error("clerk delete failed:", res.status);
      return new Response(JSON.stringify({ error: "clerk delete failed, account NOT deleted" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
