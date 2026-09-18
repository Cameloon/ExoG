// Trusted Sentinel application submission.
//
// Client sends multipart/form-data:
//   payload: JSON application fields
//   id_front, id_back, selfie: required File
//   facility: optional File
//
// Server guarantees:
//  - Clerk JWT verified against JWKS.
//  - One non-rejected application per user.
//  - Application, storage objects, document rows and confirmation email are
//    coordinated server-side; partial failures clean up created DB/storage data.
//  - File type is checked by magic bytes, not browser MIME or filename.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLERK_DOMAIN = Deno.env.get("CLERK_DOMAIN") ?? "ideal-tetra-26.clerk.accounts.dev";
const CLERK_SECRET_KEY = Deno.env.get("CLERK_SECRET_KEY") ?? "";
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "http://localhost:8080";
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "BioSteward <noreply@example.com>";

const BUCKET = "kyc-documents";
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = 45 * 1024 * 1024;
const REQUIRED_SLOTS = ["id_front", "id_back", "selfie"] as const;
const ALL_SLOTS = ["id_front", "id_back", "selfie", "facility"] as const;
type Slot = (typeof ALL_SLOTS)[number];

const ENCLOSURE_TYPES = ["Quarantäne", "Terrarium-Trocken", "Terrarium-Feucht", "Aquaterrarium", "Gifttier-Sicher"];
const ENCLOSURE_STATUSES = ["frei", "belegt", "reinigung", "wartung"];
const MAX_ENCLOSURES = 50;

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

const serviceHeaders = {
  Authorization: `Bearer ${SERVICE_ROLE}`,
  apikey: SERVICE_ROLE,
  "Content-Type": "application/json",
};

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  pdf: "application/pdf",
  webp: "image/webp",
  avif: "image/avif",
};

type Questionnaire = {
  street: string;
  house_number: string;
  zip: string;
  city: string;
  phone: string;
  birth_date: string;
  enclosure: { size: string; lighting: string; climate: string; setup: string };
  /** Enclosure slots from step 3 — seeded into the live capacity grid. */
  enclosures: { id: string; type: string; sizeCm: string; status: string }[];
  current_stock: string;
  feeding: string;
  overwintering: string;
  info_sources: string[];
  sachkunde: "none" | "bna" | "dght" | "other";
  sachkunde_detail: string;
};

type Payload = {
  fullName: string;
  region: string;
  yearsKeeping: number;
  species: string;
  capacity: string;
  quarantine: "yes" | "partial" | "no";
  vetContact: string;
  motivation: string;
  questionnaire: Questionnaire;
  commitments: {
    no_trade: boolean;
    temporary: boolean;
    animal_first: boolean;
    transparency: boolean;
    handover: boolean;
    truthful: boolean;
  };
  selfPledge: boolean;
};

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;
const rateBuckets = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  rateBuckets.set(userId, hits);
  return hits.length > RATE_MAX;
}

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
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const header = JSON.parse(atob(parts[0].replace(/-/g, "+").replace(/_/g, "/")));
    let jwk = (await getJwks())?.find((k) => k.kid === header.kid);
    if (!jwk) {
      jwksCache = null;
      jwk = (await getJwks())?.find((k) => k.kid === header.kid);
    }
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const sig = Uint8Array.from(atob(parts[2].replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      sig,
      new TextEncoder().encode(parts.slice(0, 2).join(".")),
    );
    if (!valid) return null;

    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.iss !== `https://${CLERK_DOMAIN}`) return null;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

