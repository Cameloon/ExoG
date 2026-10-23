import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

export const SiteHeader = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { user, isAdmin, isBehoerde, isEinrichtung, role, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Logged-out: public landing/marketing nav. Logged-in: role-based app nav
  // (replaces the landing links, like a normal web-app). Logo still → home.
  const publicNav = [
    { href: "/sentinel", label: t("nav.sentinel"), type: "route" as const },
    { href: "/pledge", label: t("nav.pledge"), type: "route" as const },
    { href: "/werte", label: t("nav.werte"), type: "route" as const },
    { href: "/wards", label: "Wards", type: "route" as const },
    { href: "/#system", label: t("nav.system"), type: "anchor" as const },
    { href: "/#workflow", label: t("nav.workflow"), type: "anchor" as const },
  ];

  const appNav = [
    ...(isBehoerde ? [
      { href: "/behoerde", label: "Dashboard", type: "route" as const },
      { href: "/behoerde/network", label: "Network", type: "route" as const },
      { href: "/behoerde/verwaltung", label: "Verwaltung", type: "route" as const },
    ] : []),
    ...(isEinrichtung ? [
      { href: "/shelters", label: "Einrichtung", type: "route" as const },
      { href: "/care", label: "Pflege", type: "route" as const },
      { href: "/wards", label: "Wards", type: "route" as const },
    ] : []),
    ...(role === "sentinel" ? [
      { href: "/care", label: "Pflege", type: "route" as const },
      { href: "/sentinel/network", label: "Netzwerk", type: "route" as const },
      { href: "/wards", label: "Wards", type: "route" as const },
    ] : []),
    ...(role === "user" ? [
      { href: "/sentinel/apply", label: "Registrierung", type: "route" as const },
    ] : []),
    ...(isAdmin ? [{ href: "/admin", label: t("nav.admin"), type: "route" as const }] : []),
    ...(user ? [{ href: "/account", label: t("nav.account"), type: "route" as const }] : []),
  ];

  const nav = user ? appNav : publicNav;

  const closeMobile = () => setMobileOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Logo to="/start" />
        <nav className="hidden items-center gap-7 md:flex">
          {nav.map((n) =>
            n.type === "route" ? (
              <Link key={n.href} to={n.href}
                className={`font-mono text-xs uppercase tracking-[0.18em] transition-colors hover:text-foreground ${
                  location.pathname === n.href ? "text-primary" : "text-muted-foreground"
                }`}>
                {n.label}
              </Link>
            ) : (
              <a key={n.href} href={n.href}
                className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground">
                {n.label}
              </a>
            ),
          )}
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user ? (
            <Button variant="ghost" size="sm" onClick={() => signOut()}>{t("nav.signOut")}</Button>
          ) : (
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/auth">{t("nav.signIn")}</Link>
            </Button>
          )}
          {!user && (
            <Button asChild variant="default" size="sm" className="hidden sm:inline-flex">
                <Link to="/demo">{t("nav.viewPlatform")}</Link>
            </Button>
          )}
          {/* Mobile menu trigger */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Menü öffnen"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile slide-in menu */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="flex w-[88vw] max-w-xs flex-col gap-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-16 items-center border-b border-border px-6">
            <Logo to="/start" />
          </div>

          {/* Primary CTA — full-width on mobile */}
          <div className="border-b border-border p-4">
            {user ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  signOut();
                  closeMobile();
                }}
              >
                {t("nav.signOut")}
              </Button>
            ) : (
              <Button asChild variant="default" className="w-full" onClick={closeMobile}>
              <Link to="/demo">{t("nav.viewPlatform")}</Link>
              </Button>
            )}
          </div>

          {/* Nav links */}
          <nav className="flex flex-col py-2">
            {nav.map((n) =>
              n.type === "route" ? (
                <Link
                  key={n.href}
                  to={n.href}
                  onClick={closeMobile}
                  className={`border-b border-border/60 px-6 py-4 font-mono text-xs uppercase tracking-[0.18em] transition-colors hover:bg-surface-elevated hover:text-foreground ${
                    location.pathname === n.href ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {n.label}
                </Link>
              ) : (
                <a
                  key={n.href}
                  href={n.href}
                  onClick={closeMobile}
                  className="border-b border-border/60 px-6 py-4 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
                >
                  {n.label}
                </a>
              ),
            )}
          </nav>

          {/* Auth action pinned to bottom */}
          <div className="mt-auto border-t border-border p-4">
            {!user && (
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth" onClick={closeMobile}>{t("nav.signIn")}</Link>
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
};