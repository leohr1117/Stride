import type { RechtBlock } from './arten.ts';

export const IMPRESSUM: readonly RechtBlock[] = [
  { art: 'h', text: 'Angaben gemäß § 5 DDG und § 18 Abs. 1 MStV' },
  { art: 'p', text: 'Leonardo Hramzow' },
  { art: 'p', text: 'c/o COCENTER' },
  { art: 'p', text: 'Koppoldstr. 1' },
  { art: 'p', text: '86551 Aichach' },
  { art: 'h', text: 'Kontakt' },
  { art: 'p', text: 'E-Mail: [kontakt@leohr.de](mailto:kontakt@leohr.de)' },
  { art: 'p', text: 'Kontaktformular: [Kontaktformular](/kontakt)' },
  { art: 'h', text: 'Hosting' },
  {
    art: 'p',
    text: 'Der Server steht bei Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, am Standort Falkenstein (Deutschland).',
  },
  { art: 'h', text: 'Kontaktstelle nach Art. 11 und 12 DSA' },
  {
    art: 'p',
    text: 'Behörden und Nutzer erreichen mich unter [kontakt@leohr.de](mailto:kontakt@leohr.de). Sprachen: Deutsch, Englisch.',
  },
  { art: 'h', text: 'Haftung für Links' },
  {
    art: 'p',
    text: 'Wupo enthält Links zu externen Websites Dritter (zum Beispiel Quellen zu Vorbildern), auf deren Inhalte ich keinen Einfluss habe. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich. Bei Bekanntwerden von Rechtsverletzungen entferne ich derartige Links umgehend.',
  },
  { art: 'h', text: 'Quellcode' },
  {
    art: 'p',
    text: 'Wupo ist freie Software unter der GNU Affero General Public License 3.0. Den Quellcode findest du unter [https://github.com/leohr1117/Stride](https://github.com/leohr1117/Stride). Details stehen in den [Lizenzhinweisen](/lizenzhinweise).',
  },
];