function sniffExt(bytes: Uint8Array): string | null {
  const s = (a: number[]) => a.every((b, i) => bytes[i] === b);
  if (s([0xff, 0xd8, 0xff])) return "jpg";
  if (s([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (s([0x47, 0x49, 0x46, 0x38])) return "gif";
  if (s([0x25, 0x50, 0x44, 0x46])) return "pdf";
  if (s([0x52, 0x49, 0x46, 0x46]) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
  if (bytes.length > 12 && String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]) === "ftyp") {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (brand === "avif" || brand === "avis") return "avif";
  }
  return null;
}

function cleanFileName(name: string): string {
  return (name || "document").replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180);
}

function validatePayload(input: unknown): Payload {
  const p = input as Partial<Payload>;
  const text = (value: unknown, key: string, max: number) => {
    if (typeof value !== "string" || !value.trim()) throw new Error(`missing ${key}`);
    const result = value.trim();
    if (result.length > max) throw new Error(`${key} too long`);
    return result;
  };
  const requiredStrings: (keyof Payload)[] = ["fullName", "region", "species", "capacity", "vetContact", "motivation"];
  const maxByKey: Record<string, number> = { fullName: 160, region: 120, species: 500, capacity: 1000, vetContact: 240, motivation: 5000 };
  for (const key of requiredStrings) text(p[key], String(key), maxByKey[String(key)]);
  if (!["yes", "partial", "no"].includes(p.quarantine ?? "")) throw new Error("invalid quarantine");
  if (!Number.isFinite(p.yearsKeeping) || Number(p.yearsKeeping) < 0 || Number(p.yearsKeeping) > 80) throw new Error("invalid yearsKeeping");
  const requiredCommitments: (keyof Payload["commitments"])[] = [
    "no_trade",
    "temporary",
    "animal_first",
    "transparency",
    "handover",
    "truthful",
  ];
  if (
    !p.commitments ||
    requiredCommitments.some((key) => p.commitments?.[key] !== true) ||
    p.selfPledge !== true
  ) {
    throw new Error("commitments required");
  }
  if ((p.motivation ?? "").trim().length < 40) throw new Error("motivation too short");
  // Questionnaire (placement intake § questionnaire): required fields mirror
  // the client schema loosely — string length caps live here so a 3MB payload
  // can't be persisted. Cross-field rule (sachkunde=other ⇒ detail) enforced.
  const q = p.questionnaire as Partial<Questionnaire> | undefined;
  const requiredQ: (keyof Questionnaire)[] = ["street", "house_number", "zip", "city", "phone", "birth_date", "feeding"];
  for (const key of requiredQ) {
    text(q?.[key], `questionnaire.${String(key)}`, key === "feeding" ? 3000 : 240);
  }
  if (!/^\d{5}$/.test(q!.zip.trim())) throw new Error("invalid questionnaire.zip");
  if (ageFrom(q!.birth_date) < 16) throw new Error("invalid questionnaire.birth_date (min 16)");
  const enclosure = q!.enclosure ?? ({} as Questionnaire["enclosure"]);
  const enc = {
    size: text(enclosure.size, "questionnaire.enclosure.size", 500),
    lighting: text(enclosure.lighting, "questionnaire.enclosure.lighting", 500),
    climate: text(enclosure.climate, "questionnaire.enclosure.climate", 500),
    setup: text(enclosure.setup, "questionnaire.enclosure.setup", 2000),
  };
  const sachkunde = (q!.sachkunde ?? "none") as Questionnaire["sachkunde"];
  if (!["none", "bna", "dght", "other"].includes(sachkunde)) throw new Error("invalid questionnaire.sachkunde");
  if (sachkunde === "other" && !(q!.sachkunde_detail ?? "").trim()) throw new Error("missing questionnaire.sachkunde_detail");
  const enclosures = Array.isArray(q!.enclosures)
    ? (q!.enclosures as unknown[]).slice(0, MAX_ENCLOSURES).flatMap((raw) => {
        if (!raw || typeof raw !== "object") return [];
        const e = raw as Record<string, unknown>;
        const id = typeof e.id === "string" ? e.id.trim().slice(0, 12) : "";
        if (!id) return [];
        return [{
          id,
          type: ENCLOSURE_TYPES.includes(String(e.type)) ? String(e.type) : ENCLOSURE_TYPES[1],
          sizeCm: typeof e.sizeCm === "string" ? e.sizeCm.trim().slice(0, 40) : "",
          status: ENCLOSURE_STATUSES.includes(String(e.status)) ? String(e.status) : "frei",
        }];
      })
    : [];
  const questionnaire: Questionnaire = {
    street: q!.street.trim(),
    house_number: q!.house_number.trim(),
    zip: q!.zip.trim(),
    city: q!.city.trim(),
    phone: (q!.phone ?? "").trim(),
    birth_date: q!.birth_date,
    enclosure: enc,
    enclosures,
    current_stock: text(q!.current_stock ?? "", "questionnaire.current_stock", 3000),
    feeding: text(q!.feeding, "questionnaire.feeding", 3000),
    overwintering: text(q!.overwintering ?? "", "questionnaire.overwintering", 2000),
    info_sources: Array.isArray(q!.info_sources) ? q!.info_sources.map((s) => text(String(s), "questionnaire.info_sources", 240)).filter(Boolean).slice(0, 12) : [],
    sachkunde,
    sachkunde_detail: (q!.sachkunde_detail ?? "").trim(),
  };
  if (questionnaire.info_sources.length === 0) throw new Error("missing questionnaire.info_sources");
  return {
    fullName: p.fullName!.trim(),
    region: p.region!.trim(),
    yearsKeeping: Number(p.yearsKeeping),
    species: p.species!.trim(),
    capacity: p.capacity!.trim(),
    quarantine: p.quarantine as Payload["quarantine"],
    vetContact: p.vetContact!.trim(),
    motivation: p.motivation!.trim(),
    questionnaire,
    commitments: p.commitments!,
    selfPledge: true,
  };
}

function ageFrom(iso: string): number {
  const dob = new Date(iso);
  if (Number.isNaN(dob.getTime())) return -1;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  if (now.getUTCMonth() < dob.getUTCMonth() || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

async function rest(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: { ...serviceHeaders, ...(init?.headers ?? {}) },
  });
}

// The confirmation email and the stored application row use the verified
// Clerk identity, never the client-submitted form field.
async function clerkEmail(userId: string): Promise<string> {
  if (!CLERK_SECRET_KEY) throw new Error("server misconfigured: CLERK_SECRET_KEY missing");
  const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    headers: { authorization: `Bearer ${CLERK_SECRET_KEY}` },
  });
  if (!res.ok) throw new Error(`clerk user lookup failed: ${res.status}`);
  const user = (await res.json()) as {
    primary_email_address_id?: string | null;
    email_addresses?: { id: string; email_address: string }[];
  };
  const email = user.email_addresses?.find((entry) => entry.id === user.primary_email_address_id)?.email_address
    ?? user.email_addresses?.[0]?.email_address;
  if (!email) throw new Error("no verified email address on account");
  return email;
}

