import { createContext, useContext } from "react";

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
}

export type AppRole = "admin" | "behoerde" | "einrichtung" | "sentinel" | "user";

export interface AuthContextValue {
  user: AuthUser | null;
  isAdmin: boolean;
  canBrowseSentinels: boolean;
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

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAdmin: false,
  canBrowseSentinels: false,
  isBehoerde: false,
  isEinrichtung: false,
  isSentinel: false,
  isExpert: false,
  region: null,
  role: "user",
  loading: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);
