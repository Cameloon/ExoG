import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
const client = createClient<Database>("https://ux-fixture.supabase.co", "test-only-key", {
  auth: { persistSession: false, autoRefreshToken: false },
});
export const useExternalSupabase = () => client;
export const anonSupabase = client;
