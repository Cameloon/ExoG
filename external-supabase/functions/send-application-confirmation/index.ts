// Sends the application confirmation email via Brevo (https://brevo.com) —
// EU-based (FR), free tier 300 mails/day, DPA available. If BREVO_API_KEY is
// not set, the email is only logged (dev fallback).
//
// SECURITY:
//  - CORS restricted to the app origin (set APP_ORIGIN secret/env).
//  - Requires a valid Clerk session JWT (Authorization: Bearer <Clerk JWT>),
//    verified against Clerk's JWKS (signature, iss, exp). The Supabase anon
//    key alone is NOT sufficient.
//
// Secrets: BREVO_API_KEY (brevo.com → SMTP & API → API Keys), EMAIL_FROM
// (verified sender, e.g. "BioSteward <noreply@yourdomain.de>"), APP_ORIGIN.

const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "http://localhost:8080";
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "BioSteward <noreply@example.com>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLERK_SECRET = Deno.env.get("CLERK_SECRET_KEY") ?? "";

// "Name <addr@host>" → { name, email }; bare address → default name.
const fromMatch = EMAIL_FROM.match(/^(.*?)\s*<([^>]+)>$/);
const SENDER = fromMatch
  ? { name: fromMatch[1].trim(), email: fromMatch[2].trim() }
  : { name: "BioSteward", email: EMAIL_FROM };

const corsHeaders = {
  "Access-Control-Allow-Origin": APP_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

interface Payload {
  applicationId?: string;
  caseId?: string;
}

function redactEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 1) return "***";
  return `${email[0]}***@${email.slice(at + 1)}`;
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

// Recipient is the caller's verified Clerk email, not the client-supplied
// address stored on the application (which a caller could set to a third
// party's address to spam them). Falls back to the stored email only when no
// CLERK_SECRET_KEY is configured.
async function clerkPrimaryEmail(userId: string): Promise<string | null> {
  if (!CLERK_SECRET) return null;
  const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    headers: { Authorization: `Bearer ${CLERK_SECRET}` },
  });
  if (!res.ok) return null;
  const u = (await res.json()) as {
    primary_email_address_id?: string | null;
    email_addresses?: { id: string; email_address: string }[];
  };
  const primary = u.email_addresses?.find((e) => e.id === u.primary_email_address_id);
  return primary?.email_address ?? u.email_addresses?.[0]?.email_address ?? null;
}

async function loadOwnApplication(userId: string, body: Payload): Promise<{ email: string; full_name: string; case_id: string } | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE) return null;
  const filters = body.applicationId
    ? `id=eq.${encodeURIComponent(body.applicationId)}`
    : body.caseId
      ? `case_id=eq.${encodeURIComponent(body.caseId)}`
      : "";
  if (!filters) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sentinel_applications?${filters}&user_id=eq.${encodeURIComponent(userId)}&select=email,full_name,case_id&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
      },
    },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as { email: string; full_name: string; case_id: string }[];
  return rows[0] ?? null;
}

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

    // Standard claims: issuer must be our Clerk instance, token must be unexpired.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  // The client sends the Clerk JWT; the anon apikey alone is not enough.
  const userId = token ? await verifyClerkToken(token) : null;
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (rateLimited(userId)) {
    return new Response(JSON.stringify({ error: "rate limited" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as Payload;
    const app = await loadOwnApplication(userId, body);
    if (!app) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // German-only app — no language branch.
    const subject = `Bewerbung eingegangen · ${app.case_id}`;
    const text = `Hallo ${app.full_name},\n\nDeine Sentinel-Bewerbung (${app.case_id}) ist eingegangen. Wir melden uns innerhalb von 5 Werktagen.\n\n— BioSteward Custody Network`;
    const recipient = (await clerkPrimaryEmail(userId)) ?? app.email;

    if (BREVO_API_KEY) {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": BREVO_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: SENDER,
          to: [{ email: recipient, name: app.full_name }],
          subject,
          textContent: text,
        }),
      });
      if (!res.ok) {
        console.error("[email] brevo failed", res.status, await res.text());
        return new Response(JSON.stringify({ error: "email failed" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Dev fallback: no provider configured — log so the client flow is testable.
      // Avoid logging PII: only a redacted marker + case id.
      console.log("[email] no BREVO_API_KEY, logged only", { to: redactEmail(recipient), caseId: app.case_id });
    }

    return new Response(
      JSON.stringify({ ok: true, queued: true, subject }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("send-application-confirmation error", e);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