async function existingActiveApplication(userId: string): Promise<boolean> {
  const res = await rest(
    `/rest/v1/sentinel_applications?user_id=eq.${encodeURIComponent(userId)}&status=neq.rejected&select=id&limit=1`,
  );
  if (!res.ok) throw new Error(`application lookup failed: ${res.status}`);
  const rows = (await res.json()) as { id: string }[];
  return rows.length > 0;
}

async function createApplication(userId: string, email: string, p: Payload): Promise<{ id: string; case_id: string }> {
  // ponytail: case_id is 8 hex chars (32 bits) — a duplicate key is rare but
  // not impossible; retry with a fresh id instead of surfacing a 502.
  for (let attempt = 0; attempt < 3; attempt++) {
    const caseId = `ST-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const res = await rest("/rest/v1/sentinel_applications?select=id,case_id", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: userId,
        case_id: caseId,
        full_name: p.fullName,
        email,
        region: p.region,
        experience_years: p.yearsKeeping,
        species_focus: p.species,
        capacity: p.capacity,
        motivation: p.motivation,
        preferred_language: "de",
        status: "pending",
        kyc_status: "documents_uploaded",
        pledge_data: {
          quarantine: p.quarantine,
          vet_contact: p.vetContact,
          questionnaire: p.questionnaire,
          commitments: p.commitments,
          self_pledge: p.selfPledge,
          signed_at: new Date().toISOString(),
        },
      }),
    });
    if (res.ok) {
      const rows = (await res.json()) as { id: string; case_id: string }[];
      if (!rows[0]) throw new Error("application insert returned no row");
      return rows[0];
    }
    // 409 = unique violation (case_id collision or one-active-per-user race).
    if (res.status === 409 && attempt < 2) continue;
    throw new Error(`application insert failed: ${res.status}`);
  }
  throw new Error("application insert failed: 409");
}

async function uploadDocument(userId: string, applicationId: string, slot: Slot, file: File): Promise<{ path: string; fileName: string; mime: string; size: number }> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.length === 0) throw new Error(`${slot}: empty file`);
  if (buf.length > MAX_BYTES) throw new Error(`${slot}: file too large`);
  const ext = sniffExt(buf);
  if (!ext) throw new Error(`${slot}: unsupported file type`);

  const path = `${userId}/${applicationId}/${slot}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
      "Content-Type": EXT_MIME[ext],
      "x-upsert": "false",
    },
    body: buf,
  });
  if (!res.ok) throw new Error(`${slot}: storage write failed (${res.status})`);
  return { path, fileName: cleanFileName(file.name), mime: EXT_MIME[ext], size: buf.length };
}

