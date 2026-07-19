import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Building2, PawPrint, Map as MapIcon, List as ListIcon } from "lucide-react";
import { fetchShelters, fetchWardsByRegion } from "@/lib/shelters";
import type { Shelter, Ward } from "@/lib/types";
import { LazyShelterMap } from "@/components/shelters/LazyShelterMap";

const Behoerde = () => {
  const { user, region, isBehoerde, loading } = useAuth();
  const supabase = useExternalSupabase();
  const { toast } = useToast();
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [busy, setBusy] = useState(true);
  const [showMap, setShowMap] = useState(false);

  const load = useCallback(async () => {
    if (!region) return;
    setBusy(true);
    try {
      const [s, w] = await Promise.all([
        fetchShelters(supabase, { region }),
        fetchWardsByRegion(supabase, region),
      ]);
      setShelters(s);
      setWards(w);
    } catch (e) {
      toast({ title: "Laden fehlgeschlagen", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [region, supabase, toast]);

  useEffect(() => {
    document.title = "Behörde · ExoGuard";
  }, []);

  useEffect(() => {
    if (isBehoerde && region) void load();
  }, [isBehoerde, region, load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-muted-foreground">
        <SiteHeader />
        <main className="container py-24 text-center">…</main>
      </div>
    );
  }

  if (!isBehoerde) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="container max-w-xl py-24 text-center">
          <h1 className="font-editorial text-3xl">Kein Behörden-Zugang</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Dieser Bereich ist Behörden mit Zuständigkeitsregion vorbehalten.
          </p>
          <Button asChild className="mt-6"><Link to="/start">Zur Startseite</Link></Button>
        </main>
      </div>
    );
  }

  if (!region) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="container max-w-xl py-24 text-center">
          <h1 className="font-editorial text-3xl">Keine Zuständigkeitsregion</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Deinem Behörden-Account ist keine Region zugeordnet. Das pflegt ein
            ExoGuard-Admin im Clerk-Metadatum <code>region</code> ein.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">§ Behörde · Zuständigkeit</span>
            <h1 className="font-editorial mt-2 text-4xl md:text-5xl">Einzugsgebiet {region}</h1>
            <p className="mt-3 text-muted-foreground">
              Wards und Einrichtungen in deiner Region. {wards.length} Wards · {shelters.length} Einrichtungen.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowMap((v) => !v)}>
            {showMap ? <ListIcon className="mr-2 h-4 w-4" /> : <MapIcon className="mr-2 h-4 w-4" />}
            {showMap ? "Liste" : "Karte"}
          </Button>
        </div>

        {busy ? (
          <p className="mt-10 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">Lade …</p>
        ) : (
          <div className="mt-10 grid gap-10">
            {showMap && shelters.length > 0 && (
              <section>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Einrichtungen-Karte</p>
                <div className="mt-3"><LazyShelterMap shelters={shelters} /></div>
              </section>
            )}

            <section>
              <h2 className="font-display text-2xl flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Einrichtungen</h2>
              {shelters.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Keine Einrichtungen in {region} erfasst.</p>
              ) : (
                <ul className="mt-4 divide-y divide-border border border-border bg-surface">
                  {shelters.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="min-w-0">
                        <p className="font-medium">{s.name}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{s.region} · {s.description ?? "—"}</p>
                      </div>
                      <Link to={`/shelters/${s.id}`} className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-primary hover:underline">Profil</Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="font-display text-2xl flex items-center gap-2"><PawPrint className="h-5 w-5 text-primary" /> Wards in Region</h2>
              {wards.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Keine Wards in {region} erfasst.</p>
              ) : (
                <div className="mt-4 grid gap-px bg-border md:grid-cols-2">
                  {wards.map((w) => (
                    <article key={w.id} className="bg-background p-6">
                      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{w.case_code} · {w.status}</p>
                      <h3 className="font-display mt-2 text-xl">{w.common_name}</h3>
                      {w.scientific_name && <p className="mt-1 text-xs italic text-muted-foreground">{w.scientific_name}</p>}
                      <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{w.background}</p>
                      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {w.region}</div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default Behoerde;
