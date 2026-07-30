import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useExternalSupabase } from "@/integrations/external/supabase";
import { Download, FileSignature, RotateCcw, ShieldCheck } from "lucide-react";
import { z } from "zod";

const PLEDGE_KEY = "biosteward.pledge.v1";

const commitments = [
  {
    n: "I",
    title: "Kein Erwerb außerhalb der Pflege",
    text: "Ich kaufe, tausche oder züchte keine Tiere für eigene Sammlung. Aufnahmen geschehen ausschließlich für Pflege- oder Notfallplatzierungen im Custody-Netzwerk.",
  },
  {
    n: "II",
    title: "Pflege ist temporär",
    text: "Jedes Tier in meiner Obhut hat ein Vermittlungsziel. Wenn ich es selbst behalte, dokumentiere ich begründet warum eine andere Lösung nicht möglich war.",
  },
  {
    n: "III",
    title: "Tier vor Ich",
    text: "Bei Konflikt zwischen meinem persönlichen Interesse — emotional, finanziell, sozial — und dem Wohl des Tieres entscheide ich für das Tier.",
  },
  {
    n: "IV",
    title: "Radikale Transparenz",
    text: "Ich dokumentiere jeden Verlauf vollständig. Auch Sterbefälle, Fehlentscheidungen und Outcomes, die ich lieber nicht teilen würde.",
  },
  {
    n: "V",
    title: "Kein Status, kein Markt",
    text: "Ich nutze meine Sentinel-Rolle nicht für Reichweite, Verkauf, Werbung oder Selbstdarstellung außerhalb der Plattform.",
  },
  {
    n: "VI",
    title: "Reversibilität",
    text: "Ich darf jederzeit pausieren oder austreten. Niemand wird zur Aufnahme gezwungen. Ein leerer Sentinel ist besser als ein erschöpfter.",
  },
];

type SignedPledge = {
  signedName: string;
  signedAt: string;
  version: string;
  commitments: string[];
};

const schema = z.object({
  signedName: z.string().trim().min(2, "Name erforderlich").max(120),
  accepted: z.literal(true, {
    errorMap: () => ({ message: "Bitte alle Punkte bestätigen." }),
  }),
});

