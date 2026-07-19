import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { EXTERNAL_CONFIG } from "@/config/external";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { toast } from "@/hooks/use-toast";

const Account = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { user: clerkUser } = useUser();
  const { getToken } = useClerkAuth();
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <>
        <SiteHeader />
        <main className="container py-16 text-muted-foreground">{t("account.required")}</main>
      </>
    );
  }

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

export default Account;
