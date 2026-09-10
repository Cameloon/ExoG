// Sets a user's role/region in Clerk publicMetadata (Clerk Backend API).
// Needed because behörde/einrichtung roles have no DB fallback — only the
// Clerk claim gates access. Callable by admins only.
//
// SECURITY:
//  - CORS restricted to the app origin (APP_ORIGIN).
//  - Caller must present a valid Clerk session JWT AND the caller's own
//    Clerk user must have public_metadata.role === 'admin' (checked live
//    against the Backend API, not the possibly-stale JWT claims).
//
// Secrets: CLERK_SECRET_KEY (Clerk dashboard → API keys), APP_ORIGIN.

const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "http://localhost:8080";
const CLERK_SECRET_KEY = Deno.env.get("CLERK_SECRET_KEY") ?? "";
const CLERK_DOMAIN = Deno.env.get("CLERK_DOMAIN") ?? "ideal-tetra-26.clerk.accounts.dev";
const CLERK_JWKS_URL = `https://${CLERK_DOMAIN}/.well-known/jwks.json`;

// ponytail: module-scope JWKS cache — the isolate is reused across warm
// invocations, so one Clerk fetch serves many requests. TTL guards rotation;
// an unknown kid forces one fresh refetch.
let jwksCache: { at: number; keys: { kid?: string }[] } | null = null;
async function getJwks(): Promise<{ kid?: string }[] | null> {
  if (jwksCache && Date.now() - jwksCache.at < 10 * 60 * 1000) return jwksCache.keys;
  const res = await fetch(CLERK_JWKS_URL);
  if (!res.ok) return null;
  const { keys } = await res.json();
  jwksCache = { at: Date.now(), keys };
  return keys;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": APP_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const ROLES = ["user", "sentinel", "behoerde", "einrichtung", "admin"] as const;
type Role = (typeof ROLES)[number];

interface Payload {
  userId: string;
  role: Role;
  region?: string | null;
}

// ponytail: in-memory sliding-window rate limit, resets on cold start — abuse damping only.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const rateBuckets = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  rateBuckets.set(userId, hits);
  return hits.length > RATE_MAX;
}

// Minimal Clerk JWT verification against rotating JWKS. Returns the user id.
async function verifyClerkToken(token: string): Promise<string | null> {
  try {
    const [headerB64] = token.split(".");
    const header = JSON.parse(atob(headerB64.replace(/-/g, "+").replace(/_/g, "/")));
    const kid: string | undefined = header.kid;
    if (!kid) return null;

    let jwk = (await getJwks())?.find((k) => k.kid === kid);
    if (!jwk) {
      jwksCache = null; // key rotation: force one fresh fetch
      jwk = (await getJwks())?.find((k) => k.kid === kid);
    }
    if (!jwk) return null;

    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const data = token.split(".").slice(0, 2).join(".");
    const sig = token.split(".")[2];
    const sigBytes = Uint8Array.from(
      atob(sig.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );

    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      sigBytes,
      new TextEncoder().encode(data),
    );
    if (!valid) return null;

    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (payload.iss !== `https://${CLERK_DOMAIN}`) return null;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

async function clerkApi(path: string, init?: RequestInit): Promise<Response> {
  return await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const callerId = token ? await verifyClerkToken(token) : null;
  if (!callerId || !CLERK_SECRET_KEY) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (rateLimited(callerId)) {
    return new Response(JSON.stringify({ error: "rate limited" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Admin check against the live Clerk user record (JWT claims can be stale).
    const callerRes = await clerkApi(`/users/${callerId}`);
    if (!callerRes.ok) throw new Error(`clerk lookup failed: ${callerRes.status}`);
    const caller = await callerRes.json();
    if (caller?.public_metadata?.role !== "admin") {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Payload;
    if (!body?.userId || !ROLES.includes(body.role)) {
      return new Response(JSON.stringify({ error: "missing/invalid fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clerk deep-merges public_metadata on PATCH; null deletes a key.
    const metadata: Record<string, unknown> = { role: body.role };
    if (body.region !== undefined) metadata.region = body.region || null;

    const updateRes = await clerkApi(`/users/${body.userId}/metadata`, {
      method: "PATCH",
      body: JSON.stringify({ public_metadata: metadata }),
    });
    if (!updateRes.ok) {
      console.error("[set-user-role] clerk patch failed", updateRes.status, await updateRes.text());
      return new Response(JSON.stringify({ error: "update failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[set-user-role]", { caller: callerId, target: body.userId, role: body.role });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("set-user-role error", e);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
