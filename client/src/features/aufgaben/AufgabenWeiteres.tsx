import { tx } from '../../text.ts';
import { BOSS_BELOHNUNG_INFO, BOSS_DATUM_INFO, GEGNER_INFO, MEILENSTEIN_INFO } from '../../../../shared/spiel/xp.ts';
import { EinklappKopf } from '../../components/Ausklappbar.tsx';
import { BossRing } from '../bosse/BossRing.tsx';
import { EINGABE_STIL, Feld, InfoHinweis, SchalterBahn } from '../../ui/index.ts';

function prioText(wert: number): string {
  if (wert === 1) {
    return tx('p1');
  }
  if (wert === 2) {
    return tx('p2');
  }
  if (wert === 3) {
    return tx('p3');
  }
  return tx('p4');
}

function SchalterZeile({
  an,
  label,
  info,
  onAendern,
}: {
  an: boolean;
  label: string;
  info?: string;
  onAendern: (an: boolean) => void;
}) {
  return (
    <div className="relative flex min-h-11 items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={an}
        aria-label={tx(label)}
        onClick={() => onAendern(!an)}
        className="absolute inset-0 z-0"
      />
      <span className="flex min-w-0 flex-1 items-center">
        <span className="pointer-events-none text-sm font-medium">{tx(label)}</span>
        {info ? (
          <span className="relative z-10 inline-flex self-center">
            <InfoHinweis text={info} />
          </span>
        ) : null}
      </span>
      <span className="pointer-events-none flex shrink-0 items-center">
        <SchalterBahn an={an} />
      </span>
    </div>
  );
}

export function AufgabenWeiteres({
  offen,
  onOffen,
  prioritaet,
  onPrioritaet,
  meilenstein,
  onMeilenstein,
  gegner,
  onGegner,
  boss,
  onBoss,
  deadline,
  onDeadline,
  deadlineMin,
  ring,
}: {
  offen: boolean;
  onOffen: (offen: boolean) => void;
  prioritaet: number | null;
  onPrioritaet: (wert: number | null) => void;
  meilenstein: boolean;
  onMeilenstein: (an: boolean) => void;
  gegner: boolean;
  onGegner: (an: boolean) => void;
  boss: boolean;
  onBoss: (an: boolean) => void;
  deadline: string;
  onDeadline: (wert: string) => void;
  deadlineMin: string;
  ring: { anteil: number; erwacht: boolean } | null;
}) {
  const kampf = meilenstein ? boss : gegner;

  return (
    <section className="space-y-3">
      <EinklappKopf titel="Weiteres" offen={offen} onToggle={() => onOffen(!offen)} />
      {offen && (
        <div className="space-y-4">
          <Feld label={tx('Priorität')}>
            <div role="group" aria-label={tx('Priorität')} className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4].map((wert) => (
                <button
                  key={wert}
                  type="button"
                  aria-pressed={prioritaet === wert}
                  data-prio={wert}
                  onClick={() => onPrioritaet(prioritaet === wert ? null : wert)}
                  className="chip prio-chip flex shrink-0 items-center gap-1.5 rounded-full border border-rand px-3 py-1.5 text-sm text-leise transition"
                >
                  <span className="prio-punkt" aria-hidden="true" />
                  {prioText(wert)}
                </button>
              ))}
            </div>
          </Feld>
          <div>
            <SchalterZeile an={meilenstein} label="Meilenstein" info={MEILENSTEIN_INFO} onAendern={onMeilenstein} />
            {meilenstein ? (
              <SchalterZeile an={boss} label="Boss" info={BOSS_BELOHNUNG_INFO} onAendern={onBoss} />
            ) : (
              <SchalterZeile an={gegner} label="Gegner" info={GEGNER_INFO} onAendern={onGegner} />
            )}
          </div>
          {kampf && (
            <div className="flex items-end gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <span className="flex items-center text-sm font-medium">
                  {tx('Deadline')}
                  <InfoHinweis text={BOSS_DATUM_INFO} />
                </span>
                <input
                  type="date"
                  aria-label={tx('Deadline')}
                  min={deadlineMin}
                  placeholder={tx('Optional')}
                  className={EINGABE_STIL}
                  value={deadline}
                  onChange={(ereignis) => onDeadline(ereignis.target.value)}
                />
              </div>
              {ring && <BossRing ring={ring.anteil} erwacht={ring.erwacht} />}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
