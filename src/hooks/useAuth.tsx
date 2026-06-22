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
import { createContext, ReactNode, useContext, useEffect, useMemo } from "react";
import { useUser, useClerk, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useExternalSupabase } from "@/integrations/external/supabase";

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAdmin: false,
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

        if (existing) return;

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

        if (insertErr) {
          console.warn("Profile sync: insert failed", insertErr);
        }
      } catch (err) {
        console.warn("Profile sync: unexpected error", err);
      }
    };

    syncProfile();
  }, [userLoaded, authLoaded, clerkUser, supabase]);

  const value = useMemo<AuthContextValue>(() => {
    const loading = !userLoaded || !authLoaded;
    if (loading || !clerkUser) {
      return {
        user: null,
        isAdmin: false,
        loading,
        signOut: async () => {
          await clerk.signOut();
        },
      };
    }
    const role = (clerkUser.publicMetadata as { role?: string } | null)?.role;
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
      isAdmin: role === "admin",
      loading: false,
      signOut: async () => {
        await clerk.signOut();
      },
    };
  }, [userLoaded, authLoaded, clerkUser, clerk]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
