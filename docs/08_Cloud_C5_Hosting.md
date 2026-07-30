# Cloud / Hosting — EU & BSI C5

## Aktueller Stand
| Dienst | Region | EU? | BSI C5 |
|---|---|---|---|
| **Supabase** | eu-west-1 (Irland) | ✅ | [Supabase C5/ISO 27001 vorhanden] |
| **Clerk** | DE / IE (Frankfurt/Dublin) | ✅ | [Clerk SOC2/ISO vorhanden] |

→ Datenverarbeitung im EU-Raum = DSGVO-konform (kein Drittlandtransfer).

## BSI C5 Nachweis
- [ ] **Supabase C5 / ISO 27001** Bescheinigung vom Anbieter einholen
      (Supabase veröffentlicht Compliance-Dokumente im Dashboard / Trust Center).
- [ ] **Clerk SOC 2 Type II / ISO 27001** einholen.
- [ ] Beide in `docs/08_c5_nachweise.md` (oder als PDF) ablegen.
- [ ] Bei **Bundesbehörden**: ggf. zusätzlich
      **ISO 27001 auf Basis IT-Grundschutz** nachweisen (Betreiberseite).

## Vertraglich
- AVV mit beiden (s. `03B_Auftragsverarbeitung_AVV.md`).
- Sub-Prozessoren (z.B. Supabase nutzt ggf. AWS eu-west-1) im AVV erfassen.

## Hinweis
Die App selbst ist die "Applikation" — der C5-Nachweis liegt beim
Infrastrukturanbieter. Der Betreiber muss die Bescheinigungen nur
einholen und archivieren. Keine Code-Änderung nötig.
