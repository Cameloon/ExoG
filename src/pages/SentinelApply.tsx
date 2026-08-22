import { Navigate } from "react-router-dom";
import { SentinelWizard } from "@/components/sections/SentinelWizard";
import { useSentinelApplication } from "@/hooks/useSentinelApplication";
import { useAuth } from "@/hooks/useAuth";

const SentinelApply = () => {
  const { isAdmin, isBehoerde, isEinrichtung, isSentinel } = useAuth();
  const { status, checking, error, isApproved } = useSentinelApplication();

  if (checking) return null;
  // Never let a lookup error masquerade as "no application" — the user would
  // re-apply and hit a server 409.
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8 text-center text-muted-foreground">
        <div className="max-w-md border border-border bg-surface p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-destructive">Status konnte nicht geladen werden</p>
          <p className="mt-3 text-sm">Bitte Seite neu laden. Falls das anhält, kontaktiere den Support.</p>
        </div>
      </div>
    );
  }
  // Only a non-established user with no existing application may apply.
  // Admins, behörde, einrichtung and approved sentinels never see the wizard.
  if (isAdmin || isBehoerde || isEinrichtung || isSentinel) {
    return <Navigate to="/dashboard" replace />;
  }
  if (isApproved || status === "pending" || status === "under_review") {
    return <Navigate to="/dashboard" replace />;
  }

  return <SentinelWizard variant="fullscreen" />;
};

export default SentinelApply;