async function insertDocumentRows(applicationId: string, userId: string, docs: { slot: Slot; path: string; fileName: string; mime: string; size: number }[]) {
  const res = await rest("/rest/v1/application_documents", {
    method: "POST",
    body: JSON.stringify(docs.map((d) => ({
      application_id: applicationId,
      user_id: userId,
      doc_type: d.slot,
      storage_path: d.path,
      file_name: d.fileName,
      mime_type: d.mime,
      size_bytes: d.size,
    }))),
  });
  if (!res.ok) throw new Error(`document metadata insert failed: ${res.status}`);
}

async function deleteStorageObject(path: string) {
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "DELETE",
    headers: serviceHeaders,
  });
}

async function cleanup(applicationId: string | null, uploadedPaths: string[]) {
  await Promise.all(uploadedPaths.map((p) => deleteStorageObject(p).catch(() => undefined)));
  if (applicationId) {
    await rest(`/rest/v1/sentinel_applications?id=eq.${applicationId}`, { method: "DELETE" }).catch(() => undefined);
  }
}

async function sendConfirmation(email: string, fullName: string, caseId: string) {
  const subject = `Bewerbung eingegangen · ${caseId}`;
  const text = `Hallo ${fullName},\n\nDeine Sentinel-Bewerbung (${caseId}) ist eingegangen. Wir melden uns innerhalb von 5 Werktagen.\n\n- BioSteward Custody Network`;
  if (!BREVO_API_KEY) {
    const at = email.indexOf("@");
    console.log("[email] no BREVO_API_KEY, logged only", { to: at > 1 ? `${email[0]}***@${email.slice(at + 1)}` : "***", caseId });
    return;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      sender: SENDER,
      to: [{ email, name: fullName }],
      subject,
      textContent: text,
    }),
  });
  if (!res.ok) {
    console.error("[email] brevo failed", res.status, await res.text());
    throw new Error("email failed");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const userId = token ? await verifyClerkToken(token) : null;
  if (!userId || !SUPABASE_URL || !SERVICE_ROLE) {
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

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return new Response(JSON.stringify({ error: "request too large" }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let applicationId: string | null = null;
  const uploadedPaths: string[] = [];

  try {
    const form = await req.formData();
    const payloadRaw = form.get("payload");
    if (typeof payloadRaw !== "string") throw new Error("missing payload");
    const payload = validatePayload(JSON.parse(payloadRaw));
    const email = await clerkEmail(userId);

    for (const slot of REQUIRED_SLOTS) {
      if (!(form.get(slot) instanceof File)) throw new Error(`missing ${slot}`);
    }
    if (await existingActiveApplication(userId)) {
      return new Response(JSON.stringify({ error: "application already exists" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const app = await createApplication(userId, email, payload);
    applicationId = app.id;

    const docs: { slot: Slot; path: string; fileName: string; mime: string; size: number }[] = [];
    for (const slot of ALL_SLOTS) {
      const maybeFile = form.get(slot);
      if (!(maybeFile instanceof File)) continue;
      const uploaded = await uploadDocument(userId, app.id, slot, maybeFile);
      uploadedPaths.push(uploaded.path);
      docs.push({ slot, ...uploaded });
    }
    await insertDocumentRows(app.id, userId, docs);
    await sendConfirmation(email, payload.fullName, app.case_id);

    return new Response(JSON.stringify({ ok: true, id: app.id, caseId: app.case_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    await cleanup(applicationId, uploadedPaths);
    const message = e instanceof Error ? e.message : "submission failed";
    console.error("[submit-sentinel-application]", message);
    const status = message.includes("409")
      ? 409
      : message.includes("missing") || message.includes("invalid") || message.includes("required")
        ? 400
        : 502;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
