#!/usr/bin/env node
/**
 * Seeds example animals + live pipeline data for ONE user, so the whole
 * sentinel pipeline can be walked through in the UI with a single account:
 *
 *   an approved S4 sentinel application (→ dashboard, wards, expert queue)
 *   3 example wards (placed / under_review / available)
 *   a valid care-log hash chain (mirrors append_care_log, 00022)
 *   duties for the placed ward
 *   one open identification request (→ Bestimmungshilfe voting)
 *
 * Usage:
 *   SUPABASE_SECRET_KEY="sb_secret_…" node scripts/seed-example-wards.mjs \
 *     --user user_2abc… --name "Dr. Demo" --email demo@example.de --region BY
 *
 *   --dry-run   print the plan (incl. computed hashes) and self-check, no writes
 *
 * Idempotent-ish: wards upsert by case_code; care logs + duties are deleted
 * and re-created for the DEMO wards only (re-running wipes care logs you added
 * to EX-DEMO-* wards yourself). Secret key server-side only — never commit.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://tckckikvmnuvjgsctvkr.supabase.co";
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const USER = flag("user");
const NAME = flag("name") ?? "Demo Sentinel";
const EMAIL = flag("email") ?? "demo@exoguard.local";
const REGION = flag("region") ?? "BY";
const DRY = args.includes("--dry-run");

if (!DRY && (!USER || /^user_/.test(USER) === false)) {
  console.error("Missing/invalid --user (Clerk user id, e.g. user_2abc…).\nSee file header for usage.");
  process.exit(1);
}
if (!DRY && !SECRET_KEY) {
  console.error("Missing SUPABASE_SECRET_KEY (Supabase → Settings → API Keys). Server-side only.");
  process.exit(1);
}
if (!DRY) selfCheck();

const client = () => createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false } });
const rest = (table) => client().from(table);

// ── 1) Approved S4 application for the user (dashboard + wards + expert queue)
async function ensureApplication() {
  const { data: existing } = await rest("sentinel_applications")
    .select("id,status,tier")
    .eq("user_id", USER)
    .neq("status", "rejected")
    .limit(1);
  const target = { status: "approved", tier: "S4", kyc_status: "verified" };
  if (existing?.length) {
    const { error } = await rest("sentinel_applications").update(target).eq("id", existing[0].id);
    if (error) throw new Error(`application update failed: ${error.message}`);
    return `updated ${existing[0].id} → approved/S4`;
  }
  const { error } = await rest("sentinel_applications").insert({
    user_id: USER,
    case_id: `ST-${randomUUID().slice(0, 8).toUpperCase()}`,
    full_name: NAME,
    email: EMAIL,
    region: REGION,
    experience_years: 5,
    species_focus: "Reptilien",
    capacity: "3 Quarantäneplätze",
    motivation: "Demo-Bewerbung für Pipeline-Test (seed).",
    ...target,
  });
  if (error) throw new Error(`application insert failed: ${error.message}`);
  return "created approved/S4 application";
}

// ── 2) Example wards (case_code is unique → upsert)
const WARDS = [
  {
    case_code: "EX-DEMO-001",
    common_name: "Abgottschlange",
    scientific_name: "Boa constrictor",
    sex: "weiblich",
    age_estimate: "ca. 4 Jahre",
    size_estimate: "160 cm",
    origin_context: "Zollfunde München, unzureichende Haltung",
    background: "Sicherstellung ausprivater Haltung, Unterbringung in Quarantäne seit 14 Tagen.",
    care_requirements: "Temperaturgradient 26–31 °C, Luftfeuchte 60–70 %, Versteckplätze, Wasserschale.",
    space_requirements: "Terrarium mind. 200×80×100 cm.",
    cites_listing: "B",
    status: "placed",
    placement_type: "endstelle",
    legal_custody: true,
    quarantine_status: "quarantine_safe",
  },
  {
    case_code: "EX-DEMO-002",
    common_name: "Griechische Landschildkröte",
    scientific_name: "Testudo hermanni",
    sex: "unbekannt",
    age_estimate: "adult",
    size_estimate: "18 cm",
    origin_context: "Zivile Übergabe, Besitzer im Ausland",
    background: "Anhang-A-Art: CITES-Nachweis wird geprüft, Übergabe an Auffangstation vorbereitet.",
    care_requirements: "Außengehege mit Sonnenplatz, Winterruhe-Vorbereitung, Grünfutter.",
    space_requirements: "Gehege mind. 10 m² pro Tier.",
    cites_listing: "A",
    status: "under_review",
    placement_type: "pflegestelle",
    legal_custody: true,
    quarantine_status: "in_quarantine",
    quarantine_until: new Date(Date.now() + 3 * 864e5).toISOString(),
  },
  {
    case_code: "EX-DEMO-003",
    common_name: "Königspython",
    scientific_name: "Python regius",
    sex: "männlich",
    age_estimate: "juvenile",
    size_estimate: "80 cm",
    origin_context: "Zivile Übergabe, Halter überfordert",
    background: "Vermittlungsfähig nach Quarantäne; Futterannahme stabil.",
    care_requirements: "Temperaturgradient 24–30 °C, Versteck auf beiden Seiten, Futterintervall 7 Tage.",
    space_requirements: "Terrarium mind. 120×60×60 cm.",
    cites_listing: "B",
    status: "available",
    placement_type: "pflegestelle",
    legal_custody: false,
    quarantine_status: "quarantine_safe",
  },
];

async function upsertWards() {
  const rows = WARDS.map((w) => ({
    owner_id: USER,
    region: REGION,
    urgency: "standard",
    ...w,
  }));
  const { error } = await rest("ward_listings").upsert(rows, { onConflict: "case_code" });
  if (error) throw new Error(`ward upsert failed: ${error.message}`);
  const { data, error: selErr } = await rest("ward_listings")
    .select("id,case_code")
    .in("case_code", WARDS.map((w) => w.case_code));
  if (selErr || !data?.length) throw new Error(`ward select failed: ${selErr?.message}`);
  return Object.fromEntries(data.map((r) => [r.case_code, r.id]));
}

// ── 3) Care-log chain — hash mirrors append_care_log (00022):
//      'H-' + upper(substr(sha256hex(concat_ws('|', ward_id, type, note,
//               rationale, author_name, created_at, coalesce(prev_hash,''))),1,32))
// ponytail: Node hash of the same concatenation; the ::text timestamptz
// serialization differs (microseconds+TZ suffix) — the chain stays internally
// consistent, nothing client-side recomputes it. Verified in selfCheck().
const hashOf = (wardId, type, note, rationale, authorName, createdAt, prevHash) =>
  "H-" + createHash("sha256")
    .update(`${wardId}|${type}|${note}|${rationale}|${authorName}|${createdAt}|${prevHash ?? ""}`)
    .digest("hex")
    .slice(0, 32)
    .toUpperCase();

// Notes are written to PASS validateRationale (src/lib/care-log-validation.ts)
// so the behördliche PDF export shows "KONFORM" for every entry.
const LOGS = [
  { type: "Beobachtung", note: "Ruhig, versteckt sich unter Korkröhre; Verhalten unverändert gegenüber Vortag, Häutung vollständig, Haut ohne Reste.", rationale: "Zustand + Vergleich zur Baseline dokumentiert.", metrics: { behavior: "ruhig" }, at: -4 * 864e5 },
  { type: "Fütterung", note: "Eine aufgetaute Maus (25 g) angeboten, komplett gefressen; letztes Futter vor 7 Tagen, Intervall damit eingehalten.", rationale: "Futterart, Annahme und Intervall dokumentiert.", metrics: { feedItem: "Maus 25 g (aufgetaut)", feedAmountG: 25 }, at: -3 * 864e5 },
  { type: "Klima", note: "Temperaturgradient 26–31 °C gemessen, Luftfeuchte 68 %; Thermostat nachjustiert, Spotlampe um 2 cm höher gesetzt.", rationale: "Messwerte und Korrekturmaßnahme dokumentiert.", metrics: { tempC: 31, humidity: 68 }, at: -2 * 864e5 },
  { type: "Medizin", note: "Ivermectin 0,2 mg/kg oral gegen Nachweis von Milben (Indikation: Parasitose), Anordnung Dr. Wendler (Tierarzt) lt. Rezept.", rationale: "Wirkstoff/Dosis, Indikation und tierärztliche Anordnung dokumentiert.", metrics: {}, at: -1 * 864e5 },
];

async function seedCareLogs(ids) {
  const wardId = ids["EX-DEMO-001"];
  const { error: delErr } = await rest("care_logs").delete().eq("ward_id", wardId);
  if (delErr) throw new Error(`care_logs delete failed: ${delErr.message}`);
  let prev = null;
  const rows = LOGS.map((l) => {
    const createdAt = new Date(Date.now() + l.at).toISOString();
    const hash = hashOf(wardId, l.type, l.note, l.rationale, NAME, createdAt, prev);
    const row = {
      ward_id: wardId,
      author_id: USER,
      author_name: NAME,
      type: l.type,
      note: l.note,
      rationale: l.rationale,
      metrics: l.metrics,
      prev_hash: prev,
      hash,
      created_at: createdAt,
    };
    prev = hash;
    return row;
  });
  const { error } = await rest("care_logs").insert(rows);
  if (error) throw new Error(`care_logs insert failed: ${error.message}`);
  return rows.length;
}

// ── 4) Duties for the placed ward
async function seedDuties() {
  const { error: delErr } = await rest("duties").delete().eq("owner_id", USER).like("case_code", "EX-DEMO-%");
  if (delErr) throw new Error(`duties delete failed: ${delErr.message}`);
  const { error } = await rest("duties").insert([
    { owner_id: USER, case_code: "EX-DEMO-001", title: "Klimaprotokoll erfassen (Temperatur/Luftfeuchte)", category: "Klima", priority: "normal", due_at: new Date(Date.now() + 864e5).toISOString(), done: false },
    { owner_id: USER, case_code: "EX-DEMO-001", title: "Behörden-Export an Veterinäramt übermitteln", category: "Behörde", priority: "kritisch", due_at: new Date(Date.now() + 2 * 864e5).toISOString(), done: false },
    { owner_id: USER, case_code: "EX-DEMO-002", title: "CITES-Nachweis Anhang A prüfen", category: "Übergabe", priority: "hoch", due_at: new Date(Date.now() + 3 * 864e5).toISOString(), done: false },
  ]);
  if (error) throw new Error(`duties insert failed: ${error.message}`);
  return 3;
}

// ── 5) One open identification request → Bestimmungshilfe (S4 can vote)
async function seedIdentification() {
  const { data: open } = await rest("identification_requests")
    .select("id")
    .eq("common_name", "Unbekannte Schlange (Zollfunde)")
    .eq("status", "open")
    .limit(1);
  if (open?.length) return "already open";
  const { error } = await rest("identification_requests").insert({
    created_by: USER,
    region: REGION,
    common_name: "Unbekannte Schlange (Zollfunde)",
    description: "Sichergestellt am Flughafen; 120 cm, olivgrün, loreale Gruben vorhanden. Art bislang unbestätigt.",
    photos: [],
    status: "open",
  });
  if (error) throw new Error(`identification_requests insert failed: ${error.message}`);
  return "created open request";
}

function selfCheck() {
  const abc = createHash("sha256").update("abc").digest("hex");
  if (!abc.startsWith("ba7816bf8f01cfea414140de5dae2223")) throw new Error("sha256 self-check failed");
  const h = hashOf("id", "Klima", "n", "r", "a", "2026-10-12T10:00:00.000Z", "H-0");
  if (!/^H-[0-9A-F]{32}$/.test(h)) throw new Error(`hash format check failed: ${h}`);
  if (LOGS.some((l) => !l.note || !l.rationale)) throw new Error("demo log content incomplete");
  console.log("self-check ok (sha256 vector, hash format, log set)");
}

function plan() {
  console.log(`plan for ${USER} (${NAME}, ${REGION}):`);
  console.log("  1. upsert approved S4 sentinel application");
  console.log(`  2. upsert wards: ${WARDS.map((w) => `${w.case_code} ${w.common_name} [${w.status}]`).join(" · ")}`);
  const now = Date.now();
  let prev = null;
  for (const l of LOGS) {
    const at = new Date(now + l.at).toISOString();
    prev = hashOf("ward-id", l.type, l.note, l.rationale, NAME, at, prev);
    console.log(`     ${l.type.padEnd(12)} ${at}  hash ${prev}`);
  }
  console.log("  3. duties ×3, identification request ×1 (open)");
}

if (DRY) {
  selfCheck();
  plan();
  process.exit(0);
}

const run = async () => {
  const out = [];
  out.push(await ensureApplication());
  const ids = await upsertWards();
  out.push(`wards ${Object.keys(ids).join(", ")}`);
  out.push(`care logs ×${await seedCareLogs(ids)} (chain re-hashed)`);
  out.push(`duties ×${await seedDuties()}`);
  out.push(`identification: ${await seedIdentification()}`);
  console.log(out.map((l, i) => `${i + 1}. ${l}`).join("\n"));
  console.log("\nNext: sign in as that user → /dashboard (live view), /wards, Bestimmungshilfe tab (S4).");
  console.log("Not seeded: shelter/einrichtung flow (needs a second account + admin approval).");
};

run().catch((e) => {
  console.error("seed failed:", e.message);
  process.exit(1);
});
