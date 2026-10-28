import { zahl } from '../../format.ts';
import { tx } from '../../text.ts';
import { RUECKKEHR, SCHUTZ } from '../../../../shared/spiel/schutz.ts';
import { Karte } from '../../ui/index.ts';

export function SchutzKarte() {
  return (
    <Karte className="space-y-3" label={tx('Schutz und Rückkehr')}>
      <h2 className="font-semibold break-words">{tx('Schutz und Rückkehr')}</h2>
      <div className="space-y-1">
        <h3 className="text-sm font-medium">{tx('Schutz')}</h3>
        <p className="text-sm leading-snug break-words">
          {tx(
            'Ein Tag Pause ist frei. Danach ist der Streak angeschlagen. Alle {tage} Tage Streak liegt ein Schutz bereit. Unter Heute setzt du ihn ein. Er hält die bisherigen Tage. Am selben Tag brauchst du einen Eintrag. Der Schutz gibt keine XP.',
            { tage: zahl(SCHUTZ.schwelleTage) },
          )}
        </p>
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-medium">{tx('Rückkehr')}</h3>
        <p className="text-sm leading-snug break-words">
          {tx(
            'Setzt du ihn nicht ein, öffnet die Rückkehr für {frist} Tage. Ein Eintrag in der Frist schließt sie. Disziplin und Geist bekommen XP, wenn sie an sind. Nach der Frist ist die Rückkehr vorbei, ohne XP. Die nächste kommt erst {abstand} Tage nach dem Ende der letzten.',
            { frist: zahl(RUECKKEHR.fristTage), abstand: zahl(RUECKKEHR.abstandTage) },
          )}
        </p>
      </div>
      <p className="text-sm leading-snug break-words">
        {tx('In der Chronik stehen Schutz und Rückkehr als eigene Zeilen. Sie lassen sich nicht öffnen.')}
      </p>
    </Karte>
  );
}
