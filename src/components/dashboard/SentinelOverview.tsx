import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownAZ,
  ArrowUpDown,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDot,
  Clock,
  Filter,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Stethoscope,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACTIVITY_7D,
  CASES,
  DUTIES,
  ME_SENTINEL,
  type Duty,
  type DutyPriority,
} from "@/lib/dashboard-data";

type DutyCategory = Duty["category"];
const CATEGORIES: DutyCategory[] = [
  "Fütterung",
  "Medizin",
  "Klima",
  "Behörde",
  "Reinigung",
  "Übergabe",
];
const PRIORITIES: DutyPriority[] = ["normal", "hoch", "kritisch"];

const NONE_CASE = "__none__";
const ALL_CASE = "__all__";
const ALL_CATEGORY = "__all__";
const ALL_PRIORITY = "__all__";

const PRIO_WEIGHT: Record<DutyPriority, number> = {
  kritisch: 0,
  hoch: 1,
  normal: 2,
};

const formatDue = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Heute · spontan";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  if (isYesterday) return `Gestern · ${time}`;
  if (sameDay) return `Heute · ${time}`;
  if (isTomorrow) return `Morgen · ${time}`;
  const date = d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  return `${date} · ${time}`;
};

const defaultDueIso = (): string => {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  // datetime-local format YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const PRIO_TONE: Record<DutyPriority, string> = {
  kritisch: "border-destructive/50 text-destructive",
  hoch: "border-amber-500/50 text-amber-500",
  normal: "border-border text-muted-foreground",
};

const ENCLOSURE_TONE: Record<string, string> = {
  belegt: "bg-primary text-primary-foreground",
  frei: "bg-success/20 text-success",
  reinigung: "bg-amber-500/20 text-amber-500",
  wartung: "bg-muted text-muted-foreground",
};

interface Props {
  onJumpToCase: (id: string) => void;
}

