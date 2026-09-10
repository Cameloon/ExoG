import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PageLoader } from "@/components/ui/loading-snake";
import { RequireAdmin, RequireAuth } from "@/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { V2_CSS } from "@/lib/v2Theme";

// ponytail: /app-v2 = exakt dieselben App-Seiten und -Daten, aber im
// /v2-Look. Kein Duplikat der Seitenlogik — die Seiten laufen unverändert,
// nur .v2scope remappt alle Design-Tokens (Geist, eckig, bklit-Farben,
// wählbarer Akzent). Neue App-Seiten automatisch dabei.

// Gleiche Lazy-Imports wie AppShell — Module deduplizieren, gleiche Chunks.
const Dashboard = lazy(() => import("@/pages/Dashboard.tsx"));
const SentinelPath = lazy(() => import("@/pages/SentinelPath.tsx"));
const Pledge = lazy(() => import("@/pages/Pledge.tsx"));
const SentinelApply = lazy(() => import("@/pages/SentinelApply.tsx"));
const Wards = lazy(() => import("@/pages/Wards.tsx"));
const Auth = lazy(() => import("@/pages/Auth.tsx"));
const Admin = lazy(() => import("@/pages/Admin.tsx"));
const NotFound = lazy(() => import("@/pages/NotFound.tsx"));
const Behoerde = lazy(() => import("@/pages/Behoerde.tsx"));
const BehoerdeNetwork = lazy(() => import("@/pages/BehoerdeNetwork.tsx"));
const BehoerdeVerwaltung = lazy(() => import("@/pages/BehoerdeVerwaltung.tsx"));
const Shelters = lazy(() => import("@/pages/Shelters.tsx"));
const ShelterProfile = lazy(() => import("@/pages/ShelterProfile.tsx"));
const SentinelNetwork = lazy(() => import("@/pages/SentinelNetwork.tsx"));
const Account = lazy(() => import("@/pages/Account.tsx"));
const Care = lazy(() => import("@/pages/Care.tsx"));

const RouteFallback = () => <PageLoader label="Lade Seite" />;

const RoleHome = () => {
  const { user, role, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (!user) return <Navigate to="/auth" state={{ from: "/app-v2" }} replace />;
  const home: Record<string, string> = {
    admin: "/app-v2/admin",
    behoerde: "/app-v2/behoerde",
    einrichtung: "/app-v2/shelters",
    sentinel: "/app-v2/care",
  };
  return <Navigate to={home[role] ?? "/app-v2/sentinel"} replace />;
};

export const AppV2Layout = () => {
  // Akzent folgt der Wahl auf /v2 (localStorage), initial gelesen.
  const acc = (() => {
    try {
      const v = localStorage.getItem("v2.acc");
      return v === "lila" || v === "mono" || v === "forest" || v === "lagoon" ? v : "orange";
    } catch {
      return "orange";
    }
  })();

  return (
    <div className="v2scope min-h-screen antialiased" data-acc={acc}>
      <style>{V2_CSS}</style>
      <SiteHeader />
      <div className="border-b border-border">
        <div className="container flex items-center justify-between gap-4 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <span className="v2a">● App v2</span>
            <span className="mx-2 hidden sm:inline">·</span>
            <span className="hidden sm:inline">gleiche Seiten & Daten · Design-Labor-Skin</span>
          </p>
          <a href="/v2" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            ← Design-Labor
          </a>
        </div>
      </div>
      <main>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route index element={<RoleHome />} />
            <Route path="dashboard" element={<RoleHome />} />
            <Route path="demo" element={<Dashboard />} />
            <Route path="care" element={<RequireAuth><Care /></RequireAuth>} />
            <Route path="sentinel" element={<SentinelPath />} />
            <Route path="pledge" element={<Pledge />} />
            <Route path="sentinel/apply" element={<RequireAuth><SentinelApply /></RequireAuth>} />
            <Route path="wards" element={<RequireAuth><Wards /></RequireAuth>} />
            <Route path="auth" element={<Auth />} />
            <Route path="behoerde" element={<RequireAuth><Behoerde /></RequireAuth>} />
            <Route path="behoerde/network" element={<RequireAuth><BehoerdeNetwork /></RequireAuth>} />
            <Route path="behoerde/verwaltung" element={<RequireAuth><BehoerdeVerwaltung /></RequireAuth>} />
            <Route path="shelters" element={<RequireAuth><Shelters /></RequireAuth>} />
            <Route path="shelters/:id" element={<RequireAuth><ShelterProfile /></RequireAuth>} />
            <Route path="sentinel/network" element={<RequireAuth><SentinelNetwork /></RequireAuth>} />
            <Route path="admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
            <Route path="account" element={<RequireAuth><Account /></RequireAuth>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
};

export default AppV2Layout;
