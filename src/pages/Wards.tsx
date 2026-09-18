import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { sniffImage, sniffDocument } from "@/lib/uploads";
import { SpeciesInput } from "@/components/SpeciesInput";
import { LoadingSnake } from "@/components/ui/loading-snake";
import { ShieldCheck, Lock, AlertTriangle, Plus, X, ImagePlus, Truck, FileCheck2, Pencil, Search } from "lucide-react";

type Ward = {
  id: string;
  owner_id: string;
  shelter_id: string | null;
  case_code: string;
  common_name: string;
  scientific_name: string | null;
  cites_listing: string | null;
  sex: string | null;
  age_estimate: string | null;
  size_estimate: string | null;
  origin_context: string | null;
  background: string;
  care_requirements: string;
  space_requirements: string;
  region: string | null;
  urgency: string;
  status: "available" | "under_review" | "placed" | "withdrawn";
  visibility: "vetted_only" | "admin_only";
  placement_type: "endstelle" | "pflegestelle";
  legal_custody: boolean;
  quarantine_status: "unknown" | "in_quarantine" | "quarantine_safe" | "suspected";
  quarantine_until: string | null;
  lab_report_path: string | null;
  images: string[];
  created_at: string;
};

type AccessState =
  | { kind: "loading" }
  | { kind: "anon" }
  | { kind: "no_application" }
  | { kind: "pending" }
  | { kind: "rejected" }
  | { kind: "error" }
  | { kind: "approved" };

type FormState = {
  case_code: string;
  common_name: string;
  scientific_name: string;
  cites_listing: string;
  sex: string;
  age_estimate: string;
  size_estimate: string;
  region: string;
  urgency: string;
  origin_context: string;
  background: string;
  care_requirements: string;
  space_requirements: string;
  assign_to: string;
  placement_type: "endstelle" | "pflegestelle";
  legal_custody: boolean;
  quarantine_status: "unknown" | "in_quarantine" | "quarantine_safe" | "suspected";
  quarantine_until: string;
};

const emptyForm: FormState = {
  case_code: "",
  common_name: "",
  scientific_name: "",
  cites_listing: "",
  sex: "",
  age_estimate: "",
  size_estimate: "",
  region: "",
  urgency: "standard",
  origin_context: "",
  background: "",
  care_requirements: "",
  space_requirements: "",
  assign_to: "",
  placement_type: "endstelle",
  legal_custody: false,
  quarantine_status: "unknown",
  quarantine_until: "",
};

const urgencyTone: Record<string, string> = {
  standard: "bg-muted text-muted-foreground",
  urgent: "bg-primary/15 text-primary",
  critical: "bg-destructive/15 text-destructive",
};

const urgencyLabel: Record<string, string> = {
  standard: "Standard",
  urgent: "Erhöht",
  critical: "Kritisch",
};

const statusLabel: Record<Ward["status"], string> = {
  available: "Verfügbar",
  under_review: "In Prüfung",
  placed: "Vermittelt",
  withdrawn: "Zurückgezogen",
};

const placementLabel: Record<Ward["placement_type"], string> = {
  endstelle: "Endstelle",
  pflegestelle: "Pflegestelle",
};

const quarantineLabel: Record<Ward["quarantine_status"], string> = {
  unknown: "Q unbekannt",
  in_quarantine: "Quarantäne",
  quarantine_safe: "Q-Safe",
  suspected: "Verdacht",
};

const quarantineTone: Record<Ward["quarantine_status"], string> = {
  unknown: "bg-muted text-muted-foreground",
  in_quarantine: "bg-warning/15 text-warning",
  quarantine_safe: "bg-success/15 text-success",
  suspected: "bg-destructive/15 text-destructive",
};

const TRANSPORT_CHECKLIST = ["Wärmepackung", "ISO/IATA-Box", "Tierarzt-Formular", "Isobox"];

type TransportLog = {
  id: string;
  ward_id: string;
  handler_id: string;
  from_location: string;
  to_location: string;
  mode: string;
  carrier: string;
  checklist: string[];
  notes: string;
  created_at: string;
};

