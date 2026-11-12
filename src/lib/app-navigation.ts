import type { AuthContextValue, AppRole } from "@/hooks/auth-context";

export const roleHome = (role: AppRole): string => ({
  admin: "/admin", behoerde: "/behoerde", einrichtung: "/shelters",
  sentinel: "/care", user: "/dashboard",
})[role];

// Only local application destinations may survive a sign-in redirect.
export function returnDestination(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return null;
  const path = value.split(/[?#]/)[0];
  return /^\/(dashboard|care|wards|sentinels|account|admin|behoerde(?:\/network|\/verwaltung)?|shelters(?:\/[^/]+)?|sentinel(?:\/apply|\/network)?)$/.test(path) ? value : null;
}

export function appNavigation(auth: Pick<AuthContextValue, "role" | "isAdmin" | "isBehoerde" | "isEinrichtung" | "isSentinel" | "canBrowseSentinels">) {
  const links = [{ href: roleHome(auth.role), label: "Übersicht", type: "route" as const }];
  const add = (href: string, label: string) => { if (!links.some((l) => l.href === href)) links.push({ href, label, type: "route" }); };
  if (auth.isAdmin || auth.isBehoerde || auth.isEinrichtung || auth.isSentinel) {
    add("/care", "Pflege"); add("/wards", "Tiere");
  }
  if (auth.canBrowseSentinels) add("/sentinels", "Sentinels finden");
  if (auth.isSentinel) {
    add("/sentinel/network", "Einrichtungen");
    if (auth.canBrowseSentinels && !auth.isAdmin && !auth.isBehoerde) add("/shelters", "Meine Einrichtung");
  }
  if (auth.isBehoerde) { add("/behoerde/verwaltung", "Verwaltung"); add("/shelters", "Standortprofil"); }
  if (auth.role === "user") { add("/sentinel/apply", "Sentinel-Antrag"); add("/shelters", "Einrichtungs-Zugang"); }
  add("/account", "Konto");
  return links;
}
