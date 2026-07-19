import { Link } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";

const Legal = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <>
    <SiteHeader />
    <main className="container max-w-2xl py-16 prose prose-invert">
      <h1 className="font-editorial text-3xl">{title}</h1>
      <div className="mt-6 space-y-4 text-sm text-muted-foreground">{children}</div>
      <p className="mt-8">
        <Link to="/" className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
          ← Zur Startseite
        </Link>
      </p>
    </main>
  </>
);

export const Impressum = () => (
  <Legal title="Impressum">
    <p>Angaben gemäß § 5 TMG.</p>
    <p>
      ExoGuard (BioSteward Custody Network)<br />
      Vertreten durch die Betreiberin<br />
      Kontakt: post(at)exoguard.example
    </p>
    <p>
      Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV: siehe oben.
    </p>
    <p>
      EU-Streitschlichtung: Die Europäische Kommission stellt eine Plattform zur
      Online-Streitbeilegung bereit (ec.europa.eu/consumers/odr).
    </p>
  </Legal>
);

export const Datenschutz = () => (
  <Legal title="Datenschutz">
    <p>
      Diese Anwendung verarbeitet personenbezogene Daten gemäß DSGVO. Verantwortlicher
      ist der oben genannte Betreiber.
    </p>
    <p>
      <strong>Verarbeitete Daten:</strong> Kontaktdaten (E-Mail, Name), Identitätsnachweise
      (KYC-Dokumente), sowie Custody-Fachdaten, die du selbst eingibst.
    </p>
    <p>
      <strong>Zweck:</strong> Identitätsprüfung, Custody-Koordination zwischen Behörden,
      Einrichtungen und Sentinel-Netzwerk.
    </p>
    <p>
      <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b) und c) DSGVO (Vertragserfüllung
      sowie rechtliche Verpflichtung im Behördenkontext).
    </p>
    <p>
      <strong>Hosting:</strong> Supabase (Region EU West, Irland) und Clerk (Deutschland /
      Irland). Datenverarbeitung im EU-Raum.
    </p>
    <p>
      <strong>Deine Rechte:</strong> Auskunft, Berichtigung, Löschung (Art. 17), Einschränkung
      der Verarbeitung, Datenübertragbarkeit. Löschung selbst unter „Konto → Konto löschen“.
    </p>
    <p>
      <strong>Logging:</strong> Änderungen an Fachdaten und am Bewerbungsprozess werden in
      einem unveränderlichen Audit-Log protokolliert (actor, Aktion, Zeitstempel).
    </p>
  </Legal>
);
