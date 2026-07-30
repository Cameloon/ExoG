# Sicherheits-, Berechtigungs- & Notfallkonzept

Kombiniert die drei geforderten Dokumente (IT-Grundschutz: Dokumentation,
Rollen- und Rechtekonzept, Notfallkonzept).

## 1. Berechtigungskonzept (RBAC)
Rollen (Clerk `publicMetadata.role` + Supabase `user_roles`):

| Rolle | Rechte | Quelle |
|---|---|---|
| `admin` | Alle Bewerbungen lesen, KYC-Docs ansehen, Status setzen, Audit-Log lesen | `has_role` + RLS |
| `behoerde` / `gov` | Behörden-Dashboard | `isBehoerde` |
| `einrichtung` / `shelter` | Eigene Ward-Listings verwalten | RLS `owner_id` |
| `sentinel` | Netzwerk-Zugriff nach Freigabe | `isSentinel` |
| `user` | Eigenes Profil, eigene Bewerbung | RLS `user_id` |

- **Prinzip:** Least Privilege. RLS erzwingt Zeilenebene; `has_role()` ist
  `security definer`, fälschungssicher (Clerk-JWT `app_role` Claim).
- **Admin-Vergabe:** manuell in Supabase (`user_roles`) + Clerk Metadata.

## 2. Sicherheitskonzept (Technisch)
- **Transport:** TLS 1.2+/1.3 (Hoster), HSTS-Header (`index.html`).
- **App-Header:** CSP, X-Content-Type-Options, Referrer-Policy, X-Frame-Options.
- **Auth:** Clerk (OIDC/OAuth2), MFA s. `02F_Authentifizierung_2FA.md`.
- **Audit:** `application_audit_log` (unveränderbar) + `change_log` (Trigger).
- **Rate Limiting:** Upload-Function (20/min/User).
- **KYC-Upload:** Magic-Bytes-Prüfung, 10-MB-Cap, eigener Pfad je User.
- **Löschung:** `delete-account` Edge Function (DSGVO Art. 17).

## 3. Notfallkonzept
| Szenario | Reaktion | RTO |
|---|---|---|
| Supabase-Ausfall | Failover / Support eskalieren | [supabase SLA] |
| Datenleck (KYC-Bucket public) | Sofort: Bucket auf private prüfen, Keys rotieren | < 1h |
| Admin-Account kompromittiert | Clerk: User suspendieren, `user_roles` entfernen | < 1h |
| Ransomware / DB-Kompromittierung | PITR-Restore (s. `05_Backup_Wiederherstellung.md`) | < 4h |

- **ESkalation:** [Liste Ansprechpartner + Telefon].
- **Kommunikation:** [Vorlage Betroffeneninfo nach Art. 33/34 DSGVO].

## 4. Secure SDLC
- Lint (ESLint) + Vitest im Repo.
- CSP + Security-Header im Build.
- **Offen:** Pentest + SAST/Dependabot — siehe `07_Pentest_Schwachstellenmanagement.md`.
