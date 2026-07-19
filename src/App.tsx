import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import Dashboard from "./pages/Dashboard.tsx";
import SentinelPath from "./pages/SentinelPath.tsx";
import SentinelApply from "./pages/SentinelApply.tsx";
import Pledge from "./pages/Pledge.tsx";
import Werte from "./pages/Werte.tsx";
import Wards from "./pages/Wards.tsx";
import Auth from "./pages/Auth.tsx";
import Admin from "./pages/Admin.tsx";
import NotFound from "./pages/NotFound.tsx";
import Index, { Landing } from "./pages/Index.tsx";
import Behoerde from "./pages/Behoerde.tsx";
import Shelters from "./pages/Shelters.tsx";
import ShelterProfile from "./pages/ShelterProfile.tsx";
import SentinelNetwork from "./pages/SentinelNetwork.tsx";
import Account from "./pages/Account.tsx";
import { Impressum, Datenschutz } from "./pages/Legal.tsx";

const queryClient = new QueryClient();

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

const App = () => {
  if (!isConfigured()) return <ConfigMissing />;

  return (
    <ClerkProvider publishableKey={EXTERNAL_CONFIG.CLERK_PUBLISHABLE_KEY}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/start" element={<Landing />} />
                <Route path="/dashboard" element={<Dashboard />} />
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
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
};

export default App;