const Wards = () => {
  const { user, isAdmin, isEinrichtung, loading: authLoading } = useAuth();
  const supabase = useExternalSupabase();
  const storage = supabase.storage;
  const { toast } = useToast();
  const [myShelterId, setMyShelterId] = useState<string | null>(null);
  const [access, setAccess] = useState<AccessState>({ kind: "loading" });
  const [wards, setWards] = useState<Ward[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Ward | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [interestOpen, setInterestOpen] = useState<string | null>(null);
  const [interestMessage, setInterestMessage] = useState("");
  const [interestConsult, setInterestConsult] = useState(false);
  const [detailOpen, setDetailOpen] = useState<string | null>(null);
  const [myInterests, setMyInterests] = useState<Set<string>>(new Set());
  const [interestStatus, setInterestStatus] = useState<Record<string, string>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "endstelle" | "pflegestelle" | "qsafe">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [wardsLoading, setWardsLoading] = useState(false);
  const [transports, setTransports] = useState<Record<string, TransportLog[]>>({});

  const PAGE_SIZE = 50;

  // Per-card quarantine editor state: { wardId: { status, until, labFile } }
  const [qEdit, setQEdit] = useState<Record<string, { status: Ward["quarantine_status"]; until: string; labFile: File | null }>>({});
  const [qBusy, setQBusy] = useState<string | null>(null);
  // Per-card transport form state
  const [tOpen, setTOpen] = useState<string | null>(null);
  const [tForm, setTForm] = useState({ from: "", to: "", mode: "", carrier: "", checklist: [] as string[], notes: "" });
  const [tBusy, setTBusy] = useState<string | null>(null);

  const myWards = useMemo(
    () => wards.filter((w) => user && w.owner_id === user.id),
    [wards, user],
  );

  useEffect(() => {
    document.title = "Wards · BioSteward";
  }, []);

  useEffect(() => {
    if (!isEinrichtung || !user) {
      setMyShelterId(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("shelters")
      .select("id")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setMyShelterId((data as { id: string } | null)?.id ?? null);
      });
    return () => { cancelled = true; };
  }, [isEinrichtung, user, supabase]);

  useEffect(() => {
    if (authLoading) return;
    setAccess({ kind: "loading" });
    if (!user) {
      setWards([]);
      setTransports({});
      setSignedUrls({});
      setPage(0);
      setHasMore(false);
      setAccess({ kind: "anon" });
      return;
    }
    if (isAdmin || isEinrichtung) { setAccess({ kind: "approved" }); return; }
    let cancelled = false;
    supabase
      .from("sentinel_applications")
      .select("status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) return setAccess({ kind: "error" });
        if (!data) return setAccess({ kind: "no_application" });
        if (data.status === "approved") return setAccess({ kind: "approved" });
        if (data.status === "rejected") return setAccess({ kind: "rejected" });
        return setAccess({ kind: "pending" });
      });
    return () => { cancelled = true; };
  }, [user, isAdmin, isEinrichtung, authLoading, supabase]);

  useEffect(() => {
    if (access.kind !== "approved" || !user) return;
    void loadWards();
    void loadMyInterests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access.kind, user?.id]);

  // Sign URLs whenever ward image paths change — only the paths the grid
  // actually renders (cover + 4 thumbs per ward), not entire galleries.
  useEffect(() => {
    const allPaths = Array.from(new Set(wards.flatMap((w) => (w.images ?? []).slice(0, 5))));
    const missing = allPaths.filter((p) => !signedUrls[p]);
    if (missing.length === 0) return;
    void (async () => {
      const { data, error } = await storage
        .from("ward-images")
        .createSignedUrls(missing, 60 * 60);
      if (error || !data) return;
      const next: Record<string, string> = {};
      data.forEach((d, i) => {
        if (d.signedUrl) next[missing[i]] = d.signedUrl;
      });
      setSignedUrls((prev) => ({ ...prev, ...next }));
    })();
  }, [wards, signedUrls, storage]);

  const loadWards = async (reset = false) => {
    setWardsLoading(true);
    try {
      const from = reset ? 0 : page * PAGE_SIZE;
      const { data, error } = await supabase
        .from("ward_listings")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        toast({ title: "Fehler beim Laden", description: error.message, variant: "destructive" });
        return;
      }
      const rows = (data ?? []) as Ward[];
      setWards(reset ? rows : (prev) => [...prev, ...rows]);
      if (reset) setPage(1);
      else setPage((p) => p + 1);
      setHasMore(rows.length === PAGE_SIZE);
      const ids = rows.map((w) => w.id);
      if (ids.length === 0) {
        if (reset) setTransports({});
        return;
      }
      const { data: tData } = await supabase
        .from("transport_logs")
        .select("*")
        .in("ward_id", ids)
        .order("created_at", { ascending: false });
      const map: Record<string, TransportLog[]> = {};
      (tData ?? []).forEach((t) => {
        (map[t.ward_id] ??= []).push(t as unknown as TransportLog);
      });
      setTransports(reset ? map : (prev) => ({ ...prev, ...map }));
    } finally {
      setWardsLoading(false);
    }
  };

  const loadMyInterests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("ward_interest")
      .select("ward_id, status")
      .eq("applicant_id", user.id);
    const ids = new Set<string>();
    const st: Record<string, string> = {};
    for (const r of data ?? []) { ids.add(r.ward_id); st[r.ward_id] = r.status; }
    setMyInterests(ids);
    setInterestStatus(st);
  };

  // Shared create/edit save: uploads new images, then inserts or updates.
  // keepImages contains existing gallery paths carried over from an edit.
  const saveWard = async (
    values: FormState,
    keptImages: string[],
    newFiles: File[],
  ) => {
    if (!user) return;
    setSubmitting(true);

    const uploadedPaths: string[] = [];
    const cleanupUploads = async () => {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from("ward-images").remove(uploadedPaths).catch(() => {});
      }
    };
    const removedImages = editTarget
      ? (editTarget.images ?? []).filter((path) => !keptImages.includes(path))
      : [];
    for (const file of newFiles) {
      const img = await sniffImage(file);
      if (!img) {
        setSubmitting(false);
        await cleanupUploads();
        toast({ title: "Ungültiges Bild", description: `${file.name}: nur JPG/PNG/WebP/GIF/AVIF bis 10 MB.`, variant: "destructive" });
        return;
      }
      const path = `${user.id}/${crypto.randomUUID()}.${img.ext}`;
      const { error: upErr } = await supabase.storage
        .from("ward-images")
        .upload(path, file, { contentType: img.mime, upsert: false });
      if (upErr) {
        setSubmitting(false);
        await cleanupUploads();
        toast({ title: "Bild-Upload fehlgeschlagen", description: upErr.message, variant: "destructive" });
        return;
      }
      uploadedPaths.push(path);
    }

    const payload = {
      // Staff (admin/shelter/gov) may assign the ward to an approved sentinel
      // via User-ID; default is keeping it with the creator (shelter stock).
      owner_id: values.assign_to.trim() || (editTarget ? editTarget.owner_id : user.id),
      shelter_id: editTarget ? editTarget.shelter_id : (isEinrichtung ? myShelterId : null),
      case_code: values.case_code.trim(),
      common_name: values.common_name.trim(),
      scientific_name: values.scientific_name.trim() || null,
      cites_listing: values.cites_listing || null,
      sex: values.sex.trim() || null,
      age_estimate: values.age_estimate.trim() || null,
      size_estimate: values.size_estimate.trim() || null,
      origin_context: values.origin_context.trim() || null,
      background: values.background.trim(),
      care_requirements: values.care_requirements.trim(),
      space_requirements: values.space_requirements.trim(),
      region: values.region.trim() || null,
      urgency: values.urgency || "standard",
      placement_type: values.placement_type,
      legal_custody: values.legal_custody,
      quarantine_status: values.quarantine_status,
      quarantine_until: values.quarantine_until ? new Date(values.quarantine_until).toISOString() : null,
      images: [...keptImages, ...uploadedPaths],
    };
    const { error } = editTarget
      ? await supabase.from("ward_listings").update(payload).eq("id", editTarget.id)
      : await supabase.from("ward_listings").insert(payload);
    setSubmitting(false);
    if (error) {
      // Remove orphaned uploads so a failed insert doesn't leak storage.
      await cleanupUploads();
      toast({ title: "Konnte nicht speichern", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editTarget ? "Ward aktualisiert" : "Ward eingestellt", description: "Sichtbar nur für vetted Stewards." });
    setShowForm(false);
    setEditTarget(null);
    if (removedImages.length > 0) {
      await storage.from("ward-images").remove(removedImages).catch(() => {});
    }
    void loadWards(true);
  };

  const submitInterest = async (wardId: string) => {
    if (!user || !interestMessage.trim()) return;
    const { error } = await supabase.from("ward_interest").insert({
      ward_id: wardId,
      applicant_id: user.id,
      message: interestMessage.trim(),
      consultation_requested: interestConsult,
    });
    if (error) {
      toast({ title: "Bekundung fehlgeschlagen", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Interesse eingereicht", description: "Die Einrichtung kann die Bekundung nun bestätigen oder ablehnen." });
    setInterestOpen(null);
    setInterestMessage("");
    setInterestConsult(false);
    void loadMyInterests();
  };

  // Outcome recording: owner/admin sets the ward's status. The change_log
  // trigger on ward_listings writes the audit entry automatically.
  const setWardStatus = async (id: string, status: Ward["status"]) => {
    if (status === "withdrawn" && !window.confirm("Ward wirklich zurückziehen? Der Vorgang wird protokolliert.")) return;
    const { error } = await supabase.from("ward_listings").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Status fehlgeschlagen", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Status aktualisiert", description: statusLabel[status] });
    setWards((prev) => prev.map((w) => (w.id === id ? { ...w, status } : w)));
  };

  // Quarantine editor: status + until + optional lab report (PDF/image).
  const saveQuarantine = async (wardId: string) => {
    const e = qEdit[wardId];
    if (!e || !user) return;
    setQBusy(wardId);
    const previousLabReportPath = wards.find((w) => w.id === wardId)?.lab_report_path;
    let labReportPath: string | null = null;
    const quarantineUntil = e.until ? new Date(e.until).toISOString() : null;
    try {
      if (e.labFile) {
        const sniffed = await sniffDocument(e.labFile);
        if (!sniffed) throw new Error("Nur PDF/JPG/PNG/WebP/GIF/AVIF bis 10 MB.");
        const path = `${user.id}/${wardId}/${crypto.randomUUID()}.${sniffed.ext}`;
        const { error: upErr } = await storage
          .from("lab-docs")
          .upload(path, e.labFile, { contentType: sniffed.mime, upsert: false });
        if (upErr) throw new Error(`Labornachweis-Upload: ${upErr.message}`);
        labReportPath = path;
      }
      const { error } = await supabase.from("ward_listings").update({
        quarantine_status: e.status,
        quarantine_until: quarantineUntil,
        ...(labReportPath ? { lab_report_path: labReportPath } : {}),
      }).eq("id", wardId);
      if (error) throw error;
      toast({ title: "Quarantäne-Status gespeichert" });
      setWards((prev) => prev.map((w) => (w.id === wardId
        ? {
            ...w,
            quarantine_status: e.status,
            quarantine_until: quarantineUntil,
            ...(labReportPath ? { lab_report_path: labReportPath } : {}),
          }
        : w)));
      setQEdit((p) => { const { [wardId]: _removed, ...rest } = p; return rest; });
      if (previousLabReportPath && labReportPath && previousLabReportPath !== labReportPath) {
        await storage.from("lab-docs").remove([previousLabReportPath]).catch(() => {});
      }
    } catch (err) {
      if (labReportPath) {
        await storage.from("lab-docs").remove([labReportPath]).catch(() => {});
      }
      toast({ title: "Speichern fehlgeschlagen", description: (err as Error).message, variant: "destructive" });
    } finally {
      setQBusy(null);
    }
  };

  // Transport documentation (evidence chain entry, append-only).
  const addTransport = async (wardId: string) => {
    if (!user || !tForm.from || !tForm.to) return;
    setTBusy(wardId);
    const { data, error } = await supabase.from("transport_logs").insert({
      ward_id: wardId,
      handler_id: user.id,
      from_location: tForm.from.trim(),
      to_location: tForm.to.trim(),
      mode: tForm.mode.trim(),
      carrier: tForm.carrier.trim(),
      checklist: tForm.checklist,
      notes: tForm.notes.trim(),
    }).select("*").single();
    setTBusy(null);
    if (error) {
      toast({ title: "Transport konnte nicht dokumentiert werden", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Transport dokumentiert", description: "Eintrag ist Teil der Beweiskette." });
    setTOpen(null);
    setTForm({ from: "", to: "", mode: "", carrier: "", checklist: [], notes: "" });
    if (data) {
      setTransports((prev) => ({
        ...prev,
        [wardId]: [data as unknown as TransportLog, ...(prev[wardId] ?? [])],
      }));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container py-16 lg:py-24">
        <div className="max-w-3xl">
          <span className="eyebrow">§ Wards · Vetted Disclosure</span>
          <h1 className="font-editorial mt-4 text-5xl leading-[1.02] md:text-6xl">
            Tiere, die einen <em className="italic text-primary">Steward</em> brauchen.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            Dies ist <strong className="text-foreground">kein Marktplatz</strong>, keine öffentliche Anzeige
            und keine Vermittlungsbörse. Tierprofile werden ausschließlich an
            geprüfte, qualifizierte Privathalter offengelegt — nach
            Sentinel-Prüfung, Sachkundenachweis und Platzbewertung. Vergabe vor Zoo,
            wo immer fachlich vertretbar.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <span className="border border-border px-3 py-1.5">Vetted-Only</span>
            <span className="border border-border px-3 py-1.5">Kein Handel</span>
            <span className="border border-border px-3 py-1.5">Kein Status</span>
            <span className="border border-border px-3 py-1.5">Reversibel</span>
          </div>
        </div>

        <div className="mt-16">
          {access.kind === "loading" && (
            <div className="flex justify-center">
              <LoadingSnake label="Prüfe Zugang" compact />
            </div>
          )}

          {access.kind === "anon" && (
            <Gate
              icon={Lock}
              title="Anmeldung erforderlich"
              body="Ward-Profile sind grundsätzlich nicht öffentlich. Melde dich an, um deine Eignung als qualifizierter Privathalter prüfen zu lassen."
              cta={{ label: "Anmelden / Registrieren", to: "/auth" }}
            />
          )}

          {access.kind === "no_application" && (
            <Gate
              icon={ShieldCheck}
              title="Sentinel-Pfad starten"
              body="Wards werden nur an geprüfte Stewards vergeben. Reiche zuerst einen Sentinel-Antrag mit Sachkundenachweis und Platzbewertung ein."
              cta={{ label: "Sentinel-Pfad starten", to: "/sentinel" }}
            />
          )}

          {access.kind === "pending" && (
            <Gate
              icon={ShieldCheck}
              title="Antrag in Prüfung"
              body="Dein Sentinel-Antrag wird noch geprüft. Sobald freigegeben, wird dieser Bereich automatisch sichtbar."
            />
          )}

          {access.kind === "rejected" && (
            <Gate
              icon={AlertTriangle}
              title="Kein Zugang"
              body="Auf Basis deines aktuellen Antrags konnte kein Steward-Status vergeben werden. Du kannst dich bei geänderten Voraussetzungen erneut bewerben."
              cta={{ label: "Werte & FAQ", to: "/werte" }}
            />
          )}

          {access.kind === "error" && (
            <Gate
              icon={AlertTriangle}
              title="Zugang konnte nicht geprüft werden"
              body="Der Zugangsdienst ist momentan nicht erreichbar. Bitte lade die Seite später erneut."
            />
          )}

          {access.kind === "approved" && (
            <ApprovedView
              wards={wards}
              myWards={myWards}
              currentUserId={user!.id}
              isAdmin={isAdmin}
              canCreate={isAdmin || isEinrichtung}
              myInterests={myInterests}
              interestStatus={interestStatus}
              showForm={showForm}
              editTarget={editTarget}
              openCreate={() => { setEditTarget(null); setShowForm(true); }}
              openEdit={(w) => { setEditTarget(w); setShowForm(true); }}
              closeForm={() => { setShowForm(false); setEditTarget(null); }}
              submitting={submitting}
              saveWard={saveWard}
              signedUrls={signedUrls}
              interestOpen={interestOpen}
              setInterestOpen={setInterestOpen}
              interestMessage={interestMessage}
              setInterestMessage={setInterestMessage}
              interestConsult={interestConsult}
              setInterestConsult={setInterestConsult}
              detailOpen={detailOpen}
              setDetailOpen={setDetailOpen}
              submitInterest={submitInterest}
              setWardStatus={setWardStatus}
              filter={filter}
              setFilter={setFilter}
              search={search}
              setSearch={setSearch}
              wardsLoading={wardsLoading}
              hasMore={hasMore}
              loadMore={() => void loadWards(false)}
              qEdit={qEdit}
              setQEdit={setQEdit}
              qBusy={qBusy}
              saveQuarantine={saveQuarantine}
              transports={transports}
              tOpen={tOpen}
              setTOpen={setTOpen}
              tForm={tForm}
              setTForm={setTForm}
              tBusy={tBusy}
              addTransport={addTransport}
            />
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

const Gate = ({
  icon: Icon,
  title,
  body,
  cta,
}: {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
  cta?: { label: string; to: string };
}) => (
  <div className="border border-border bg-surface p-10">
    <div className="flex items-start gap-5">
      <Icon className="h-6 w-6 shrink-0 text-primary" />
      <div className="max-w-xl">
        <h2 className="font-display text-2xl">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
        {cta && (
          <Button asChild className="mt-6">
            <Link to={cta.to}>{cta.label}</Link>
          </Button>
        )}
      </div>
    </div>
  </div>
);

type ApprovedViewProps = {
  wards: Ward[];
  myWards: Ward[];
  currentUserId: string;
  isAdmin: boolean;
  canCreate: boolean;
  myInterests: Set<string>;
  interestStatus: Record<string, string>;
  showForm: boolean;
  editTarget: Ward | null;
  openCreate: () => void;
  openEdit: (w: Ward) => void;
  closeForm: () => void;
  submitting: boolean;
  saveWard: (values: FormState, keptImages: string[], newFiles: File[]) => Promise<void>;
  signedUrls: Record<string, string>;
  interestOpen: string | null;
  setInterestOpen: (v: string | null) => void;
  interestMessage: string;
  setInterestMessage: (v: string) => void;
  interestConsult: boolean;
  setInterestConsult: (v: boolean) => void;
  detailOpen: string | null;
  setDetailOpen: (v: string | null) => void;
  submitInterest: (id: string) => void;
  setWardStatus: (id: string, status: Ward["status"]) => void;
  filter: "all" | "endstelle" | "pflegestelle" | "qsafe";
  setFilter: (f: "all" | "endstelle" | "pflegestelle" | "qsafe") => void;
  search: string;
  setSearch: (v: string) => void;
  wardsLoading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  qEdit: Record<string, { status: Ward["quarantine_status"]; until: string; labFile: File | null }>;
  setQEdit: React.Dispatch<React.SetStateAction<Record<string, { status: Ward["quarantine_status"]; until: string; labFile: File | null }>>>;
  qBusy: string | null;
  saveQuarantine: (wardId: string) => void;
  transports: Record<string, TransportLog[]>;
  tOpen: string | null;
  setTOpen: (v: string | null) => void;
  tForm: { from: string; to: string; mode: string; carrier: string; checklist: string[]; notes: string };
  setTForm: React.Dispatch<React.SetStateAction<{ from: string; to: string; mode: string; carrier: string; checklist: string[]; notes: string }>>;
  tBusy: string | null;
  addTransport: (wardId: string) => void;
};

const ApprovedView = ({
  wards, myWards, currentUserId, isAdmin, canCreate, myInterests, interestStatus,
  showForm, editTarget, openCreate, openEdit, closeForm, submitting, saveWard, signedUrls,
  interestOpen, setInterestOpen, interestMessage, setInterestMessage, interestConsult, setInterestConsult, detailOpen, setDetailOpen, submitInterest, setWardStatus,
  filter, setFilter, search, setSearch, wardsLoading, hasMore, loadMore,
  qEdit, setQEdit, qBusy, saveQuarantine,
  transports, tOpen, setTOpen, tForm, setTForm, tBusy, addTransport,
}: ApprovedViewProps) => {
  const q = search.trim().toLowerCase();
  const visibleWards = wards.filter((w) =>
    (filter === "all" ? true
      : filter === "qsafe" ? w.quarantine_status === "quarantine_safe"
      : w.placement_type === filter) &&
    (!q || w.common_name.toLowerCase().includes(q) || (w.case_code ?? "").toLowerCase().includes(q) ||
      (w.scientific_name ?? "").toLowerCase().includes(q) || (w.region ?? "").toLowerCase().includes(q)),
  );

  useEffect(() => {
    if (!detailOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailOpen(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [detailOpen, setDetailOpen]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
            Steward-Zugang aktiv
          </p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {visibleWards.length} von {wards.length} {wards.length === 1 ? "Ward" : "Wards"} · vertraulich
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => (showForm ? closeForm() : openCreate())} variant={showForm ? "outline" : "default"}>
            <Plus className="mr-1 h-4 w-4" />
            {showForm ? "Abbrechen" : "Ward einstellen"}
          </Button>
        )}
      </div>

      {canCreate && showForm && (
        <WardForm
          key={editTarget?.id ?? "new"}
          ward={editTarget}
          myWards={myWards}
          submitting={submitting}
          signedUrls={signedUrls}
          onSubmit={saveWard}
          onCancel={closeForm}
        />
      )}

      <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-px bg-border" role="group" aria-label="Ward-Filter">
          {([
            ["all", "Alle"],
            ["endstelle", "Endstelle"],
            ["pflegestelle", "Pflegestelle"],
            ["qsafe", "Q-Safe"],
          ] as const).map(([k, lbl]) => (
            <button key={k} type="button" onClick={() => setFilter(k)}
              aria-pressed={filter === k}
              className={`flex-1 px-4 py-2 text-center font-mono text-[10px] uppercase tracking-[0.22em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:flex-none md:text-left ${
                filter === k ? "bg-surface-elevated text-primary" : "bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >{lbl}</button>
          ))}
        </div>
        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche: Name, Case-Code, Region …"
            className="pl-9"
            aria-label="Wards durchsuchen"
          />
        </div>
      </div>

      <div className="mt-10 grid gap-px bg-border md:grid-cols-2" aria-busy={wardsLoading}>
        {wardsLoading && wards.length === 0 && (
          <div className="flex justify-center bg-background p-10 md:col-span-2">
            <LoadingSnake label="Lade Wards" compact />
          </div>
        )}
        {!wardsLoading && wards.length === 0 && (
          <div className="bg-background p-10 text-sm text-muted-foreground md:col-span-2">
            Aktuell sind keine Wards offen.
          </div>
        )}
        {!wardsLoading && visibleWards.length === 0 && wards.length > 0 && (
          <div className="bg-background p-10 text-sm text-muted-foreground md:col-span-2">
            Keine Wards in dieser Filterkategorie.
          </div>
        )}
        {visibleWards.map((w) => {
          const owned = w.owner_id === currentUserId;
          const expressed = myInterests.has(w.id);
          const cover = (w.images ?? [])[0];
          return (
            <article key={w.id} className="bg-background p-6 transition-colors hover:bg-surface">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setDetailOpen(w.id)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDetailOpen(w.id);
                  }
                }}
                className="cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={`${w.common_name} Details ansehen`}
                aria-expanded={detailOpen === w.id}
                aria-controls={`ward-detail-${w.id}`}
              >
                <div className="flex items-start gap-4">
                  <div className="relative h-20 w-28 shrink-0 overflow-hidden border border-border bg-muted">
                    {cover ? (signedUrls[cover]
                      ? <img src={signedUrls[cover]} alt={w.common_name} loading="lazy" className="h-full w-full object-cover" />
                      : <div className="h-full w-full animate-pulse bg-muted" />)
                      : <div className="flex h-full w-full items-center justify-center text-muted-foreground"><ImagePlus className="h-5 w-5" /></div>}
                    {(w.images?.length ?? 0) > 1 && (
                      <span className="absolute bottom-1 right-1 bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-white">+{w.images.length - 1}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      {w.case_code} · {statusLabel[w.status]}
                    </p>
                    <h3 className="font-display mt-1 text-xl leading-tight transition-colors hover:text-primary">{w.common_name}</h3>
                    {w.scientific_name && (
                      <p className="mt-0.5 text-xs italic text-muted-foreground">
                        {w.scientific_name}
                        {w.cites_listing && (
                          <span className="ml-2 not-italic font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                            CITES {w.cites_listing}
                          </span>
                        )}
                      </p>
                    )}
                    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {w.sex && <Meta label="Geschl." value={w.sex} />}
                      {w.age_estimate && <Meta label="Alter" value={w.age_estimate} />}
                      {w.size_estimate && <Meta label="Maße" value={w.size_estimate} />}
                      {w.region && <Meta label="Region" value={w.region} />}
                    </dl>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge className={urgencyTone[w.urgency] ?? urgencyTone.standard}>{urgencyLabel[w.urgency] ?? w.urgency}</Badge>
                    {(owned || isAdmin) && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openEdit(w); }}
                        className="flex items-center gap-1 border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition hover:border-primary hover:text-primary"
                        aria-label={`${w.common_name} bearbeiten`}
                      >
                        <Pencil className="h-3 w-3" /> Bearbeiten
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className={`inline-block border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] ${
                    w.placement_type === "pflegestelle" ? "border-warning/40 bg-warning/10 text-warning" : "border-border bg-muted text-muted-foreground"
                  }`}>
                    {placementLabel[w.placement_type]}
                  </span>
                  {w.legal_custody && (
                    <span className="inline-block border border-warning/40 bg-warning/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-warning">
                      Amtliche Verwahrung
                    </span>
                  )}
                  <span className={`inline-block border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] ${quarantineTone[w.quarantine_status]}`}>
                    {quarantineLabel[w.quarantine_status]}
                    {w.quarantine_status === "in_quarantine" && w.quarantine_until && (
                      <span className="normal-case"> bis {new Date(w.quarantine_until).toLocaleDateString("de-DE")}</span>
                    )}
                  </span>
                  {w.lab_report_path && (
                    <span className="inline-flex items-center gap-1 border border-border bg-muted px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                      <FileCheck2 className="h-2.5 w-2.5 text-success" /> Laborbefund
                    </span>
                  )}
                </div>
              </div>

              {detailOpen === w.id && (
                <div
                  className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 md:p-8"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={`ward-detail-${w.id}`}
                  onClick={() => setDetailOpen(null)}
                >
                  <div className="w-full max-w-3xl border border-border bg-background" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                          {w.case_code} · {statusLabel[w.status]}
                        </p>
                        <h3 id={`ward-detail-${w.id}`} className="font-display mt-1 text-2xl leading-tight">{w.common_name}</h3>
                        {w.scientific_name && (
                          <p className="mt-1 text-xs italic text-muted-foreground">
                            {w.scientific_name}
                            {w.cites_listing && (
                              <span className="ml-2 not-italic font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                                CITES {w.cites_listing}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <Badge className={urgencyTone[w.urgency] ?? urgencyTone.standard}>{urgencyLabel[w.urgency] ?? w.urgency}</Badge>
                        <button
                          type="button"
                          onClick={() => setDetailOpen(null)}
                          className="flex h-8 w-8 items-center justify-center border border-border text-muted-foreground hover:border-primary hover:text-primary"
                          aria-label="Schließen"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="max-h-[72vh] overflow-y-auto p-6">
                      {w.images.length > 0 && (
                        <div className="mb-6 grid gap-2 sm:grid-cols-2">
                          {w.images.slice(0, 5).map((p, i) => (
                            <div key={p} className={`aspect-[16/10] overflow-hidden border border-border bg-muted ${i === 0 ? "sm:col-span-2" : ""}`}>
                              {signedUrls[p]
                                ? <img src={signedUrls[p]} alt={w.common_name} loading="lazy" className="h-full w-full object-cover" />
                                : <div className="h-full w-full animate-pulse bg-muted" />}
                            </div>
                          ))}
                          {w.images.length > 5 && (
                            <p className="text-xs text-muted-foreground">+{w.images.length - 5} weitere Fotos</p>
                          )}
                        </div>
                      )}
                      <Section label="Vorgeschichte" body={w.background} />
                      <Section label="Pflege" body={w.care_requirements} />
                      <Section label="Platz" body={w.space_requirements} />

              {(owned || isAdmin) && (
                <div className="mt-6 border border-border bg-surface p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    Quarantäne &amp; Laborbefund
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Quarantäne und Laborbefund werden hier für die Übergabe dokumentiert.
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <select
                      value={qEdit[w.id]?.status ?? w.quarantine_status}
                      onChange={(e) => setQEdit((p) => ({
                        ...p,
                        [w.id]: { status: e.target.value as Ward["quarantine_status"], until: p[w.id]?.until ?? w.quarantine_until?.slice(0, 10) ?? "", labFile: p[w.id]?.labFile ?? null },
                      }))}
                      className="h-9 border border-border bg-background px-2 text-xs"
                      aria-label="Quarantäne-Status ändern"
                    >
                      {Object.entries(quarantineLabel).map(([v, lbl]) => (
                        <option key={v} value={v}>{lbl}</option>
                      ))}
                    </select>
                    {(qEdit[w.id]?.status ?? w.quarantine_status) === "in_quarantine" && (
                      <Input
                        type="date"
                        value={qEdit[w.id]?.until ?? w.quarantine_until?.slice(0, 10) ?? ""}
                        onChange={(e) => setQEdit((p) => ({ ...p, [w.id]: { status: p[w.id]?.status ?? w.quarantine_status, until: e.target.value, labFile: p[w.id]?.labFile ?? null } }))}
                        className="h-9 text-xs"
                      />
                    )}
                    <label className="flex h-9 cursor-pointer items-center justify-center gap-2 border border-dashed border-border bg-background text-xs text-muted-foreground hover:border-primary hover:text-primary transition">
                      {qEdit[w.id]?.labFile?.name ?? "Labornachweis (PDF) …"}
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          setQEdit((p) => ({ ...p, [w.id]: { status: p[w.id]?.status ?? w.quarantine_status, until: p[w.id]?.until ?? w.quarantine_until?.slice(0, 10) ?? "", labFile: f } }));
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <Button
                    size="sm"
                    className="mt-3"
                    disabled={qBusy === w.id}
                    onClick={() => saveQuarantine(w.id)}
                  >
                    {qBusy === w.id ? "Speichere …" : "Quarantäne-Status speichern"}
                  </Button>
                </div>
              )}

              <div className="mt-6 border border-border bg-surface p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground flex items-center gap-2">
                  <Truck className="h-3.5 w-3.5" /> Transporte (Beweiskette)
                </p>
                {(transports[w.id] ?? []).length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">Noch kein Transport dokumentiert.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {(transports[w.id] ?? []).map((t) => (
                      <li key={t.id} className="border-l-2 border-primary/40 pl-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                            {t.from_location || "?"} → {t.to_location || "?"}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {new Date(t.created_at).toLocaleString("de-DE")}
                          </span>
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          {[t.mode, t.carrier, t.checklist.length > 0 ? `Checkliste: ${t.checklist.join(", ")}` : "", t.notes]
                            .filter(Boolean).join(" · ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                {(owned || isAdmin) && (
                  <div className="mt-3">
                    {tOpen === w.id ? (
                      <div className="grid gap-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Von (Ort)" value={tForm.from} onChange={(e) => setTForm((p) => ({ ...p, from: e.target.value }))} className="h-8 text-xs" />
                          <Input placeholder="Nach (Ort)" value={tForm.to} onChange={(e) => setTForm((p) => ({ ...p, to: e.target.value }))} className="h-8 text-xs" />
                          <Input placeholder="Transportart (z. B. zert. Kurier)" value={tForm.mode} onChange={(e) => setTForm((p) => ({ ...p, mode: e.target.value }))} className="h-8 text-xs" />
                          <Input placeholder="Ausführender / Firma" value={tForm.carrier} onChange={(e) => setTForm((p) => ({ ...p, carrier: e.target.value }))} className="h-8 text-xs" />
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {TRANSPORT_CHECKLIST.map((c) => (
                            <label key={c} className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 accent-primary"
                                checked={tForm.checklist.includes(c)}
                                onChange={(e) => setTForm((p) => ({
                                  ...p,
                                  checklist: e.target.checked ? [...p.checklist, c] : p.checklist.filter((x) => x !== c),
                                }))}
                              />
                              {c}
                            </label>
                          ))}
                        </div>
                        <Input placeholder="Notizen (Temp, Dokumente …)" value={tForm.notes} onChange={(e) => setTForm((p) => ({ ...p, notes: e.target.value }))} className="h-8 text-xs" />
                        <div className="flex gap-2">
                          <Button size="sm" disabled={tBusy === w.id || !tForm.from || !tForm.to} onClick={() => addTransport(w.id)}>
                            {tBusy === w.id ? "Speichere …" : "Transport dokumentieren"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setTOpen(null); setTForm({ from: "", to: "", mode: "", carrier: "", checklist: [], notes: "" }); }}>
                            Abbrechen
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setTOpen(w.id)}>
                        <Truck className="mr-1 h-3.5 w-3.5" /> Transport dokumentieren
                      </Button>
                    )}
                  </div>
                )}
              </div>

                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-5">
                {owned || isAdmin ? (
                  <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    {owned ? "Du betreust diesen Ward ·" : "Admin ·"} Outcome
                    <select
                      value={w.status}
                      onChange={(e) => setWardStatus(w.id, e.target.value as Ward["status"])}
                      className="h-8 border border-border bg-background px-2 text-xs normal-case tracking-normal text-foreground"
                      aria-label="Ward-Status ändern"
                    >
                      {Object.entries(statusLabel).map(([v, lbl]) => (
                        <option key={v} value={v}>{lbl}</option>
                      ))}
                    </select>
                  </label>
                ) : expressed ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    {interestStatus[w.id] === "matched" ? "Interesse bestätigt ✓" :
                     interestStatus[w.id] === "declined" ? "Interesse abgelehnt" :
                     interestStatus[w.id] === "withdrawn" ? "Interesse zurückgezogen" :
                     "Interesse bekundet · in Prüfung"}
                  </span>
                ) : w.status === "available" ? (
                  interestOpen === w.id ? (
                    <div className="w-full">
                      <Textarea
                        value={interestMessage}
                        onChange={(e) => setInterestMessage(e.target.value)}
                        placeholder="Erfahrung, Haltungssituation, geplante Unterbringung, Zeitfenster …"
                        rows={4}
                      />
                      <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-3.5 w-3.5 accent-primary"
                          checked={interestConsult}
                          onChange={(e) => setInterestConsult(e.target.checked)}
                        />
                        <span>Ich wünsche einen Termin für ein Beratungsgespräch.</span>
                      </label>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" disabled={!interestMessage.trim()} onClick={() => submitInterest(w.id)}>Bekundung senden</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setInterestOpen(null); setInterestMessage(""); setInterestConsult(false); }}>
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => { setInterestOpen(w.id); setInterestMessage(""); setInterestConsult(false); }}>
                      {w.placement_type === "pflegestelle"
                        ? "Als amtlicher Verwahrer bewerben"
                        : "Interesse als Steward bekunden"}
                    </Button>
                  )
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    {statusLabel[w.status]}
                  </span>
                )}
              </div>
            </article>
          );
        })}
        <div className="hidden bg-background md:block" aria-hidden="true" />
      </div>

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <Button variant="outline" disabled={wardsLoading} onClick={loadMore}>
            {wardsLoading ? "Lade Wards …" : "Weitere Wards laden"}
          </Button>
        </div>
      )}
    </>
  );
};

// Self-contained create/edit form. Owns its draft state so typing in it
// never re-renders the wards grid (previously every keystroke re-rendered
// all cards, regenerating the visible filter + signing effects).
const WardForm = ({
  ward, myWards, submitting, signedUrls, onSubmit, onCancel,
}: {
  ward: Ward | null;
  myWards: Ward[];
  submitting: boolean;
  signedUrls: Record<string, string>;
  onSubmit: (values: FormState, keptImages: string[], newFiles: File[]) => Promise<void>;
  onCancel: () => void;
}) => {
  const [form, setForm] = useState<FormState>(
    ward ? {
      case_code: ward.case_code,
      common_name: ward.common_name,
      scientific_name: ward.scientific_name ?? "",
      cites_listing: ward.cites_listing ?? "",
      sex: ward.sex ?? "",
      age_estimate: ward.age_estimate ?? "",
      size_estimate: ward.size_estimate ?? "",
      region: ward.region ?? "",
      urgency: ward.urgency,
      origin_context: ward.origin_context ?? "",
      background: ward.background,
      care_requirements: ward.care_requirements,
      space_requirements: ward.space_requirements,
      assign_to: "",
      placement_type: ward.placement_type,
      legal_custody: ward.legal_custody,
      quarantine_status: ward.quarantine_status,
      quarantine_until: ward.quarantine_until?.slice(0, 10) ?? "",
    } : emptyForm,
  );
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [carriedImages, setCarriedImages] = useState<string[]>(ward?.images ?? []);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // Object URLs live exactly as long as their File in pendingImages —
  // creating them during render leaks a URL per render.
  useEffect(() => {
    const urls = pendingImages.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [pendingImages]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const prefillFromWard = (id: string) => {
    const w = myWards.find((x) => x.id === id);
    if (!w) return;
    setForm({
      case_code: w.case_code,
      common_name: w.common_name,
      scientific_name: w.scientific_name ?? "",
      cites_listing: w.cites_listing ?? "",
      sex: w.sex ?? "",
      age_estimate: w.age_estimate ?? "",
      size_estimate: w.size_estimate ?? "",
      region: w.region ?? "",
      urgency: w.urgency,
      origin_context: w.origin_context ?? "",
      background: w.background,
      care_requirements: w.care_requirements,
      space_requirements: w.space_requirements,
      assign_to: "",
      placement_type: w.placement_type,
      legal_custody: w.legal_custody,
      quarantine_status: w.quarantine_status,
      quarantine_until: w.quarantine_until?.slice(0, 10) ?? "",
    });
    setCarriedImages(w.images ?? []);
    setPendingImages([]);
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setPendingImages((p) => [...p, ...files]);
    e.target.value = "";
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void onSubmit(form, carriedImages, pendingImages); }}
      className="mt-8 grid gap-5 border border-border bg-surface p-8 md:grid-cols-2"
    >
      {myWards.length > 0 && !ward && (
        <div className="md:col-span-2 border border-dashed border-border bg-background p-5">
          <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Aus eigenen Wards übernehmen
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Wähle einen deiner bestehenden Wards — Felder & Bilder werden automatisch übernommen.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {myWards.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => prefillFromWard(w.id)}
                className="border border-border px-3 py-2 text-left text-xs hover:border-primary hover:bg-primary/5 transition"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {w.case_code}
                </span>
                <span className="block text-foreground">{w.common_name}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setForm(emptyForm); setCarriedImages([]); setPendingImages([]); }}
              className="border border-border px-3 py-2 text-xs text-muted-foreground hover:border-destructive hover:text-destructive transition"
            >
              Felder leeren
            </button>
          </div>
        </div>
      )}

      <Field label="Case-Code" required value={form.case_code} onChange={(v) => update("case_code", v)} placeholder="WARD-2026-001" />
      <Field label="Bezeichnung" required value={form.common_name} onChange={(v) => update("common_name", v)} placeholder="Bartagame, weiblich" />
      <SpeciesInput
        value={form.scientific_name}
        onChange={(v) => update("scientific_name", v)}
        onListingChange={(l) => update("cites_listing", l)}
      />
      <Field label="Geschlecht" value={form.sex} onChange={(v) => update("sex", v)} placeholder="weiblich / männlich / unbekannt" />
      <Field label="Alter (geschätzt)" value={form.age_estimate} onChange={(v) => update("age_estimate", v)} placeholder="ca. 6 Jahre" />
      <Field label="Größe / Gewicht" value={form.size_estimate} onChange={(v) => update("size_estimate", v)} placeholder="48 cm / 420 g" />
      <Field label="Standortregion" value={form.region} onChange={(v) => update("region", v)} placeholder="DE-Süd, AT, …" />

      <div>
        <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Dringlichkeit
        </Label>
        <select
          value={form.urgency}
          onChange={(e) => update("urgency", e.target.value)}
          className="mt-2 h-10 w-full border border-border bg-background px-3 text-sm"
          aria-label="Dringlichkeit"
        >
          <option value="standard">Standard</option>
          <option value="urgent">Erhöht</option>
          <option value="critical">Kritisch</option>
        </select>
      </div>

      <div>
        <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Vermittlungsart
        </Label>
        <select
          value={form.placement_type}
          onChange={(e) => update("placement_type", e.target.value as FormState["placement_type"])}
          className="mt-2 h-10 w-full border border-border bg-background px-3 text-sm"
          aria-label="Vermittlungsart"
        >
          <option value="endstelle">Endstelle gesucht (Übereignung)</option>
          <option value="pflegestelle">Pflegestelle gesucht (Tier bleibt Eigentum des Staates)</option>
        </select>
      </div>

      <div>
        <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Quarantäne-Status
        </Label>
        <select
          value={form.quarantine_status}
          onChange={(e) => update("quarantine_status", e.target.value as FormState["quarantine_status"])}
          className="mt-2 h-10 w-full border border-border bg-background px-3 text-sm"
          aria-label="Quarantäne-Status"
        >
          <option value="unknown">Unbekannt</option>
          <option value="in_quarantine">In Quarantäne</option>
          <option value="quarantine_safe">Quarantäne-Safe (neg. Laborbefund)</option>
          <option value="suspected">Verdacht / erkrankt</option>
        </select>
        {form.quarantine_status === "in_quarantine" && (
          <div className="mt-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Quarantäne bis
            </Label>
            <Input
              type="date"
              value={form.quarantine_until}
              onChange={(e) => update("quarantine_until", e.target.value)}
              className="mt-1"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 self-end">
        <label className="flex cursor-pointer items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <input
            type="checkbox"
            checked={form.legal_custody}
            onChange={(e) => update("legal_custody", e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Amtliche Verwahrung (Tier bleibt Eigentum des Staates)
        </label>
      </div>

      <TextField label="Hintergrund / Herkunft (intern)" value={form.origin_context} onChange={(v) => update("origin_context", v)} />
      <TextField label="Vorgeschichte & Verhalten" required value={form.background} onChange={(v) => update("background", v)} />
      <TextField label="Pflegeanforderungen" required value={form.care_requirements} onChange={(v) => update("care_requirements", v)} />
      <TextField label="Platz- & Haltungsanforderungen" required value={form.space_requirements} onChange={(v) => update("space_requirements", v)} />

      <div className="md:col-span-2">
        <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Bilder (vetted-only sichtbar)
        </Label>
        <div className="mt-3 flex flex-wrap gap-3">
          {carriedImages.map((path) => (
            <div key={path} className="relative h-24 w-24 overflow-hidden border border-border bg-background">
              {signedUrls[path]
                ? <img src={signedUrls[path]} alt="Tierfoto Vorschau" className="h-full w-full object-cover" />
                : <div className="h-full w-full animate-pulse bg-muted" />}
              <button
                type="button"
                onClick={() => setCarriedImages((p) => p.filter((x) => x !== path))}
                className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground hover:bg-destructive hover:text-destructive-foreground"
                aria-label="Bild entfernen"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {pendingImages.map((_file, i) => (
            <div key={i} className="relative h-24 w-24 overflow-hidden border border-primary/40 bg-background">
              {previewUrls[i] && <img src={previewUrls[i]} alt="Tierfoto Vorschau" className="h-full w-full object-cover" />}
              <button
                type="button"
                onClick={() => setPendingImages((p) => p.filter((_, idx) => idx !== i))}
                className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground hover:bg-destructive hover:text-destructive-foreground"
                aria-label="Bild entfernen"
              >
                <X className="h-3 w-3" />
              </button>
              <span className="absolute bottom-1 left-1 bg-primary px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary-foreground">
                Neu
              </span>
            </div>
          ))}
          <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-border bg-background text-xs text-muted-foreground hover:border-primary hover:text-primary transition">
            <ImagePlus className="h-5 w-5" />
            <span>Hinzufügen</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} />
          </label>
        </div>
      </div>

      <div className="md:col-span-2">
        <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Sentinel-Zuweisung (User-ID, optional)
        </Label>
        <Input
          value={form.assign_to}
          onChange={(e) => update("assign_to", e.target.value)}
          placeholder="user_… — leer = Ward bleibt bei dir"
          className="mt-2 font-mono text-xs"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Nur Sentinels mit freigegebener Bewerbung können zugewiesen werden.
        </p>
      </div>

      <div className="md:col-span-2 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Wird gespeichert …" : ward ? "Änderungen speichern" : "Vetted-Only einstellen"}
        </Button>
      </div>
    </form>
  );
};

const Field = ({
  label, required, placeholder, value, onChange,
}: { label: string; required?: boolean; placeholder?: string; value: string; onChange: (v: string) => void }) => (
  <div>
    <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
      {label}{required && " *"}
    </Label>
    <Input
      required={required}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-2"
    />
  </div>
);

const TextField = ({
  label, required, value, onChange,
}: { label: string; required?: boolean; value: string; onChange: (v: string) => void }) => (
  <div className="md:col-span-2">
    <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
      {label}{required && " *"}
    </Label>
    <Textarea
      required={required}
      rows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-2"
    />
  </div>
);

const Meta = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="font-mono text-[10px] uppercase tracking-[0.22em]">{label}</dt>
    <dd className="mt-1 text-foreground/85">{value}</dd>
  </div>
);

const Section = ({ label, body }: { label: string; body: string }) => (
  <div className="mt-5">
    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
    <p className="mt-2 text-sm leading-relaxed text-foreground/85 whitespace-pre-line">{body}</p>
  </div>
);

export default Wards;
