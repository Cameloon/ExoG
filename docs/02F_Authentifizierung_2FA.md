# 2FA / Passkeys erzwingen (Clerk)

**Typ:** No-Code-Konfiguration. **Ort:** Clerk Dashboard. **Code-Änderung:** keine.

## Warum
Behörden fordern häufig 2FA (BSI, OWASP ASVS). Clerk unterstützt TOTP,
Passkeys (FIDO2/WebAuthn) und SMS — muss nur aktiviert werden.

## Schritte
1. Clerk Dashboard → **User & Authentication → Multi-factor (MFA)**.
2. **Email-based MFA** oder **Authenticator application (TOTP)** aktivieren.
   - Empfohlen für Behörden: **Authenticator app (TOTP)** + optional **Passkeys**.
3. **Enforcement mode:** auf **`Enforce for all users`** setzen
   (nicht nur "optional"), damit auch Admins/Behördenrollen betroffen sind.
4. Optional: **Passkeys** unter *Web3 / Passkeys* aktivieren (phishing-resistent,
   steigert Sicherheit ohne UX-Einbuße).
5. Rollout: bestehende User werden beim nächsten Login zur 2FA-Setup
   aufgefordert. Ggf. Kommunikation an Pilotnutzer:innen senden.

## Verifikation
- Als Admin einloggen → nach Passwort sollte 2FA-Prompt erscheinen.
- `Auth.tsx` (Clerk `<SignIn>`) unterstützt MFA automatisch, keine Code-Änderung.

## Hinweis
Die App nutzt bereits Clerk (`@clerk/clerk-react`) — MFA ist reine Dashboard-Config.
