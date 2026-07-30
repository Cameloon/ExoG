# ExoGuard / BioSteward — Behördenkonformitäts-Dokumentation

Dieser Ordner sammelt die **organisatorischen und prozessualen** Nachweise,
die über den reinen App-Code hinaus für den Behörden-Einsatz gebraucht werden
(nach BSI IT-Grundschutz, DSGVO/BDSG, BITV 2.0, BSI C5).

Jede Datei ist eine **Vorlage / Checkliste** — Projektspezifika (Behördenname,
Ansprechpartner, regionale Vorgaben) sind mit `[...]` markiert und von dir zu füllen.

## Stand der App (technisch, Stand: 2026-07)

| Bereich | Status |
|---|---|
| RBAC / Rollenkonzept | ✅ (Clerk + Supabase RLS) |
| Unveränderbares Audit-Log | ✅ (`application_audit_log` + `change_log`) |
| Security-Header (HSTS, CSP, Referrer, Frame) | ✅ (`index.html`) |
| Rate Limiting (Upload) | ✅ (Edge Function) |
| DSGVO-Selbstlöschung | ✅ (`/account`, Edge Function) |
| Impressum / Datenschutz | ✅ (`/impressum`, `/datenschutz`) |
| EU-Hosting | ✅ (Supabase Irland eu-west-1, Clerk DE/IE) |
| 2FA / Passkeys | ⚠️ in Clerk konfigurieren — siehe `02F_Authentifizierung_2FA.md` |
| DSFA / AVV / Löschkonzept | ⚠️ auszufüllen — siehe `03A`–`03C` |
| WCAG 2.1 AA Audit | ⚠️ siehe `04_Barrierefreiheit_WCAG.md` |
| Backup-Konzept | ⚠️ siehe `05_Backup_Wiederherstellung.md` |
| Pentest / SAST | ⚠️ siehe `07_Pentest_Schwachstellenmanagement.md` |

## Datei-Index

- `02F_Authentifizierung_2FA.md` — 2FA/Passkeys in Clerk aktivieren (No-Code)
- `03A_Datenschutz_DSFA.md` — Datenschutz-Folgenabschätzung (Vorlage)
- `03B_Auftragsverarbeitung_AVV.md` — Auftragsverarbeitungsverträge (Clerk, Supabase)
- `03C_Loeschkonzept.md` — Löschfristen & -wege
- `04_Barrierefreiheit_WCAG.md` — WCAG 2.1 AA Checkliste + Quick-Wins
- `05_Backup_Wiederherstellung.md` — Backup- & Wiederherstellungskonzept
- `06_Sicherheitskonzept.md` — Sicherheits-/Berechtigungs-/Notfallkonzept
- `07_Pentest_Schwachstellenmanagement.md` — Pentest + SAST/Dependabot
- `08_Cloud_C5_Hosting.md` — EU-Hosting / C5-Nachweis
- `09_Schnittstellen_OpenAPI.md` — REST-Status / OpenAPI
