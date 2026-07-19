// Self-service account deletion (DSGVO Art. 17).
// Authenticated user deletes their own data: profile, roles, applications,
// documents, shelter requests, and KYC files in storage. The Clerk user
// itself is deleted via the Admin API using CLERK_SECRET_KEY.
//
// Server guarantees:
//  - Clerk JWT verified (user can only delete their own id).
//  - Storage purge scoped to the caller's own folder.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLERK_SECRET = Deno.env.get("CLERK_SECRET_KEY") ?? "";
const BUCKET = "kyc-documents";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "http://localhost:5173",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

async function verifyClerkToken(token: string): Promise<string | null> {
  try {
    const [h] = token.split(".");
    const header = JSON.parse(atob(h.replace(/-/g, "+").replace(/_/g, "/")));
    const jwksRes = await fetch(`https://${Deno.env.get("CLERK_DOMAIN") ?? "ideal-tetra-26.clerk.accounts.dev"}/.well-known/jwks.json`);
    if (!jwksRes.ok) return null;
    const { keys } = await jwksRes.json();
    const jwk = keys.find((k: { kid?: string }) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const data = token.split(".").slice(0, 2).join(".");
    const sig = Uint8Array.from(atob(token.split(".")[2].replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, new TextEncoder().encode(data)))) return null;
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

async function del(path: string, body?: unknown) {
  return fetch(`${SUPABASE_URL}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const userId = token ? await verifyClerkToken(token) : null;
  if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  // 1) Purge own KYC files.
  const listRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}?prefix=${userId}/`, {
    headers: { Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
  });
  if (listRes.ok) {
    const files = (await listRes.json()) as { name: string }[];
    for (const f of files) {
      await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${userId}/${f.name}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
      });
    }
  }

  // 2) Delete own DB rows (FKs cascade where defined).
  await del(`/rest/v1/application_documents?user_id=eq.${userId}`);
  await del(`/rest/v1/sentinel_applications?user_id=eq.${userId}`);
  await del(`/rest/v1/pending_shelter_requests?user_id=eq.${userId}`);
  await del(`/rest/v1/sentinel_shelter_requests?user_id=eq.${userId}`);
  await del(`/rest/v1/user_roles?user_id=eq.${userId}`);
  await del(`/rest/v1/profiles?id=eq.${userId}`);

  // 3) Delete Clerk user (cascade revokes sessions).
  if (CLERK_SECRET) {
    await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${CLERK_SECRET}`, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
