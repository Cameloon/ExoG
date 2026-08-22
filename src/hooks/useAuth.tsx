/**
 * Clerk-backed auth hook. Drop-in replacement for the previous
 * Lovable Cloud / Supabase Auth hook. Exposes the same shape so
 * existing components do not need to change much:
 *
 *   { user, isAdmin, loading, signOut }
 *
 * - `user.id`     → Clerk user id (string, e.g. "user_2abc...")
 * - `user.email`  → primary email
 *
 * Admin role is determined by reading the `public_metadata.role`
 * field on the Clerk user (set it to "admin" in the Clerk dashboard).
 */
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useUser, useClerk, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useExternalSupabase } from "@/integrations/external/supabase";

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
}

export type AppRole = "admin" | "behoerde" | "einrichtung" | "sentinel" | "user";

interface AuthContextValue {
  user: AuthUser | null;
  isAdmin: boolean;
  isBehoerde: boolean;
  isEinrichtung: boolean;
  isSentinel: boolean;
  /** Top-tier sentinel (S4) — may vote in the Bestimmungshilfe queue. */
  isExpert: boolean;
  /** The user's responsible region/area (Behörde scope, shelter region). */
  region: string | null;
  /** Coarse role used for routing/guards. */
  role: AppRole;
  loading: boolean;
  signOut: () => Promise<void>;
}

  const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAdmin: false,
  isBehoerde: false,
  isEinrichtung: false,
  isSentinel: false,
  isExpert: false,
  region: null,
  role: "user",
  loading: false,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { isLoaded: userLoaded, user: clerkUser } = useUser();
  const { isLoaded: authLoaded } = useClerkAuth();
  const clerk = useClerk();
  const supabase = useExternalSupabase();

  useEffect(() => {
    if (!userLoaded || !authLoaded || !clerkUser) return;

    const syncProfile = async () => {
      try {
        const { data: existing, error: selectErr } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", clerkUser.id)
          .maybeSingle();

        if (selectErr) {
          console.warn("Profile sync: select failed", selectErr);
          return;
        }

        if (!existing) {
          const { error: insertErr } = await supabase.from("profiles").insert({
            id: clerkUser.id,
            email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
            display_name:
              clerkUser.fullName ??
              clerkUser.username ??
              clerkUser.primaryEmailAddress?.emailAddress ??
              null,
            preferred_language: "de",
          });
          if (insertErr) console.warn("Profile sync: insert failed", insertErr);
        }

        // Admin role for DB RLS (has_role) is bootstrapped manually in Supabase
        // (see migration notes) and read from Clerk publicMetadata for the app.
        // We intentionally do NOT write user_roles from the client: that would
        // require granting authenticated write on a privilege table.
      } catch (err) {
        console.warn("Profile sync: unexpected error", err);
      }
    };

    syncProfile();
  }, [userLoaded, authLoaded, clerkUser, supabase]);

  // Fallback region from profiles table when admins assign region there instead of Clerk metadata.
  const [profileRegion, setProfileRegion] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoaded || !clerkUser) { setProfileRegion(null); return; }
    supabase.from("profiles").select("region").eq("id", clerkUser.id).maybeSingle()
      .then(({ data }) => setProfileRegion((data as { region: string } | null)?.region ?? null));
  }, [userLoaded, clerkUser, supabase]);

  // A shelter user may be granted access via an admin-approved
  // pending_shelter_requests row (no manual Clerk role step required).
  // ponytail: .maybeSingle() previously errored on duplicate rows (the table
  // had no unique constraint → client upserts created dupes) and on a stale
  // token right after refresh, silently dropping approvedShelter to false →
  // the Wards gate kicked the user out ("Sentinel-Pfad") after reload.
  // Now: order+limit, and retry transient failures instead of failing once.
  const [approvedShelter, setApprovedShelter] = useState(false);
  useEffect(() => {
    if (!userLoaded || !clerkUser) { setApprovedShelter(false); return; }
    let cancelled = false;
    void (async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data, error } = await supabase
          .from("pending_shelter_requests")
          .select("status")
          .eq("user_id", clerkUser.id)
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(1);
        if (!error) {
          if (!cancelled) setApprovedShelter(Boolean(data));
          return;
        }
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    })();
    return () => { cancelled = true; };
  }, [userLoaded, clerkUser, supabase]);
  const [sentinelApproved, setSentinelApproved] = useState(false);
  const [sentinelTier, setSentinelTier] = useState<string | null>(null);
  useEffect(() => {
    if (!userLoaded || !clerkUser) {
      setApprovedShelter(false);
      setSentinelApproved(false);
      setSentinelTier(null);
      return;
    }
    const meta = clerkUser.publicMetadata as { role?: string } | null;
    let cancelled = false;
    void (async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data, error } = await supabase
          .from("sentinel_applications")
          .select("status, tier")
          .eq("user_id", clerkUser.id)
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(1);
        if (!error) {
          if (!cancelled) {
            const approved = Boolean(data) || meta?.role === "sentinel";
            setSentinelApproved(approved);
            setSentinelTier((data as { tier?: string | null }[] | null)?.[0]?.tier ?? null);
          }
          return;
        }
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    })();
    return () => { cancelled = true; };
  }, [userLoaded, clerkUser, supabase]);

  const value = useMemo<AuthContextValue>(() => {
    const loading = !userLoaded || !authLoaded;
    if (loading || !clerkUser) {
      return {
        user: null,
        isAdmin: false,
        isBehoerde: false,
        isEinrichtung: approvedShelter,
        isSentinel: false,
        isExpert: false,
        region: null,
        role: "user",
        loading,
        signOut: async () => {
          await clerk.signOut();
        },
      };
    }
    const meta = clerkUser.publicMetadata as {
      role?: string;
      region?: string;
    } | null;
    const role = meta?.role;
    const isAdmin = role === "admin";
    const isBehoerde = role === "behoerde" || role === "gov";
    // A sentinel may be approved for shelter-network membership too; that must
    // NOT flip them to einrichtung — the approved-shelter fallback only
    // applies to accounts with no other identity (no Clerk role, no sentinel
    // application). Explicit einrichtung/shelter roles always win.
    const isEinrichtung = role === "einrichtung" || role === "shelter" || (approvedShelter && !role && !sentinelApproved);
    const isSentinel = role === "sentinel" || sentinelApproved;
    const isExpert = isSentinel && sentinelTier === "S4";
    const appRole: AppRole = isAdmin
      ? "admin"
      : isBehoerde
        ? "behoerde"
        : isEinrichtung
          ? "einrichtung"
          : isSentinel
            ? "sentinel"
            : "user";
    return {
      user: {
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
        displayName:
          clerkUser.fullName ??
          clerkUser.username ??
          clerkUser.primaryEmailAddress?.emailAddress ??
          null,
        emailVerified:
          clerkUser.primaryEmailAddress?.verification?.status === "verified",
      },
      isAdmin,
      isBehoerde,
      isEinrichtung,
      isSentinel,
      isExpert,
      region: meta?.region ?? profileRegion,
      role: appRole,
      loading: false,
      signOut: async () => {
        await clerk.signOut();
      },
    };
  }, [userLoaded, authLoaded, clerkUser, clerk, approvedShelter, sentinelApproved, sentinelTier, profileRegion]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
