import { useEffect, useState } from "react";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { useAuth } from "@/hooks/useAuth";

export type SentinelAppStatus = "pending" | "under_review" | "approved" | "rejected" | null;

/**
 * Returns the current user's sentinel application status, or null if none.
 * Used to gate re-application and to flag "in bearbeitung" in the UI.
 */
export function useSentinelApplication() {
  const { user, loading } = useAuth();
  const supabase = useExternalSupabase();
  const [status, setStatus] = useState<SentinelAppStatus>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) {
      setChecking(false);
      return;
    }
    let active = true;
    (async () => {
      // ponytail: a transient network error must not read as "no application"
      // — that would let the user re-apply and hit a server 409.
      const { data, error: err } = await supabase
        .from("sentinel_applications")
        .select("status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (err) {
        setError(err.message);
      } else {
        setStatus((data as { status: SentinelAppStatus } | null)?.status ?? null);
      }
      setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, [user, loading, supabase]);

  return { status, checking, error, hasApplication: status !== null, isApproved: status === "approved" };
}
