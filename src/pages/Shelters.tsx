import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PawPrint, Network, Building2, Check, X } from "lucide-react";
import { WardManager } from "@/components/wards/WardManager";
import { RegionSelect } from "@/components/RegionSelect";
import {
  fetchMyShelter,
  upsertShelter,
  fetchShelterWards,
  fetchRequestsForShelter,
  setRequestStatus,
} from "@/lib/shelters";
import type { Shelter, Ward, ShelterRequest } from "@/lib/types";
import { BUNDESLAENDER } from "@/lib/germanRegions";

type Tab = "profil" | "tiere" | "netzwerk";

const Shelters = () => {
  const { user, isEinrichtung, loading } = useAuth();
  const supabase = useExternalSupabase();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("profil");
  const [shelter, setShelter] = useState<Shelter | null>(null);
  const [wards, setWards] = useState<Ward[]>([]);
  const [requests, setRequests] = useState<ShelterRequest[]>([]);
  const [busy, setBusy] = useState(true);
  const [editing, setEditing] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<"pending" | "rejected" | null>(null);
  const [myShelterId, setMyShelterId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const s = await fetchMyShelter(supabase, user.id);
      setShelter(s);
      if (s) {
        const [w, r] = await Promise.all([
          fetchShelterWards(supabase, s.id),
          fetchRequestsForShelter(supabase, s.id),
        ]);
        setWards(w);
        setRequests(r);
      }
    } catch (e) {
      toast({ title: "Laden fehlgeschlagen", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [user, supabase, toast]);

  useEffect(() => {
    document.title = "Einrichtung · ExoGuard";
  }, []);

  useEffect(() => {
    if (isEinrichtung && user) void load();
  }, [isEinrichtung, user, load]);

  useEffect(() => {
    if (!isEinrichtung || !user) return;
    supabase
      .from("shelters")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle()
      .then(({ data }) => setMyShelterId((data as { id: string } | null)?.id ?? null));
  }, [isEinrichtung, user, supabase]);

  // If the user signed up as a shelter but the admin hasn't confirmed yet,
  // surface the pending/rejected state instead of a generic "no access".
  useEffect(() => {
    if (isEinrichtung || !user) {
      setPendingStatus(null);
      return;
    }
    supabase
      .from("pending_shelter_requests")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) =>
        setPendingStatus((data as { status: "pending" | "rejected" } | null)?.status ?? null),
      );
  }, [isEinrichtung, user, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-muted-foreground">
        <SiteHeader />
        <main className="container py-24 text-center">…</main>
      </div>
    );
  }

  if (!isEinrichtung) {
    if (pendingStatus === "pending") {
      return (
        <div className="min-h-screen bg-background text-foreground">
          <SiteHeader />
          <main className="container max-w-xl py-24 text-center">
            <h1 className="font-editorial text-3xl">Einrichtung wartet auf Bestätigung</h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Deine Anmeldung als Einrichtung wurde übermittelt. Ein Admin
              prüft und bestätigt deinen Zugang — ohne KYC-Prozess.
            </p>
            <Button asChild className="mt-6"><Link to="/start">Zur Startseite</Link></Button>
          </main>
        </div>
      );
    }
    if (pendingStatus === "rejected") {
      return (
        <div className="min-h-screen bg-background text-foreground">
          <SiteHeader />
          <main className="container max-w-xl py-24 text-center">
            <h1 className="font-editorial text-3xl">Einrichtungs-Antrag abgelehnt</h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Dein Antrag als Einrichtung wurde von einem Admin abgelehnt.
            </p>
            <Button asChild className="mt-6"><Link to="/start">Zur Startseite</Link></Button>
          </main>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="container max-w-xl py-24 text-center">
          <h1 className="font-editorial text-3xl">Kein Einrichtungs-Zugang</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Dieser Bereich ist Tierheimen / Einrichtungen vorbehalten.
          </p>
          <Button asChild className="mt-6"><Link to="/start">Zur Startseite</Link></Button>
        </main>
      </div>
    );
  }

  const saveProfile = async (form: Partial<Shelter>) => {
    if (!user) return;
    setBusy(true);
    try {
      const saved = await upsertShelter(supabase, {
        ...(shelter ?? {}),
        ...form,
        owner_id: user.id,
        kind: "shelter",
      } as Shelter);
      setShelter(saved);
      setEditing(false);
      toast({ title: shelter ? "Profil gespeichert" : "Profil erstellt" });
    } catch (e) {
      toast({ title: "Speichern fehlgeschlagen", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const respond = async (id: string, status: ShelterRequest["status"]) => {
    try {
      await setRequestStatus(supabase, id, status);
      setRequests((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
      toast({ title: status === "accepted" ? "Anfrage akzeptiert" : "Anfrage abgelehnt" });
    } catch (e) {
      toast({ title: "Fehler", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">§ Einrichtung</span>
            <h1 className="font-editorial mt-2 text-4xl md:text-5xl">{shelter?.name ?? "Meine Einrichtung"}</h1>
            <p className="mt-3 text-muted-foreground">{shelter?.region ?? "—"}</p>
          </div>
          <div className="flex gap-px bg-border">
            {([
              ["profil", "Profil", Building2],
              ["tiere", "Tiere", PawPrint],
              ["netzwerk", "Netzwerk", Network],
            ] as const).map(([id, lbl, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-2 bg-surface px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                  tab === id ? "bg-surface-elevated text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3 w-3" /> {lbl}
              </button>
            ))}
          </div>
        </div>

        {busy && !shelter ? (
          <p className="mt-10 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">Lade …</p>
        ) : (
          <div className="mt-10">
            {tab === "profil" && (
              <ShelterProfileForm
                shelter={shelter}
                editing={editing}
                setEditing={setEditing}
                onSave={saveProfile}
                busy={busy}
              />
            )}

            {tab === "tiere" && (
              <section>
                <WardManager shelterId={myShelterId} />
              </section>
            )}

            {tab === "netzwerk" && (
              <section>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Sentinel-Anfragen ({requests.filter((r) => r.status === "open").length} offen)
                </p>
                {requests.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">Noch keine Anfragen von Sentinels.</p>
                ) : (
                  <ul className="mt-4 divide-y divide-border border border-border bg-surface">
                    {requests.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                        <div>
                          <p className="text-sm">Sentinel <span className="font-mono">{r.sentinel_id.slice(0, 12)}…</span></p>
                          {r.message && <p className="mt-1 text-xs text-muted-foreground">{r.message}</p>}
                          <span className="mt-1 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{r.status}</span>
                        </div>
                        {r.status === "open" && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => respond(r.id, "accepted")}><Check className="mr-1 h-3 w-3" /> Annehmen</Button>
                            <Button size="sm" variant="ghost" onClick={() => respond(r.id, "declined")}><X className="mr-1 h-3 w-3" /> Ablehnen</Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

const ShelterProfileForm = ({
  shelter,
  editing,
  setEditing,
  onSave,
  busy,
}: {
  shelter: Shelter | null;
  editing: boolean;
  setEditing: (v: boolean) => void;
  onSave: (form: Partial<Shelter>) => void;
  busy: boolean;
}) => {
  const [name, setName] = useState(shelter?.name ?? "");
  const initialRegion = shelter?.region ?? "";
  const [state, setState] = useState(
    BUNDESLAENDER.find((s) => initialRegion.endsWith(s)) ?? "",
  );
  const [district, setDistrict] = useState(
    state ? initialRegion.replace(`, ${state}`, "") : initialRegion,
  );
  const [address, setAddress] = useState(shelter?.address ?? "");
  const [contactEmail, setContactEmail] = useState(shelter?.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(shelter?.contact_phone ?? "");
  const [description, setDescription] = useState(shelter?.description ?? "");
  const [lat, setLat] = useState(shelter?.lat != null ? String(shelter.lat) : "");
  const [lng, setLng] = useState(shelter?.lng != null ? String(shelter.lng) : "");

  useEffect(() => {
    setName(shelter?.name ?? "");
    const r = shelter?.region ?? "";
    const st = BUNDESLAENDER.find((s) => r.endsWith(s)) ?? "";
    setState(st);
    setDistrict(st ? r.replace(`, ${st}`, "") : r);
    setAddress(shelter?.address ?? "");
    setContactEmail(shelter?.contact_email ?? "");
    setContactPhone(shelter?.contact_phone ?? "");
    setDescription(shelter?.description ?? "");
    setLat(shelter?.lat != null ? String(shelter.lat) : "");
    setLng(shelter?.lng != null ? String(shelter.lng) : "");
  }, [shelter]);

  if (!editing) {
    if (!shelter) {
      return (
        <div className="border border-border bg-surface p-8">
          <h2 className="font-display text-2xl">Profil anlegen</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Lege dein Einrichtungs-Profil an, damit dich Wächter und Behörden finden.
          </p>
          <Button size="sm" className="mt-5" onClick={() => setEditing(true)}>Profil erstellen</Button>
        </div>
      );
    }
    return (
      <div className="border border-border bg-surface p-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl">{shelter?.name ?? "Profil anlegen"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{shelter?.region ?? "—"}</p>
            {shelter?.description && <p className="mt-4 text-sm">{shelter.description}</p>}
          </div>
          <Button size="sm" onClick={() => setEditing(true)}>Bearbeiten</Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const regionValue = district ? `${district}, ${state}` : state;
        onSave({
          name,
          region: regionValue,
          address: address || null,
          contact_email: contactEmail || null,
          contact_phone: contactPhone || null,
          description: description || null,
          lat: lat ? Number(lat) : null,
          lng: lng ? Number(lng) : null,
        });
      }}
      className="grid gap-5 border border-border bg-surface p-8 md:grid-cols-2"
    >
      <Field label="Name" value={name} onChange={setName} />
      <RegionSelect
        state={state}
        district={district}
        onState={setState}
        onDistrict={setDistrict}
      />
      <Field label="Adresse" value={address} onChange={setAddress} />
      <Field label="Kontakt-E-Mail" value={contactEmail} onChange={setContactEmail} />
      <Field label="Telefon" value={contactPhone} onChange={setContactPhone} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Breitengrad (lat)" value={lat} onChange={setLat} />
        <Field label="Längengrad (lng)" value={lng} onChange={setLng} />
      </div>
      <div className="md:col-span-2">
        <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Beschreibung</Label>
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-2" />
      </div>
      <div className="md:col-span-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>Abbrechen</Button>
        <Button type="submit" disabled={busy}>Speichern</Button>
      </div>
    </form>
  );
};

const Field = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div>
    <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} className="mt-2" />
  </div>
);

export default Shelters;
