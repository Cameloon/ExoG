import { ACCENT_OPTIONS, useAccentTheme, type AccentTheme } from "@/hooks/useAccentTheme";

const labels: Record<AccentTheme, string> = {
  orange: "Orange",
  lila: "Lila",
  mono: "Graphit",
  forest: "Forest",
  lagoon: "Lagoon",
};

const swatches: Record<AccentTheme, string> = {
  orange: "#eab308",
  lila: "#818cf8",
  mono: "#a1a1aa",
  forest: "#14b8a6",
  lagoon: "#06b6d4",
};

export const AccentThemeSelector = () => {
  const { accent, setAccent } = useAccentTheme();

  return (
    <div className="flex flex-wrap gap-1 border border-border p-1" role="group" aria-label="Akzentfarbe wählen">
      {ACCENT_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setAccent(option)}
          aria-pressed={accent === option}
          className={`flex items-center gap-2 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            accent === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <span className="h-2.5 w-2.5" style={{ backgroundColor: swatches[option] }} aria-hidden />
          {labels[option]}
        </button>
      ))}
    </div>
  );
};
