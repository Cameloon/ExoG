import { useEffect, useState } from "react";

export const ACCENT_OPTIONS = ["orange", "lila", "mono", "forest", "lagoon"] as const;
export type AccentTheme = (typeof ACCENT_OPTIONS)[number];

const STORAGE_KEY = "v2.acc";
const EVENT_NAME = "exoguard-accent-change";

export const readAccentTheme = (): AccentTheme => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return ACCENT_OPTIONS.includes(value as AccentTheme) ? (value as AccentTheme) : "orange";
  } catch {
    return "orange";
  }
};

export const writeAccentTheme = (value: AccentTheme) => {
  try {
    localStorage.setItem(STORAGE_KEY, value);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: value }));
  } catch {
    // A blocked localStorage should not prevent changing the current view.
  }
};

export const useAccentTheme = () => {
  const [accent, setAccentState] = useState<AccentTheme>(readAccentTheme);

  useEffect(() => {
    const sync = (event?: Event) => {
      const detail = (event as CustomEvent<AccentTheme> | undefined)?.detail;
      setAccentState(detail && ACCENT_OPTIONS.includes(detail) ? detail : readAccentTheme());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) sync();
    };
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { accent, setAccent: writeAccentTheme };
};
