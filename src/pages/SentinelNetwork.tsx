import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useToast } from "@/hooks/use-toast";
import { Building2, MapPin, Clock, CheckCircle2, XCircle } from "lucide-react";
import { fetchShelters, fetchMyRequests } from "@/lib/shelters";
import type { Shelter, ShelterRequest } from "@/lib/types";

const SentinelNetwork = () => {
  const { user, role, loading } = useAuth();
  const supabase = useExternalSupabase();
  const { toast } = useToast();
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [requests, setRequests] = useState<ShelterRequest[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const [s, r] = await Promise.all([
        fetchShelters(supabase),
        fetchMyRequests(supabase, user.id),
      ]);
      setShelters(s);
      setRequests(r);
    } catch (e) {
      toast({ title: "Laden fehlgeschlagen", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [user, supabase, toast]);

  useEffect(() => {
    document.title = "Sentinel-Netzwerk · ExoGuard";
  }, []);

  useEffect(() => {
    if (role === "sentinel" && user) void load();
  }, [role, user, load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-muted-foreground">
        <SiteHeader />
        <main className="container py-24 text-center">…</main>
      </div>
    );
  }

  if (role !== "sentinel") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="container max-w-xl py-24 text-center">
          <h1 className="font-editorial text-3xl">Nur für Sentinels</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Hier verbindest du dich mit Einrichtungen. Du musst ein verifizierter Sentinel sein.
          </p>
          <Link to="/sentinel" className="mt-6 inline-block text-primary underline">Zum Sentinel-Pfad</Link>
        </main>
      </div>
    );
  }

  const statusIcon = (s: ShelterRequest["status"]) =>
    s === "accepted" ? <CheckCircle2 className="h-4 w-4 text-green-400" />
    : s === "declined" ? <XCircle className="h-4 w-4 text-destructive" />
    : <Clock className="h-4 w-4 text-primary" />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container py-12">
        <span className="eyebrow">§ Netzwerk</span>
        <h1 className="font-editorial mt-2 text-4xl md:text-5xl">Einrichtungen &amp; Sentinels</h1>
        <p className="mt-3 text-muted-foreground">
          Finde Tierheime / Einrichtungen und bewirb dich als Sentinel für deren Bestand.
        </p>

        {busy ? (
          <p className="mt-10 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">Lade …</p>
        ) : (
          <div className="mt-10 grid gap-10">
            <section>
              <h2 className="font-display text-2xl flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Einrichtungen</h2>
              {shelters.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Noch keine Einrichtungen erfasst.</p>
              ) : (
                <ul className="mt-4 divide-y divide-border border border-border bg-surface">
                  {shelters.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="min-w-0">
                        <p className="font-medium">{s.name}</p>
                        <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {s.region}</p>
                      </div>
                      <Link to={`/shelters/${s.id}`} className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-primary hover:underline">Profil</Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="font-display text-2xl">Meine Anfragen</h2>
              {requests.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Du hast noch keine Anfragen gesendet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-border border border-border bg-surface">
                  {requests.map((r) => {
                    const s = shelters.find((x) => x.id === r.shelter_id);
                    return (
                      <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-4">
                        <div>
                          <p className="text-sm">{s?.name ?? "Einrichtung"}</p>
                          <span className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            {statusIcon(r.status)} {r.status}
                          </span>
                        </div>
                        {s && <Link to={`/shelters/${s.id}`} className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-primary hover:underline">Profil</Link>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default SentinelNetwork;
