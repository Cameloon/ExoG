// Secure KYC document upload.
// Client sends raw file bytes in the request body with headers:
//   authorization:  Bearer <Clerk JWT>
//   x-application-id: <uuid>
//   x-slot:         id_front | id_back | facility
//   content-type:   file mime
//
// Server-side guarantees (the client cannot bypass these):
//  - Clerk JWT verified against JWKS (signature, iss, exp); user_id from `sub`.
//  - Application must exist, belong to the caller, and still be reviewable
//    (no overwriting KYC evidence after approval).
//  - File type validated by MAGIC BYTES, not the client-claimed MIME; the
//    stored content-type is derived from the sniffed type.
//  - Hard size cap (10 MB).
//  - Stored only under the caller's own folder: ${sub}/${applicationId}/${slot}.${ext}
//
// Storage write uses the service-role key, so this function is the single
// trusted writer; clients have no direct INSERT policy on the bucket.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLERK_DOMAIN = Deno.env.get("CLERK_DOMAIN") ?? "";
const BUCKET = "kyc-documents";
const MAX_BYTES = 10 * 1024 * 1024;

const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "http://localhost:8080";
const corsHeaders = {
  "Access-Control-Allow-Origin": APP_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-application-id, x-slot",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

// ponytail: simple in-memory sliding-window rate limit, keyed by user id.
// No external store; resets on cold start, which is fine for abuse damping.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const rateBuckets = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  rateBuckets.set(userId, hits);
  return hits.length > RATE_MAX;
}

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  pdf: "application/pdf",
  webp: "image/webp",
  avif: "image/avif",
};

// Returns the canonical extension for a known-safe file, or null to reject.
function sniffExt(bytes: Uint8Array): string | null {
  const s = (a: number[]) => a.every((b, i) => bytes[i] === b);
  if (s([0xff, 0xd8, 0xff])) return "jpg";
  if (s([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (s([0x47, 0x49, 0x46, 0x38])) return "gif";
  if (s([0x25, 0x50, 0x44, 0x46])) return "pdf";
  // RIFF....WEBP
  if (s([0x52, 0x49, 0x46, 0x46]) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
  // ftyp box: bytes[4..8]=="ftyp", bytes[8..12]=="avif"|"avis"
  if (bytes.length > 12 && String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]) === "ftyp") {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (brand === "avif" || brand === "avis") return "avif";
  }
  return null;
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
    const [headerB64] = token.split(".");
    const header = JSON.parse(atob(headerB64.replace(/-/g, "+").replace(/_/g, "/")));
    const kid: string | undefined = header.kid;
    if (!kid) return null;
    let jwk = (await getJwks())?.find((k) => k.kid === kid);
    if (!jwk) {
      jwksCache = null;
      jwk = (await getJwks())?.find((k) => k.kid === kid);
    }
    if (!jwk) return null;
    const cryptoKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const data = token.split(".").slice(0, 2).join(".");
    const sig = token.split(".")[2];
    const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, sigBytes, new TextEncoder().encode(data));
    if (!valid) return null;
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.iss !== `https://${CLERK_DOMAIN}`) return null;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

// The caller must own the application and it must still be under review —
// otherwise an approved user could overwrite reviewed KYC evidence.
async function applicationWritable(applicationId: string, userId: string): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sentinel_applications?id=eq.${applicationId}&user_id=eq.${userId}&select=status`,
    { headers: { Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE } },
  );
  if (!res.ok) return false;
  const rows = (await res.json()) as { status: string }[];
  return rows.length === 1 && (rows[0].status === "pending" || rows[0].status === "under_review");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (!CLERK_DOMAIN || !SUPABASE_URL || !SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: "function not configured" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const userId = token ? await verifyClerkToken(token) : null;
  if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (rateLimited(userId)) {
    return new Response(JSON.stringify({ error: "rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const applicationId = req.headers.get("x-application-id") ?? "";
  const slot = req.headers.get("x-slot");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationId) || !/^(id_front|id_back|facility|selfie)$/.test(slot ?? "")) {
    return new Response(JSON.stringify({ error: "bad request" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (!(await applicationWritable(applicationId, userId))) {
    return new Response(JSON.stringify({ error: "application not writable" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BYTES) {
    return new Response(JSON.stringify({ error: "file too large (max 10 MB)" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.length === 0) return new Response(JSON.stringify({ error: "empty file" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (buf.length > MAX_BYTES) return new Response(JSON.stringify({ error: "file too large (max 10 MB)" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const ext = sniffExt(buf);
  if (!ext) return new Response(JSON.stringify({ error: "unsupported file type" }), { status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const path = `${userId}/${applicationId}/${slot}.${ext}`;

  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": EXT_MIME[ext],
      "x-upsert": "true",
      apikey: SERVICE_ROLE,
    },
    body: buf,
  });
  if (!up.ok) {
    const detail = await up.text();
    console.error("storage upload failed", up.status, detail);
    return new Response(JSON.stringify({ error: "storage write failed" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true, path }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
