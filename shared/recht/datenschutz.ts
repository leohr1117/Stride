import type { RechtBlock } from './arten.ts';
import { APP_ADRESSE_STANDARD, appAdresse, appHost } from '../appAdresse.ts';

const STAND = 'Stand: 20. November 2026';

export function datenschutz(adresse: string = APP_ADRESSE_STANDARD): readonly RechtBlock[] {
  const host = appHost(appAdresse(adresse));
  return [
  { art: 'h', text: '1. Verantwortlicher' },
  {
    art: 'p',
    text: `Verantwortlich für die Datenverarbeitung in Wupo (${host}) ist Leonardo Hramzow, erreichbar unter den Angaben im [Impressum](/impressum) und per E-Mail an [kontakt@leohr.de](mailto:kontakt@leohr.de).`,
  },
  { art: 'h', text: '2. Wo Wupo läuft' },
  {
    art: 'p',
    text: 'Wupo läuft auf einem Server von Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, am Standort Falkenstein (Deutschland). Hetzner handelt als Auftragsverarbeiter (Art. 28 DSGVO). Mit Hetzner besteht ein Vertrag zur Auftragsverarbeitung über Stammdaten, Kommunikationsdaten, Logdaten und Inhalte der Nutzer. Betroffen sind die Nutzer der App. Deine Konto- und Spieldaten liegen auf diesem Server. Weitere Informationen: [Datenschutzerklärung von Hetzner](https://www.hetzner.com/legal/privacy-policy).',
  },
  {
    art: 'p',
    text: 'Damit Wupo aus dem Internet erreichbar ist, läuft die Verbindung über einen Tunnel von Cloudflare (Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA). Cloudflare handelt als Auftragsverarbeiter (Art. 28 DSGVO) laut Cloudflare Customer DPA, leitet die Anfragen verschlüsselt an den Server bei Hetzner weiter und schützt ihn vor Angriffen. Dabei verarbeitet Cloudflare technisch notwendige Daten wie deine IP-Adresse und die Inhalte der Verbindung. Dabei kann eine Übermittlung in die USA stattfinden. Cloudflare ist nach dem EU-U.S. Data Privacy Framework zertifiziert (Art. 45 DSGVO); zusätzlich gelten die EU-Standardvertragsklauseln. Rechtsgrundlage ist mein berechtigtes Interesse an einem sicheren und erreichbaren Betrieb (Art. 6 Abs. 1 lit. f DSGVO). Weitere Informationen: [cloudflare.com/privacypolicy](https://www.cloudflare.com/privacypolicy/).',
  },
  { art: 'h', text: '3. Server-Logs' },
  {
    art: 'p',
    text: 'Bei jedem Aufruf speichert der Server technisch notwendige Daten: Datum und Uhrzeit, Anfragemethode, aufgerufene Adresse ohne Abfrageparameter, Statuscode und Antwortzeit. Ich brauche sie, um Fehler zu finden und Missbrauch abzuwehren (Art. 6 Abs. 1 lit. f DSGVO). Die Logs werden nach 14 Tagen automatisch gelöscht, außer ein konkreter Sicherheitsvorfall erfordert eine längere Aufbewahrung.',
  },
  { art: 'h', text: '4. Dein Konto' },
  { art: 'p', text: 'Für ein Konto speichere ich:' },
  {
    art: 'liste',
    punkte: [
      'deinen Benutzernamen,',
      'dein Passwort nur als sicheren Hash (ich kenne dein Passwort nicht),',
      'das Datum der Registrierung,',
      'deine Anmeldesitzungen mit dem Zeitpunkt, zu dem sie begonnen haben.',
    ],
  },
  { art: 'p', text: 'Registrierst du dich mit einem Passwort, brauchst du einen Benutzernamen und ein Passwort.' },
  {
    art: 'p',
    text: 'Du kannst dich mit Google anmelden oder ein bestehendes Konto mit Google verknüpfen. Die Anmeldung läuft bei Google über accounts.google.com. Wupo fordert dort nur die Berechtigung openid email an. Ich speichere die Google-Nutzerkennung und, wenn das Token sie enthält, die E-Mail-Adresse. Die Nutzerkennung ordnet das Konto zu. Die E-Mail-Adresse speichere ich nur und suche das Konto nicht darüber. Einen Namen frage ich nicht ab. Anbieter dieser Anmeldung ist Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland. Google kann Daten auch auf Servern außerhalb der EU verarbeiten. Rechtsgrundlage ist die von dir gewählte Anmeldung (Art. 6 Abs. 1 lit. b DSGVO). Weitere Informationen: [policies.google.com/privacy](https://policies.google.com/privacy). Ich beauftrage Google nicht als Auftragsverarbeiter. Deine Spieldaten bleiben auf dem Server bei Hetzner.',
  },
  {
    art: 'p',
    text: 'In deinem Konto speichert Wupo deine Spieldaten: eingetragene Tätigkeiten, Erfahrungspunkte, Streaks, Attribute, Level, Bereiche, Ziele, Projekte, gewählte Vorbilder und Einstellungen. Diese Daten verarbeite ich, um dir Wupo bereitzustellen (Art. 6 Abs. 1 lit. b DSGVO). Sie sind nur für dich sichtbar und werden nicht verkauft, nicht für Werbung genutzt und nicht an Dritte weitergegeben, außer an die hier genannten Dienste.',
  },
  { art: 'p', text: 'Bitte trage keine Gesundheitsdaten oder anderen besonders sensiblen Angaben ein. Wupo ist dafür nicht gedacht.' },
  {
    art: 'p',
    text: 'Deine Daten bleiben gespeichert, solange dein Konto besteht. Du kannst dein Konto jederzeit in der App unter Mehr > Einstellungen > Konto > Konto löschen löschen oder die Löschung per E-Mail an [kontakt@leohr.de](mailto:kontakt@leohr.de) verlangen. Dann lösche ich dein Konto und alle Spieldaten sofort.',
  },
  {
    art: 'p',
    text: 'Die Datenbanken werden nächtlich auf dem Hetzner-Server gesichert. Diese Kopien werden nach 29 Tagen gelöscht. Zusätzlich gibt es Server-Abbilder über die Backup-Funktion von Hetzner. Die Abbilder entstehen täglich, enthalten auch die Datenbank-Sicherungen und werden nach sieben Sicherungen überschrieben. Gelöschte Daten können noch bis zu 37 Tage in Sicherungskopien enthalten sein.',
  },
  { art: 'p', text: 'Wupo richtet sich an Personen ab 16 Jahren.' },
  { art: 'h', text: '5. Lokaler Speicher und Anmeldung' },
  {
    art: 'p',
    text: 'Wupo setzt keine Tracking- oder Werbe-Cookies und verwendet keine Analyse-Werkzeuge. Schriften und Programmteile liefert der Server aus.',
  },
  {
    art: 'p',
    text: 'Nach der Anmeldung setzt Wupo ein Anmelde-Cookie („ascend_sitzung“), damit du angemeldet bleibst. Es gilt 30 Tage ab der Anmeldung oder bis du dich abmeldest.',
  },
  {
    art: 'p',
    text: 'Außerdem legt Wupo im lokalen Speicher deines Browsers (localStorage, sessionStorage und Service-Worker-Cache) Einstellungen und App-Dateien ab, damit die App schnell und auch offline funktioniert. Diese Speicherungen sind für den von dir gewünschten Dienst unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Du kannst sie jederzeit über die Einstellungen deines Browsers löschen; danach musst du dich neu anmelden.',
  },
  { art: 'h', text: '6. Benachrichtigungen' },
  {
    art: 'p',
    text: 'Wenn du Benachrichtigungen erlaubst, legt dein Browser ein Push-Abo an. Das Abo läuft über den Push-Dienst deines Browser-Herstellers (z. B. Google bei Chrome, Mozilla bei Firefox, Apple bei Safari); welchen, legt der Browser fest. Ich speichere die dabei erzeugte Adresse und die Schlüssel zu deinem Konto und schicke darüber Erinnerungen. Der Inhalt der Benachrichtigung ist verschlüsselt; der Dienst sieht die Push-Adresse und den Zeitpunkt. Dabei kann eine Übermittlung in die USA stattfinden. Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du im Browser erteilst. Du kannst die Erlaubnis in Wupo oder in den Browsereinstellungen widerrufen; dann lösche ich die Adresse.',
  },
  { art: 'h', text: '7. Kalender-Verbindung' },
  {
    art: 'p',
    text: 'Wenn du einen Kalender verbindest, trägst du dessen Abo-Adresse (ICS-Link) in Wupo ein. Der Server ruft diese Adresse regelmäßig ab und speichert die Termine (zum Beispiel Titel, Zeit, Ort und Beschreibung), damit Wupo sie dir anzeigen und verwenden kann. Behandle den Link wie ein Passwort: Wer ihn kennt, kann deinen Kalender lesen. Ich speichere ihn nur zu diesem Zweck. Rechtsgrundlage ist die von dir gewünschte Funktion (Art. 6 Abs. 1 lit. b DSGVO). Termine können Angaben über andere Personen enthalten, etwa Namen von Teilnehmenden; trag nur Kalender ein, die du dafür nutzen darfst. Wenn du die Verbindung trennst, lösche ich den Link und die gespeicherten Termine. Für die Verarbeitung beim Kalender-Anbieter gilt dessen Datenschutzerklärung.',
  },
  { art: 'h', text: '8. Verbindung mit Todoist' },
  {
    art: 'p',
    text: 'Wenn du Todoist verbindest, gibst du Wupo dein Todoist-API-Token. Ich speichere es verschlüsselt auf dem Server und rufe damit nur die Aufgaben ab, die du für Wupo ausgewählt hast, bzw. lege dort die Einträge an, die du einstellst. Anbieter von Todoist ist Doist Inc. (USA); die Übermittlung dorthin erfolgt auf deine Veranlassung. Für die Verarbeitung bei Todoist gilt deren Datenschutzerklärung ([doist.com/privacy](https://doist.com/privacy)). Rechtsgrundlage ist die von dir gewünschte Funktion (Art. 6 Abs. 1 lit. b DSGVO). Wenn du die Verbindung in Wupo trennst, lösche ich das Token. Im Todoist-Konto kannst du es zusätzlich ungültig machen.',
  },
  { art: 'h', text: '9. Links zu Quellen' },
  {
    art: 'p',
    text: 'Bei Vorbildern verlinkt Wupo auf externe Quellen, zum Beispiel Wikipedia. Daten werden erst übertragen, wenn du einen Link anklickst. Dann gilt die Datenschutzerklärung der jeweiligen Seite.',
  },
  { art: 'h', text: '10. Kontakt per E-Mail und Kontaktformular' },
  {
    art: 'p',
    text: 'Wenn du mir schreibst, per E-Mail oder über das [Kontaktformular](/kontakt), verwende ich deine Angaben (zum Beispiel Name, E-Mail-Adresse und Nachricht) nur, um deine Anfrage zu beantworten (Art. 6 Abs. 1 lit. b bzw. f DSGVO), und lösche sie, wenn sie nicht mehr benötigt werden. Mein E-Mail-Postfach wird von Zoho Corporation B.V. (Beneluxlaan 4B, 3527 HT Utrecht, Niederlande) als Auftragsverarbeiter (Art. 28 DSGVO) betrieben. Die Mails, die Wupo verschickt, gehen über den SMTP-Dienst von Zoho Mail EU (Zoho Corporation B.V.). Deine Nachricht wird dort gespeichert.',
  },
  { art: 'h', text: '11. Sicherheit' },
  { art: 'p', text: 'Die Verbindung zu Wupo ist verschlüsselt (TLS). Passwörter speichere ich nur als Hash. Server und Software halte ich aktuell. Die Datenbanken werden nächtlich auf dem Hetzner-Server gesichert. Gelöschte Daten können noch bis zu 37 Tage in Sicherungskopien enthalten sein.' },
  { art: 'h', text: '12. Keine automatisierten Entscheidungen' },
  {
    art: 'p',
    text: 'Wupo trifft keine automatisierten Entscheidungen im Sinne von Art. 22 DSGVO. XP, Level und Vergleiche mit Vorbildern sind spielerische Berechnungen ohne rechtliche oder ähnlich erhebliche Wirkung.',
  },
  { art: 'h', text: '13. Deine Rechte' },
  {
    art: 'p',
    text: 'Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21). Eine erteilte Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3). Schreib mir dazu einfach an [kontakt@leohr.de](mailto:kontakt@leohr.de). Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO), zum Beispiel beim Thüringer Landesbeauftragten für den Datenschutz und die Informationsfreiheit.',
  },
  { art: 'p', text: STAND },
  ];
}

export const DATENSCHUTZ: readonly RechtBlock[] = datenschutz();
