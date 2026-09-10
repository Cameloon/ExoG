import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { EXTERNAL_CONFIG } from "@/config/external";
import { SentinelChangePanel } from "@/components/dashboard/SentinelChangePanel";
import { AccentThemeSelector } from "@/components/AccentThemeSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/SiteHeader";
import { toast } from "@/hooks/use-toast";

const Account = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, role, region, signOut } = useAuth();
  const { getToken } = useClerkAuth();
  const supabase = useExternalSupabase();
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setDisplayName((data as { display_name: string | null } | null)?.display_name ?? ""));
  }, [user, supabase]);

  if (!user) {
    return (
      <>
        <SiteHeader />
        <main className="container py-16 text-muted-foreground">{t("account.required")}</main>
      </>
    );
  }

  const saveName = async () => {
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("id", user.id);
    setSavingName(false);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Gespeichert" });
  };

  const deleteAccount = async () => {
    if (!window.confirm(t("account.deleteConfirm"))) return;
    setBusy(true);
    try {
      const token = await getToken();
      const res = await fetch(`${EXTERNAL_CONFIG.SUPABASE_URL}/functions/v1/delete-account`, {
        method: "POST",
        headers: { authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("delete failed");
      toast({ title: t("account.deleted") });
      await signOut();
      navigate("/");
    } catch {
      toast({ title: t("account.deleteError"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SiteHeader />
      <main className="container max-w-xl py-16">
        <h1 className="font-editorial text-3xl">{t("account.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>

        <div className="mt-10 border border-border rounded-md p-6 space-y-3">
          <Detail label="Rolle" value={roleLabels[role] ?? role} />
          <Detail label="Region" value={region ?? "—"} />
          <Detail label="Benutzer-ID" value={user.id} mono />
        </div>

        <div className="mt-10 border border-border rounded-md p-6">
          <Label htmlFor="display-name" className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Anzeigename
          </Label>
          <div className="mt-3 flex gap-2">
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={120}
              placeholder="Vor- und Nachname"
            />
            <Button variant="outline" disabled={savingName} onClick={saveName}>
              {savingName ? "…" : "Speichern"}
            </Button>
          </div>
        </div>

        <div className="mt-10 border border-border rounded-md p-6">
          <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Erscheinungsbild
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Wähle die Akzentfarbe für Landingpage, Navigation und App-Oberfläche.
          </p>
          <div className="mt-4">
            <AccentThemeSelector />
          </div>
        </div>

        {role === "sentinel" && (
          <div className="mt-10">
            <SentinelChangePanel />
          </div>
        )}

        <div className="mt-10 border border-border rounded-md p-6">
          <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-destructive">
            {t("account.danger")}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">{t("account.deleteHint")}</p>
          <Button variant="destructive" className="mt-4" disabled={busy} onClick={deleteAccount}>
            {busy ? t("account.deleting") : t("account.delete")}
          </Button>
        </div>
      </main>
    </>
  );
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  behoerde: "Behörde",
  einrichtung: "Einrichtung",
  sentinel: "Sentinel",
  user: "Benutzer",
};

const Detail = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</dt>
    <dd className={`mt-1 text-sm ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
  </div>
);

export default Account;
