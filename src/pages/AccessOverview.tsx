import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/auth-context";
import { useSentinelApplication } from "@/hooks/useSentinelApplication";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { LoadingSnake } from "@/components/ui/loading-snake";
import { AppFeedback } from "@/components/AppFeedback";

const statusLabel: Record<string, string> = { pending: "Eingegangen", under_review: "In Prüfung", approved: "Freigegeben", rejected: "Abgelehnt" };

export default function AccessOverview() {
  const { user } = useAuth();
  const application = useSentinelApplication();
  const supabase = useExternalSupabase();
  const [shelter, setShelter] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => { document.title = "Mein Zugang · ExoGuard"; }, []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    setChecking(true); setError(false);
    void supabase.from("pending_shelter_requests").select("status").eq("user_id", user.id).maybeSingle()
      .then(({ data, error }) => { if (active) { setShelter(data?.status ?? null); setError(Boolean(error)); setChecking(false); } });
    return () => { active = false; };
  }, [user, supabase, revision]);
  return <div className="min-h-screen bg-background text-foreground dashboard-bg">
    <SiteHeader />
    <main className="container max-w-4xl py-10">
      <span className="eyebrow">§ Mein Zugang</span>
      <h1 className="font-editorial mt-3 text-4xl">Willkommen{user?.displayName ? `, ${user.displayName}` : ""}.</h1>
      <p className="mt-4 text-muted-foreground">Hier siehst du den Stand deiner Anträge und deinen nächsten Schritt.</p>
      {checking || application.checking ? <div className="py-10"><LoadingSnake label="Lade Antragsstatus" /></div>
        : error || application.error ? <AppFeedback title="Antragsstatus nicht verfügbar" message="Deine Anträge bleiben gespeichert. Bitte versuche es erneut." onRetry={() => { application.retry(); setRevision((v) => v + 1); }} />
        : <div className="mt-8 grid gap-6 md:grid-cols-2">
          {([
            { title: "Sentinel", status: application.status, target: "/sentinel/apply", description: "Als geprüfte Pflegestelle Tiere aufnehmen und ihre Pflege dokumentieren." },
            { title: "Einrichtung", status: shelter, target: "/shelters", description: "Tiere erfassen, geeignete Sentinels finden und Anfragen verwalten." },
          ]).map((item) => <section key={item.title} className="border border-border bg-surface p-6">
            <h2 className="font-display text-2xl">{item.title}</h2>
            <p className="mt-3 text-sm text-muted-foreground">{item.description}</p>
            <p className="mt-5 font-mono text-xs text-primary">{item.status ? statusLabel[item.status] : "Noch kein Antrag"}</p>
            {item.status === "pending" || item.status === "under_review"
              ? <p className="mt-3 text-sm">Dein Antrag wird geprüft. Du brauchst ihn nicht erneut einzureichen.</p>
              : item.status === "approved" ? <Button variant="outline" className="mt-5" onClick={() => window.location.reload()}>Zugang neu laden</Button>
              : <Button asChild variant="outline" className="mt-5"><Link to={item.target}>{item.status === "rejected" ? "Erneut beantragen" : item.status === "approved" ? "Zugang öffnen" : "Zugang beantragen"}</Link></Button>}
          </section>)}
        </div>}
      <Button variant="ghost" className="mt-6" onClick={() => window.location.reload()}>Status aktualisieren</Button>
    </main><SiteFooter />
  </div>;
}
