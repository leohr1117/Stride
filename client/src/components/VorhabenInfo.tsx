import type { BossInfo, Vorhaben } from '../../../shared/api/index.ts';
import { ausTagesSchluessel, kurzesDatum, stunden, zahl } from '../format.ts';
import { tx, txMenge } from '../text.ts';

export function VorhabenKennzahlen({ vorhaben, ohneXp = false }: { vorhaben: Vorhaben; ohneXp?: boolean }) {
  return (
    <p className="zahl text-xs text-leise">
      {txMenge(vorhaben.anzahlEintraege, '{anzahl} Einträge', { anzahl: zahl(vorhaben.anzahlEintraege) })}
      {vorhaben.stunden > 0 && ` · ${stunden(vorhaben.stunden)}`}
      {!ohneXp && ` · ${tx('{xp} XP', { xp: zahl(vorhaben.xp) })}`}
      {vorhaben.anlauf > 1 && ` · ${tx('{anlauf}. Anlauf', { anlauf: vorhaben.anlauf })}`}
    </p>
  );
}

function tagDanach(tag: string): Date {
  const datum = ausTagesSchluessel(tag);
  datum.setDate(datum.getDate() + 1);
  return datum;
}

export function bossSeit(boss: Pick<BossInfo, 'deadline'>): string {
  return tx('seit {datum}', { datum: kurzesDatum(tagDanach(boss.deadline).toISOString()) });
}

export function bossZeile(boss: Pick<BossInfo, 'phase' | 'deadline'>): string {
  if (boss.phase === 'erwacht') {
    return tx('Erwacht · seit {datum}', { datum: kurzesDatum(tagDanach(boss.deadline).toISOString()) });
  }
  return tx('Entsteht · {datum}', { datum: kurzesDatum(ausTagesSchluessel(boss.deadline).toISOString()) });
}
