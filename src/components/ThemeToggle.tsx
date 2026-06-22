import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export const ThemeToggle = ({ className }: { className?: string }) => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  const toggle = () => {
    const next = isDark ? "light" : "dark";
    // Use the View Transitions API for a buttery page crossfade when available
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> };
    };
    if (typeof doc.startViewTransition === "function") {
      doc.startViewTransition(() => {
        setTheme(next);
      });
    } else {
      setTheme(next);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "relative inline-flex h-9 w-[68px] shrink-0 items-center rounded-full",
        "border border-border bg-muted/60 backdrop-blur-md",
        "outline-none ring-offset-background transition-all",
        "hover:bg-muted hover:border-primary/40",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "shadow-inset-hl",
        className,
      )}
    >
      {/* Track icons */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-between px-2.5">
        <Sun
          className={cn(
            "h-3.5 w-3.5 transition-all duration-500",
            isDark ? "scale-75 opacity-30 text-muted-foreground" : "scale-100 opacity-100 text-primary",
          )}
          style={{ transitionTimingFunction: "var(--ease-spring)" }}
        />
        <Moon
          className={cn(
            "h-3.5 w-3.5 transition-all duration-500",
            isDark ? "scale-100 opacity-100 text-primary" : "scale-75 opacity-30 text-muted-foreground",
          )}
          style={{ transitionTimingFunction: "var(--ease-spring)" }}
        />
      </span>

      {/* Sliding knob */}
      <span
        className={cn(
          "pointer-events-none z-10 flex h-7 w-7 items-center justify-center rounded-full",
          "bg-background shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.5)] ring-1 ring-primary/20",
          "transition-all duration-500",
        )}
        style={{
          transform: isDark ? "translateX(34px)" : "translateX(2px)",
          transitionTimingFunction: "var(--ease-spring)",
        }}
      >
        <span className="relative h-3.5 w-3.5">
          {mounted ? (
            <>
              <Sun
                className={cn(
                  "absolute inset-0 h-3.5 w-3.5 text-primary transition-all duration-500",
                  isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100",
                )}
                style={{ transitionTimingFunction: "var(--ease-spring)" }}
              />
              <Moon
                className={cn(
                  "absolute inset-0 h-3.5 w-3.5 text-primary transition-all duration-500",
                  isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0",
                )}
                style={{ transitionTimingFunction: "var(--ease-spring)" }}
              />
            </>
          ) : null}
        </span>
      </span>
    </button>
  );
};