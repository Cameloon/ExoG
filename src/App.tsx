import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/hooks/useAuth";
import { EXTERNAL_CONFIG, isConfigured } from "@/config/external";
import "@/i18n";
import Index from "./pages/Index.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import SentinelPath from "./pages/SentinelPath.tsx";
import Pledge from "./pages/Pledge.tsx";
import Werte from "./pages/Werte.tsx";
import Wards from "./pages/Wards.tsx";
import Auth from "./pages/Auth.tsx";
import Admin from "./pages/Admin.tsx";
import NotFound from "./pages/NotFound.tsx";

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
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/sentinel" element={<SentinelPath />} />
                <Route path="/pledge" element={<Pledge />} />
                <Route path="/werte" element={<Werte />} />
                <Route path="/wards" element={<Wards />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/admin" element={<Admin />} />
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
