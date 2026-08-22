import { useEffect, useRef, useState } from "react";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Wiss.-Name input with CITES autocomplete (cites_species, trigram index).
 *  Native datalist — no picker lib needed. Reports the matched listing up. */
export const SpeciesInput = ({
  value, onChange, onListingChange,
}: { value: string; onChange: (v: string) => void; onListingChange: (listing: string) => void }) => {
  const supabase = useExternalSupabase();
  const [options, setOptions] = useState<{ full_name: string; current_listing: string | null }[]>([]);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 3) { setOptions([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("cites_species")
        .select("full_name, current_listing")
        .ilike("full_name", `%${q}%`)
        .limit(10);
      setOptions((data ?? []) as { full_name: string; current_listing: string | null }[]);
    }, 250);
    return () => clearTimeout(timer);
  }, [value, supabase]);

  const match = options.find((o) => o.full_name === value.trim());

  // Report the matched listing upward, but only when it actually changes.
  // Callers pass inline callbacks (new identity every render) — without the
  // guard this effect re-fires on every render and loops forever.
  const lastReportedRef = useRef("");
  useEffect(() => {
    const listing = match?.current_listing ?? "";
    if (lastReportedRef.current !== listing) {
      lastReportedRef.current = listing;
      onListingChange(listing);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.current_listing]);

  return (
    <div>
      <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        Wiss. Name
      </Label>
      <Input
        placeholder="Pogona vitticeps"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2"
        list="cites-species"
        autoComplete="off"
      />
      <datalist id="cites-species">
        {options.map((o) => (
          <option key={o.full_name} value={o.full_name} label={o.current_listing ? `CITES Anhang ${o.current_listing}` : undefined} />
        ))}
      </datalist>
      {match?.current_listing && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
          CITES Anhang {match.current_listing}
        </p>
      )}
    </div>
  );
};
