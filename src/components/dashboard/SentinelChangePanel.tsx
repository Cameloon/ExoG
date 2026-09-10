import { useEffect, useState } from "react";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSnake } from "@/components/ui/loading-snake";
import { toast } from "@/hooks/use-toast";
import { MapPin, ShieldCheck, Clock } from "lucide-react";

// Sentinels may request an address change. It lands in sentinel_change_requests
// and only takes effect once an admin approves it (see Admin queue).
const statusChip: Record<string, string> = {
  pending: "border-warning/40 bg-warning/10 text-warning",
  approved: "border-success/40 bg-success/10 text-success",
  rejected: "border-destructive/40 bg-destructive/10 text-destructive",
};

const statusLabel: Record<string, string> = {
  pending: "In Prüfung — ein Admin muss die Änderung freigeben",
  approved: "Freigegeben — die neuen Daten sind aktiv",
  rejected: "Abgelehnt — du kannst eine neue Änderung beantragen",
};

export const SentinelChangePanel = () => {
  const { user } = useAuth();
  const supabase = useExternalSupabase();

  const [current, setCurrent] = useState<{ street: string; house_number: string; zip: string; city: string } | null>(null);
  const [form, setForm] = useState({ street: "", house_number: "", zip: "", city: "" });
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const [{ data: app }, { data: req }] = await Promise.all([
        supabase
          .from("sentinel_applications")
          .select("pledge_data")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("sentinel_change_requests")
          .select("id, status")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const q = (app?.pledge_data as { questionnaire?: { street?: string; house_number?: string; zip?: string; city?: string } } | null)?.questionnaire;
      const base = { street: q?.street ?? "", house_number: q?.house_number ?? "", zip: q?.zip ?? "", city: q?.city ?? "" };
      setCurrent(base);
      setForm(base);
      setLastStatus((req?.status as string | undefined) ?? null);
      setPendingId(req?.status === "pending" ? (req.id as string) : null);
      setBusy(false);
    })();
    return () => { cancelled = true; };
  }, [user, supabase]);

  const submit = async () => {
    if (!user) return;
    if (!form.street.trim() || !form.house_number.trim() || !/^\d{5}$/.test(form.zip.trim()) || !form.city.trim()) {
      toast({ title: "Vollständige Adresse erforderlich", description: "Straße, Hausnummer, PLZ und Wohnort angeben.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("sentinel_change_requests").insert({
        user_id: user.id,
        requested: {
          street: form.street.trim(),
          house_number: form.house_number.trim(),
          zip: form.zip.trim(),
          city: form.city.trim(),
        },
      });
      if (error) throw error;
      toast({ title: "Änderung beantragt", description: "Ein Admin prüft die neuen Daten. Bis zur Freigabe bleibt die alte Adresse aktiv." });
      setLastStatus("pending");
    } catch (e) {
      toast({ title: "Fehler", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    if (!pendingId) return;
    if (!window.confirm("Änderungsantrag wirklich zurückziehen?")) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("sentinel_change_requests").delete().eq("id", pendingId);
      if (error) throw error;
      setPendingId(null);
      setLastStatus(null);
      toast({ title: "Änderungsantrag zurückgezogen" });
    } catch (e) {
      toast({ title: "Fehler", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-border bg-surface p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary flex items-center gap-2">
        <MapPin className="h-3.5 w-3.5" /> Profil-Adresse
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Adressänderungen durchlaufen einen Admin-Freigabe-Loop — sichtbar für Netzwerk-Karte und Zuweisung erst nach Bestätigung.
      </p>

      {busy ? (
        <div className="mt-4"><LoadingSnake label="Lade Adresse" compact /></div>
      ) : (
        <div className="mt-4">
          {lastStatus && (
            <span className={`inline-flex items-center gap-2 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${statusChip[lastStatus]}`}>
              {lastStatus === "pending" ? <Clock className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
              {statusLabel[lastStatus] ?? lastStatus}
            </span>
          )}

          <div className="mt-4 grid grid-cols-[1fr_110px] gap-3">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Straße</label>
              <Input value={form.street} onChange={(e) => setForm((p) => ({ ...p, street: e.target.value }))} maxLength={160} className="mt-1 h-9" />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Hausnummer</label>
              <Input value={form.house_number} onChange={(e) => setForm((p) => ({ ...p, house_number: e.target.value }))} maxLength={20} className="mt-1 h-9" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">PLZ</label>
              <Input value={form.zip} onChange={(e) => setForm((p) => ({ ...p, zip: e.target.value.replace(/\D/g, "").slice(0, 5) }))} maxLength={5} inputMode="numeric" className="mt-1 h-9" />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Wohnort</label>
              <Input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} maxLength={120} className="mt-1 h-9" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm" disabled={saving || lastStatus === "pending"} onClick={submit}>
              {saving ? "Sende …" : "Adresse ändern beantragen"}
            </Button>
            {pendingId && (
              <Button size="sm" variant="outline" disabled={saving} onClick={cancel}>
                Antrag zurückziehen
              </Button>
            )}
            {current && (
              <span className="text-xs text-muted-foreground">
                Aktuell: {current.street} {current.house_number}, {current.zip} {current.city}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};