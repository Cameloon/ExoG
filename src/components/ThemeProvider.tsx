import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export const ThemeProvider = ({ children }: { children: ReactNode }) => (
  <NextThemesProvider
    defaultTheme="dark"
    enableSystem={false}
    attribute="class"
    disableTransitionOnChange={false}
  >
    {children}
  </NextThemesProvider>
);