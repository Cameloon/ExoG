# Schnittstellen — REST / OpenAPI

## Aktueller Stand
- **Datenzugriff:** Supabase REST API (PostgREST) über `useExternalSupabase()`.
- **Edge Functions (REST):**
  - `POST /functions/v1/kyc-upload` — KYC-Dokument-Upload
  - `POST /functions/v1/delete-account` — DSGVO-Löschung
  - `POST /functions/v1/send-application-confirmation` — E-Mail
- **Kein XÖV / OSCI / SOAP** — diese sind nur für bestehende Fachverfahren
  (z.B. OSCI-Transport) relevant. Für reine Web-Behörden-Apps ist REST
  zunehmend ausreichend.

## OpenAPI-Spec (empfohlen)
Für Schnittstellen-Dokumentation (Behörden/Partner) sollte eine
`openapi.yaml` hinterlegt werden. Da die Edge Functions das Format definieren,
kann eine minimale Spec manuell gepflegt werden:

```yaml
openapi: 3.1.0
info:
  title: ExoGuard Functions
  version: 1.0.0
paths:
  /functions/v1/kyc-upload:
    post:
      summary: KYC document upload
      security: [{ bearerAuth: [] }]
      # headers: x-application-id, x-slot (id_front|id_back|facility|selfie)
  /functions/v1/delete-account:
    post:
      summary: DSGVO account deletion
      security: [{ bearerAuth: [] }]
```

## Zu tun
- [ ] `docs/09_openapi.yaml` ausfüllen (optional, für Partner-Schnittstellen).
- [ ] Falls XÖV/OSCI-Anbindung an Fachverfahren gefordert: separat klären
      (i.d.R. Gateway/Middleware nötig, nicht Teil dieser SPA).

## Hinweis
OpenAPI ist **Doku**, keine Funktionsänderung. Nur bei behördlichen
Schnittstellenverhandlungen relevant.
