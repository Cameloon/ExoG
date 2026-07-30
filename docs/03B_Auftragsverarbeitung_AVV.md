# Auftragsverarbeitung (AVV) — Übersicht

**Rechtsgrundlage:** DSGVO Art. 28. Jeder externer Dienst, der personenbezogene
Daten in unserem Auftrag verarbeitet, braucht einen AVV.

## Eingesetzte Dienste

| Dienst | Zweck | Daten | AVV-Status |
|---|---|---|---|
| **Supabase** (eu-west-1, Irland) | DB, Auth-Backend, Storage (KYC) | Profile, Bewerbungen, KYC-Docs | [ ] AVV abschließen (Supabase DPA vorhanden) |
| **Clerk** (DE/IE) | Authentication, MFA, User-Management | User-IDs, E-Mail, Identitäts-Claims | [ ] AVV abschließen (Clerk DPA vorhanden) |
| [ optional: E-Mail-Provider ] | Bestätigungs-Mails | E-Mail-Adresse | [ ] klären |
| [ optional: Hosting/Static ] | SPA-Auslieferung | keine personenbez. Daten | [ ] ggf. AVV |

## Zu tun
1. Supabase DPA (Data Processing Addendum) unter
   https://supabase.com/dpa anfordern / im Dashboard akzeptieren.
2. Clerk DPA unter https://clerk.com/legal anfordern.
3. Sub-Unterauftragsverarbeiter (z.B. Supabase nutzt ggf. Sub-Prozessoren in EU)
   im AVV erfassen.
4. AVV mit Verantwortlichem und DSB gegenzeichnen; Kopie in `docs/` ablegen.

## Hinweis
Die App überträgt KYC-Dokumente **nur** an Supabase Storage (privater Bucket)
und nutzt Clerk **nicht** zum Speichern von Fachdaten — Angriffsfläche klein.
