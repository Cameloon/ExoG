import { useCallback, useEffect, useState } from "react";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { SpeciesInput } from "@/components/SpeciesInput";
import { CheckCircle2, Sparkles } from "lucide-react";

type IdRequest = {
  id: string;
  common_name: string;
  description: string;
  photos: string[];
  created_at: string;
};

type IdVote = {
  id: string;
  request_id: string;
  expert_id: string;
  species: string;
  listing: string | null;
  confidence: string;
  note: string;
};

/** Bestimmungshilfe queue — shown to approved sentinels with tier S4. */
export const IdentificationQueue = () => {
  const { user } = useAuth();
  const supabase = useExternalSupabase();
  const { toast } = useToast();
  const [requests, setRequests] = useState<IdRequest[]>([]);
  const [votes, setVotes] = useState<Record<string, IdVote[]>>({});
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(true);
  const [draft, setDraft] = useState<Record<string, { species: string; listing: string; confidence: string; note: string }>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const { data: reqs } = await supabase
        .from("identification_requests")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .range(0, 19);
      const list = (reqs ?? []) as unknown as IdRequest[];
      setRequests(list);
      if (list.length === 0) { setVotes({}); return; }
      const { data: v } = await supabase
        .from("identification_votes")
        .select("*")
        .in("request_id", list.map((r) => r.id));
      const map: Record<string, IdVote[]> = {};
      (v ?? []).forEach((x) => (map[x.request_id] ??= []).push(x as unknown as IdVote));
      setVotes(map);
      const paths = list.flatMap((r) => r.photos);
      if (paths.length > 0) {
        const { data: urls } = await supabase.storage.from("id-photos").createSignedUrls(paths, 60 * 60);
        const umap: Record<string, string> = {};
        (urls ?? []).forEach((u, i) => { if (u.signedUrl) umap[paths[i]] = u.signedUrl; });
        setPhotoUrls(umap);
      }
    } catch (e) {
      console.error("[IdentificationQueue] load failed:", e);
    } finally {
      setBusy(false);
    }
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  const submitVote = async (reqId: string) => {
    const d = draft[reqId];
    if (!user || !d?.species.trim()) return;
    setSubmitting(reqId);
    const { error } = await supabase.from("identification_votes").insert({
      request_id: reqId,
      expert_id: user.id,
      species: d.species.trim(),
      listing: d.listing || null,
      confidence: d.confidence,
      note: d.note.trim(),
    });
    setSubmitting(null);
    if (error) {
      toast({ title: "Gutachten konnte nicht gespeichert werden", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Gutachten abgegeben", description: "Deine Einschätzung fließt in die Bestimmung ein." });
    setDraft((p) => { const { [reqId]: _r, ...rest } = p; return rest; });
    void load();
  };

  return (
    <section className="border border-border bg-surface">
      <div className="border-b border-border p-5">
        <span className="eyebrow flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" /> Bestimmungshilfe</span>
        <p className="mt-2 text-sm text-muted-foreground">
          Behörden melden unbekannte Tiere. Als Sentinel der Stufe S4 bestimmst du Art und CITES-Schutzstatus — ein Mehrheitskonsens unabhängiger Gutachten bestätigt die Art.
        </p>
      </div>
      {busy ? (
        <p className="p-5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Lade Anfragen …</p>
      ) : requests.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">Keine offenen Bestimmungsanfragen.</p>
      ) : (
        <ul className="divide-y divide-border">
          {requests.map((r) => {
            const myVote = votes[r.id]?.find((v) => v.expert_id === user?.id);
            const d = draft[r.id];
            return (
              <li key={r.id} className="p-5">
                <div className="flex flex-wrap gap-4">
                  <div className="flex gap-2">
                    {r.photos.slice(0, 4).map((p) => (
                      photoUrls[p]
                        ? <a key={p} href={photoUrls[p]} target="_blank" rel="noopener noreferrer" className="block h-20 w-20 overflow-hidden border border-border">
                            <img src={photoUrls[p]} alt="Fundtier zur Bestimmung" className="h-full w-full object-cover" />
                          </a>
                        : <div key={p} className="h-20 w-20 animate-pulse border border-border bg-muted" />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.common_name}</p>
                    {r.description && <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>}
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {votes[r.id]?.length ?? 0} Gutachten · {new Date(r.created_at).toLocaleDateString("de-DE")}
                    </p>
                  </div>
                </div>

                {(votes[r.id] ?? []).length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {(votes[r.id] ?? []).map((v) => (
                      <li key={v.id} className="border border-border bg-background px-2 py-1 text-[11px]">
                        <span className="italic">{v.species}</span>
                        {v.listing && <span className="ml-1 font-mono text-[9px] uppercase text-primary">CITES {v.listing}</span>}
                        <span className="ml-1 font-mono text-[9px] text-muted-foreground">· {v.confidence}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {myVote ? (
                  <p className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Dein Gutachten: {myVote.species}
                  </p>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]">
                    <SpeciesInput
                      value={d?.species ?? ""}
                      onChange={(v) => setDraft((p) => ({ ...p, [r.id]: { species: v, listing: p[r.id]?.listing ?? "", confidence: p[r.id]?.confidence ?? "mittel", note: p[r.id]?.note ?? "" } }))}
                      onListingChange={(l) => setDraft((p) => ({ ...p, [r.id]: { species: p[r.id]?.species ?? "", listing: l, confidence: p[r.id]?.confidence ?? "mittel", note: p[r.id]?.note ?? "" } }))}
                    />
                    <select
                      value={d?.confidence ?? "mittel"}
                      onChange={(e) => setDraft((p) => ({ ...p, [r.id]: { species: p[r.id]?.species ?? "", listing: p[r.id]?.listing ?? "", confidence: e.target.value, note: p[r.id]?.note ?? "" } }))}
                      className="mt-2 h-10 self-end border border-border bg-background px-2 text-sm"
                    >
                      <option value="hoch">Sicherheit: hoch</option>
                      <option value="mittel">Sicherheit: mittel</option>
                      <option value="niedrig">Sicherheit: niedrig</option>
                    </select>
                    <Button size="sm" className="self-end" disabled={submitting === r.id || !d?.species.trim()} onClick={() => submitVote(r.id)}>
                      {submitting === r.id ? "Speichere …" : "Gutachten abgeben"}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
