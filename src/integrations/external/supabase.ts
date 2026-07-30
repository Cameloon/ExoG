/**
 * Supabase client wired to Clerk authentication.
 *
 * Singleton client — created once, reused everywhere. The Clerk JWT
 * is injected via a module-level token getter set by the hook on mount,
 * avoiding duplicate GoTrueClient instances (one per component).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { EXTERNAL_CONFIG } from "@/config/external";
import type { Database } from "@/integrations/supabase/types";

// ponytail: single client instance, avoids "Multiple GoTrueClient instances" warning
let supabaseClient: SupabaseClient<Database> | null = null;
let getClerkToken: (() => Promise<string | null>) | null = null;

function getClient(): SupabaseClient<Database> {
  if (supabaseClient) return supabaseClient;
  supabaseClient = createClient<Database>(
    EXTERNAL_CONFIG.SUPABASE_URL,
    EXTERNAL_CONFIG.SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: async (input, init) => {
          const token = getClerkToken ? await getClerkToken() : null;
          const headers = new Headers(init?.headers);
          if (token) headers.set("Authorization", `Bearer ${token}`);
          return fetch(input, { ...init, headers });
        },
      },
    },
  );
  return supabaseClient;
}

// Anonymous client — only safe for public reads or when no user is signed in.
const anon = createClient<Database>(
  EXTERNAL_CONFIG.SUPABASE_URL,
  EXTERNAL_CONFIG.SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export const anonSupabase = anon;

/**
 * React hook returning the singleton Supabase client.
 */
export const useExternalSupabase = (): SupabaseClient<Database> => {
  const { getToken } = useClerkAuth();
  getClerkToken = async () => {
    const t = await getToken({ template: EXTERNAL_CONFIG.CLERK_SUPABASE_JWT_TEMPLATE });
    return t ?? null;
  };
  return getClient();
};
