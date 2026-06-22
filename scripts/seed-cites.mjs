#!/usr/bin/env node
/**
 * Seed the cites_species table from the cleaned CITES JSON.
 *
 * Usage:
 *   SUPABASE_SECRET_KEY="your-key" node scripts/seed-cites.mjs
 *
 * The Supabase URL defaults to the one in src/config/external.ts.
 * Override with SUPABASE_URL env var if needed.
 *
 * Why a secret key?
 *   The table has RLS enabled (public select, admin-only write).
 *   A secret key bypasses RLS, which is correct for a one-time seed.
 *   NEVER expose this key to the client — it's for scripts only.
 *
 * Keys (new system, replaces legacy anon/service_role):
 *   Publishable key (sb_publishable_...)  → client-side, low privileges
 *   Secret key      (sb_secret_...)       → server-side, elevated privileges
 *
 * Legacy fallback: SUPABASE_SERVICE_ROLE_KEY still works if set.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://tckckikvmnuvjgsctvkr.supabase.co";
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SECRET_KEY) {
  console.error(
    "Missing SUPABASE_SECRET_KEY.\n" +
    "Usage: SUPABASE_SECRET_KEY=\"your-key\" node scripts/seed-cites.mjs\n" +
    "Get your secret key: Supabase Dashboard → Project Settings → API Keys"
  );
  process.exit(1);
}

const DATA_PATH = resolve(__dirname, "data", "cites_species_cleaned.json");
const BATCH_SIZE = 500;

async function main() {
  console.log("Reading cleaned CITES data ...");
  const raw = readFileSync(DATA_PATH, "utf-8");
  const entries = JSON.parse(raw);
  console.log(`  ${entries.length} entries loaded`);

  const supabase = createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { persistSession: false },
  });

  // Check connectivity
  const { error: pingErr } = await supabase.from("cites_species").select("id").limit(1);
  if (pingErr) {
    console.error("  Connection failed:", pingErr.message);
    console.error("  Make sure SUPABASE_SECRET_KEY is correct and you can reach", SUPABASE_URL);
    process.exit(1);
  }
  console.log("  Connected to Supabase");

  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("cites_species").upsert(
      batch.map((e) => ({
        id: e.id,
        full_name: e.full_name,
        rank: e.rank,
        class_name: e.class_name,
        order_name: e.order_name,
        family_name: e.family_name,
        genus_name: e.genus_name,
        species_name: e.species_name,
        cites_accepted: e.cites_accepted,
        english_names: e.english_names,
        current_listing: e.current_listing,
        listing_changes: e.listing_changes,
      })),
      { onConflict: "id", ignoreDuplicates: false }
    );

    if (error) {
      console.error(`  Batch ${i / BATCH_SIZE + 1} failed:`, error.message);
      errors++;
    } else {
      inserted += batch.length;
    }

    const pct = ((i + batch.length) / entries.length * 100).toFixed(1);
    process.stdout.write(`\r  Progress: ${inserted}/${entries.length} (${pct}%)`);
  }

  console.log("\n");
  if (errors > 0) {
    console.warn(`  Done with ${errors} failed batches`);
  }
  console.log(`  Successfully seeded ${inserted} CITES species`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
