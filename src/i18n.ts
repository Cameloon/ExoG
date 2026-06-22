import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const de = {
  nav: {
    sentinel: "Sentinel-Pfad",
    pledge: "Pledge",
    werte: "Werte & FAQ",
    system: "System",
    workflow: "Ablauf",
    admin: "Admin",
    becomeSentinel: "Sentinel werden",
    viewPlatform: "Plattform ansehen",
    backHome: "← Zur Startseite",
    signIn: "Anmelden",
    signOut: "Abmelden",
  },
  auth: {
    title: "Zugang zum Custody-Netzwerk",
    subtitle: "Verifizierte Identität · Audit-Spur · Datenschutz",
    email: "E-Mail",
    password: "Passwort",
    displayName: "Name",
    signIn: "Anmelden",
    signUp: "Konto erstellen",
    needAccount: "Noch kein Konto?",
    haveAccount: "Bereits registriert?",
    error: "Anmeldung fehlgeschlagen",
    successSignup: "Konto erstellt — du bist jetzt eingeloggt.",
    verifySent: "Bestätigungscode gesendet",
    verificationCode: "Bestätigungscode",
    verificationHint: "Gib den Code aus der E-Mail ein, um dein Konto zu aktivieren.",
    confirmCode: "Code bestätigen",
    changeEmail: "E-Mail ändern",
  },
  onboarding: {
    docs: {
      title: "KYC · Identitätsnachweis",
      hint:
        "Lade Ausweisdokumente und (optional) ein Foto deiner Halteanlage hoch. Dateien werden verschlüsselt gespeichert und sind ausschließlich für verifizierte Prüfer:innen einsichtig.",
      idFront: "Ausweis Vorderseite",
      idBack: "Ausweis Rückseite",
      facility: "Foto Halteanlage (optional)",
      uploaded: "Hochgeladen",
      required: "Beide Ausweisseiten sind erforderlich.",
    },
    verify: {
      blocked: "E-Mail-Verifizierung erforderlich",
      blockedDesc: "Bestätige zuerst deine E-Mail-Adresse, bevor du die Bewerbung einreichst.",
      sent: "Verifizierungs-Mail gesendet",
      sendFailed: "Verifizierungs-Mail fehlgeschlagen",
      refreshed: "Status aktualisiert",
      cta: "E-Mail zuerst bestätigen",
    },
    submitting: "Wird übermittelt…",
    confirmEmail: "Eine Bestätigungs-E-Mail wurde an {{email}} gesendet.",
  },
  admin: {
    title: "Admin · Bewerbungen",
    subtitle: "Manuelle KYC- und Eignungsprüfung",
    filterAll: "Alle",
    pending: "Offen",
    underReview: "In Prüfung",
    approved: "Freigegeben",
    rejected: "Abgelehnt",
    noResults: "Keine Bewerbungen.",
    review: "Prüfen",
    approve: "Freigeben",
    reject: "Ablehnen",
    setUnderReview: "In Prüfung setzen",
    notes: "Interne Notizen",
    documents: "Dokumente",
    viewDoc: "Öffnen",
    forbidden: "Kein Zugriff. Diese Seite ist Admins vorbehalten.",
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources: { de: { translation: de } },
    lng: "de",
    fallbackLng: "de",
    supportedLngs: ["de"],
    interpolation: { escapeValue: false },
  });

export default i18n;
