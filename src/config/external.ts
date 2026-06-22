/**
 * External infrastructure config — fill these in after creating your
 * Supabase project and Clerk application.
 *
 * See SETUP.md in the project root for step-by-step instructions.
 *
 * SAFETY: Only the publishable / anon keys go here. They are designed
 * to be public. NEVER paste the Clerk Secret Key or the Supabase
 * Service Role Key into this file.
 */

export const EXTERNAL_CONFIG = {
  // Supabase project (Settings → API)
  SUPABASE_URL: "https://tckckikvmnuvjgsctvkr.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_es2M4yzpEBzj5rETBCnQYw_tps2kiNm",

  // Clerk application (API Keys → Publishable key)
  CLERK_PUBLISHABLE_KEY: "pk_test_aWRlYWwtdGV0cmEtMjYuY2xlcmsuYWNjb3VudHMuZGV2JA",

  // Name of the JWT template you create inside Clerk for Supabase.
  // Default Clerk template name for Supabase integration is "supabase".
  CLERK_SUPABASE_JWT_TEMPLATE: "supabase",
} as const;

export const isConfigured = () =>
  !EXTERNAL_CONFIG.SUPABASE_URL.includes("YOUR-PROJECT-REF") &&
  !EXTERNAL_CONFIG.SUPABASE_ANON_KEY.includes("YOUR_") &&
  !EXTERNAL_CONFIG.CLERK_PUBLISHABLE_KEY.includes("YOUR_");
