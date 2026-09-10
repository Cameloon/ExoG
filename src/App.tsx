import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { isConfigured } from "@/config/external";
import { PageLoader } from "@/components/ui/loading-snake";
import "@/i18n";

// Route-level code splitting: public landing variants stay separate from the
// auth shell; the v2 design is now the canonical landing page.
// AppShell (Clerk + Supabase, ~90 kB gz) is its own lazy chunk — public pages
// never fetch the auth runtime.
const Landing = lazy(() => import("./pages/Index.tsx").then((m) => ({ default: m.Landing })));
const LandingV2 = lazy(() => import("./pages/LandingV2.tsx"));
const Werte = lazy(() => import("./pages/Werte.tsx"));
const Impressum = lazy(() => import("./pages/Legal.tsx").then((m) => ({ default: m.Impressum })));
const Datenschutz = lazy(() => import("./pages/Legal.tsx").then((m) => ({ default: m.Datenschutz })));
const AppShell = lazy(() => import("./AppShell.tsx"));

const RouteFallback = () => <PageLoader label="Lade Seite" />;

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
    <ThemeProvider>
      <TooltipProvider>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring">
          Zum Inhalt springen
        </a>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<LandingV2 />} />
              <Route path="/start" element={<LandingV2 />} />
              <Route path="/original" element={<Landing />} />
              <Route path="/v2" element={<LandingV2 />} />
              <Route path="/werte" element={<Werte />} />
              <Route path="/impressum" element={<Impressum />} />
              <Route path="/datenschutz" element={<Datenschutz />} />
              <Route path="/*" element={<AppShell />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  );
};

export default App;
