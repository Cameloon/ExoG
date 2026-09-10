import { useEffect, useState, useCallback } from "react";
import { Link, Navigate } from "react-router-dom";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSnake } from "@/components/ui/loading-snake";
import { useToast } from "@/hooks/use-toast";
import { PawPrint, Network, Building2, Check, X, ChevronDown } from "lucide-react";
import { WardManager } from "@/components/wards/WardManager";
import { RegionSelect } from "@/components/RegionSelect";
import {
  fetchMyShelter,
  upsertShelter,
  fetchShelterWards,
  fetchRequestsForShelter,
  setRequestStatus,
  deleteShelterRequest,
} from "@/lib/shelters";
import { parseCapacity, totalCapacity } from "@/lib/habitats";
import type { Shelter, Ward, ShelterRequest, WardInterest } from "@/lib/types";
import { BUNDESLAENDER } from "@/lib/germanRegions";
import { fetchWardInterests, setInterestStatus } from "@/lib/shelters";
import { QuestionnaireBlock } from "@/components/QuestionnaireBlock";

type Tab = "profil" | "tiere" | "netzwerk";

type ApplicantApp = {
  full_name: string;
  email: string;
  region: string;
  experience_years: number;
  species_focus: string | null;
  capacity: string;
  motivation: string;
  status: string;
  created_at: string;
  pledge_data: { questionnaire?: unknown } | null;
};

const INTEREST_STATUS: Record<string, { lbl: string; cls: string }> = {
  open: { lbl: "offen", cls: "text-primary" },
  shortlisted: { lbl: "in Auswahl", cls: "text-amber-400" },
  matched: { lbl: "gematcht", cls: "text-green-400" },
  declined: { lbl: "abgelehnt", cls: "text-muted-foreground" },
  withdrawn: { lbl: "zurückgezogen", cls: "text-muted-foreground" },
};