const Pledge = () => {
  const { user } = useAuth();
  const supabase = useExternalSupabase();
  const [existing, setExisting] = useState<SignedPledge | null>(null);
  const [fromApplication, setFromApplication] = useState(false);
  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState<boolean[]>(commitments.map(() => false));
  const [error, setError] = useState<string>("");

  useEffect(() => {
    document.title = "Pledge · Sentinel-Selbstverpflichtung";
    const meta = document.querySelector('meta[name="description"]');
    meta?.setAttribute(
      "content",
      "Die Sentinel-Selbstverpflichtung: sechs Punkte, privat unterzeichnet, jederzeit reversibel — Grundlage des BioSteward-Netzwerks.",
    );
  }, []);

  // Canonical source: the pledge signed inside the sentinel application
  // (sentinel_applications.pledge_data). localStorage is only the fallback
  // for visitors who haven't applied yet.
  useEffect(() => {
    if (!user) {
      const raw = localStorage.getItem(PLEDGE_KEY);
      if (raw) {
        try {
          setExisting(JSON.parse(raw));
        } catch {
          /* ignore */
        }
      }
      return;
    }
    supabase
      .from("sentinel_applications")
      .select("full_name, pledge_data, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const pd = (data as { full_name: string; pledge_data: { self_pledge?: boolean; signed_at?: string } | null; created_at: string } | null);
        if (pd?.pledge_data?.self_pledge) {
          setExisting({
            signedName: pd.full_name,
            signedAt: pd.pledge_data.signed_at ?? pd.created_at,
            version: "1.0",
            commitments: commitments.map((c) => `${c.n}. ${c.title}`),
          });
          setFromApplication(true);
          return;
        }
        const raw = localStorage.getItem(PLEDGE_KEY);
        if (raw) {
          try {
            setExisting(JSON.parse(raw));
          } catch {
            /* ignore */
          }
        }
      });
  }, [user, supabase]);

  const allChecked = accepted.every(Boolean);

  const onSign = () => {
    setError("");
    if (!allChecked) {
      setError("Bitte bestätige alle sechs Punkte.");
      return;
    }
    const result = schema.safeParse({ signedName: name, accepted: true });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    const signed: SignedPledge = {
      signedName: name.trim(),
      signedAt: new Date().toISOString(),
      version: "1.0",
      commitments: commitments.map((c) => `${c.n}. ${c.title}`),
    };
    localStorage.setItem(PLEDGE_KEY, JSON.stringify(signed));
    setExisting(signed);
    toast({
      title: "Pledge unterzeichnet",
      description: "Privat gespeichert. Jederzeit widerrufbar.",
    });
  };

  const onRevoke = () => {
    localStorage.removeItem(PLEDGE_KEY);
    setExisting(null);
    setAccepted(commitments.map(() => false));
    setName("");
    toast({
      title: "Pledge widerrufen",
      description: "Du kannst sie jederzeit erneut unterzeichnen.",
    });
  };

  const onDownload = () => {
    if (!existing) return;
    const lines = [
      "SENTINEL-SELBSTVERPFLICHTUNG · BioSteward",
      `Version ${existing.version}`,
      `Unterzeichnet von: ${existing.signedName}`,
      `Datum: ${new Date(existing.signedAt).toLocaleString("de-DE")}`,
      "",
      ...commitments.map((c) => `${c.n}. ${c.title}\n   ${c.text}\n`),
      "",
      "Diese Selbstverpflichtung ist privat, reversibel und nicht öffentlich einsehbar.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pledge-${existing.signedName.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <section className="border-b border-border bg-hero">
          <div className="container py-20 lg:py-28">
            <span className="eyebrow">§ Pledge · Selbstverpflichtung</span>
            <h1 className="font-editorial mt-6 max-w-4xl text-5xl leading-[1.02] md:text-6xl">
              Sechs Sätze. <em className="italic text-primary">Eine Haltung.</em>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              Die Pledge ist kein Vertrag. Sie ist ein privater Eid an dich
              selbst — und das einzige, was alle Sentinels gemeinsam haben.
            </p>
          </div>
        </section>

        <section className="border-b border-border bg-surface">
          <div className="container grid gap-12 py-20 lg:grid-cols-12">
            {/* Commitments */}
            <div className="lg:col-span-7">
              <ol className="space-y-px border border-border bg-border">
                {commitments.map((c, i) => (
                  <li key={c.n} className="bg-background p-6 md:p-8">
                    <div className="flex items-baseline justify-between gap-6">
                      <div>
                        <span className="font-mono text-[11px] tracking-[0.22em] text-primary">
                          {c.n}
                        </span>
                        <h3 className="font-display mt-2 text-xl">{c.title}</h3>
                      </div>
                      {!existing && (
                        <label className="flex shrink-0 cursor-pointer items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          <Checkbox
                            checked={accepted[i]}
                            onCheckedChange={(v) =>
                              setAccepted((arr) =>
                                arr.map((x, idx) => (idx === i ? Boolean(v) : x)),
                              )
                            }
                          />
                          Akzeptiert
                        </label>
                      )}
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                      {c.text}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            {/* Sign / Manage */}
            <aside className="lg:col-span-5">
              <div className="sticky top-24 border border-border bg-background p-6 md:p-8">
                {existing ? (
                  <>
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                        Aktiv unterzeichnet
                      </span>
                    </div>
                    <h2 className="font-editorial mt-4 text-3xl">
                      Pledge gilt.
                    </h2>
                    <dl className="mt-6 space-y-3 border-t border-border pt-6 font-mono text-xs">
                      <Row label="Name" value={existing.signedName} />
                      <Row
                        label="Unterzeichnet"
                        value={new Date(existing.signedAt).toLocaleString("de-DE")}
                      />
                      <Row label="Version" value={existing.version} />
                      <Row label="Punkte" value={`${existing.commitments.length} / 6`} />
                    </dl>
                    <div className="mt-8 flex flex-col gap-2">
                      <Button onClick={onDownload} variant="outline" className="justify-start">
                        <Download className="mr-2 h-4 w-4" /> Kopie herunterladen
                      </Button>
                      {!fromApplication && (
                        <Button
                          onClick={onRevoke}
                          variant="ghost"
                          className="justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <RotateCcw className="mr-2 h-4 w-4" /> Pledge widerrufen
                        </Button>
                      )}
                    </div>
                    <p className="mt-6 text-xs text-muted-foreground">
                      {fromApplication
                        ? "Diese Pledge ist Teil deines Sentinel-Antrags und im Custody-Netzwerk hinterlegt. Widerruf läuft über den Antrag selbst."
                        : "Die Pledge ist lokal in diesem Browser gespeichert. Bei vollständiger Sentinel-Aktivierung wird sie verschlüsselt im Custody-Netzwerk hinterlegt."}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <FileSignature className="h-5 w-5 text-primary" />
                      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                        Unterzeichnen
                      </span>
                    </div>
                    <h2 className="font-editorial mt-4 text-3xl">
                      Privat. <em className="italic">Reversibel.</em>
                    </h2>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Bestätige links alle sechs Punkte und unterschreibe mit
                      deinem Klarnamen. Nichts wird veröffentlicht.
                    </p>
                    <div className="mt-6">
                      <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                        Klarname
                      </Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={120}
                        placeholder="Vor- und Nachname"
                        className="mt-2"
                      />
                    </div>
                    <div className="mt-6 flex items-center justify-between border-t border-border pt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      <span>Bestätigt</span>
                      <span className={allChecked ? "text-primary" : ""}>
                        {accepted.filter(Boolean).length} / {commitments.length}
                      </span>
                    </div>
                    {error && (
                      <p className="mt-3 text-xs text-destructive">{error}</p>
                    )}
                    <Button onClick={onSign} className="mt-6 w-full" size="lg">
                      Pledge unterzeichnen
                    </Button>
                  </>
                )}
              </div>
            </aside>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-4">
    <dt className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
      {label}
    </dt>
    <dd className="text-right text-foreground">{value}</dd>
  </div>
);

export default Pledge;
