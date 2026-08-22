import { cn } from "@/lib/utils";

type LoadingSnakeProps = {
  label?: string;
  className?: string;
  compact?: boolean;
};

export function LoadingSnake({ label = "Lade", className, compact = false }: LoadingSnakeProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn("inline-flex flex-col items-center justify-center gap-3 text-muted-foreground", className)}
    >
      <div
        aria-hidden="true"
        className={cn("loading-snake-spin", compact && "loading-snake-spin--compact")}
      />
      {label && (
        <span className="font-mono text-[10px] uppercase tracking-[0.22em]">
          {label}
        </span>
      )}
    </div>
  );
}

export function PageLoader({ label = "Lade" }: { label?: string }) {
  return (
    <div className="min-h-screen bg-background text-muted-foreground flex items-center justify-center">
      <LoadingSnake label={label} />
    </div>
  );
}
