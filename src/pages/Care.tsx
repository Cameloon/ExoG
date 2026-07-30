import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SentinelView } from "@/components/dashboard/SentinelView";

// Live care-log workspace (wards + persistent, hash-chained logs) for ward
// owners: sentinels and Einrichtungen. The demo twin lives at /demo.
const Care = () => {
  const { user, role, loading } = useAuth();

  useEffect(() => {
    document.title = "Pflege · ExoGuard";
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-muted-foreground flex items-center justify-center">
        …
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" state={{ from: "/care" }} replace />;
  if (role !== "sentinel" && role !== "einrichtung" && role !== "admin") {
    return <Navigate to="/sentinel" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground dashboard-bg">
      <SiteHeader />
      <main className="container py-10">
        <span className="eyebrow">§ Pflege & Beweiskette</span>
        <h1 className="font-editorial mt-3 text-4xl leading-tight md:text-5xl">
          Pflege-Log.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Jeder Eintrag wird mit dem vorherigen verkettet und ist unveränderbar —
          der Verlauf bleibt behördentauglich, auch Jahre später.
        </p>
        <div className="mt-8">
          <SentinelView live />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Care;
