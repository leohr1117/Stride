import type { RechtBlock } from './arten.ts';

export const LIZENZEN: readonly RechtBlock[] = [
  { art: 'h', text: 'Stride' },
  { art: 'p', text: 'Copyright © 2026 Leonardo Hramzow' },
  {
    art: 'p',
    text: 'Stride ist freie Software: Du kannst es unter den Bedingungen der GNU Affero General Public License, Version 3, wie von der Free Software Foundation veröffentlicht, weitergeben und/oder verändern.',
  },
  {
    art: 'p',
    text: 'Stride wird in der Hoffnung verbreitet, dass es nützlich ist, aber OHNE JEDE GEWÄHRLEISTUNG, sogar ohne die implizite Gewährleistung der MARKTREIFE oder der EIGNUNG FÜR EINEN BESTIMMTEN ZWECK. Einzelheiten stehen in der GNU Affero General Public License.',
  },
  {
    art: 'liste',
    punkte: [
      'Lizenztext: [https://www.gnu.org/licenses/agpl-3.0.html](https://www.gnu.org/licenses/agpl-3.0.html) (verbindlich ist die englische Originalfassung)',
    ],
  },
  { art: 'quelle' },
  { art: 'h', text: 'Verwendete Open-Source-Komponenten' },
  {
    art: 'p',
    text: 'Stride verwendet Open-Source-Bibliotheken anderer Autorinnen und Autoren. Die vollständige Liste mit Lizenzen und Copyright-Hinweisen findest du hier: [Liste der Open-Source-Komponenten](/lizenzen.txt).',
  },
  { art: 'h', text: 'Schriften' },
  {
    art: 'p',
    text: 'Stride liefert diese Schriften selbst aus. Sie stehen unter der SIL Open Font License 1.1. Der vollständige Lizenztext steht in der Liste der Open-Source-Komponenten.',
  },
  {
    art: 'liste',
    punkte: [
      'Exo 2, die Schrift der App',
      'Barlow Semi Condensed, nur in der Ansicht Antik',
      'Cinzel, nur in der Ansicht Antik',
    ],
  },
  {
    art: 'p',
    text: 'Für Chinesisch und Japanisch verwendet Stride Schriften des Geräts und liefert keine eigene Schriftdatei aus.',
  },
  { art: 'h', text: 'Icons' },
  {
    art: 'p',
    text: 'Die Symbole stammen aus Lucide (Paket lucide-react, ISC-Lizenz). Den Lizenztext enthält die Liste der Open-Source-Komponenten. Projektseite: [lucide.dev](https://lucide.dev).',
  },
  { art: 'h', text: 'Inhalte zu Vorbildern' },
  {
    art: 'p',
    text: 'Kurzbeschreibungen von Vorbildern sind eigene Texte. Wo sie auf Quellen wie Wikipedia beruhen, ist die Quelle verlinkt. Werden Wikipedia-Texte wörtlich übernommen, gilt dafür CC BY-SA 4.0: Quelle, Autorenhinweis, Lizenzlink und gleiche Lizenz angeben.',
  },
];
