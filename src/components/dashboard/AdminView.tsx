import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CERT_QUEUE, type CertReviewItem } from "@/lib/dashboard-data";
import { CheckCircle2, XCircle, Clock, FileText, ShieldCheck, AlertTriangle } from "lucide-react";

const tone: Record<CertReviewItem["status"], string> = {
  pending: "text-warning",
  in_review: "text-info",
  approved: "text-success",
  rejected: "text-destructive",
};

const label: Record<CertReviewItem["status"], string> = {
  pending: "Eingereicht",
  in_review: "In Prüfung",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
};

export const AdminView = () => {
  const [items, setItems] = useState<CertReviewItem[]>(CERT_QUEUE);
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const active = items.find((i) => i.id === activeId);

  const setStatus = (id: string, status: CertReviewItem["status"]) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));

  const counts = {
    pending: items.filter((i) => i.status === "pending").length,
    in_review: items.filter((i) => i.status === "in_review").length,
    approved: items.filter((i) => i.status === "approved").length,
    rejected: items.filter((i) => i.status === "rejected").length,
  };

  return (
    <>
      <div className="grid gap-px bg-border md:grid-cols-4">
        {[
          { k: counts.pending, l: "Neu eingereicht", icon: AlertTriangle, accent: counts.pending > 0 },
          { k: counts.in_review, l: "In Prüfung", icon: Clock },
          { k: counts.approved, l: "Freigegeben (30d)", icon: ShieldCheck },
          { k: counts.rejected, l: "Abgelehnt (30d)", icon: XCircle },
        ].map((s) => (
          <div key={s.l} className="bg-background p-6">
            <div className="flex items-start justify-between">
              <s.icon className={`h-4 w-4 ${s.accent ? "text-warning" : "text-muted-foreground"}`} />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Queue</span>
            </div>
            <div className={`mt-6 font-display text-4xl tracking-tight ${s.accent ? "text-warning" : ""}`}>{s.k}</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <section className="lg:col-span-7">
          <h2 className="text-xl tracking-tight">Zertifizierungs-Anträge</h2>
          <div className="mt-4 border border-border bg-surface">
            <div className="hidden grid-cols-[1fr_70px_70px_100px] items-center gap-4 border-b border-border px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground md:grid">
              <div>Antrag / Person</div>
              <div>Stufe</div>
              <div>Region</div>
              <div>Status</div>
            </div>
            {items.map((i) => (
              <button
                key={i.id}
                onClick={() => setActiveId(i.id)}
                className={`flex w-full items-start justify-between gap-3 border-b border-border px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-surface-elevated ${
                  activeId === i.id ? "bg-surface-elevated" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono text-[11px] text-primary">{i.id}</span>
                    <span className="md:hidden font-mono text-[11px] text-primary">St. {i.tier}</span>
                    <span className="md:hidden font-mono text-[10px] text-muted-foreground">{i.region}</span>
                    <span className={`md:hidden font-mono text-[10px] uppercase ${tone[i.status]}`}>● {label[i.status]}</span>
                  </div>
                  <div className="mt-1 text-sm">{i.applicant}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">eingereicht {i.submitted}</div>
                </div>
                <div className="hidden shrink-0 items-center gap-4 md:flex">
                  <div className="w-[70px] font-mono text-sm text-primary">{i.tier}</div>
                  <div className="w-[70px] font-mono text-xs text-muted-foreground">{i.region}</div>
                  <div className={`w-[100px] font-mono text-[11px] uppercase ${tone[i.status]}`}>
                    ● {label[i.status]}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <aside className="lg:col-span-5">
          {active && (
            <div className="sticky top-24 border border-border bg-surface">
              <div className="border-b border-border p-6">
                <span className="case-tag">Zertifizierungs-Antrag</span>
                <h3 className="mt-4 font-mono text-lg text-primary">{active.id}</h3>
                <p className="mt-2 text-2xl tracking-tight">{active.applicant}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  Stufe {active.tier} · Region {active.region} · {active.docsCount} Nachweise
                </p>
              </div>

              <div className="p-6">
                <span className="eyebrow">Eingereichte Nachweise</span>
                <ul className="mt-4 divide-y divide-border border-y border-border">
                  {Array.from({ length: active.docsCount }).map((_, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <div className="text-sm">Nachweis {i + 1}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">PDF · digital signiert</div>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] uppercase text-success">● geprüft</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-border p-6">
                <span className="eyebrow">Region & Recht</span>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Stufe {active.tier} ist in {active.region} unter den geltenden
                  Landesregelungen grundsätzlich zulässig. Behörd­liche
                  Halte­erlaubnis liegt vor.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-px border-t border-border bg-border">
                <Button
                  variant="ghost"
                  className="rounded-none bg-surface text-destructive hover:bg-surface-elevated"
                  onClick={() => setStatus(active.id, "rejected")}
                >
                  <XCircle className="mr-2 h-4 w-4" /> Ablehnen
                </Button>
                <Button
                  className="rounded-none"
                  onClick={() => setStatus(active.id, "approved")}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Freigeben
                </Button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
};
