import type { Versionseintrag } from './versionen.ts';

export function changelogMarkdown(versionen: readonly Versionseintrag[]): string {
  const zeilen = ['# Änderungsprotokoll', ''];
  for (const eintrag of versionen) {
    zeilen.push(`## ${eintrag.version}`, '');
    for (const abschnitt of eintrag.abschnitte) {
      if (abschnitt.punkte.length === 0) {
        continue;
      }
      zeilen.push(`### ${abschnitt.titel}`, '');
      for (const punkt of abschnitt.punkte) {
        zeilen.push(`- ${punkt}`);
      }
      zeilen.push('');
    }
  }
  return `${zeilen.join('\n').replace(/\n+$/, '')}\n`;
}
