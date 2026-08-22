import { parseQuestionnaire, SACHKUNDE_LABEL, type Questionnaire } from "@/lib/questionnaire";

// Read-only review block for the placement questionnaire (Sentinel-Aufnahme).
// Used by Einrichtungen (applicant review) and Behörden (oversight).
const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="grid grid-cols-3 gap-4 text-xs md:grid-cols-4">
    <dt className="col-span-1 text-muted-foreground">{k}</dt>
    <dd className="col-span-2 whitespace-pre-wrap text-foreground/85 md:col-span-3">{v || <span className="text-muted-foreground">—</span>}</dd>
  </div>
);

export const QuestionnaireBlock = ({ raw, className = "" }: { raw: unknown; className?: string }) => {
  const q: Questionnaire | null = parseQuestionnaire(raw);
  if (!q) return null;
  const fullAddress = [q.street, [q.zip, q.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return (
    <div className={className}>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        Vermittlungs-Fragebogen
      </p>
      <dl className="mt-2 grid grid-cols-1 gap-y-2 sm:grid-cols-2 sm:gap-x-6">
        <Row k="Anschrift" v={fullAddress} />
        <Row k="Telefon" v={q.phone} />
        <Row k="Geburtsdatum" v={q.birth_date} />
        <Row k="Terrarium · Maße" v={q.enclosure.size} />
        <Row k="Beleuchtung" v={q.enclosure.lighting} />
        <Row k="Temperatur / rF" v={q.enclosure.climate} />
        <Row k="Einrichtung" v={q.enclosure.setup} />
        <Row k="Tierbesatz" v={q.current_stock || "keiner"} />
        <Row k="Fütterung" v={q.feeding} />
        <Row k="Überwinterung" v={q.overwintering || "—"} />
        <Row k="Infoquellen" v={q.info_sources.join(", ")} />
        <Row k="Sachkundenachweis" v={SACHKUNDE_LABEL[q.sachkunde] + (q.sachkunde === "other" && q.sachkunde_detail ? `: ${q.sachkunde_detail}` : "")} />
      </dl>
    </div>
  );
};
