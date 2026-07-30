import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { EXTERNAL_CONFIG, isConfigured } from "@/config/external";
import "@/i18n";
import Index from "./pages/Index.tsx";

// Route-level code splitting: everything except the landing page loads on demand.
const Landing = lazy(() => import("./pages/Index.tsx").then((m) => ({ default: m.Landing })));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const SentinelPath = lazy(() => import("./pages/SentinelPath.tsx"));
const SentinelApply = lazy(() => import("./pages/SentinelApply.tsx"));
const Pledge = lazy(() => import("./pages/Pledge.tsx"));
const Werte = lazy(() => import("./pages/Werte.tsx"));
const Wards = lazy(() => import("./pages/Wards.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Behoerde = lazy(() => import("./pages/Behoerde.tsx"));
const Shelters = lazy(() => import("./pages/Shelters.tsx"));
const ShelterProfile = lazy(() => import("./pages/ShelterProfile.tsx"));
const SentinelNetwork = lazy(() => import("./pages/SentinelNetwork.tsx"));
const Account = lazy(() => import("./pages/Account.tsx"));
const Care = lazy(() => import("./pages/Care.tsx"));
const Impressum = lazy(() => import("./pages/Legal.tsx").then((m) => ({ default: m.Impressum })));
const Datenschutz = lazy(() => import("./pages/Legal.tsx").then((m) => ({ default: m.Datenschutz })));

const RouteFallback = () => (
  <div className="min-h-screen bg-background text-muted-foreground flex items-center justify-center">
    …
  </div>
);

const ConfigMissing = () => (
  <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
    <div className="max-w-xl border border-destructive/40 bg-surface p-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-destructive">
        § Konfiguration fehlt
      </p>
      <h1 className="font-editorial mt-3 text-3xl">External backend not configured</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Open <code className="text-foreground">src/config/external.ts</code> and fill in
        your Supabase URL, Supabase anon key, and Clerk publishable key.
        See <code className="text-foreground">SETUP.md</code> for full instructions.
      </p>
    </div>
  </div>
);

const RequireAdmin = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-muted-foreground flex items-center justify-center">
        …
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" state={{ from: "/admin" }} replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background text-muted-foreground flex items-center justify-center">
        …
      </div>
    );
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

const App = () => {
  if (!isConfigured()) return <ConfigMissing />;

  return (
    <ClerkProvider publishableKey={EXTERNAL_CONFIG.CLERK_PUBLISHABLE_KEY}>
        <ThemeProvider>
        <TooltipProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring">
            Zum Inhalt springen
          </a>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <div id="main" tabIndex={-1}>
              <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/start" element={<Landing />} />
                <Route path="/dashboard" element={<DashboardHome />} />
                <Route path="/demo" element={<Dashboard />} />
                <Route path="/care" element={<RequireAuth><Care /></RequireAuth>} />
                <Route path="/sentinel" element={<SentinelPath />} />
                <Route path="/sentinel/apply" element={<RequireAuth><SentinelApply /></RequireAuth>} />
                <Route path="/pledge" element={<Pledge />} />
                <Route path="/werte" element={<Werte />} />
                <Route path="/wards" element={<Wards />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/behoerde" element={<RequireAuth><Behoerde /></RequireAuth>} />
                <Route path="/shelters" element={<RequireAuth><Shelters /></RequireAuth>} />
                <Route path="/shelters/:id" element={<ShelterProfile />} />
                <Route path="/sentinel/network" element={<RequireAuth><SentinelNetwork /></RequireAuth>} />
                <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
                <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
                <Route path="/impressum" element={<Impressum />} />
                <Route path="/datenschutz" element={<Datenschutz />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
              </div>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
        </ThemeProvider>
    </ClerkProvider>
  );
};

export default App;
