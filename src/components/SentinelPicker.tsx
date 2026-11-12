import { useEffect, useId, useState } from "react";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { fetchSentinelPage, type NetworkSentinel } from "@/lib/sentinel-directory";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function SentinelPicker({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const client = useExternalSupabase();
  const id = useId();
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<NetworkSentinel[]>([]);
  const [selected, setSelected] = useState<NetworkSentinel | null>(null);
  const [after, setAfter] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setBusy(true); setError(false);
    const timer = setTimeout(() => {
      void fetchSentinelPage(client, { search, after, limit: 50, signal: abort.signal })
        .then(setRows).catch(() => { if (!abort.signal.aborted) setError(true); })
        .finally(() => { if (!abort.signal.aborted) setBusy(false); });
    }, 250);
    return () => { abort.abort(); clearTimeout(timer); };
  }, [client, search, after, revision]);
  return <div className="space-y-2">
    <Label htmlFor={`${id}-search`}>Sentinel suchen</Label>
    <Input id={`${id}-search`} type="search" value={search} disabled={disabled} placeholder="Name, Art oder Ort" onChange={(e) => { setSearch(e.target.value); setAfter(undefined); }} />
    <Label htmlFor={id}>Sentinel zuweisen (optional)</Label>
    <select id={id} className="h-10 w-full min-w-0 border border-border bg-background px-3 text-sm" disabled={disabled || busy || error}
      value={value} onChange={(e) => { setSelected(rows.find((s) => s.user_id === e.target.value) ?? null); onChange(e.target.value); }}>
      <option value="">Zuweisung unverändert lassen</option>
      {selected && !rows.some((s) => s.user_id === selected.user_id) && <option value={selected.user_id}>{selected.full_name} · {selected.region}</option>}
      {rows.map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name} · {s.region} · {s.species_focus ?? s.tier}</option>)}
    </select>
    <p role="status" className="text-xs text-muted-foreground">{busy ? "Suche Sentinels …" : error ? "Suche nicht verfügbar." : rows.length ? "Freigegebene Sentinels aus dem gesamten Bundesgebiet." : "Keine passenden Sentinels gefunden. Suche ändern oder leer lassen."}</p>
    {error && <Button type="button" variant="outline" size="sm" onClick={() => setRevision((v) => v + 1)}>Suche erneut versuchen</Button>}
    <div className="flex flex-wrap gap-2">
      {after && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setAfter(undefined)}>Erste Ergebnisse</Button>}
      {rows.length === 50 && <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setAfter(rows.at(-1)?.user_id)}>Weitere Ergebnisse</Button>}
    </div>
  </div>;
}
