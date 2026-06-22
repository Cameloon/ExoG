// Sends an application confirmation email (or logs it if no email provider is configured).
// For MVP: this returns success and logs to the function log. Wire to a provider when ready.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  email: string;
  fullName: string;
  caseId: string;
  language?: "de" | "en";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
    console.log("[email] would send", { to: body.email, subject, body: text });

    return new Response(
      JSON.stringify({ ok: true, queued: true, subject }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("send-application-confirmation error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
