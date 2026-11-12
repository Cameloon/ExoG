import { AuthContext, type AppRole } from "@/hooks/auth-context";
import type { ReactNode } from "react";
export function AuthProvider({ children }: { children: ReactNode }) {
  const dual = localStorage.getItem("test-role") === "dual";
  const role = (dual ? "sentinel" : localStorage.getItem("test-role") ?? "sentinel") as AppRole;
  const expert = localStorage.getItem("test-expert") === "true";
  return <AuthContext.Provider value={{
    user: localStorage.getItem("test-role") === "anonymous" ? null : { id: "user_test", displayName: "Test Person", email: "test@example.test", emailVerified: true },
    role, isAdmin: role === "admin", isBehoerde: role === "behoerde", isEinrichtung: role === "einrichtung",
    isSentinel: role === "sentinel", isExpert: expert,
    canBrowseSentinels: dual || ["admin","behoerde","einrichtung"].includes(role),
    region: "Berlin", loading: false, signOut: async () => {},
  }}>{children}</AuthContext.Provider>;
}
