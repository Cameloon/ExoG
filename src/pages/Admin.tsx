import { useEffect, useState, useCallback } from "react";
import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, ChevronRight, FileText, XCircle, Clock, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { HABITAT_CATEGORIES, parseCapacity, totalCapacity } from "@/lib/habitats";

type Status = "pending" | "under_review" | "approved" | "rejected";

interface Application {
  id: string;
  case_id: string;
  user_id: string;
  full_name: string;
  email: string;
  region: string;
  experience_years: number;
  species_focus: string | null;
  capacity: string;
  motivation: string;
  pledge_data: Record<string, unknown>;
  status: Status;
  kyc_status: string;
  reviewer_notes: string | null;
  created_at: string;
}

interface DocRow {
  id: string;
  doc_type: string;
  storage_path: string;
  file_name: string;
}

const Admin = () => {
  const { t } = useTranslation();
  const { user, isAdmin, loading } = useAuth();
  const supabase = useExternalSupabase();
  const [filter, setFilter] = useState<Status | "all">("pending");
  const [apps, setApps] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Application | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [shelterReqs, setShelterReqs] = useState<
    { id: string; user_id: string; email: string; display_name: string | null; status: string }[]
  >([]);
  const [shelterBusy, setShelterBusy] = useState(false);

  useEffect(() => {
    document.title = "Admin · BioSteward";
  }, []);

  const load = useCallback(async () => {
    let q = supabase
      .from("sentinel_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) {
      toast({ title: "Load failed", description: error.message, variant: "destructive" });
      return;
    }
    setApps((data ?? []) as Application[]);
  }, [filter]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const loadShelterReqs = useCallback(async () => {
    const { data, error } = await supabase
      .from("pending_shelter_requests")
      .select("id, user_id, email, display_name, status")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Load failed", description: error.message, variant: "destructive" });
      return;
    }
    setShelterReqs((data ?? []) as { id: string; user_id: string; email: string; display_name: string | null; status: string }[]);
  }, [supabase]);

  useEffect(() => {
    if (isAdmin) void loadShelterReqs();
  }, [isAdmin, loadShelterReqs]);

  const decideShelter = async (id: string, status: "approved" | "rejected") => {
    if (!user) return;
    setShelterBusy(true);
    try {
      const { error } = await supabase
        .from("pending_shelter_requests")
        .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast({ title: status === "approved" ? "Einrichtung bestätigt" : "Antrag abgelehnt" });
      await loadShelterReqs();
    } catch (e) {
      toast({ title: "Update failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setShelterBusy(false);
    }
  };

  const openApp = async (app: Application) => {
    setSelected(app);
    setNotes(app.reviewer_notes ?? "");
    const { data } = await supabase
      .from("application_documents")
      .select("id, doc_type, storage_path, file_name")
      .eq("application_id", app.id);
    setDocs((data ?? []) as DocRow[]);
  };

  const openDoc = async (path: string, fileName?: string) => {
    const { data, error } = await supabase.storage
      .from("kyc-documents")
      .createSignedUrl(path, 60, { download: fileName ?? true });
    if (error || !data) {
      toast({ title: "Doc not accessible", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const previewDoc = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("kyc-documents")
      .createSignedUrl(path, 60);
    if (error || !data) {
      toast({ title: "Doc not accessible", variant: "destructive" });
      return;
    }
    setPreview(data.signedUrl);
  };

  const setStatus = async (newStatus: Status) => {
    if (!selected || !user) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("sentinel_applications")
        .update({
          status: newStatus,
          reviewer_notes: notes,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          kyc_status: (newStatus === "approved" ? "verified" : selected.kyc_status) as "verified" | "documents_uploaded" | "not_started" | "rejected",
        })
        .eq("id", selected.id);
      if (error) throw error;

      await supabase.from("application_audit_log").insert({
        application_id: selected.id,
        actor_id: user.id,
        action: "status_change",
        from_status: selected.status,
        to_status: newStatus,
        notes,
      });

      toast({ title: `Status: ${newStatus}` });
      setSelected(null);
      await load();
    } catch (e) {
      toast({ title: "Update failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-muted-foreground">
        <SiteHeader />
        <main className="container py-24 text-center">…</main>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" state={{ from: "/admin" }} replace />;
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="container max-w-xl py-24 text-center">
          <XCircle className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="font-editorial mt-6 text-3xl">{t("admin.forbidden")}</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Du bist eingeloggt, hast aber keine Admin-Rolle. Bitte einen bestehenden
            Admin, deinem Konto die Rolle zuzuweisen.
          </p>
          <Button asChild className="mt-6"><Link to="/start">Zur Startseite</Link></Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container py-12">
        <span className="eyebrow">§ Admin</span>
        <h1 className="font-editorial mt-4 text-4xl md:text-5xl">{t("admin.title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("admin.subtitle")}</p>

        {/* Shelter confirmation queue */}
        <div className="mt-8 border border-border bg-surface p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
            Einrichtungen · Bestätigung
          </p>
          {shelterReqs.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Keine offenen Anträge.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {shelterReqs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="text-sm font-medium">{r.display_name ?? r.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{r.email}</p>
                    <span className="mt-1 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{r.status}</span>
                  </div>
                  {r.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={shelterBusy} onClick={() => decideShelter(r.id, "approved")}>Bestätigen</Button>
                      <Button size="sm" variant="ghost" disabled={shelterBusy} onClick={() => decideShelter(r.id, "rejected")}>Ablehnen</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Filter */}
        <div className="mt-8 flex flex-wrap gap-2">
          {([
            ["all", t("admin.filterAll")],
            ["pending", t("admin.pending")],
            ["under_review", t("admin.underReview")],
            ["approved", t("admin.approved")],
            ["rejected", t("admin.rejected")],
          ] as const).map(([k, lbl]) => (
            <button
              key={k}
              onClick={() => setFilter(k as Status | "all")}
              className={`border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
                filter === k
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          {/* List */}
          <div className="border border-border bg-surface">
            {apps.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">{t("admin.noResults")}</div>
            ) : (
              <ul className="divide-y divide-border">
                {apps.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => openApp(a)}
                      className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-background ${
                        selected?.id === a.id ? "bg-background" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={a.status} />
                          <span className="truncate text-sm font-medium">{a.full_name}</span>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {a.case_id} · {a.region} · {new Date(a.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Detail */}
          <div className="border border-border bg-surface">
            {!selected ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {t("admin.review")} →
              </div>
            ) : (
              <div className="p-6 md:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      {selected.case_id}
                    </p>
                    <h2 className="font-editorial mt-1 text-2xl">{selected.full_name}</h2>
                    <p className="text-sm text-muted-foreground">{selected.email} · {selected.region}</p>
                  </div>
                  <StatusBadge status={selected.status} />
                </div>

                <dl className="mt-6 space-y-3 text-sm">
                  <Row k="Erfahrung" v={`${selected.experience_years} Jahre`} />
                  <Row k="Spezies" v={selected.species_focus ?? "—"} />
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Kapazität je Lebensraum</dt>
                    <dd className="mt-1 flex flex-wrap gap-2">
                      {HABITAT_CATEGORIES.map((h) => (
                        <span key={h.key} className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs">
                          {h.label}<span className="font-semibold text-foreground">{parseCapacity(selected.capacity)[h.key]}</span>
                        </span>
                      ))}
                      <span className="inline-flex items-center gap-1 border border-primary/40 bg-primary/10 px-2 py-1 text-xs">
                        Gesamt<span className="font-semibold">{totalCapacity(parseCapacity(selected.capacity))}</span>
                      </span>
                    </dd>
                  </div>
                  <Row k="KYC" v={selected.kyc_status} />
                </dl>

                <div className="mt-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Motivation</p>
                  <p className="mt-2 whitespace-pre-wrap rounded border border-border bg-background p-4 text-sm leading-relaxed">
                    {selected.motivation}
                  </p>
                </div>

                <div className="mt-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{t("admin.documents")}</p>
                  {docs.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">—</p>
                  ) : (
                    <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {docs.map((d) => (
                        <li key={d.id} className="border border-border bg-background p-3">
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{d.doc_type}</p>
                          <p className="mt-1 truncate text-xs text-foreground/80">{d.file_name}</p>
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => previewDoc(d.storage_path)}>
                              <Eye className="mr-1 h-3 w-3" /> {t("admin.viewDoc")}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => openDoc(d.storage_path, d.file_name)}>
                              <FileText className="mr-1 h-3 w-3" /> Download
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{t("admin.notes")}</p>
                  <Textarea rows={4} className="mt-2" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <Button onClick={() => setStatus("under_review")} disabled={busy} variant="outline">
                    <Clock className="mr-2 h-4 w-4" /> {t("admin.setUnderReview")}
                  </Button>
                  <Button onClick={() => setStatus("approved")} disabled={busy}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> {t("admin.approve")}
                  </Button>
                  <Button onClick={() => setStatus("rejected")} disabled={busy} variant="destructive">
                    <XCircle className="mr-2 h-4 w-4" /> {t("admin.reject")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
          <DialogContent className="max-w-3xl bg-background p-2">
            <DialogTitle className="sr-only">Dokumentenvorschau</DialogTitle>
            {preview && <img src={preview} alt="Dokumentenvorschau" className="max-h-[80vh] w-full object-contain" />}
          </DialogContent>
        </Dialog>
      </main>
      <SiteFooter />
    </div>
  );
};

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="grid grid-cols-3 gap-3">
    <dt className="text-muted-foreground">{k}</dt>
    <dd className="col-span-2">{v}</dd>
  </div>
);

const StatusBadge = ({ status }: { status: Status }) => {
  const map: Record<Status, { lbl: string; cls: string }> = {
    pending: { lbl: "Offen", cls: "border-border text-muted-foreground" },
    under_review: { lbl: "In Prüfung", cls: "border-primary/60 text-primary" },
    approved: { lbl: "Freigegeben", cls: "border-green-500/60 text-green-400" },
    rejected: { lbl: "Abgelehnt", cls: "border-destructive/60 text-destructive" },
  };
  const m = map[status];
  return <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] ${m.cls}`}>{m.lbl}</span>;
};

export default Admin;
