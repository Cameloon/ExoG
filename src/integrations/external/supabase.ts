/**
 * Supabase client wired to Clerk authentication.
 *
 * Every request fetches a fresh Clerk JWT (issued via the "supabase"
 * JWT template) and passes it to Supabase. RLS policies in the
 * external Supabase project read the JWT's `sub` claim (the Clerk
 * user id, e.g. "user_2abc...") to scope rows.
 *
 * Usage in components:
 *   import { useExternalSupabase } from "@/integrations/external/supabase";
 *   const supabase = useExternalSupabase();
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useMemo } from "react";
import { EXTERNAL_CONFIG } from "@/config/external";
import type { Database } from "@/integrations/supabase/types";

// Anonymous client — only safe for public reads or when no user is signed in.
export const anonSupabase: SupabaseClient<Database> = createClient<Database>(
  EXTERNAL_CONFIG.SUPABASE_URL,
  EXTERNAL_CONFIG.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

/**
 * React hook returning a Supabase client that injects the current
 * Clerk JWT on every request.
 */
export const useExternalSupabase = (): SupabaseClient<Database> => {
  const { getToken } = useClerkAuth();

  return useMemo(() => {
    return createClient<Database>(
      EXTERNAL_CONFIG.SUPABASE_URL,
      EXTERNAL_CONFIG.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          fetch: async (input, init) => {
            const token = await getToken({
              template: EXTERNAL_CONFIG.CLERK_SUPABASE_JWT_TEMPLATE,
            });
            const headers = new Headers(init?.headers);
            if (token) headers.set("Authorization", `Bearer ${token}`);
            return fetch(input, { ...init, headers });
          },
        },
      },
    );
  }, [getToken]);
};
