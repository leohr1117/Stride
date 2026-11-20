import type { RechtBlock } from './arten.ts';

export const NUTZUNG: readonly RechtBlock[] = [
  { art: 'h', text: 'Nutzungsbedingungen (Deutsch)' },
  { art: 'p', text: 'Stand: 18. November 2026' },
  { art: 'h', text: '1. Geltungsbereich und Betreiber' },
  {
    art: 'p',
    text: 'Diese Bedingungen gelten für die Nutzung der Web-App Wupo unter stride.leohr.de. Betreiber ist Leonardo Hramzow als Privatperson in Deutschland (Kontaktangaben im [Impressum](/impressum) von Wupo, E-Mail [kontakt@leohr.de](mailto:kontakt@leohr.de)). Mit der Registrierung erklärst du dich mit diesen Bedingungen einverstanden.',
  },
  { art: 'h', text: '2. Was Wupo ist' },
  {
    art: 'p',
    text: 'Wupo hilft dir bei persönlicher Entwicklung und Gewohnheiten: Du trägst Tätigkeiten ein, sammelst Erfahrungspunkte (XP) und Streaks, ordnest Einträge Bereichen zu und kannst dich an Vorbildern orientieren. Optional kannst du Todoist und einen Kalender anbinden.',
  },
  { art: 'h', text: '3. Kostenlos, Mindestalter' },
  {
    art: 'p',
    text: 'Wupo ist kostenlos. Es gibt keine Abos, keine In-App-Käufe und keine Werbung. Du kannst Wupo ab 16 Jahren nutzen.',
  },
  { art: 'h', text: '4. Quellcode und Selbsthosting' },
  {
    art: 'p',
    text: 'Wupo ist freie Software unter der GNU Affero General Public License Version 3 (AGPL-3.0). Den Quellcode findest du unter [github.com/leohr1117/Stride](https://github.com/leohr1117/Stride). Für den Quellcode gilt ausschließlich die AGPL-3.0; diese Bedingungen schränken die Rechte daraus nicht ein.',
  },
  {
    art: 'p',
    text: 'Diese Bedingungen gelten nur für die von mir betriebene Instanz unter stride.leohr.de. Wer Wupo selbst betreibt, ist für seine Instanz, ihre Nutzer und deren Daten selbst verantwortlich und braucht eigene Rechtstexte.',
  },
  { art: 'h', text: '5. Dein Konto' },
  {
    art: 'p',
    text: 'Halte dein Passwort geheim. Ein Konto ist für eine Person gedacht. Du kannst dein Konto jederzeit in der App löschen oder die Löschung per E-Mail an [kontakt@leohr.de](mailto:kontakt@leohr.de) verlangen. Gelöschte Konten entferne ich sofort; aus Sicherungskopien verschwinden sie spätestens nach 30 Tagen.',
  },
  { art: 'h', text: '6. Was nicht erlaubt ist' },
  { art: 'p', text: 'Bei der Nutzung von Wupo darfst du nicht:' },
  {
    art: 'liste',
    punkte: [
      'Inhalte eintragen, die gegen Gesetze oder Rechte anderer verstoßen,',
      'Wupo angreifen, überlasten oder Sicherheitsmaßnahmen umgehen,',
      'Wupo automatisiert in einem Umfang abfragen, der den Betrieb stört,',
      'Konten für andere Personen ohne deren Wissen anlegen.',
    ],
  },
  {
    art: 'p',
    text: 'Verstößt du erheblich dagegen, kann ich dein Konto sperren oder löschen. Vorher gebe ich dir Gelegenheit zur Stellungnahme, außer bei schweren Verstößen oder wenn Eile nötig ist.',
  },
  { art: 'h', text: '7. Deine Inhalte, Vorbilder und Anbindungen' },
  {
    art: 'p',
    text: 'Deine Einträge gehören dir. Ich verarbeite sie nur, um dir Wupo bereitzustellen; Einzelheiten stehen in der [Datenschutzerklärung](/datenschutz).',
  },
  {
    art: 'p',
    text: 'XP, Level, Streaks und Vergleiche mit Vorbildern sind spielerische Schätzungen. Sie sind keine Tatsachenbehauptungen über die genannten Personen und keine medizinische, psychologische oder berufliche Beratung.',
  },
  {
    art: 'p',
    text: 'Für Todoist und deinen Kalender gelten zusätzlich die Bedingungen der jeweiligen Anbieter. Ich bin nicht dafür verantwortlich, wenn deren Dienste nicht erreichbar sind oder ihre Schnittstellen ändern.',
  },
  { art: 'h', text: '8. Verfügbarkeit und Änderungen am Dienst' },
  {
    art: 'p',
    text: 'Wupo ist ein privat betriebenes, kostenloses Angebot. Ich bemühe mich um einen zuverlässigen Betrieb, kann aber keine bestimmte Verfügbarkeit zusagen. Wartungen und Störungen sind möglich. Exportiere wichtige Daten deshalb zusätzlich selbst.',
  },
  {
    art: 'p',
    text: 'Ich kann Funktionen ändern, hinzufügen oder entfernen und den Betrieb von Wupo einstellen. Eine Einstellung kündige ich mindestens 30 Tage vorher an, soweit mir das möglich ist.',
  },
  { art: 'h', text: '9. Haftung' },
  {
    art: 'p',
    text: 'Da Wupo unentgeltlich ist, hafte ich nur für Vorsatz und grobe Fahrlässigkeit (vgl. §§ 521, 599 BGB). Verletze ich leicht fahrlässig eine Pflicht, deren Erfüllung die Nutzung von Wupo überhaupt erst ermöglicht und auf deren Einhaltung du vertrauen darfst, ist meine Haftung auf den vorhersehbaren, typischen Schaden begrenzt.',
  },
  {
    art: 'p',
    text: 'Unberührt bleibt meine Haftung für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit, für arglistig verschwiegene Mängel, nach dem Produkthaftungsgesetz sowie in allen Fällen, in denen die Haftung gesetzlich nicht beschränkt werden kann.',
  },
  { art: 'h', text: '10. Änderungen dieser Bedingungen' },
  {
    art: 'p',
    text: 'Wenn ich diese Bedingungen ändere, zeige ich dir die neue Fassung beim nächsten Öffnen von Wupo an. Sie gilt für dich erst, wenn du zustimmst. Stimmst du nicht zu, kannst du dein Konto löschen; bis dahin gilt die bisherige Fassung.',
  },
  { art: 'h', text: '11. Schlussbestimmungen' },
  {
    art: 'p',
    text: 'Es gilt deutsches Recht. Bist du Verbraucher mit gewöhnlichem Aufenthalt in einem anderen Staat, bleiben die zwingenden Verbraucherschutzvorschriften dieses Staates unberührt.',
  },
  {
    art: 'p',
    text: 'Ich bin nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
  },
  { art: 'p', text: 'Diese Bedingungen gibt es auf Deutsch und Englisch. Bei Abweichungen gilt die deutsche Fassung.' },
  { art: 'p', text: 'Sollte eine Bestimmung unwirksam sein, bleiben die übrigen wirksam.' },
  { art: 'h', text: 'Terms of Use (English)' },
  { art: 'p', text: 'Last updated: 18 November 2026' },
  { art: 'h', text: '1. Scope and operator' },
  {
    art: 'p',
    text: 'These terms apply to the use of the web app Wupo at stride.leohr.de. Wupo is operated by Leonardo Hramzow, a private individual in Germany (contact details in Wupo\'s [legal notice](/impressum), email [kontakt@leohr.de](mailto:kontakt@leohr.de)). By registering, you agree to these terms.',
  },
  { art: 'h', text: '2. What Wupo is' },
  {
    art: 'p',
    text: 'Wupo helps you with personal growth and habits: you log activities, earn experience points (XP) and streaks, sort entries into areas and can look to role models. Optionally, you can connect Todoist and a calendar.',
  },
  { art: 'h', text: '3. Free of charge, minimum age' },
  {
    art: 'p',
    text: 'Wupo is free. There are no subscriptions, no in-app purchases and no ads. You must be at least 16 years old to use Wupo.',
  },
  { art: 'h', text: '4. Source code and self-hosting' },
  {
    art: 'p',
    text: 'Wupo is free software under the GNU Affero General Public License version 3 (AGPL-3.0). The source code is available at [github.com/leohr1117/Stride](https://github.com/leohr1117/Stride). The source code is governed solely by the AGPL-3.0; these terms do not limit your rights under it.',
  },
  {
    art: 'p',
    text: 'These terms only apply to the instance I operate at stride.leohr.de. Anyone who runs Wupo themselves is responsible for their own instance, its users and their data, and needs their own legal texts.',
  },
  { art: 'h', text: '5. Your account' },
  {
    art: 'p',
    text: 'Keep your password secret. An account is meant for one person. You can delete your account at any time in the app or request deletion by email to [kontakt@leohr.de](mailto:kontakt@leohr.de). I remove deleted accounts immediately; they disappear from backups within 30 days at the latest.',
  },
  { art: 'h', text: '6. What is not allowed' },
  { art: 'p', text: 'When using Wupo, you must not:' },
  {
    art: 'liste',
    punkte: [
      'enter content that violates the law or the rights of others,',
      'attack or overload Wupo or bypass security measures,',
      'query Wupo automatically to an extent that disrupts operation,',
      'create accounts for other people without their knowledge.',
    ],
  },
  {
    art: 'p',
    text: 'If you seriously violate these rules, I may suspend or delete your account. I will give you the chance to respond first, unless the violation is severe or urgent action is needed.',
  },
  { art: 'h', text: '7. Your content, role models and integrations' },
  {
    art: 'p',
    text: 'Your entries belong to you. I only process them to provide Wupo to you; details are in the [privacy policy](/datenschutz).',
  },
  {
    art: 'p',
    text: 'XP, levels, streaks and comparisons with role models are playful estimates. They are not statements of fact about the people named and not medical, psychological or professional advice.',
  },
  {
    art: 'p',
    text: 'For Todoist and your calendar, the terms of the respective providers also apply. I am not responsible if their services are unavailable or change their interfaces.',
  },
  { art: 'h', text: '8. Availability and changes to the service' },
  {
    art: 'p',
    text: 'Wupo is a free service run by a private individual. I try to keep it running reliably but cannot promise any particular availability. Maintenance and outages may occur, so please also export important data yourself.',
  },
  {
    art: 'p',
    text: 'I may change, add or remove features and may shut Wupo down. I will announce a shutdown at least 30 days in advance where possible.',
  },
  { art: 'h', text: '9. Liability' },
  {
    art: 'p',
    text: 'As Wupo is provided free of charge, I am only liable for intent and gross negligence (cf. sections 521, 599 of the German Civil Code). If I slightly negligently breach a duty whose fulfilment is essential for using Wupo at all and on which you may rely, my liability is limited to the foreseeable, typical damage.',
  },
  {
    art: 'p',
    text: 'This does not limit my liability for injury to life, body or health, for fraudulently concealed defects, under the German Product Liability Act, or in any other case where liability cannot be limited by law.',
  },
  { art: 'h', text: '10. Changes to these terms' },
  {
    art: 'p',
    text: 'If I change these terms, I will show you the new version the next time you open Wupo. It only applies to you once you accept it. If you do not accept it, you can delete your account; until then, the previous version applies.',
  },
  { art: 'h', text: '11. Final provisions' },
  {
    art: 'p',
    text: 'German law applies. If you are a consumer habitually resident in another country, the mandatory consumer protection rules of that country remain unaffected.',
  },
  {
    art: 'p',
    text: 'I am neither willing nor obliged to take part in dispute resolution proceedings before a consumer arbitration board.',
  },
  { art: 'p', text: 'These terms are available in German and English. In case of discrepancies, the German version prevails.' },
  { art: 'p', text: 'If any provision is invalid, the remaining provisions remain valid.' },
];
