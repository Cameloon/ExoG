# Datenschutz-Folgenabschätzung (DSFA) — Vorlage

**Rechtsgrundlage:** DSGVO Art. 35 (Verordnung (EU) 2016/679), BDSG.

**System:** ExoGuard / BioSteward Custody Network — Web-App zur Koordination
von Custody für beschlagnahmte Exoten zwischen Behörden, Einrichtungen, Sentinel-Netzwerk.

## 1. Verantwortlicher
- [Behörde / Betreiber Name], [Anschrift], [Vertretungsberechtigte:r]
- Datenschutzbeauftragte:r: [Name, Kontakt]

## 2. Zweck der Verarbeitung
Identitätsprüfung (KYC), Custody-Koordination, Zuweisung von Platzierungen.

## 3. Rechtsgrundlagen (Art. 6 Abs. 1 DSGVO)
- lit. b) Vertragserfüllung (Aufnahme als Sentinel/Einrichtung)
- lit. c) Rechtliche Verpflichtung (Behördenkontext, CITES/TierSchG)
- lit. f) Berechtigtes Interesse (Betrugsschutz via Identitätsabgleich)

## 4. Betroffene Personen
Bewerber:innen (Sentinel), Einrichtungen, Behördenmitarbeiter:innen,
Antragstellende (beschlagnahmende Behörden).

## 5. Verarbeitete Daten
| Kategorie | Beispiel | Quelle |
|---|---|---|
| Stammdaten | Name, E-Mail | Selbstauskunft |
| Identitätsnachweise | Ausweisbild vorne/hinten, Gesichtsbild, Halteanlage-Foto | Upload (KYC) |
| Fachdaten | Custody-Platzierungen, Wards, Interessen | Eingabe |
| Metadaten | Audit-Log (actor, Aktion, Zeit) | System |

## 6. Risikobewertung (Art. 35 Abs. 3)
- [ ] Profiling / automatisierte Entscheidung: **Nein** (nur menschliche Freigabe).
- [ ] Umfangreiche Verarbeitung besonderer Kategorien (Art. 9): **Nein**.
- [ ] Überwachungsumfeld: **Nein** (kein Tracking, keine Scoring).
- Verbleibendes Risiko: Missbrauch von Identitätsdokumenten bei Datendiebstahl.

## 7. Schutzmaßnahmen (TOMs)
- Verschlüsselung At-Rest (Supabase) + In-Transit (TLS 1.2+/1.3).
- Privater KYC-Bucket (kein Public-Access), nur Admin-Read via RLS.
- Unveränderbares Audit-Log (`application_audit_log`, `change_log`).
- RBAC + RLS (kein Zugriff außerhalb der Rolle).
- DSGVO-Art.-17-Selbstlöschung (`/account`).
- EU-Hosting (Supabase Irland, Clerk DE/IE).

## 8. Ergebnis
Risiko nach Maßnahmen **niedrig / mittel** → [ ] keine weitere Prüfung nötig /
[ ] DPIA-Escalation an Aufsichtsbehörde.

## 9. Freigabe
Unterschrift DSB / Verantwortlicher: ____________ Datum: ____________
