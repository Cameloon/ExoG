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
  region: null,
  role: "user",
  loading: true,
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

  // A shelter user may be granted access via an admin-approved
  // pending_shelter_requests row (no manual Clerk role step required).
  const [approvedShelter, setApprovedShelter] = useState(false);
  const [sentinelApproved, setSentinelApproved] = useState(false);
  useEffect(() => {
    if (!userLoaded || !clerkUser) {
      setApprovedShelter(false);
      setSentinelApproved(false);
      return;
    }
    const meta = clerkUser.publicMetadata as { role?: string } | null;
    if (meta?.role === "einrichtung" || meta?.role === "shelter") {
      setApprovedShelter(true);
      return;
    }
    supabase
      .from("pending_shelter_requests")
      .select("status")
      .eq("user_id", clerkUser.id)
      .maybeSingle()
      .then(({ data }) =>
        setApprovedShelter((data as { status: string } | null)?.status === "approved"),
      );
  }, [userLoaded, clerkUser, supabase]);

  useEffect(() => {
    if (!userLoaded || !clerkUser) {
      setSentinelApproved(false);
      return;
    }
    const meta = clerkUser.publicMetadata as { role?: string } | null;
    if (meta?.role === "sentinel") {
      setSentinelApproved(true);
      return;
    }
    supabase
      .from("sentinel_applications")
      .select("status")
      .eq("user_id", clerkUser.id)
      .eq("status", "approved")
      .maybeSingle()
      .then(({ data }) => setSentinelApproved(Boolean(data)));
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
    const isEinrichtung = role === "einrichtung" || role === "shelter" || approvedShelter;
    const isSentinel = role === "sentinel" || sentinelApproved;
    const appRole: AppRole = isAdmin
      ? "admin"
      : isSentinel
        ? "sentinel"
        : isBehoerde
          ? "behoerde"
          : isEinrichtung
            ? "einrichtung"
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
      region: meta?.region ?? null,
      role: appRole,
      loading: false,
      signOut: async () => {
        await clerk.signOut();
      },
    };
  }, [userLoaded, authLoaded, clerkUser, clerk]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
