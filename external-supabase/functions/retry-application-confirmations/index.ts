// Schedule every five minutes. Authenticate using a dedicated server-only
// CRON_SECRET, never the browser's anon key. Delivery is at least once.
const URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const BREVO = Deno.env.get("BREVO_API_KEY") ?? "";
const FROM = Deno.env.get("EMAIL_FROM") ?? "BioSteward <noreply@example.com>";
const match = FROM.match(/^(.*?)\s*<([^>]+)>$/);
const sender = match ? { name: match[1].trim(), email: match[2].trim() } : { name: "BioSteward", email: FROM };
const headers = { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!URL || !SERVICE || !CRON_SECRET || !BREVO) return new Response("not configured", { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) return new Response("unauthorized", { status: 401 });
  try {
    // Exclude fresh submissions so their immediate delivery attempt finishes.
    const now = new Date().toISOString();
    const before = new Date(Date.now() - 5 * 60_000).toISOString();
    const pending = await fetch(`${URL}/rest/v1/sentinel_applications?confirmation_status=eq.pending&confirmation_next_attempt_at=lte.${now}&created_at=lt.${before}&select=id,email,full_name,case_id&order=confirmation_next_attempt_at.asc&limit=20`, { headers });
    if (!pending.ok) throw new Error(`queue read: ${pending.status}`);
    const rows = await pending.json() as { id: string; email: string; full_name: string; case_id: string }[];
    let sent = 0;
    for (const app of rows) {
      try {
        // Compare-and-set a lease: overlapping workers cannot deliver the same
        // row concurrently; a crash or provider failure becomes retryable later.
        const claim = await fetch(`${URL}/rest/v1/sentinel_applications?id=eq.${app.id}&confirmation_status=eq.pending&confirmation_next_attempt_at=lte.${now}`, {
          method: "PATCH", headers: { ...headers, Prefer: "return=representation" },
          body: JSON.stringify({ confirmation_next_attempt_at: new Date(Date.now() + 15 * 60_000).toISOString() }),
        });
        if (!claim.ok || (await claim.json()).length === 0) continue;
        const result = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST", headers: { "api-key": BREVO, "Content-Type": "application/json" },
          signal: AbortSignal.timeout(5_000),
          body: JSON.stringify({ sender, to: [{ email: app.email, name: app.full_name }],
            subject: `Bewerbung eingegangen · ${app.case_id}`,
            textContent: `Hallo ${app.full_name},\n\nDeine Sentinel-Bewerbung (${app.case_id}) ist eingegangen. Wir melden uns innerhalb von 5 Werktagen.\n\n- BioSteward Custody Network`,
          }),
        });
        if (!result.ok) { console.error("confirmation retry failed", app.id, result.status); continue; }
        const marked = await fetch(`${URL}/rest/v1/sentinel_applications?id=eq.${app.id}`, {
          method: "PATCH", headers, body: JSON.stringify({ confirmation_status: "sent" }),
        });
        if (!marked.ok) throw new Error(`queue update: ${marked.status}`);
        sent++;
      } catch (error) {
        console.error("confirmation remains queued", app.id, error instanceof Error ? error.message : "delivery error");
      }
    }
    return Response.json({ sent, remainingInBatch: rows.length - sent });
  } catch (error) {
    console.error("confirmation worker", error instanceof Error ? error.message : "error");
    return new Response("retry failed", { status: 502 });
  }
});
