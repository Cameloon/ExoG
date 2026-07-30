# Barrierefreiheit — WCAG 2.1 AA / EN 301 549 / BITV 2.0

**Status:** Basis vorhanden (shadcn/Radix UI liefert ARIA, Fokus-Ringe,
Tastatursteuerung), aber **kein formaler Audit** durchgeführt.

## Quick-Wins (im Code noch offen)
- [ ] **Skip-Link** ("Zum Inhalt") oben in `App.tsx` / Layout einfügen.
- [ ] **Alt-Texte** bei Wards-Bildergalerie (`WardManager.tsx`, `Wards.tsx`)
      prüfen — dekorative `alt=""`, aber Tierbilder brauchen `alt={common_name}`.
- [ ] **Kontrast** der `muted-foreground`-Texte gegen `background` mit
      axe/devtools prüfen (viele Hinweis-Texte sind sehr dezent).
- [ ] **`lang`-Attribut** ok (`<html lang="de">`), aber dynamische Sprach-
      wechsel prüfen.
- [ ] **Fokus sichtbar** bei custom Elementen (PixelBlast Background hat
      `aria-label`, aber interaktive Bereiche?).

## Formale Prüfung (-organisatorisch)
1. **Automatisiert:** axe DevTools (Browser-Extension) oder
   `pa11y`/Lighthouse-CI in der Pipeline.
2. **Manuell:** Tastatur-only-Durchlauf (Tab durch ganze App, Fokus sichtbar?),
   Screenreader-Test (NVDA/VoiceOver) auf den 3 Hauptflows
   (Anmeldung, Bewerbung, Admin-Review).
3. **Nachweis:** Ergebnis als `docs/04_audit_[datum].md` ablegen
   (Konformitätserklärung BITV 2.0 §12).

## Relevante WCAG-2.1-AA-Kriterien (Auszug)
- 1.3.1 Info & Beziehungen (Struktur/ARIA)
- 1.4.3 Kontrast (Minimum)
- 1.4.11 Nicht-Text-Kontrast
- 2.1.1 Tastatur
- 2.4.7 Sichtbarer Fokus
- 4.1.2 Name, Rolle, Wert (ARIA)
