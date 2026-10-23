import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSignIn, useSignUp } from "@clerk/clerk-react";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { useSentinelApplication } from "@/hooks/useSentinelApplication";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type AuthMode = "signin" | "signup";

const getClerkErrorMessage = (err: unknown) => {
  const clerkError = err as {
    errors?: { longMessage?: string; message?: string }[];
    message?: string;
  };
  return (
    clerkError.errors?.[0]?.longMessage ??
    clerkError.errors?.[0]?.message ??
    clerkError.message ??
    "Unbekannter Fehler"
  );
};

const splitDisplayName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? undefined, lastName: undefined };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1),
  };
};

const Auth = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, isAdmin, isBehoerde, isEinrichtung, isSentinel, role } = useAuth();
  const signInFlow = useSignIn();
  const signUpFlow = useSignUp();

  const params = new URLSearchParams(location.search);
  const [mode, setMode] = useState<AuthMode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  // Zweiter Faktor (TOTP / Backup-Code / E-Mail- / SMS-Code) nach Passwort-Login.
  const [secondFactors, setSecondFactors] = useState<
    { strategy: string; emailAddressId?: string; phoneNumberId?: string; safeIdentifier?: string }[]
  >([]);
  const [secondStrategy, setSecondStrategy] = useState("");
  const [busy, setBusy] = useState(false);
  const supabase = useExternalSupabase();
  // Self-service role choice at signup: sentinel (→ KYC application) or
  // shelter (→ admin confirmation, no KYC).
  const [intendedRole, setIntendedRole] = useState<"sentinel" | "shelter">("sentinel");

  useEffect(() => {
    document.title = "Anmelden · BioSteward";
  }, []);

  // Only a brand-new user who explicitly chose the sentinel path (and holds no
  // established role) should land in the application wizard. Everyone else goes
  // to their role-specific home, ignoring any stale "from" pointing at the wizard.
  const homeForRole: Record<string, string> = {
    admin: "/admin",
    behoerde: "/behoerde",
    einrichtung: "/shelters",
    sentinel: "/dashboard",
  };
  const isEstablishedRole = isAdmin || isBehoerde || isEinrichtung || isSentinel;
  const sentinelWizardTarget = isEstablishedRole
    ? (homeForRole[role] ?? "/dashboard")
    : intendedRole === "sentinel"
      ? "/sentinel/apply"
      : "/shelters";

  useEffect(() => {
    if (!loading && user) {
      navigate(sentinelWizardTarget, { replace: true });
    }
  }, [loading, user, navigate, sentinelWizardTarget]);

  const finishAuth = async (
    createdSessionId: string | null | undefined,
    setActive: (params: { session: string }) => Promise<void>,
    createdUserId?: string | null,
  ) => {
    if (!createdSessionId) throw new Error("Clerk hat keine Sitzung erstellt.");
    await setActive({ session: createdSessionId });
    // Shelter signups need admin confirmation (no KYC). Record a pending
    // request so /admin can approve and grant the Clerk role.
    if (intendedRole === "shelter" && createdUserId) {
      try {
        await supabase.from("pending_shelter_requests").upsert({
          user_id: createdUserId,
          email,
          display_name: displayName || null,
          status: "pending",
        });
      } catch {
        // non-blocking: admin queue can still be seeded manually
      }
    }
    navigate(sentinelWizardTarget, { replace: true });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!signUpFlow.isLoaded) throw new Error("Clerk ist noch nicht bereit.");

        if (needsVerification) {
          const result = await signUpFlow.signUp.attemptEmailAddressVerification({ code });
          if (result.status === "complete") {
            await finishAuth(result.createdSessionId, signUpFlow.setActive, result.createdUserId);
            return;
          }
          throw new Error("Der Bestätigungscode konnte nicht abgeschlossen werden.");
        }

        const { firstName, lastName } = splitDisplayName(displayName);
        const result = await signUpFlow.signUp.create({
          emailAddress: email,
          password,
          firstName,
          lastName,
          unsafeMetadata: {
            displayName: displayName || email,
            preferredLanguage: "de",
            intendedRole,
          },
          locale: "de",
        });

        if (result.status === "complete") {
          await finishAuth(result.createdSessionId, signUpFlow.setActive, result.createdUserId);
          return;
        }

        await signUpFlow.signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setNeedsVerification(true);
        toast({ title: t("auth.verifySent"), description: email });
        return;
      }

      if (!signInFlow.isLoaded) throw new Error("Clerk ist noch nicht bereit.");

      // Bereits im zweiten Faktor? Code prüfen.
      if (secondFactors.length > 0) {
        const res = await signInFlow.signIn.attemptSecondFactor({
          strategy: secondStrategy as "totp",
          code,
        });
        if (res.status === "complete") {
          await finishAuth(res.createdSessionId, signInFlow.setActive);
          return;
        }
        throw new Error("Code ungültig oder abgelaufen — bitte erneut versuchen.");
      }

      const result = await signInFlow.signIn.create({
        identifier: email,
        password,
        strategy: "password",
      });

      if (result.status === "complete") {
        await finishAuth(result.createdSessionId, signInFlow.setActive);
        return;
      }

      if (result.status === "needs_second_factor") {
        const factors = ((result.supportedSecondFactors ?? []) as {
          strategy: string; emailAddressId?: string; phoneNumberId?: string; safeIdentifier?: string;
        }[]).filter((f) => ["totp", "backup_code", "email_code", "phone_code"].includes(f.strategy));
        if (factors.length === 0) throw new Error("Für dieses Konto ist ein weiterer Anmeldeschritt erforderlich.");
        const first = factors[0];
        // E-Mail-/SMS-Code muss erst versendet werden; TOTP/Backup-Code nicht.
        if (first.strategy === "email_code" && first.emailAddressId) {
          await signInFlow.signIn.prepareSecondFactor({ strategy: "email_code", emailAddressId: first.emailAddressId });
        } else if (first.strategy === "phone_code" && first.phoneNumberId) {
          await signInFlow.signIn.prepareSecondFactor({ strategy: "phone_code", phoneNumberId: first.phoneNumberId });
        }
        setSecondFactors(factors);
        setSecondStrategy(first.strategy);
        setCode("");
        toast({ title: "Zweiter Faktor erforderlich", description: "Bitte Code aus deiner zweiten Anmeldemethode eingeben." });
        return;
      }

      throw new Error("Für dieses Konto ist ein weiterer Anmeldeschritt erforderlich.");
    } catch (err) {
      toast({
        title: t("auth.error"),
        description: getClerkErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const toggleMode = () => {
    setMode((current) => (current === "signup" ? "signin" : "signup"));
    setNeedsVerification(false);
    setSecondFactors([]);
    setSecondStrategy("");
    setCode("");
  };

  const secondFactorLabel: Record<string, string> = {
    totp: "Authenticator-App",
    backup_code: "Backup-Code",
    email_code: "E-Mail-Code",
    phone_code: "SMS-Code",
  };

  const switchSecondStrategy = async (strategy: string) => {
    if (!signInFlow.isLoaded || !signInFlow.signIn) return;
    const f = secondFactors.find((x) => x.strategy === strategy);
    if (!f || strategy === secondStrategy) return;
    setBusy(true);
    try {
      if (strategy === "email_code" && f.emailAddressId) {
        await signInFlow.signIn.prepareSecondFactor({ strategy: "email_code", emailAddressId: f.emailAddressId });
      } else if (strategy === "phone_code" && f.phoneNumberId) {
        await signInFlow.signIn.prepareSecondFactor({ strategy: "phone_code", phoneNumberId: f.phoneNumberId });
      }
      setSecondStrategy(strategy);
      setCode("");
    } catch (err) {
      toast({ title: t("auth.error"), description: getClerkErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container max-w-md py-24">
        <span className="eyebrow">§ Zugang</span>
        <h1 className="font-editorial mt-4 text-4xl">{t("auth.title")}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t("auth.subtitle")}</p>

        <form onSubmit={submit} className="mt-10 space-y-5 border border-border bg-surface p-6">
          {mode === "signin" && secondFactors.length > 0 ? (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                Schritt 2 / 2 · Zwei-Faktor-Bestätigung
              </p>
              <div>
                <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Methode wählen
                </Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {secondFactors.map((f) => (
                    <button
                      type="button"
                      key={f.strategy}
                      onClick={() => switchSecondStrategy(f.strategy)}
                      className={`border px-3 py-3 text-left transition-colors ${
                        secondStrategy === f.strategy
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">
                        {secondFactorLabel[f.strategy] ?? f.strategy}
                      </span>
                      {f.safeIdentifier && (
                        <span className="mt-1 block truncate text-[11px] text-muted-foreground">{f.safeIdentifier}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Code
                </Label>
                <Input inputMode="numeric" required value={code} onChange={(e) => setCode(e.target.value)} className="mt-2" autoComplete="one-time-code" />
                <p className="mt-2 text-xs text-muted-foreground">
                  {secondStrategy === "backup_code"
                    ? "Einen deiner Backup-Codes eingeben."
                    : "Code aus der gewählten zweiten Methode eingeben."}
                </p>
              </div>
            </>
          ) : mode === "signup" && !needsVerification && (
            <>
              <div>
                <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {t("auth.displayName")}
                </Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-2" maxLength={120} />
              </div>
              <div>
                <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Rolle wählen
                </Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {([
                    { id: "sentinel", label: "Sentinel", sub: "Pflege & KYC-Prüfung" },
                    { id: "shelter", label: "Einrichtung", sub: "Tierheim · Bestätigung" },
                  ] as const).map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setIntendedRole(r.id)}
                      className={`border px-3 py-3 text-left transition-colors ${
                        intendedRole === r.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">{r.label}</span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">{r.sub}</span>
                    </button>
                  ))}
                </div>
                {intendedRole === "sentinel" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Du durchläufst danach die Sentinel-Bewerbung mit Sachkundenachweis.
                  </p>
                )}
                {intendedRole === "shelter" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Ein Admin bestätigt deine Einrichtung — ohne KYC-Prozess.
                  </p>
                )}
              </div>
            </>
          )}
          {!needsVerification ? (
            <>
              <div>
                <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {t("auth.email")}
                </Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2" />
              </div>
              <div>
                <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {t("auth.password")}
                </Label>
                <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2" />
              </div>
            </>
          ) : (
            <div>
              <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {t("auth.verificationCode")}
              </Label>
              <Input inputMode="numeric" required value={code} onChange={(e) => setCode(e.target.value)} className="mt-2" autoComplete="one-time-code" />
              <p className="mt-2 text-xs text-muted-foreground">{t("auth.verificationHint")}</p>
            </div>
          )}
          <Button type="submit" disabled={busy || !signInFlow.isLoaded || !signUpFlow.isLoaded} className="w-full">
            {busy ? "…" : secondFactors.length > 0 ? "Code bestätigen" : needsVerification ? t("auth.confirmCode") : mode === "signup" ? t("auth.signUp") : t("auth.signIn")}
          </Button>
          {secondFactors.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSecondFactors([]);
                setSecondStrategy("");
                setCode("");
              }}
              className="block w-full text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
            >
              ← Zurück zur Passwort-Anmeldung
            </button>
          )}
          {!needsVerification && (
            <button
              type="button"
              onClick={toggleMode}
              className="block w-full text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
            >
              {mode === "signup" ? t("auth.haveAccount") : t("auth.needAccount")}
            </button>
          )}
          {needsVerification && (
            <button
              type="button"
              onClick={() => {
                setNeedsVerification(false);
                setCode("");
              }}
              className="block w-full text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
            >
              {t("auth.changeEmail")}
            </button>
          )}
        </form>

        {!needsVerification && (
          <>
            <div className="mt-8 flex items-center gap-4">
              <span className="h-px flex-1 bg-border" />
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">oder</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <button
              type="button"
              onClick={() => {
                const oauthDone = sentinelWizardTarget;
                if (mode === "signup") {
                  if (!signUpFlow.isLoaded) return;
                  signUpFlow.signUp.authenticateWithRedirect({
                    strategy: "oauth_google",
                    redirectUrl: "/auth",
                    redirectUrlComplete: oauthDone,
                  });
                } else {
                  if (!signInFlow.isLoaded) return;
                  signInFlow.signIn.authenticateWithRedirect({
                    strategy: "oauth_google",
                    redirectUrl: "/auth",
                    redirectUrlComplete: oauthDone,
                  });
                }
              }}
              disabled={!signInFlow.isLoaded || !signUpFlow.isLoaded}
              className="mt-5 flex w-full items-center justify-center gap-3 border border-border bg-surface px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {mode === "signup" ? "Mit Google registrieren" : "Mit Google anmelden"}
            </button>
          </>
        )}

        {!signInFlow.isLoaded || !signUpFlow.isLoaded ? (
          <p className="mt-3 text-center text-xs text-muted-foreground">Clerk wird geladen…</p>
        ) : null}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/start" className="hover:text-foreground">← Startseite</Link>
        </p>
      </main>
    </div>
  );
};

export default Auth;