export const SentinelOverview = ({ onJumpToCase }: Props) => {
  const [duties, setDuties] = useState<Duty[]>(DUTIES);
  const [newDuty, setNewDuty] = useState("");
  const [newCategory, setNewCategory] = useState<DutyCategory>("Klima");
  const [newPriority, setNewPriority] = useState<DutyPriority>("normal");
  const [newCaseId, setNewCaseId] = useState<string>(NONE_CASE);
  const [newDueIso, setNewDueIso] = useState<string>(defaultDueIso());

  // Filter & Sort states
  const [filterCaseId, setFilterCaseId] = useState<string>(ALL_CASE);
  const [filterCategory, setFilterCategory] = useState<string>(ALL_CATEGORY);
  const [filterPriority, setFilterPriority] = useState<string>(ALL_PRIORITY);
  const [sortBy, setSortBy] = useState<"due" | "priority" | "title">("due");

  const hasActiveFilters =
    filterCaseId !== ALL_CASE || filterCategory !== ALL_CATEGORY || filterPriority !== ALL_PRIORITY;

  const filteredAndSortedOpen = useMemo(() => {
    let list = duties.filter((d) => !d.done);
    if (filterCaseId !== ALL_CASE) {
      list = list.filter((d) => d.caseId === filterCaseId);
    }
    if (filterCategory !== ALL_CATEGORY) {
      list = list.filter((d) => d.category === filterCategory);
    }
    if (filterPriority !== ALL_PRIORITY) {
      list = list.filter((d) => d.priority === filterPriority);
    }
    return list.sort((a, b) => {
      if (sortBy === "due") return a.dueIso.localeCompare(b.dueIso);
      if (sortBy === "priority") return PRIO_WEIGHT[a.priority] - PRIO_WEIGHT[b.priority];
      return a.title.localeCompare(b.title);
    });
  }, [duties, filterCaseId, filterCategory, filterPriority, sortBy]);

  const open = filteredAndSortedOpen;
  const overdue = open.filter((d) => d.due.startsWith("Gestern"));
  const today = open.filter((d) => d.due.startsWith("Heute"));
  const upcoming = open.filter(
    (d) => !d.due.startsWith("Heute") && !d.due.startsWith("Gestern"),
  );

  const enclosureBreakdown = useMemo(() => {
    const map = new Map<string, { total: number; belegt: number }>();
    ME_SENTINEL.enclosures.forEach((e) => {
      const cur = map.get(e.type) ?? { total: 0, belegt: 0 };
      cur.total += 1;
      if (e.status === "belegt") cur.belegt += 1;
      map.set(e.type, cur);
    });
    return Array.from(map.entries());
  }, []);

  const maxLogs = Math.max(...ACTIVITY_7D.map((a) => a.logs));
  const totalLogs = ACTIVITY_7D.reduce((s, a) => s + a.logs, 0);

  const toggleDuty = (id: string) =>
    setDuties((prev) =>
      prev.map((d) => (d.id === id ? { ...d, done: !d.done } : d)),
    );

  const addDuty = () => {
    const t = newDuty.trim();
    if (!t) return;
    const iso = newDueIso || defaultDueIso();
    const d: Duty = {
      id: `D-${Date.now()}`,
      title: t,
      caseId: newCaseId === NONE_CASE ? undefined : newCaseId,
      due: formatDue(iso),
      dueIso: iso,
      priority: newPriority,
      done: false,
      category: newCategory,
    };
    setDuties((prev) => [d, ...prev]);
    setNewDuty("");
    setNewCaseId(NONE_CASE);
    setNewPriority("normal");
    setNewCategory("Klima");
    setNewDueIso(defaultDueIso());
  };

  const resetFilters = () => {
    setFilterCaseId(ALL_CASE);
    setFilterCategory(ALL_CATEGORY);
    setFilterPriority(ALL_PRIORITY);
    setSortBy("due");
  };

  const caseLabel = (id?: string) => {
    if (!id) return null;
    const c = CASES.find((x) => x.id === id);
    return c ? `${c.id} · ${c.german}` : id;
  };

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      {/* Linke Spalte: Profil + Zertifikate */}
      <section className="lg:col-span-4 space-y-px bg-border">
        <div className="bg-surface p-6">
          <span className="eyebrow">Profil</span>
          <div className="mt-4 flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center bg-primary/10 font-display text-xl text-primary">
              KH
            </div>
            <div>
              <div className="font-display text-xl tracking-tight">
                {ME_SENTINEL.name}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Stufe {ME_SENTINEL.tier} · seit {ME_SENTINEL.joined}
              </div>
              <div className="mt-1 font-mono text-[10px] text-primary">
                Ø Reaktion {ME_SENTINEL.reactionMinutes} Min
              </div>
            </div>
          </div>

          <ul className="mt-5 space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">{ME_SENTINEL.contact.address}</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono text-xs">{ME_SENTINEL.contact.phone}</span>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono text-xs">{ME_SENTINEL.contact.email}</span>
            </li>
            <li className="flex items-start gap-2 border-t border-border pt-2">
              <Stethoscope className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Vet on call
                </div>
                <div className="text-sm">
                  {ME_SENTINEL.vetOnCall.name} ·{" "}
                  <span className="font-mono text-xs">{ME_SENTINEL.vetOnCall.phone}</span>
                </div>
              </div>
            </li>
          </ul>
        </div>

        <div className="bg-surface p-6">
          <span className="eyebrow flex items-center gap-2">
            <ShieldCheck className="h-3 w-3" /> Zertifikate
          </span>
          <ul className="mt-4 space-y-3">
            {ME_SENTINEL.certifications.map((c) => (
              <li key={c.ref} className="border-l-2 border-primary/40 pl-3">
                <div className="text-sm">{c.label}</div>
                <div className="mt-0.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  <span>{c.authority}</span>
                  <span className="text-primary/70">gültig {c.validUntil}</span>
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  Ref {c.ref}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-surface p-6">
          <span className="eyebrow">Versicherung</span>
          <div className="mt-3 text-sm">{ME_SENTINEL.insurance.policy}</div>
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">
            Deckung {(ME_SENTINEL.insurance.coverEur / 1_000_000).toFixed(1)} Mio €
            · gültig bis {ME_SENTINEL.insurance.validUntil}
          </div>
        </div>
      </section>

      {/* Mittlere + rechte Spalte */}
      <div className="lg:col-span-8 space-y-8">
        {/* Kapazitäts-Visualizer */}
        <section className="border border-border bg-surface">
          <div className="flex items-baseline justify-between border-b border-border p-6">
            <div>
              <span className="eyebrow">Kapazitäten · Anlagen</span>
              <h3 className="mt-2 text-xl tracking-tight">
                {ME_SENTINEL.capacity.used} von {ME_SENTINEL.capacity.total} Plätzen belegt
              </h3>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
              {Math.round((ME_SENTINEL.capacity.used / ME_SENTINEL.capacity.total) * 100)}% Auslastung
            </span>
          </div>

          {/* Slot-Grid */}
          <div className="grid grid-cols-3 gap-px bg-border md:grid-cols-6">
            {ME_SENTINEL.enclosures.map((e) => (
              <button
                key={e.id}
                onClick={() => e.occupiedBy && onJumpToCase(e.occupiedBy)}
                disabled={!e.occupiedBy}
                className={`group relative flex flex-col bg-surface p-4 text-left transition-colors ${
                  e.occupiedBy ? "hover:bg-surface-elevated" : "cursor-default"
                }`}
              >
                <span
                  className={`inline-flex h-5 w-fit items-center px-1.5 font-mono text-[9px] uppercase tracking-[0.18em] ${ENCLOSURE_TONE[e.status]}`}
                >
                  {e.status}
                </span>
                <span className="mt-3 font-display text-lg">{e.id}</span>
                <span className="mt-0.5 text-[11px] text-muted-foreground">{e.type}</span>
                <span className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {e.sizeCm} cm
                </span>
                {e.occupiedBy && (
                  <span className="mt-2 font-mono text-[10px] text-primary">
                    {e.occupiedBy}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Breakdown by type */}
          <div className="border-t border-border p-6">
            <span className="eyebrow">Verteilung nach Anlagentyp</span>
            <ul className="mt-4 space-y-3">
              {enclosureBreakdown.map(([type, v]) => {
                const pct = (v.belegt / v.total) * 100;
                return (
                  <li key={type}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{type}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {v.belegt}/{v.total}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 w-full bg-border">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Aktivitäts-Visualizer */}
        <section className="border border-border bg-surface p-6">
          <div className="flex items-baseline justify-between">
            <span className="eyebrow flex items-center gap-2">
              <Activity className="h-3 w-3" /> Aktivität · 7 Tage
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {totalLogs} Einträge gesamt
            </span>
          </div>
          <div className="mt-6 flex items-end gap-2 h-32">
            {ACTIVITY_7D.map((a) => {
              const h = (a.logs / maxLogs) * 100;
              const isPeak = a.logs === maxLogs;
              return (
                <div key={a.day} className="flex flex-1 flex-col items-center gap-2">
                  <div className="relative flex h-full w-full items-end">
                    <div
                      className={`w-full transition-all ${isPeak ? "bg-primary" : "bg-primary/30"}`}
                      style={{ height: `${h}%` }}
                    />
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[10px] text-foreground">
                      {a.logs}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {a.day}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Pflichten / Todos */}
        <section className="border border-border bg-surface">
          <div className="flex items-baseline justify-between border-b border-border p-6">
            <div>
              <span className="eyebrow flex items-center gap-2">
                <CalendarClock className="h-3 w-3" /> Pflichten
              </span>
              <h3 className="mt-2 text-xl tracking-tight">
                {open.length} offen · {overdue.length} überfällig
              </h3>
            </div>
          </div>

          {/* Quick add */}
          <div className="space-y-2 border-b border-border p-4">
            <div className="flex gap-2">
              <Input
                value={newDuty}
                onChange={(e) => setNewDuty(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addDuty()}
                placeholder="Neue Pflicht erfassen…"
                className="h-9 border-border bg-background font-mono text-sm"
              />
              <Button size="sm" onClick={addDuty} disabled={!newDuty.trim()}>
                <Plus className="mr-1.5 h-4 w-4" /> Hinzufügen
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Select value={newCategory} onValueChange={(v) => setNewCategory(v as DutyCategory)}>
                <SelectTrigger className="h-9 border-border bg-background font-mono text-xs">
                  <SelectValue placeholder="Kategorie" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="font-mono text-xs">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={newPriority} onValueChange={(v) => setNewPriority(v as DutyPriority)}>
                <SelectTrigger className="h-9 border-border bg-background font-mono text-xs">
                  <SelectValue placeholder="Priorität" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="font-mono text-xs uppercase">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={newCaseId} onValueChange={setNewCaseId}>
                <SelectTrigger className="h-9 border-border bg-background font-mono text-xs">
                  <SelectValue placeholder="Fall" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_CASE} className="font-mono text-xs">
                    — kein Fall —
                  </SelectItem>
                  {CASES.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="font-mono text-xs">
                      {c.id} · {c.german}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="datetime-local"
                value={newDueIso}
                onChange={(e) => setNewDueIso(e.target.value)}
                className="h-9 border-border bg-background font-mono text-xs"
              />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Fällig: {formatDue(newDueIso)}
            </p>
          </div>

          {/* Filter & Sort Bar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background/30 p-4">
            <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Select value={filterCaseId} onValueChange={setFilterCaseId}>
              <SelectTrigger className="h-8 w-auto min-w-[140px] border-border bg-background font-mono text-xs">
                <SelectValue placeholder="Fall" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CASE} className="font-mono text-xs">
                  Alle Fälle
                </SelectItem>
                {CASES.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="font-mono text-xs">
                    {c.id} · {c.german}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-8 w-auto min-w-[120px] border-border bg-background font-mono text-xs">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORY} className="font-mono text-xs">
                  Alle Kategorien
                </SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="font-mono text-xs">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="h-8 w-auto min-w-[120px] border-border bg-background font-mono text-xs">
                <SelectValue placeholder="Priorität" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PRIORITY} className="font-mono text-xs">
                  Alle Prioritäten
                </SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p} className="font-mono text-xs uppercase">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="ml-auto flex items-center gap-2">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as "due" | "priority" | "title")}>
                <SelectTrigger className="h-8 w-auto min-w-[140px] border-border bg-background font-mono text-xs">
                  <SelectValue placeholder="Sortieren" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="due" className="font-mono text-xs">
                    Fälligkeit
                  </SelectItem>
                  <SelectItem value="priority" className="font-mono text-xs">
                    Priorität
                  </SelectItem>
                  <SelectItem value="title" className="font-mono text-xs">
                    Titel A–Z
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-primary hover:underline"
              >
                <X className="h-3 w-3" /> Filter zurücksetzen
              </button>
            )}
          </div>

          {open.length === 0 && (
            <div className="border-b border-border p-8 text-center">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Keine offenen Pflichten passen zum Filter
              </span>
            </div>
          )}

          {overdue.length > 0 && (
            <DutyGroup
              label="Überfällig"
              icon={<AlertTriangle className="h-3 w-3 text-destructive" />}
              duties={overdue}
              onToggle={toggleDuty}
              onJumpToCase={onJumpToCase}
              caseLabel={caseLabel}
            />
          )}
          <DutyGroup
            label="Heute"
            icon={<Clock className="h-3 w-3 text-primary" />}
            duties={today}
            onToggle={toggleDuty}
            onJumpToCase={onJumpToCase}
            caseLabel={caseLabel}
          />
          <DutyGroup
            label="Kommend"
            icon={<CircleDot className="h-3 w-3 text-muted-foreground" />}
            duties={upcoming}
            onToggle={toggleDuty}
            onJumpToCase={onJumpToCase}
            caseLabel={caseLabel}
          />

          {duties.some((d) => d.done) && (
            <div className="border-t border-border p-6">
              <span className="eyebrow">Erledigt</span>
              <ul className="mt-3 space-y-2">
                {duties
                  .filter((d) => d.done)
                  .map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground line-through"
                    >
                      <button
                        onClick={() => toggleDuty(d.id)}
                        className="flex h-4 w-4 items-center justify-center border border-primary bg-primary text-primary-foreground"
                      >
                        <Check className="h-2.5 w-2.5" />
                      </button>
                      {d.title}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

interface DutyGroupProps {
  label: string;
  icon: React.ReactNode;
  duties: Duty[];
  onToggle: (id: string) => void;
  onJumpToCase: (id: string) => void;
  caseLabel: (id?: string) => string | null;
}

const DutyGroup = ({ label, icon, duties, onToggle, onJumpToCase, caseLabel }: DutyGroupProps) => {
  if (duties.length === 0) return null;
  return (
    <div className="border-b border-border p-6 last:border-b-0">
      <span className="eyebrow flex items-center gap-2">
        {icon} {label}
      </span>
      <ul className="mt-3 space-y-2">
        {duties.map((d) => (
          <li
            key={d.id}
            className="flex items-start gap-3 border-l-2 border-border bg-background/40 p-3 hover:border-primary/60 transition-colors"
          >
            <button
              onClick={() => onToggle(d.id)}
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border border-border hover:border-primary"
              aria-label="Erledigt"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] ${PRIO_TONE[d.priority]}`}
                >
                  {d.priority}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {d.category}
                </span>
              </div>
              <div className="mt-1.5 text-sm">{d.title}</div>
              <div className="mt-1 flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {d.due}
                </span>
                {d.caseId && (
                  <button
                    onClick={() => onJumpToCase(d.caseId!)}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {caseLabel(d.caseId)}
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
