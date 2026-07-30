# Löschkonzept (DSGVO Art. 5 Abs. 1 lit. e, Art. 17)

## Grundsatz
Personenbezogene Daten werden nur so lange gespeichert, wie der Zweck es
erfordert. Nutzer:innen können jederzeit selbst löschen.

## Selbstlöschung (bereits implementiert)
- **Ort:** `/account` → "Konto löschen"
- **Effekt:** löscht Profil, Rollen, Bewerbungen, Dokumente, Shelter-Requests
  und KYC-Dateien (Storage) sowie den Clerk-User (via Admin API).
- **Log:** der Eintrag in `application_audit_log` bleibt erhalten
  (`on delete set null` bei `application_id`) → revisionssicher.

## Löschfristen (auszufüllen)
| Daten | Frist | Auslöser |
|---|---|---|
| KYC-Dokumente (nicht freigegebene Bewerbungen) | [z.B. 6 Monate nach Ablehnung] | [manuell / Cron] |
| Bewerbungen (abgelehnt) | [z.B. 12 Monate] | [ ] |
| Audit-Logs | [gesetzliche Aufbewahrung, z.B. 3–10 J.] | **nicht** automatisch löschen |
| Inaktive Accounts | [z.B. 24 Monate inaktiv] | [ ] |

## Technische Löschwege
- **DB:** `delete-account` Edge Function (Service-Role) oder manuell via SQL.
- **Storage:** KYC-Bucket-Objekte werden mitgelöscht (Prefix `userId/`).
- **Clerk:** `DELETE /v1/users/{id}` (nur mit `CLERK_SECRET_KEY`).

## Aufgabe
Fristen mit DSB abstimmen und in dieser Tabelle füllen. Cron-Job / Supabase
Scheduled Function für verfallene Daten ggf. nachrüsten.
