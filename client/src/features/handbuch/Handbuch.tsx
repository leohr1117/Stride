import { tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { DAUER_OPTIONEN } from '../../../../shared/spiel/begriffe.ts';
import { ERLAUBTE_PAUSENTAGE } from '../../../../shared/spiel/kette.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { LEVEL_KURVEN, xpBisLevel } from '../../../../shared/spiel/level.ts';
import { momentumFuerSerie } from '../../../../shared/spiel/momentum.ts';
import { LEVEL_MARKEN, VISION_BEISPIELE } from '../../../../shared/spiel/orientierung.ts';
import { RUECKKEHR, SCHUTZ } from '../../../../shared/spiel/schutz.ts';
import { beispielVorbilder, durchschnittXpProTag } from '../../../../shared/features/vorbilder/vorbilder.ts';
import { basisXp, visionBeute } from '../../../../shared/spiel/xp.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { Karte, Ladeanzeige } from '../../ui/index.ts';
import { faktorText, zahl, zeitspanne } from '../../format.ts';

const STREAK_BEISPIELE = [7, 30, 100, 365];

export function HandbuchSeite() {
  const { data: einstellungen, isPending } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });

  if (isPending || !einstellungen) {
    return <Ladeanzeige />;
  }

  const mitVisionen = istAn('visionen', einstellungen);
  const mitVorbildern = istAn('vorbilder', einstellungen);
  const sprung = [
    { id: 'eintraege', name: 'Einträge' },
    { id: 'streak', name: 'Streak' },
    { id: 'level', name: 'Level' },
    ...(mitVisionen ? [{ id: 'visionen', name: 'Visionen' }] : []),
    ...(mitVorbildern ? [{ id: 'vorbilder', name: 'Vorbilder' }] : []),
  ];
  const xpAmTag = durchschnittXpProTag();

  return (
    <div className="min-w-0 space-y-6">
      <nav className="text-sm leading-6">
        {sprung.map((eintrag, index) => (
          <span key={eintrag.id}>
            {index > 0 ? (
              <span className="text-leise" aria-hidden="true">
                {' · '}
              </span>
            ) : null}
            <a href={`#${eintrag.id}`} className="font-medium text-akzent">
              {tx(eintrag.name)}
            </a>
          </span>
        ))}
      </nav>

      <HandbuchAbschnitt id="eintraege" titel="Einträge">
        <Tabelle
          spalten={[tx('Dauer'), tx('XP ohne Boni')]}
          zeilen={[
            [tx('Keine Angabe'), zahl(basisXp(null))],
            ...DAUER_OPTIONEN.map((option) => [tx(option.label), zahl(basisXp(option.stunden))]),
          ]}
        />
      </HandbuchAbschnitt>

      <HandbuchAbschnitt id="streak" titel="Streak">
        <ul className="list-none space-y-1 p-0 text-sm leading-5">
          <li>{tx('Pause: {tage} Tag frei', { tage: zahl(ERLAUBTE_PAUSENTAGE) })}</li>
          <li>{tx('Schutz: alle {tage} Tage, unter Heute einsetzen', { tage: zahl(SCHUTZ.schwelleTage) })}</li>
          <li>{tx('Rückkehr: {frist} Tage, wenn kein Schutz', { frist: zahl(RUECKKEHR.fristTage) })}</li>
          <li>{tx('Schutz und Rückkehr geben keine XP')}</li>
        </ul>
        <Tabelle
          spalten={[tx('Streak'), tx('Faktor')]}
          zeilen={STREAK_BEISPIELE.map((tage) => [tx('{tage} Tage', { tage: zahl(tage) }), faktorText(momentumFuerSerie(tage))])}
        />
      </HandbuchAbschnitt>

      <HandbuchAbschnitt id="level" titel="Level">
        <Tabelle
          spalten={[tx('Level'), tx('XP gesamt'), tx('Tage bei {xp} XP am Tag', { xp: zahl(xpAmTag) })]}
          zeilen={LEVEL_MARKEN.map((level) => {
            const xp = xpBisLevel(level, LEVEL_KURVEN.charakter);
            return [zahl(level), zahl(xp), zeitspanne(xp / xpAmTag)];
          })}
        />
      </HandbuchAbschnitt>

      {mitVisionen ? (
        <HandbuchAbschnitt id="visionen" titel="Visionen">
          <Tabelle
            spalten={[tx('Beispiel'), tx('Level'), tx('XP beim Erreichen')]}
            zeilen={VISION_BEISPIELE.map((beispiel) => [tx(beispiel.titel), zahl(beispiel.level), zahl(visionBeute(beispiel.level))])}
          />
        </HandbuchAbschnitt>
      ) : null}

      {mitVorbildern ? (
        <HandbuchAbschnitt id="vorbilder" titel="Vorbilder">
          <Tabelle
            spalten={[tx('Person'), tx('Richtung'), tx('Level')]}
            zahlAb={2}
            zeilen={beispielVorbilder().map((vorbild) => [tx(vorbild.name), vorbild.richtung ? tx(vorbild.richtung) : '—', zahl(vorbild.level)])}
          />
        </HandbuchAbschnitt>
      ) : null}
    </div>
  );
}

function HandbuchAbschnitt({ id, titel, children }: { id: string; titel: string; children: ReactNode }) {
  return (
    <section id={id} className="min-w-0 space-y-2">
      <h2 className="ueberschrift abschnittskopf text-[13px] leading-[18px] font-semibold tracking-normal text-leise normal-case">
        {tx(titel)}
      </h2>
      {children}
    </section>
  );
}

function Tabelle({ spalten, zeilen, zahlAb = 1 }: { spalten: string[]; zeilen: ReactNode[][]; zahlAb?: number }) {
  const ausrichtung = (index: number) => (index >= zahlAb ? 'zahl text-right' : 'text-left');
  return (
    <Karte dicht className="max-w-full overflow-x-auto overscroll-x-contain">
      <table className="w-max min-w-full text-sm">
        <thead>
          <tr className="border-b border-rand">
            {spalten.map((spalte, index) => (
              <th
                key={spalte}
                className={`px-4 py-2 text-[13px] leading-[18px] font-medium whitespace-nowrap text-leise ${ausrichtung(index)}`}
              >
                {spalte}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-rand">
          {zeilen.map((zeile, zeilenIndex) => (
            <tr key={zeilenIndex}>
              {zeile.map((zelle, index) => (
                <td key={index} className={`px-4 py-2 whitespace-nowrap ${ausrichtung(index)}`}>
                  {zelle}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Karte>
  );
}
