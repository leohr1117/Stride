import type { RechtBlock } from './arten.ts';

const STAND = 'Stand: 18. November 2026';

export const DATENSCHUTZ: readonly RechtBlock[] = [
  { art: 'h', text: '1. Verantwortlicher' },
  {
    art: 'p',
    text: 'Verantwortlich für die Datenverarbeitung in Stride (stride.leohr.de) ist Leonardo Hramzow, erreichbar unter den Angaben im [Impressum](/impressum) und per E-Mail an [kontakt@leohr.de](mailto:kontakt@leohr.de).',
  },
  { art: 'h', text: '2. Wo Stride läuft' },
  {
    art: 'p',
    text: 'Stride läuft auf einem eigenen Server von mir in Deutschland. Deine Konto- und Spieldaten liegen nur dort. Ein Hosting-Anbieter hat darauf keinen Zugriff.',
  },
  {
    art: 'p',
    text: 'Damit Stride aus dem Internet erreichbar ist, läuft die Verbindung über einen Tunnel von Cloudflare (Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA). Cloudflare handelt als Auftragsverarbeiter (Art. 28 DSGVO), leitet die Anfragen verschlüsselt an meinen Server weiter und schützt ihn vor Angriffen. Dabei verarbeitet Cloudflare technisch notwendige Daten wie deine IP-Adresse und die Inhalte der Verbindung. Dabei kann eine Übermittlung in die USA stattfinden. Cloudflare ist nach dem EU-U.S. Data Privacy Framework zertifiziert (Art. 45 DSGVO); zusätzlich gelten die EU-Standardvertragsklauseln. Rechtsgrundlage ist mein berechtigtes Interesse an einem sicheren und erreichbaren Betrieb (Art. 6 Abs. 1 lit. f DSGVO). Weitere Informationen: [cloudflare.com/privacypolicy](https://www.cloudflare.com/privacypolicy/).',
  },
  { art: 'h', text: '3. Server-Logs' },
  {
    art: 'p',
    text: 'Bei jedem Aufruf speichert mein Server technisch notwendige Daten: Datum und Uhrzeit, Anfragemethode, aufgerufene Adresse ohne Abfrageparameter, Statuscode und Antwortzeit. Ich brauche sie, um Fehler zu finden und Missbrauch abzuwehren (Art. 6 Abs. 1 lit. f DSGVO). Die Logs werden nach 14 Tagen automatisch gelöscht, außer ein konkreter Sicherheitsvorfall erfordert eine längere Aufbewahrung.',
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
  { art: 'p', text: 'Benutzername und Passwort brauchst du für ein Konto; ohne sie kannst du Stride nicht nutzen.' },
  {
    art: 'p',
    text: 'In deinem Konto speichert Stride deine Spieldaten: eingetragene Tätigkeiten, Erfahrungspunkte, Streaks, Attribute, Level, Bereiche, Ziele, Projekte, gewählte Vorbilder und Einstellungen. Diese Daten verarbeite ich, um dir Stride bereitzustellen (Art. 6 Abs. 1 lit. b DSGVO). Sie sind nur für dich sichtbar und werden nicht verkauft, nicht für Werbung genutzt und nicht an Dritte weitergegeben, außer an die hier genannten Dienste.',
  },
  { art: 'p', text: 'Bitte trage keine Gesundheitsdaten oder anderen besonders sensiblen Angaben ein. Stride ist dafür nicht gedacht.' },
  {
    art: 'p',
    text: 'Deine Daten bleiben gespeichert, solange dein Konto besteht. Du kannst dein Konto jederzeit in der App unter Mehr > Einstellungen > Konto > Konto löschen löschen oder die Löschung per E-Mail an [kontakt@leohr.de](mailto:kontakt@leohr.de) verlangen. Dann lösche ich dein Konto und alle Spieldaten sofort. Mein Server sichert die Datenbanken täglich; die Sicherungen liegen auf demselben Server und werden nach höchstens 30 Tagen automatisch gelöscht. Aus den Sicherungen verschwinden deine Daten deshalb spätestens nach 30 Tagen.',
  },
  { art: 'p', text: 'Stride richtet sich an Personen ab 16 Jahren.' },
  { art: 'h', text: '5. Lokaler Speicher und Anmeldung' },
  {
    art: 'p',
    text: 'Stride setzt keine Tracking- oder Werbe-Cookies und verwendet keine Analyse-Werkzeuge. Schriften und Programmteile liefert mein eigener Server aus.',
  },
  {
    art: 'p',
    text: 'Nach der Anmeldung setzt Stride ein Anmelde-Cookie („ascend_sitzung“), damit du angemeldet bleibst. Es gilt 30 Tage ab der Anmeldung oder bis du dich abmeldest.',
  },
  {
    art: 'p',
    text: 'Außerdem legt Stride im lokalen Speicher deines Browsers (localStorage, sessionStorage und Service-Worker-Cache) Einstellungen und App-Dateien ab, damit die App schnell und auch offline funktioniert. Diese Speicherungen sind für den von dir gewünschten Dienst unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Du kannst sie jederzeit über die Einstellungen deines Browsers löschen; danach musst du dich neu anmelden.',
  },
  { art: 'h', text: '6. Benachrichtigungen' },
  {
    art: 'p',
    text: 'Wenn du Benachrichtigungen erlaubst, meldet dein Browser Stride bei seinem Push-Dienst an (bei Chrome und Android: Google Firebase Cloud Messaging, bei Firefox: Mozilla, bei Safari: Apple). Ich speichere die dabei erzeugte Push-Adresse zu deinem Konto und schicke darüber Erinnerungen. Dabei kann eine Übermittlung in die USA stattfinden. Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du im Browser erteilst. Du kannst sie jederzeit in Stride oder in den Browsereinstellungen widerrufen; dann lösche ich die Push-Adresse.',
  },
  { art: 'h', text: '7. Kalender-Verbindung' },
  {
    art: 'p',
    text: 'Wenn du einen Kalender verbindest, trägst du dessen Abo-Adresse (ICS-Link) in Stride ein. Mein Server ruft diese Adresse regelmäßig ab und speichert die Termine (zum Beispiel Titel, Zeit, Ort und Beschreibung), damit Stride sie dir anzeigen und verwenden kann. Behandle den Link wie ein Passwort: Wer ihn kennt, kann deinen Kalender lesen. Ich speichere ihn nur zu diesem Zweck. Rechtsgrundlage ist die von dir gewünschte Funktion (Art. 6 Abs. 1 lit. b DSGVO). Termine können Angaben über andere Personen enthalten, etwa Namen von Teilnehmenden; trag nur Kalender ein, die du dafür nutzen darfst. Wenn du die Verbindung trennst, lösche ich den Link und die gespeicherten Termine. Für die Verarbeitung beim Kalender-Anbieter gilt dessen Datenschutzerklärung.',
  },
  { art: 'h', text: '8. Verbindung mit Todoist' },
  {
    art: 'p',
    text: 'Wenn du Todoist verbindest, gibst du Stride dein Todoist-API-Token. Ich speichere es verschlüsselt auf meinem Server und rufe damit nur die Aufgaben ab, die du für Stride ausgewählt hast, bzw. lege dort die Einträge an, die du einstellst. Anbieter von Todoist ist Doist Inc. (USA); die Übermittlung dorthin erfolgt auf deine Veranlassung. Für die Verarbeitung bei Todoist gilt deren Datenschutzerklärung ([doist.com/privacy](https://doist.com/privacy)). Rechtsgrundlage ist die von dir gewünschte Funktion (Art. 6 Abs. 1 lit. b DSGVO). Wenn du die Verbindung in Stride trennst, lösche ich das Token. Im Todoist-Konto kannst du es zusätzlich ungültig machen.',
  },
  { art: 'h', text: '9. Links zu Quellen' },
  {
    art: 'p',
    text: 'Bei Vorbildern verlinkt Stride auf externe Quellen, zum Beispiel Wikipedia. Daten werden erst übertragen, wenn du einen Link anklickst. Dann gilt die Datenschutzerklärung der jeweiligen Seite.',
  },
  { art: 'h', text: '10. Kontakt per E-Mail und Kontaktformular' },
  {
    art: 'p',
    text: 'Wenn du mir schreibst, per E-Mail oder über das [Kontaktformular](/kontakt), verwende ich deine Angaben (zum Beispiel Name, E-Mail-Adresse und Nachricht) nur, um deine Anfrage zu beantworten (Art. 6 Abs. 1 lit. b bzw. f DSGVO), und lösche sie, wenn sie nicht mehr benötigt werden. Mein E-Mail-Postfach wird von Zoho Corporation B.V. (Beneluxlaan 4B, 3527 HT Utrecht, Niederlande) als Auftragsverarbeiter (Art. 28 DSGVO) betrieben; deine Nachricht wird dort gespeichert.',
  },
  { art: 'h', text: '11. Sicherheit' },
  { art: 'p', text: 'Die Verbindung zu Stride ist verschlüsselt (TLS). Passwörter speichere ich nur als Hash. Server und Software halte ich aktuell und sichere die Daten täglich.' },
  { art: 'h', text: '12. Keine automatisierten Entscheidungen' },
  {
    art: 'p',
    text: 'Stride trifft keine automatisierten Entscheidungen im Sinne von Art. 22 DSGVO. XP, Level und Vergleiche mit Vorbildern sind spielerische Berechnungen ohne rechtliche oder ähnlich erhebliche Wirkung.',
  },
  { art: 'h', text: '13. Deine Rechte' },
  {
    art: 'p',
    text: 'Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21). Eine erteilte Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3). Schreib mir dazu einfach an [kontakt@leohr.de](mailto:kontakt@leohr.de). Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO), zum Beispiel beim Thüringer Landesbeauftragten für den Datenschutz und die Informationsfreiheit.',
  },
  { art: 'p', text: STAND },
];