const Shelters = () => {
  const { user, isEinrichtung, isBehoerde, role, loading } = useAuth();
  const isGov = isBehoerde;
  const canManageProfile = isEinrichtung || isBehoerde;
  const supabase = useExternalSupabase();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("profil");
  const [shelter, setShelter] = useState<Shelter | null>(null);
  const [wards, setWards] = useState<Ward[]>([]);
  const [requests, setRequests] = useState<ShelterRequest[]>([]);
  const [interests, setInterests] = useState<WardInterest[]>([]);
  const [applicants, setApplicants] = useState<Record<string, ApplicantApp>>({});
  const [expandedReq, setExpandedReq] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [editing, setEditing] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<"pending" | "rejected" | null>(null);
  const [requesting, setRequesting] = useState(false);

  // Self-service request — covers OAuth signups (no pending row is written on
  // the OAuth redirect path) and users who signed up without choosing a role.
  const requestAccess = async () => {
    if (!user) return;
    setRequesting(true);
    const payload = {
      user_id: user.id,
      email: user.email ?? "",
      display_name: user.displayName ?? null,
      status: "pending" as const,
    };
    const { data: existing, error: lookupError } = await supabase
      .from("pending_shelter_requests")
      .select("id, status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = lookupError
      ? { error: lookupError }
      : existing?.status === "approved"
        ? { error: null }
        : existing
          ? await supabase.from("pending_shelter_requests").update(payload).eq("id", existing.id)
          : await supabase.from("pending_shelter_requests").insert(payload);
    setRequesting(false);
    if (error) {
      toast({ title: "Antrag fehlgeschlagen", description: error.message, variant: "destructive" });
      return;
    }
    setPendingStatus("pending");
    toast({ title: "Antrag übermittelt", description: "Ein Admin bestätigt deine Einrichtung." });
  };
  // Derived from the shelter row load() already fetches — no second query.
  const myShelterId = shelter?.id ?? null;

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const s = await fetchMyShelter(supabase, user.id);
      setShelter(s);
      if (s) {
        const [w, r, i] = await Promise.all([
          fetchShelterWards(supabase, s.id),
          fetchRequestsForShelter(supabase, s.id),
          fetchWardInterests(supabase, s.id),
        ]);
        setWards(w);
        setRequests(r);
        setInterests(i);
        // Klarname + Profil der Bewerber (RLS 00017 + 00024: shelter reads
        // applicants of its requests and ward applications)
        const ids = [...new Set([
          ...r.map((x) => x.sentinel_id),
          ...i.map((x) => x.applicant_id),
        ])];
        if (ids.length > 0) {
          const { data } = await supabase
            .from("sentinel_applications")
            .select("user_id, full_name, email, region, experience_years, species_focus, capacity, motivation, status, created_at, pledge_data")
            .in("user_id", ids)
            .order("created_at", { ascending: false });
          const map: Record<string, ApplicantApp> = {};
          for (const a of (data ?? []) as (ApplicantApp & { user_id: string })[]) {
            if (!map[a.user_id]) map[a.user_id] = a; // latest application per user
          }
          setApplicants(map);
        }
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

  // Behörden verwalten ihr Standort-Profil (kind='gov') auf derselben Seite,
  // damit Ämter auf der Netzwerk-Karte sichtbar sind.
  useEffect(() => {
    if (isBehoerde && user) void load();
  }, [isBehoerde, user, load]);

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
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) =>
        setPendingStatus((data as { status: "pending" | "rejected" } | null)?.status ?? null),
      );
  }, [isEinrichtung, user, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-muted-foreground">
        <SiteHeader />
        <main className="container py-24 text-center">
          <LoadingSnake label="Lade Einrichtungen" />
        </main>
      </div>
    );
  }

  // Sentinels/admins have no shelter business here — only institutions,
  // authorities (gov location profile) and role-less users may proceed.
  if (!canManageProfile && role !== "user") {
    return <Navigate to="/dashboard" replace />;
  }

  if (!canManageProfile) {
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
          <h1 className="font-editorial text-3xl">Als Einrichtung registrieren</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Dieser Bereich ist Tierheimen / Notstationen / Einrichtungen vorbehalten.
            Beantrage den Zugang — ein Admin bestätigt deine Einrichtung, ohne KYC-Prozess.
          </p>
          <Button className="mt-6" disabled={requesting} onClick={requestAccess}>
            {requesting ? "Sende …" : "Zugang als Einrichtung beantragen"}
          </Button>
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
        kind: isBehoerde ? "gov" : "shelter",
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

  const removeRequest = async (id: string) => {
    if (!window.confirm("Anfrage endgültig löschen? Der/die Sentinel kann sich danach erneut bewerben.")) return;
    const req = requests.find((x) => x.id === id);
    try {
      await deleteShelterRequest(supabase, id);
      setRequests((r) => r.filter((x) => x.id !== id));
      if (req) {
        setApplicants((prev) => {
          const next = { ...prev };
          delete next[req.sentinel_id];
          return next;
        });
      }
      toast({ title: "Anfrage gelöscht" });
    } catch (e) {
      toast({ title: "Fehler", description: (e as Error).message, variant: "destructive" });
    }
  };

  const respondInterest = async (id: string, status: "matched" | "declined") => {
    try {
      await setInterestStatus(supabase, id, status);
      setInterests((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
      toast({ title: status === "matched" ? "Interesse bestätigt" : "Interesse abgelehnt" });
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
            <span className="eyebrow">§ {isGov ? "Behörde" : "Einrichtung"}</span>
            <h1 className="font-editorial mt-2 text-4xl md:text-5xl">{shelter?.name ?? (isGov ? "Meine Behörde" : "Meine Einrichtung")}</h1>
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
          <div className="mt-10 flex justify-center">
            <LoadingSnake label="Lade Einrichtungen" compact />
          </div>
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
                  Ward-Anfragen ({interests.filter((x) => x.status === "open" || x.status === "shortlisted").length} offen)
                </p>
                {interests.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Noch keine Interessensbekundungen für deine Tiere.
                  </p>
                ) : (
                  <ul className="mt-4 divide-y divide-border border border-border bg-surface">
                    {interests.map((x) => {
                      const app = applicants[x.applicant_id];
                      const st = INTEREST_STATUS[x.status] ?? { lbl: x.status, cls: "text-muted-foreground" };
                      const expanded = expandedReq === `ward-${x.id}`;
                      return (
                        <li key={x.id} className="px-5 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">
                                {x.ward ? `${x.ward.common_name} (${x.ward.case_code})` : "Ward"}
                                <span className={`ml-2 font-mono text-[10px] uppercase tracking-[0.2em] ${st.cls}`}>{st.lbl}</span>
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {app ? (
                                  <button
                                    onClick={() => setExpandedReq(expanded ? null : `ward-${x.id}`)}
                                    className="inline-flex items-center gap-1 text-foreground hover:text-primary"
                                  >
                                    {app.full_name} · {app.region} · {app.experience_years} Jahre Erfahrung
                                    <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                                  </button>
                                ) : "Bewerber:in"}{" "}
                                · {new Date(x.created_at).toLocaleDateString("de-DE")}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {x.consultation_requested && (
                                  <span className="inline-block border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-primary">
                                    Beratungsgespräch gewünscht
                                  </span>
                                )}
                                {x.message && <p className="w-full text-xs text-muted-foreground">{x.message}</p>}
                              </div>
                            </div>
                            {(x.status === "open" || x.status === "shortlisted") && (
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => respondInterest(x.id, "matched")}><Check className="mr-1 h-3 w-3" /> Matchen</Button>
                                <Button size="sm" variant="ghost" onClick={() => respondInterest(x.id, "declined")}><X className="mr-1 h-3 w-3" /> Ablehnen</Button>
                              </div>
                            )}
                          </div>
                          {expanded && app && app.pledge_data?.questionnaire && (
                            <QuestionnaireBlock raw={app.pledge_data.questionnaire} className="mt-4 border-t border-border pt-4" />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Sentinel-Anfragen ({requests.filter((r) => r.status === "open").length} offen)
                </p>
                {requests.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">Noch keine Anfragen von Sentinels.</p>
                ) : (
                  <ul className="mt-4 divide-y divide-border border border-border bg-surface">
                    {requests.map((r) => {
                      const app = applicants[r.sentinel_id];
                      const expanded = expandedReq === r.id;
                      return (
                        <li key={r.id} className="px-5 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <button
                                onClick={() => setExpandedReq(expanded ? null : r.id)}
                                className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary"
                              >
                                {app?.full_name ?? "Bewerber:in"}
                                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                              </button>
                              {app && (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {app.region} · {app.experience_years} Jahre Erfahrung
                                  {app.status === "approved" && (
                                    <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">✓ vetted</span>
                                  )}
                                </p>
                              )}
                              {r.message && <p className="mt-1 text-xs text-muted-foreground">{r.message}</p>}
                              <span className="mt-1 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{r.status}</span>
                            </div>
                            <div className="flex gap-2">
                              {r.status === "open" && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => respond(r.id, "accepted")}><Check className="mr-1 h-3 w-3" /> Annehmen</Button>
                                  <Button size="sm" variant="ghost" onClick={() => respond(r.id, "declined")}><X className="mr-1 h-3 w-3" /> Ablehnen</Button>
                                </>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => removeRequest(r.id)} title="Anfrage löschen">
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
{expanded && app && (
                            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs">
                              <Meta label="Klarname" value={app.full_name} />
                              <Meta label="Kontakt" value={app.email} />
                              <Meta label="Region" value={app.region} />
                              <Meta label="Erfahrung" value={`${app.experience_years} Jahre`} />
                              <Meta label="Spezies-Fokus" value={app.species_focus ?? "—"} />
                              <Meta label="Kapazität gesamt" value={String(totalCapacity(parseCapacity(app.capacity)))} />
                              <Meta label="Bewerbung" value={new Date(app.created_at).toLocaleDateString("de-DE")} />
                              <Meta label="Status" value={app.status} />
                              <div className="col-span-2">
                                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Motivation</span>
                                <p className="mt-1 whitespace-pre-wrap text-foreground/85">{app.motivation}</p>
                              </div>
                            </dl>
                          )}
                          {expanded && !app && (
                            <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
                              Keine Bewerbungsdaten gefunden (Bewerber:in ohne Sentinel-Antrag).
                            </p>
                          )}
                        </li>
                      );
                    })}
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
      onSubmit={async (e) => {
        e.preventDefault();
        const regionValue = district ? `${district}, ${state}` : state;
        // ponytail: auto-geocode address via Photon on save (Nominatim blocks
        // browser requests per usage policy → coords stayed null → dead map).
        // Manual lat/lng fields below are the fallback knob.
        let glat = lat, glng = lng;
        if (!glat || !glng) {
          // Only send a coarse location to the geocoder. The exact address
          // stays in Supabase and is never sent to a third-party map service.
          const q = [district, state].filter(Boolean).join(", ");
          if (q) try {
            const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1`);
            const data = await res.json() as { features: { geometry: { coordinates: [number, number] } }[] };
            const coords = data.features?.[0]?.geometry?.coordinates;
            if (coords) { if (!glng) glng = String(coords[0]); if (!glat) glat = String(coords[1]); }
          } catch { /* geocode silent fail — manual fields below */ }
        }
        onSave({
          name,
          region: regionValue,
          address: address || null,
          contact_email: contactEmail || null,
          contact_phone: contactPhone || null,
          description: description || null,
          lat: glat ? Number(glat) : null,
          lng: glng ? Number(glng) : null,
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
      <div className="md:col-span-2 grid gap-5 sm:grid-cols-2">
        <div>
          <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Breitengrad (optional)</Label>
          <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="wird aus Adresse ermittelt" className="mt-2" inputMode="decimal" />
        </div>
        <div>
          <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Längengrad (optional)</Label>
          <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="wird aus Adresse ermittelt" className="mt-2" inputMode="decimal" />
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Leer lassen — die Koordinaten für die Karte werden beim Speichern automatisch aus der Adresse ermittelt. Nur eintragen, wenn der automatische Treffer falsch liegt.
        </p>
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

const Meta = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</dt>
    <dd className="mt-1 text-foreground/85">{value}</dd>
  </div>
);

export default Shelters;
