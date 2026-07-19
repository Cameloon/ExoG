import { Link } from "react-router-dom";
import { Logo } from "./Logo";

export const SiteFooter = () => (
  <footer className="border-t border-border bg-surface">
    <div className="container py-16">
      <div className="grid gap-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Dezentrale Auffanginfrastruktur für beschlagnahmte Exoten.
            Entwickelt mit Veterinärämtern, DGHT-Standards und dem
            Tierschutzgesetz im Einklang.
          </p>
          <div className="mt-6 flex items-center gap-2">
            <span className="h-1.5 w-1.5 bg-success animate-pulse-dot" />
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Pilotbetrieb · Region Süd
            </span>
          </div>
        </div>

        <div>
          <h4 className="eyebrow mb-4">Plattform</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="#system" className="hover:text-foreground">Behörden</a></li>
            <li><a href="#system" className="hover:text-foreground">Stewards</a></li>
            <li><a href="#workflow" className="hover:text-foreground">Ablauf</a></li>
            <li><a href="#recht" className="hover:text-foreground">CITES & TierSchG</a></li>
          </ul>
        </div>

        <div>
          <h4 className="eyebrow mb-4">Rechtliches</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/datenschutz" className="hover:text-foreground">Datenschutz</Link></li>
            <li><Link to="/impressum" className="hover:text-foreground">Impressum</Link></li>
            <li><a href="#" className="hover:text-foreground">Sicherheit</a></li>
            <li><Link to="/datenschutz" className="hover:text-foreground">DSGVO-Auftragsverarbeitung</Link></li>
          </ul>
        </div>
      </div>

      <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 md:flex-row md:items-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          © 2026 ExoGuard / BioSteward · Geschlossenes Netzwerk · Kein Marktplatz
        </p>
        <p className="font-mono text-[11px] text-muted-foreground">
          Aktenzeichen-Format: EG-{new Date().getFullYear()}-XXXXX
        </p>
      </div>
    </div>
  </footer>
);
