import { type ReactNode } from "react";
import { V2_CSS } from "@/lib/v2Theme";
import { useAccentTheme } from "@/hooks/useAccentTheme";

// Applies the v2/bklit skin + the user-chosen accent to pages that live
// outside AppShell (public routes such as /werte, /impressum, /datenschutz).
export const V2Scope = ({ children }: { children: ReactNode }) => {
  const { accent } = useAccentTheme();
  return (
    <div className="v2scope min-h-screen antialiased" data-acc={accent} data-app-v2>
      <style>{V2_CSS}</style>
      {children}
    </div>
  );
};

export default V2Scope;
