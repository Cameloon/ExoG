// Auth-gated shell. Imported lazily from App.tsx so the ~90 kB gz Clerk
// runtime is only fetched when a visitor actually hits an auth route —
// public landing pages render without it.
import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { EXTERNAL_CONFIG } from "@/config/external";
import { PageLoader } from "@/components/ui/loading-snake";
import { V2_CSS } from "@/lib/v2Theme";
import { useAccentTheme } from "@/hooks/useAccentTheme";

const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const SentinelPath = lazy(() => import("./pages/SentinelPath.tsx"));
const Pledge = lazy(() => import("./pages/Pledge.tsx"));
const SentinelApply = lazy(() => import("./pages/SentinelApply.tsx"));
const Wards = lazy(() => import("./pages/Wards.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Behoerde = lazy(() => import("./pages/Behoerde.tsx"));
const BehoerdeNetwork = lazy(() => import("./pages/BehoerdeNetwork.tsx"));
const BehoerdeVerwaltung = lazy(() => import("./pages/BehoerdeVerwaltung.tsx"));
const Shelters = lazy(() => import("./pages/Shelters.tsx"));
const ShelterProfile = lazy(() => import("./pages/ShelterProfile.tsx"));
const SentinelNetwork = lazy(() => import("./pages/SentinelNetwork.tsx"));
const Account = lazy(() => import("./pages/Account.tsx"));
const Care = lazy(() => import("./pages/Care.tsx"));
const AppV2Layout = lazy(() => import("./pages/appv2/AppV2Layout.tsx"));

const RouteFallback = () => <PageLoader label="Lade Seite" />;

export const RequireAdmin = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return <PageLoader label="Prüfe Zugang" />;
  }
  if (!user) return <Navigate to="/auth" state={{ from: "/admin" }} replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return <PageLoader label="Prüfe Zugang" />;
  }
  if (!user) return <Navigate to="/auth" state={{ from: "/dashboard" }} replace />;
  return <>{children}</>;
};

// Logged-in users land on their role's real home; the demo lives at /demo.
const DashboardHome = () => {
  const { user, role, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (!user) return <Navigate to="/auth" state={{ from: "/dashboard" }} replace />;
  const home: Record<string, string> = {
    admin: "/admin",
    behoerde: "/behoerde",
    einrichtung: "/shelters",
    sentinel: "/care",
  };
  return <Navigate to={home[role] ?? "/sentinel"} replace />;
};

const AppShellRoot = () => {
  const { accent: acc } = useAccentTheme();

  return (
    <div className="v2scope min-h-screen antialiased" data-acc={acc} data-app-v2>
      <style>{V2_CSS}</style>
      <ClerkProvider publishableKey={EXTERNAL_CONFIG.CLERK_PUBLISHABLE_KEY}>
        <AuthProvider>
          <div id="main" tabIndex={-1}>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/app-v2/*" element={<AppV2Layout />} />
                <Route path="/dashboard" element={<DashboardHome />} />
                <Route path="/demo" element={<Dashboard />} />
                <Route path="/care" element={<RequireAuth><Care /></RequireAuth>} />
                <Route path="/sentinel" element={<SentinelPath />} />
                <Route path="/pledge" element={<Pledge />} />
                <Route path="/sentinel/apply" element={<RequireAuth><SentinelApply /></RequireAuth>} />
                <Route path="/wards" element={<RequireAuth><Wards /></RequireAuth>} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/behoerde" element={<RequireAuth><Behoerde /></RequireAuth>} />
                <Route path="/behoerde/network" element={<RequireAuth><BehoerdeNetwork /></RequireAuth>} />
                <Route path="/behoerde/verwaltung" element={<RequireAuth><BehoerdeVerwaltung /></RequireAuth>} />
                <Route path="/shelters" element={<RequireAuth><Shelters /></RequireAuth>} />
                <Route path="/shelters/:id" element={<RequireAuth><ShelterProfile /></RequireAuth>} />
                <Route path="/sentinel/network" element={<RequireAuth><SentinelNetwork /></RequireAuth>} />
                <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
                <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </div>
        </AuthProvider>
      </ClerkProvider>
    </div>
  );
};

export default AppShellRoot;
