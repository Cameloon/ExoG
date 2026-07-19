/**
 * External infrastructure config — fill these in after creating your
 * Supabase project and Clerk application.
 *
 * Prefer VITE_ env vars (see .env / .env.example). Fallback values below
 * are the publishable / anon keys, which are designed to be public.
 * NEVER paste the Clerk Secret Key or the Supabase Service Role Key here.
 */

const env = import.meta.env;

const FALLBACK = {
  SUPABASE_URL: "https://tckckikvmnuvjgsctvkr.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_es2M4yzpEBzj5rETBCnQYw_tps2kiNm",
  CLERK_PUBLISHABLE_KEY: "pk_test_aWRlYWwtdGV0cmEtMjYuY2xlcmsuYWNjb3VudHMuZGV2JA",
  CLERK_SUPABASE_JWT_TEMPLATE: "supabase",
};

export const EXTERNAL_CONFIG = {
  // Supabase project (Settings → API)
  SUPABASE_URL: env.VITE_SUPABASE_URL ?? FALLBACK.SUPABASE_URL,
  SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY ?? FALLBACK.SUPABASE_ANON_KEY,

  // Clerk application (API Keys → Publishable key)
  CLERK_PUBLISHABLE_KEY:
    env.VITE_CLERK_PUBLISHABLE_KEY ?? FALLBACK.CLERK_PUBLISHABLE_KEY,

  // Name of the JWT template you create inside Clerk for Supabase.
  // Default Clerk template name for Supabase integration is "supabase".
  CLERK_SUPABASE_JWT_TEMPLATE:
    env.VITE_CLERK_SUPABASE_JWT_TEMPLATE ?? FALLBACK.CLERK_SUPABASE_JWT_TEMPLATE,
} as const;

export const isConfigured = () =>
  !EXTERNAL_CONFIG.SUPABASE_URL.includes("YOUR-PROJECT-REF") &&
  !EXTERNAL_CONFIG.SUPABASE_ANON_KEY.includes("YOUR_") &&
  !EXTERNAL_CONFIG.CLERK_PUBLISHABLE_KEY.includes("YOUR_") &&
  !EXTERNAL_CONFIG.SUPABASE_ANON_KEY.includes("REPLACE_WITH") &&
  !EXTERNAL_CONFIG.CLERK_PUBLISHABLE_KEY.includes("REPLACE_WITH");
