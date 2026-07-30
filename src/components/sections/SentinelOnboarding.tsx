import { useEffect } from "react";
import { Link } from "react-router-dom";
import { SentinelWizard } from "@/components/sections/SentinelWizard";
import { useSentinelApplication } from "@/hooks/useSentinelApplication";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

// Content-only: SentinelPath owns the hero + PathwayFlow + page shell.
const SentinelOnboarding = () => {
  useEffect(() => {
    document.title = "Sentinel-Pfad · BioSteward";
    const meta = document.querySelector('meta[name="description"]');
    const c =
      "Der Weg vom erfahrenen Halter zum Sentinel: fünf Stationen, klare Selbstverpflichtung, Bewerbung im verifizierten Custody-Netzwerk.";
    meta?.setAttribute("content", c);
  }, []);

  const { status, checking, hasApplication, isApproved } = useSentinelApplication();
  const { isAdmin, isBehoerde, isEinrichtung, isSentinel } = useAuth();

  if (checking) {
    return <div className="border-t border-border bg-background py-16 text-center text-sm text-muted-foreground">Lade Status…</div>;
  }

  // Established roles (admin, behörde, einrichtung, approved sentinel) never
  // see the application wizard on the public sentinel page.
  if (isAdmin || isBehoerde || isEinrichtung || isSentinel) {
    return (
      <div className="border-t border-border bg-background py-16 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
        <h2 className="font-editorial mt-5 text-3xl">Bereits im Netzwerk.</h2>
        <p className="mt-3 text-muted-foreground">Dein Konto ist bestätigt — die Bewerbung ist für dich nicht nötig.</p>
        <Link to="/care" className="mt-6 inline-block font-mono text-[10px] uppercase tracking-[0.22em] text-primary hover:underline">Zum Pflege-Log →</Link>
      </div>
    );
  }

  if (isApproved) {
    return (
      <div className="border-t border-border bg-background py-16 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
        <h2 className="font-editorial mt-5 text-3xl">Du bist Sentinel.</h2>
        <p className="mt-3 text-muted-foreground">Deine Aufnahme ist bestätigt. Alles Weitere findest du im Netzwerk-Bereich.</p>
        <Link to="/care" className="mt-6 inline-block font-mono text-[10px] uppercase tracking-[0.22em] text-primary hover:underline">Zum Pflege-Log →</Link>
      </div>
    );
  }

  if (hasApplication) {
    const rejected = status === "rejected";
    const Icon = rejected ? XCircle : Clock;
    return (
      <div className="border-t border-border bg-background py-16 text-center">
        <Icon className="mx-auto h-10 w-10 text-primary" />
        <h2 className="font-editorial mt-5 text-3xl">
          {rejected ? "Antrag abgelehnt" : "Dein Antrag wird bearbeitet"}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          {rejected
            ? "Deine Bewerbung wurde nicht angenommen. Du kannst dich erneut bewerben."
            : "Wir prüfen deine Unterlagen. Du erhältst eine Rückmeldung innerhalb von 5 Werktagen — eine erneute Bewerbung ist nicht nötig."}
        </p>
        {rejected && (
          <div className="mt-8">
            <SentinelWizard variant="embedded" />
          </div>
        )}
      </div>
    );
  }

  return <SentinelWizard variant="embedded" />;
};

export default SentinelOnboarding;
