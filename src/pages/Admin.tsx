import { useEffect, useState, useCallback, useRef } from "react";
import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { useAuth } from "@/hooks/useAuth";
import { EXTERNAL_CONFIG } from "@/config/external";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSnake } from "@/components/ui/loading-snake";
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
  mime_type: string | null;
}

interface AuditRow {
  id: string;
  action: string;
  from_status: Status | null;
  to_status: Status | null;
  notes: string | null;
  created_at: string;
}

interface ChangeRow {
  id: string;
  actor_id: string;
  action: string;
  table_name: string;
  record_id: string;
  changed_at: string;
}

const Admin = () => {
  const { t } = useTranslation();
  const { user, isAdmin, loading } = useAuth();
  const { getToken } = useClerkAuth();
  const supabase = useExternalSupabase();
  const [filter, setFilter] = useState<Status | "all">("pending");
  const [apps, setApps] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Application | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [preview, setPreview] = useState<{ url: string; mime: string } | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [shelterReqs, setShelterReqs] = useState<
    { id: string; user_id: string; email: string; display_name: string | null; status: string }[]
  >([]);
  const [shelterBusy, setShelterBusy] = useState(false);
  const [changeReqs, setChangeReqs] = useState<
    { id: string; user_id: string; status: string; full_name: string | null; requested: Record<string, unknown>; created_at: string }[]
  >([]);
  const [changeBusy, setChangeBusy] = useState(false);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [changes, setChanges] = useState<ChangeRow[]>([]);
  const [roleUserId, setRoleUserId] = useState("");
  const [roleRole, setRoleRole] = useState("behoerde");
  const [roleRegion, setRoleRegion] = useState("");
  const [roleBusy, setRoleBusy] = useState(false);

  const setUserRole = async () => {
    const uid = roleUserId.trim();
    if (!uid) return;
    const label = roleRole === "behoerde" ? "Behörde" : roleRole === "einrichtung" ? "Einrichtung" : roleRole === "admin" ? "Admin" : roleRole;
    if (!window.confirm(`Rolle "${label}" für ${uid} setzen? Änderung wird protokolliert.`)) return;
    setRoleBusy(true);
    try {
      const token = await getToken();
      const res = await fetch(`${EXTERNAL_CONFIG.SUPABASE_URL}/functions/v1/set-user-role`, {
        method: "POST",
        headers: { authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: uid,
          role: roleRole,
          region: roleRole === "behoerde" ? roleRegion.trim() || null : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `HTTP ${res.status}`);
      // Persisted audit: role grants used to exist only in the edge function's
      // console log. role_change_log (00024) is admin-insert only, append-only.
      if (user) {
        const { error: auditErr } = await supabase.from("role_change_log").insert({
          actor_id: user.id,
          target_user_id: uid,
          role: roleRole,
          region: roleRole === "behoerde" ? roleRegion.trim() || null : null,
        });
        if (auditErr) throw new Error(`Rolle gesetzt, aber Protokollierung fehlgeschlagen: ${auditErr.message}`);
      }
      toast({ title: "Rolle gesetzt", description: `${uid} → ${roleRole}${roleRegion.trim() ? ` · ${roleRegion.trim()}` : ""}` });
      setRoleUserId("");
      setRoleRegion("");
    } catch (e) {
      toast({ title: "Fehlgeschlagen", description: (e as Error).message, variant: "destructive" });
    } finally {
      setRoleBusy(false);
    }
  };

  useEffect(() => {
    document.title = "Admin · BioSteward";
  }, []);

  const appPageRef = useRef(0);
  const [appsHasMore, setAppsHasMore] = useState(false);

  const load = useCallback(async (reset = false) => {
    const from = reset ? 0 : appPageRef.current;
    let q = supabase
      .from("sentinel_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + 99);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) {
      toast({ title: "Load failed", description: error.message, variant: "destructive" });
      return;
    }
    const rows = (data ?? []) as Application[];
    setApps(reset ? rows : (prev) => [...prev, ...rows]);
    appPageRef.current = reset ? rows.length : appPageRef.current + rows.length;
    setAppsHasMore(rows.length === 100);
  }, [filter, supabase]);

  useEffect(() => {
    if (isAdmin) load(true);
  }, [isAdmin, load]);

  const loadShelterReqs = useCallback(async () => {
    const { data, error } = await supabase
      .from("pending_shelter_requests")
      .select("id, user_id, email, display_name, status")
      .order("created_at", { ascending: false })
      .range(0, 99);
    if (error) {
      toast({ title: "Load failed", description: error.message, variant: "destructive" });
      return;
    }
    setShelterReqs((data ?? []) as { id: string; user_id: string; email: string; display_name: string | null; status: string }[]);
  }, [supabase]);

  useEffect(() => {
    if (isAdmin) void loadShelterReqs();
  }, [isAdmin, loadShelterReqs]);

  // Sentinel address-change requests (00027). Approve writes the new address
  // into the application's pledge_data so profile + network map pick it up.
  const loadChangeReqs = useCallback(async () => {
    const { data, error } = await supabase
      .from("sentinel_change_requests")
      .select("id, user_id, requested, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .range(0, 49);
    if (error) {
      toast({ title: "Load failed", description: error.message, variant: "destructive" });
      return;
    }
    const uids = [...new Set((data ?? []).map((r) => r.user_id))];
    let names: Record<string, string> = {};
    if (uids.length) {
      const { data: appRows } = await supabase
        .from("sentinel_applications")
        .select("user_id, full_name")
        .in("user_id", uids);
      names = Object.fromEntries((appRows ?? []).map((a) => [a.user_id, a.full_name]));
    }
    setChangeReqs(
      (data ?? []).map((r) => ({
        id: r.id,
        user_id: r.user_id,
        status: r.status,
        full_name: names[r.user_id] ?? null,
        requested: (r.requested ?? {}) as Record<string, unknown>,
        created_at: r.created_at,
      })),
    );
  }, [supabase]);

  useEffect(() => {
    if (isAdmin) void loadChangeReqs();
  }, [isAdmin, loadChangeReqs]);

  const decideChange = async (id: string, userId: string, approve: boolean) => {
    if (!user) return;
    setChangeBusy(true);
    try {
      if (approve) {
        const { data: app, error: appErr } = await supabase
          .from("sentinel_applications")
          .select("user_id, pledge_data")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (appErr) throw appErr;
        if (!app) throw new Error("Kein Sentinel-Antrag für diesen Nutzer gefunden.");
        const pledge = (app.pledge_data ?? {}) as { questionnaire?: Record<string, unknown> };
        const req = changeReqs.find((r) => r.id === id) as { requested: Record<string, unknown> } | undefined;
        if (!req) throw new Error("Request not found");
        const { error: upErr } = await supabase
          .from("sentinel_applications")
          .update({
            pledge_data: {
              ...pledge,
              questionnaire: {
                ...(pledge.questionnaire ?? {}),
                street: (req.requested?.street as string) ?? "",
                house_number: (req.requested?.house_number as string) ?? "",
                zip: (req.requested?.zip as string) ?? "",
                city: (req.requested?.city as string) ?? "",
              },
            },
          })
          .eq("user_id", userId);
        if (upErr) throw upErr;
      }
      const { error } = await supabase
        .from("sentinel_change_requests")
        .update({
          status: approve ? "approved" : "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      toast({ title: approve ? "Adresse übernommen" : "Änderung abgelehnt" });
      await loadChangeReqs();
    } catch (e) {
      toast({ title: "Update failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setChangeBusy(false);
    }
  };

  // Global custody-table audit trail (00011 change_log, written by DB triggers).
  const loadChanges = useCallback(async () => {
    const { data, error } = await supabase
      .from("change_log")
      .select("id, actor_id, action, table_name, record_id, changed_at")
      .order("changed_at", { ascending: false })
      .range(0, 49);
    if (error) {
      toast({ title: "Load failed", description: error.message, variant: "destructive" });
      return;
    }
    setChanges((data ?? []) as ChangeRow[]);
  }, [supabase]);

  useEffect(() => {
    if (isAdmin) void loadChanges();
  }, [isAdmin, loadChanges]);

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
    const [{ data: docData }, { data: auditData }] = await Promise.all([
      supabase
        .from("application_documents")
        .select("id, doc_type, storage_path, file_name, mime_type")
        .eq("application_id", app.id),
      supabase
        .from("application_audit_log")
        .select("id, action, from_status, to_status, notes, created_at")
        .eq("application_id", app.id)
        .order("created_at", { ascending: false }),
    ]);
    setDocs((docData ?? []) as DocRow[]);
    setAudit((auditData ?? []) as AuditRow[]);
  };

  const openDoc = async (path: string, fileName?: string) => {
    const { data, error } = await supabase.storage
      .from("kyc-documents")
      .createSignedUrl(path, 60, { download: fileName ?? true });
    if (error || !data) {
      toast({ title: "Doc not accessible", variant: "destructive" });
      return;
    }
    // noopener: KYC files are user-uploaded content — the new tab must not
    // be able to reach back into this admin tab (reverse tabnabbing).
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const previewDoc = async (path: string, mime: string | null) => {
    const { data, error } = await supabase.storage
      .from("kyc-documents")
      .createSignedUrl(path, 60);
    if (error || !data) {
      toast({ title: "Doc not accessible", variant: "destructive" });
      return;
    }
    setPreview({ url: data.signedUrl, mime: mime ?? "" });
  };

  const setStatus = async (newStatus: Status) => {
    if (!selected || !user) return;
    if (newStatus !== selected.status && !window.confirm(`Status auf "${newStatus}" setzen?`)) return;
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

      // Audit insert is part of the transaction: if it fails, revert the
      // status change so an unlogged decision is never left half-applied.
      const { error: auditErr } = await supabase.from("application_audit_log").insert({
        application_id: selected.id,
        actor_id: user.id,
        action: "status_change",
        from_status: selected.status,
        to_status: newStatus,
        notes,
      });
      if (auditErr) {
        await supabase
          .from("sentinel_applications")
          .update({ status: selected.status, kyc_status: selected.kyc_status as "rejected" | "not_started" | "documents_uploaded" | "verified", reviewer_notes: selected.reviewer_notes ?? null })
          .eq("id", selected.id);
        throw auditErr;
      }

      toast({ title: `Status: ${newStatus}` });
      setSelected(null);
      await load(true);
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
        <main className="container py-24 text-center">
          <LoadingSnake label="Lade Admin" />
        </main>
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

        {/* Sentinel address-change queue */}
        <div className="mt-8 border border-border bg-surface p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
            Sentinel · Adressänderungen
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Freigabe übernimmt die neue Adresse in das Sentinel-Profil (sichtbar für Netzwerk, Behörden-Karte und Zuweisung).
          </p>
          {changeReqs.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Keine offenen Änderungsanträge.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {changeReqs.map((r) => {
                const a = (r.requested ?? {}) as { street?: string; house_number?: string; zip?: string; city?: string };
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <p className="text-sm font-medium">{r.full_name ?? r.user_id}</p>
                      <p className="mt-1 text-xs text-muted-foreground font-mono">{r.user_id}</p>
                      <p className="mt-1 text-sm">{a.street} {a.house_number}, {a.zip} {a.city}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" disabled={changeBusy} onClick={() => decideChange(r.id, r.user_id, true)}>Übernehmen</Button>
                      <Button size="sm" variant="ghost" disabled={changeBusy} onClick={() => decideChange(r.id, r.user_id, false)}>Ablehnen</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Role & region management (Clerk publicMetadata via edge function) */}
        <div className="mt-8 border border-border bg-surface p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
            Rollen &amp; Regionen
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Clerk User-ID (z.B. aus dem Antrag, Feld „User") + Rolle setzen. Behörde braucht zusätzlich eine Region.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Input
              value={roleUserId}
              onChange={(e) => setRoleUserId(e.target.value)}
              placeholder="user_…"
              className="w-64 font-mono text-xs"
            />
            <select
              value={roleRole}
              onChange={(e) => setRoleRole(e.target.value)}
              className="h-10 border border-border bg-background px-3 text-sm"
            >
              <option value="behoerde">behoerde</option>
              <option value="einrichtung">einrichtung</option>
              <option value="sentinel">sentinel</option>
              <option value="admin">admin</option>
              <option value="user">user (Zurücksetzen)</option>
            </select>
            {roleRole === "behoerde" && (
              <Input
                value={roleRegion}
                onChange={(e) => setRoleRegion(e.target.value)}
                placeholder="Region, z.B. DE-Süd"
                className="w-48"
              />
            )}
            <Button size="sm" disabled={roleBusy || !roleUserId.trim()} onClick={setUserRole}>
              {roleBusy ? "Setze …" : "Rolle setzen"}
            </Button>
          </div>
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
            {appsHasMore && (
              <div className="border-t border-border p-3 text-center">
                <Button size="sm" variant="outline" onClick={() => void load()}>
                  Weitere Anträge laden
                </Button>
              </div>
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
                  <Row k="User" v={selected.user_id}>
                    <button
                      onClick={() => { setRoleUserId(selected.user_id); setRoleRole("behoerde"); setRoleRegion(selected.region); }}
                      className="ml-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary hover:underline"
                    >
                      → Rolle
                    </button>
                  </Row>
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
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => previewDoc(d.storage_path, d.mime_type)}>
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

                <div className="mt-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Audit-Spur</p>
                  {audit.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">Noch keine Einträge.</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-border border border-border bg-background">
                      {audit.map((a) => (
                        <li key={a.id} className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                              {a.from_status ?? "—"} → {a.to_status ?? a.action}
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {new Date(a.created_at).toLocaleString("de-DE")}
                            </span>
                          </div>
                          {a.notes && <p className="mt-1 text-xs text-muted-foreground">{a.notes}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
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
            {preview && preview.mime.startsWith("image/") && (
              <img src={preview.url} alt="Dokumentenvorschau" className="max-h-[80vh] w-full object-contain" />
            )}
            {preview && preview.mime === "application/pdf" && (
              <iframe src={preview.url} title="Dokumentenvorschau" className="h-[80vh] w-full" />
            )}
            {preview && !preview.mime.startsWith("image/") && preview.mime !== "application/pdf" && (
              <p className="p-6 text-sm text-muted-foreground">
                Keine Vorschau für diesen Dateityp — bitte herunterladen.
              </p>
            )}
          </DialogContent>
        </Dialog>

        {/* Custody-table change log (trigger-written, append-only) */}
        <div className="mt-10 border border-border bg-surface p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
            Änderungsprotokoll · Custody-Tabellen
          </p>
          {changes.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Noch keine Änderungen protokolliert.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {changes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    <span className={c.action === "DELETE" ? "text-destructive" : "text-foreground"}>{c.action}</span>
                    {" · "}{c.table_name}{" · "}{c.record_id.slice(0, 8)}…
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date(c.changed_at).toLocaleString("de-DE")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

const Row = ({ k, v, children }: { k: string; v: string; children?: React.ReactNode }) => (
  <div className="grid grid-cols-3 gap-3">
    <dt className="text-muted-foreground">{k}</dt>
    <dd className="col-span-2 flex items-center gap-2">{v}{children}</dd>
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
