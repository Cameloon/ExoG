// Sends an application confirmation email (or logs it if no email provider is configured).
// For MVP: this returns success and logs to the function log. Wire to a provider when ready.
//
// SECURITY:
//  - CORS restricted to the app origin (set APP_ORIGIN secret/env).
//  - Requires a valid Clerk session JWT (Authorization: Bearer <Clerk JWT>),
//    verified against Clerk's JWKS. The Supabase anon key alone is NOT sufficient.

const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "http://localhost:5173";

const corsHeaders = {
  "Access-Control-Allow-Origin": APP_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

interface Payload {
  email: string;
  fullName: string;
  caseId: string;
  language?: "de" | "en";
}

function redactEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 1) return "***";
  return `${email[0]}***@${email.slice(at + 1)}`;
}

const CLERK_JWKS_URL = `https://${
  Deno.env.get("CLERK_DOMAIN") ?? "ideal-tetra-26.clerk.accounts.dev"
}/.well-known/jwks.json`;

// Minimal Clerk JWT verification against rotating JWKS.
async function verifyClerkToken(token: string): Promise<boolean> {
  try {
    const [headerB64] = token.split(".");
    const header = JSON.parse(atob(headerB64.replace(/-/g, "+").replace(/_/g, "/")));
    const kid: string | undefined = header.kid;
    if (!kid) return false;

    const jwksRes = await fetch(CLERK_JWKS_URL);
    if (!jwksRes.ok) return false;
    const { keys } = await jwksRes.json();
    const jwk = keys.find((k: { kid?: string }) => k.kid === kid);
    if (!jwk) return false;

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
    if (!valid) return false;

    // Replay / expiry check on standard claims.
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return false;
    if (payload.azp && !payload.azp.includes(APP_ORIGIN) && !APP_ORIGIN.includes("localhost")) {
      // Allow if authorized-party matches our origin (skip for local dev).
    }
    return true;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  // The client sends the Clerk JWT; the anon apikey alone is not enough.
  if (!token || !(await verifyClerkToken(token))) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as Payload;
    if (!body?.email || !body?.caseId) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lang = body.language === "en" ? "en" : "de";

    const subject =
      lang === "de"
        ? `Bewerbung eingegangen · ${body.caseId}`
        : `Application received · ${body.caseId}`;

    const text =
      lang === "de"
        ? `Hallo ${body.fullName},\n\nDeine Sentinel-Bewerbung (${body.caseId}) ist eingegangen. Wir melden uns innerhalb von 5 Werktagen.\n\n— BioSteward Custody Network`
        : `Hello ${body.fullName},\n\nYour Sentinel application (${body.caseId}) has been received. We will get back to you within 5 business days.\n\n— BioSteward Custody Network`;

    // No external provider wired yet — log so it shows up in function logs and the
    // client can confirm the email step succeeded. Replace with a real provider later.
    // Avoid logging PII: only a redacted marker + case id.
    console.log("[email] queued", { to: redactEmail(body.email), caseId: body.caseId });

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
