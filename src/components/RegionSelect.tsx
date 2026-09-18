import { Label } from "@/components/ui/label";
import { BUNDESLAENDER, LANDKREISE } from "@/lib/germanRegions";

type Props = {
  state: string;
  district: string;
  onState: (v: string) => void;
  onDistrict: (v: string) => void;
  stateLabel?: string;
  districtLabel?: string;
  required?: boolean;
};

// Two-step region picker backed by the single source of truth in
// src/lib/germanRegions.ts. Stores "Bundesland" + "Landkreis" separately.
export const RegionSelect = ({
  state, district, onState, onDistrict,
  stateLabel = "Bundesland", districtLabel = "Landkreis / Kreis",
  required = true,
}: Props) => {
  const districts = state ? LANDKREISE[state] ?? [] : [];
  const isCityState = districts.length === 0;

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{stateLabel}</Label>
        <select
          value={state}
          onChange={(e) => onState(e.target.value)}
          required={required}
          className="mt-2 h-10 w-full border border-border bg-background px-3 text-sm"
        >
          <option value="" disabled>{required ? "Bundesland wählen …" : "—"}</option>
          {BUNDESLAENDER.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div>
        <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{districtLabel}</Label>
        {isCityState ? (
          <input
            value={district}
            onChange={(e) => onDistrict(e.target.value)}
            placeholder="Stadt (z.B. Berlin)" className="mt-2 h-10 w-full border border-border bg-background px-3 text-sm"
          />
        ) : (
          <select
            value={district}
            onChange={(e) => onDistrict(e.target.value)}
            required={required}
            disabled={!state}
            className="mt-2 h-10 w-full border border-border bg-background px-3 text-sm disabled:opacity-50"
          >
            <option value="" disabled>{state ? "Landkreis wählen …" : "zuerst Bundesland"}</option>
            {districts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </div>
    </div>
  );
};
