import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

export const Logo = ({ className = "", to = "/start" }: { className?: string; to?: string }) => (
  <Link to={to} className={`group inline-flex items-center gap-2.5 ${className}`}>
    <div className="relative flex h-7 w-7 items-center justify-center border border-border bg-surface-elevated">
      <ShieldCheck className="h-3.5 w-3.5 text-primary" strokeWidth={2.25} />
      <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 bg-primary animate-pulse-dot" />
    </div>
    <div className="flex flex-col leading-none">
      <span className="font-display text-base font-semibold tracking-tight">
        ExoGuard
      </span>
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        BioSteward · DE
      </span>
    </div>
  </Link>
);
