import { useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  ShieldCheck,
  User2,
  Activity,
  FileSignature,
  ClipboardList,
} from "lucide-react";
import { CASES, CARE_LOGS, CASE_DOCS, type CaseRecord, type CaseStatus } from "@/lib/dashboard-data";

const statusColor: Record<CaseStatus, string> = {
  Intake: "text-warning",
  Triage: "text-primary",
  Transport: "text-info",
  Pflege: "text-success",
  Outcome: "text-muted-foreground",
};

const riskColor: Record<CaseRecord["risk"], string> = {
  kritisch: "bg-destructive/15 text-destructive border-destructive/30",
  hoch: "bg-warning/10 text-warning border-warning/30",
  mittel: "bg-info/10 text-info border-info/30",
  stabil: "bg-success/10 text-success border-success/30",
};

type DetailTab = "chain" | "care" | "docs";

export const AuthorityView = () => {
  const [selected, setSelected] = useState<CaseRecord>(CASES[0]);
  const [filter, setFilter] = useState<CaseStatus | "Alle">("Alle");
  const [tab, setTab] = useState<DetailTab>("chain");

  const filtered = filter === "Alle" ? CASES : CASES.filter((c) => c.status === filter);

  return (
    <>
      {/* KPI strip */}
      <div className="grid gap-px bg-border md:grid-cols-4">
        {[
          { k: "12", l: "Aktive Akten", icon: FileText },
          { k: "3", l: "Kritisch · < 6 Std", icon: AlertTriangle, accent: true },
          { k: "4:12", l: "Ø Vermittlungszeit", icon: Clock },
          { k: "98 %", l: "Beweiskette intakt", icon: ShieldCheck },
        ].map((s) => (
          <div key={s.l} className="bg-background p-6">
            <div className="flex items-start justify-between">
              <s.icon className={`h-4 w-4 ${s.accent ? "text-destructive" : "text-muted-foreground"}`} />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">24h</span>
            </div>
            <div className={`mt-6 font-display text-4xl tracking-tight ${s.accent ? "text-destructive" : ""}`}>{s.k}</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Regionale Verteilung */}
      <div className="mt-px grid gap-px bg-border md:grid-cols-8">
        {[
          { r: "BY", n: 4 }, { r: "BW", n: 2 }, { r: "NRW", n: 2 }, { r: "HE", n: 1 },
          { r: "BE", n: 1 }, { r: "HH", n: 1 }, { r: "SN", n: 1 }, { r: "Andere", n: 0 },
        ].map((x) => (
          <div key={x.r} className="bg-background p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{x.r}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-xl">{x.n}</span>
              <div className="h-1 flex-1 bg-border">
                <div className="h-full bg-primary/60" style={{ width: `${Math.min(x.n * 25, 100)}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        {/* Case list */}
        <section className="lg:col-span-7">
          <div className="flex items-center justify-between">
            <h2 className="text-xl tracking-tight">Aktive Akten</h2>
          </div>

          <div className="mt-4 flex flex-wrap gap-px bg-border">
            {(["Alle", "Intake", "Triage", "Transport", "Pflege", "Outcome"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`bg-surface px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
                  filter === s ? "bg-surface-elevated text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="mt-4 border border-border bg-surface">
            <div className="hidden grid-cols-[1fr_80px_60px_90px_24px] items-center gap-4 border-b border-border px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground md:grid">
              <div>Akte / Spezies</div>
              <div>Status</div>
              <div>CITES</div>
              <div>Risiko</div>
              <div />
            </div>
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => { setSelected(c); setTab("chain"); }}
                className={`flex w-full items-start justify-between gap-3 border-b border-border px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-surface-elevated ${
                  selected.id === c.id ? "bg-surface-elevated" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono text-[11px] text-primary">{c.id}</span>
                    {c.origin === "Zivile Übergabe" && (
                      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">· zivil</span>
                    )}
                    <span className={`md:hidden font-mono text-[10px] uppercase ${statusColor[c.status]}`}>● {c.status}</span>
                    <span className="md:hidden font-mono text-[10px] text-muted-foreground">Anh. {c.cites}</span>
                    <span className={`md:hidden inline-block border px-2 py-0.5 font-mono text-[9px] uppercase ${riskColor[c.risk]}`}>
                      {c.risk}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-sm">{c.german}</div>
                  <div className="font-mono text-[10px] italic text-muted-foreground">{c.species}</div>
                </div>
                <div className="hidden shrink-0 items-center gap-4 md:flex">
                  <div className={`w-20 font-mono text-[11px] uppercase ${statusColor[c.status]}`}>{c.status}</div>
                  <div className="w-14 font-mono text-xs text-muted-foreground">Anh. {c.cites}</div>
                  <div className="w-20">
                    <span className={`inline-block border px-2 py-0.5 font-mono text-[10px] uppercase ${riskColor[c.risk]}`}>
                      {c.risk}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Detail panel */}
        <aside className="lg:col-span-5">
          <div className="sticky top-24 border border-border bg-surface">
            <div className="border-b border-border p-6">
              <div className="flex items-center justify-between">
                <span className="case-tag">Akte</span>
                <span className={`font-mono text-[11px] uppercase ${statusColor[selected.status]}`}>● {selected.status}</span>
              </div>
              <h3 className="mt-4 font-mono text-lg text-primary">{selected.id}</h3>
              <p className="mt-2 text-2xl tracking-tight">{selected.german}</p>
              <p className="font-mono text-xs italic text-muted-foreground">{selected.species}</p>
            </div>

            <div className="grid grid-cols-2 gap-px bg-border">
              {[
                { l: "CITES", v: `Anhang ${selected.cites}`, icon: ShieldCheck },
                { l: "Region", v: selected.region, icon: MapPin },
                { l: "Im System", v: selected.age, icon: Clock },
                { l: "Risiko", v: selected.risk, icon: Activity },
              ].map((m) => (
                <div key={m.l} className="bg-surface p-4">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    <m.icon className="h-3 w-3" /> {m.l}
                  </div>
                  <div className="mt-2 font-mono text-sm capitalize">{m.v}</div>
                </div>
              ))}
            </div>

            {/* Tab nav */}
            <div className="flex border-t border-border bg-border gap-px">
              {([
                { k: "chain" as const, l: "Beweiskette", icon: FileSignature },
                { k: "care" as const, l: "Pflege-Log", icon: ClipboardList },
                { k: "docs" as const, l: "Dokumente", icon: FileText },
              ]).map((t) => (
                <button
                  key={t.k}
                  onClick={() => setTab(t.k)}
                  className={`flex flex-1 items-center justify-center gap-2 bg-surface px-3 py-3 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                    tab === t.k ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <t.icon className="h-3 w-3" /> {t.l}
                </button>
              ))}
            </div>

            {tab === "chain" && (
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <span className="eyebrow">Beweiskette</span>
                  <span className="font-mono text-[10px] text-success">● intakt</span>
                </div>
                <ol className="mt-4 space-y-3">
                  {[
                    { who: selected.authority, role: selected.origin === "Zivile Übergabe" ? "Zivile Übergabe" : "Beschlagnahme", t: "00:00", done: true },
                    { who: "Dr. R. Wendler", role: "Veterinär-Triage", t: "00:08", done: true },
                    { who: "ExoGuard Routing", role: "Sentinel-Match", t: "00:24", done: selected.status !== "Intake" },
                    { who: selected.steward ?? "—", role: "Übergabe Custody", t: selected.steward ? "01:42" : "ausstehend", done: !!selected.steward },
                    { who: selected.outcome ?? "—", role: "Outcome", t: selected.outcome ? "abgeschlossen" : "ausstehend", done: selected.status === "Outcome" },
                  ].map((s, i) => (
                    <li key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`mt-1 h-2 w-2 rounded-full ${s.done ? "bg-primary" : "border border-border bg-background"}`} />
                        {i < 4 && <div className="mt-1 w-px flex-1 bg-border" />}
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">{s.who}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">{s.t}</span>
                        </div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{s.role}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {tab === "care" && (
              <div className="p-6">
                <span className="eyebrow">Pflege-Einträge</span>
                <ul className="mt-4 space-y-3">
                  {(CARE_LOGS[selected.id] ?? []).map((l, i) => (
                    <li key={i} className="border-l-2 border-primary/40 pl-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">{l.type}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{l.ts}</span>
                      </div>
                      <p className="mt-1 text-sm">{l.note}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">— {l.author}</p>
                    </li>
                  ))}
                  {!(CARE_LOGS[selected.id]?.length) && (
                    <li className="font-mono text-xs text-muted-foreground">Noch keine Einträge.</li>
                  )}
                </ul>
              </div>
            )}

            {tab === "docs" && (
              <div className="p-6">
                <span className="eyebrow">Dokumente</span>
                <ul className="mt-4 divide-y divide-border border-y border-border">
                  {(CASE_DOCS[selected.id] ?? []).map((d, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm">{d.name}</div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          {d.type} · {d.size}
                        </div>
                      </div>
                      <span className={`font-mono text-[10px] uppercase ${d.signed ? "text-success" : "text-warning"}`}>
                        {d.signed ? "● signiert" : "○ unsigned"}
                      </span>
                    </li>
                  ))}
                  {!(CASE_DOCS[selected.id]?.length) && (
                    <li className="py-3 font-mono text-xs text-muted-foreground">Keine Dokumente hinterlegt.</li>
                  )}
                </ul>
              </div>
            )}

            {selected.status === "Triage" && (
              <div className="border-t border-border p-6">
                <span className="eyebrow">Empfohlene Sentinels · 3</span>
                <div className="mt-4 space-y-px bg-border">
                  {[
                    { n: "Dr. K. Hoffmann", t: "Gifttier-Spez. · BY", d: "12 km · 3 freie Plätze", m: "98 %" },
                    { n: "S. Ostermann", t: "Reptilien S3 · BY", d: "34 km · 2 freie Plätze", m: "94 %" },
                    { n: "Auffangstation Allgäu", t: "Sanctuary · BY", d: "78 km · 1 freier Platz", m: "91 %" },
                  ].map((s) => (
                    <div key={s.n} className="flex items-center justify-between bg-surface p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center border border-border bg-surface-elevated">
                          <User2 className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm">{s.n}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{s.t} · {s.d}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm text-primary">{s.m}</div>
                        <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Match</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
};
