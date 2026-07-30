# Backup- & Wiederherstellungskonzept

**Hosting:** Supabase (EU West, Irland). **Verantwortlich:** [Betreiber].

## Aktueller Stand
- Supabase führt automatische Backups durch (Daily, je nach Plan).
- **Point-in-Time Recovery (PITR)** ist je nach Plan verfügbar — **aktivieren!**
  (Supabase Dashboard → Project Settings → Database → PITR).

## Regelmäßige Backups
| Objekt | Mechanismus | Frequenz | Aufbewahrung |
|---|---|---|---|
| Postgres (Tabellen) | Supabase Managed Backup / PITR | täglich (PITR: minütlich) | [Plan-abhängig, z.B. 7–30 T.] |
| Storage (KYC-Docs) | Supabase Storage-Replikation | kontinuierlich | siehe Plan |
| Secrets (Clerk/Supabase) | [im Secret-Manager erfassen] | — | — |

## Wiederherstellung (RTO / RPO)
- **RTO (Recovery Time):** [z.B. < 4h] — neues Supabase-Projekt + Migrationen
  (`00001`–`00012`) + PITR-Restore.
- **RPO (Recovery Point):** [z.B. < 1h bei PITR].

## Zu tun
1. [ ] PITR in Supabase aktivieren.
2. [ ] Backup-Plan (Frequenz/Aufbewahrung) mit DSB/Behörde abstimmen.
3. [ ] Wiederherstellung 1× im Jahr **proben** (Restore-Test) → Ergebnis hier notieren.
4. [ ] Supabase-Region = EU bestätigen (Irland = EU, DSGVO-konform).

## Hinweis
Die Migrations unter `external-supabase/migrations/` sind die
**Wiederherstellungs-Anleitung** für das Schema — bei Neuaufbau in Reihenfolge
ausführen.
