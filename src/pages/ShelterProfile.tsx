import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PawPrint, MapPin, CheckCircle2 } from "lucide-react";
import { fetchShelter, fetchShelterWards, fetchMyRequests, sendShelterRequest } from "@/lib/shelters";
import type { Shelter, Ward, ShelterRequest } from "@/lib/types";
import { LazyShelterMap } from "@/components/shelters/LazyShelterMap";

const ShelterProfile = () => {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const supabase = useExternalSupabase();
  const { toast } = useToast();
  const [shelter, setShelter] = useState<Shelter | null>(null);
  const [wards, setWards] = useState<Ward[]>([]);
  const [myRequest, setMyRequest] = useState<ShelterRequest | null>(null);
  const [busy, setBusy] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  const isSentinel = role === "sentinel";

  const load = useCallback(async () => {
    if (!id) return;
    setBusy(true);
    try {
      const s = await fetchShelter(supabase, id);
      setShelter(s);
      if (s) {
        const w = await fetchShelterWards(supabase, s.id);
        setWards(w);
      }
      if (user && isSentinel) {
        const mine = await fetchMyRequests(supabase, user.id);
        setMyRequest(mine.find((r) => r.shelter_id === id) ?? null);
      }
    } catch (e) {
      toast({ title: "Laden fehlgeschlagen", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [id, supabase, user, isSentinel, toast]);

  useEffect(() => {
    document.title = "Einrichtung · ExoGuard";
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sendRequest = async () => {
    if (!user || !id) return;
    setSending(true);
    try {
      await sendShelterRequest(supabase, { shelter_id: id, sentinel_id: user.id, message: msg || null });
      toast({ title: "Anfrage gesendet", description: "Die Einrichtung wird benachrichtigt." });
      setMsg("");
      void load();
    } catch (e) {
      toast({ title: "Fehler", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (busy && !shelter) {
    return (
      <div className="min-h-screen bg-background text-muted-foreground">
        <SiteHeader />
        <main className="container py-24 text-center">…</main>
      </div>
    );
  }

  if (!shelter) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="container max-w-xl py-24 text-center">
          <h1 className="font-editorial text-3xl">Einrichtung nicht gefunden</h1>
          <Button asChild className="mt-6"><Link to="/shelters">Alle Einrichtungen</Link></Button>
        </main>
      </div>
    );
  }

  const requested = myRequest?.status === "open" || myRequest?.status === "accepted";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">§ Einrichtung</span>
            <h1 className="font-editorial mt-2 text-4xl md:text-5xl">{shelter.name}</h1>
            <p className="mt-3 flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /> {shelter.region}</p>
            {shelter.description && <p className="mt-4 max-w-2xl text-sm">{shelter.description}</p>}
          </div>
          {isSentinel && (
            <div className="w-full max-w-sm rounded border border-border bg-surface p-4">
              {requested ? (
                <p className="flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="h-4 w-4" /> Anfrage {myRequest?.status === "accepted" ? "akzeptiert" : "offen"}</p>
              ) : (
                <>
                  <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Als Sentinel bewerben</Label>
                  <Textarea rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Kurze Vorstellung …" className="mt-2" />
                  <Button size="sm" className="mt-2 w-full" onClick={sendRequest} disabled={sending}>Anfrage senden</Button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowMap((v) => !v)}>
            {showMap ? "Liste" : "Karte"}
          </Button>
        </div>
        {showMap && <div className="mt-4"><LazyShelterMap shelters={[shelter]} /></div>}

        <section className="mt-10">
          <h2 className="font-display text-2xl flex items-center gap-2"><PawPrint className="h-5 w-5 text-primary" /> Tiere der Einrichtung</h2>
          {wards.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Noch keine Tiere erfasst.</p>
          ) : (
            <div className="mt-4 grid gap-px bg-border md:grid-cols-2">
              {wards.map((w) => (
                <article key={w.id} className="bg-background p-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{w.case_code} · {w.status}</p>
                  <h3 className="font-display mt-2 text-xl">{w.common_name}</h3>
                  {w.scientific_name && <p className="mt-1 text-xs italic text-muted-foreground">{w.scientific_name}</p>}
                  <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{w.background}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
};

export default ShelterProfile;