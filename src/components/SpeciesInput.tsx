import { useEffect, useId, useRef, useState } from "react";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SpeciesOption = { full_name: string; current_listing: string | null };
const canonical = (value: string) => value.trim().toLocaleLowerCase();

/** Search the shared reference and carry the exact selected listing forward. */
export const SpeciesInput = ({ value, listing, onChange, onListingChange, onBusyChange }: {
  value: string; listing?: string; onChange: (v: string) => void; onListingChange: (listing: string) => void; onBusyChange?: (busy: boolean) => void;
}) => {
  const supabase = useExternalSupabase();
  const inputId = useId();
  const [options, setOptions] = useState<SpeciesOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const report = useRef(onListingChange);
  report.current = onListingChange;
  const lastApplied = useRef("");
  const edited = useRef(false);
  const storedListing = useRef(listing); storedListing.current = listing;
  const reportBusy = useRef(onBusyChange); reportBusy.current = onBusyChange;
  useEffect(() => { reportBusy.current?.(busy); }, [busy]);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 3) { setOptions([]); setBusy(false); setError(false); return; }
    const controller = new AbortController();
    setBusy(true); setError(false);
    const timer = setTimeout(async () => {
      // Escape pattern characters; a typed '%' must not search the whole index.
      const term = query.replace(/[\\%_]/g, "\\$&");
      const { data, error } = await supabase.from("cites_species")
        .select("full_name, current_listing").eq("cites_accepted", true)
        .ilike("full_name", `%${term}%`).order("full_name").limit(15)
        .abortSignal(controller.signal);
      if (controller.signal.aborted) return;
      const rows = (data ?? []) as SpeciesOption[];
      setOptions(rows); setError(Boolean(error)); setBusy(false);
      const match = rows.find((row) => canonical(row.full_name) === canonical(query));
      const key = match ? `${canonical(match.full_name)}|${match.current_listing ?? ""}` : "";
      // Opening an existing case must not replace a verified population-specific
      // classification with the broader reference listing.
      if (match && key !== lastApplied.current && (edited.current || !storedListing.current)) {
        lastApplied.current = key;
        report.current(match.current_listing ?? "");
      }
    }, 250);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [value, supabase, revision]);

  const match = options.find((row) => canonical(row.full_name) === canonical(value));
  return <div>
    <Label htmlFor={inputId} className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Wiss. Name</Label>
    <Input id={inputId} placeholder="Art suchen, z. B. Python regius" value={value}
      aria-describedby={`${inputId}-status`} aria-busy={busy}
      onChange={(event) => {
        const next = event.target.value;
        edited.current = true;
        setBusy(next.trim().length >= 3);
        reportBusy.current?.(next.trim().length >= 3);
        if (canonical(next) !== canonical(value)) {
          lastApplied.current = "";
          const chosen = options.find((row) => canonical(row.full_name) === canonical(next));
          onListingChange(chosen?.current_listing ?? "");
          if (chosen) lastApplied.current = `${canonical(chosen.full_name)}|${chosen.current_listing ?? ""}`;
        }
        onChange(next);
      }} className="mt-2" list={`${inputId}-species`} autoComplete="off" />
    <datalist id={`${inputId}-species`}>
      {options.map((row) => <option key={row.full_name} value={row.full_name} label={row.current_listing ? `CITES ${row.current_listing}` : "Schutzstatus prüfen"} />)}
    </datalist>
    <p id={`${inputId}-status`} role="status" className="mt-1 text-xs text-muted-foreground">
      {busy ? "Artverzeichnis wird durchsucht …" : error ? "Artverzeichnis nicht erreichbar. Gespeicherte Angaben bleiben erhalten."
        : match?.current_listing ? !edited.current && listing ? `Artverzeichnis: CITES ${match.current_listing}. Die gespeicherte Angabe bleibt erhalten.` : `CITES ${match.current_listing} wird automatisch übernommen${match.current_listing.includes("/") ? "; Population / Herkunft prüfen" : ""}.`
        : value.trim().length >= 3 ? "Kein eindeutiger Schutzstatus gefunden. Bitte anhand der Nachweise prüfen."
        : "Ab drei Zeichen suchen und einen wissenschaftlichen Namen auswählen."}
    </p>
    {error && <button type="button" className="mt-1 text-xs text-primary underline" onClick={() => setRevision((n) => n + 1)}>Artverzeichnis erneut laden</button>}
  </div>;
};
