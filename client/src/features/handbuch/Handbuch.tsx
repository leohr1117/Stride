import { tx, txMenge } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
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
import { AbschnittKopf, Chip, FlaecheInnen, Ladeanzeige } from '../../ui/index.ts';
import { faktorText, zahl, zeitspanne } from '../../format.ts';

const STREAK_BEISPIELE = [7, 30, 100, 365];

export function HandbuchSeite() {
  const { data: einstellungen, isPending } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const bereit = !isPending && einstellungen !== undefined;
  const mitVisionen = einstellungen ? istAn('visionen', einstellungen) : false;
  const mitVorbildern = einstellungen ? istAn('vorbilder', einstellungen) : false;
  const sprung = [
    { id: 'eintraege', name: 'Einträge' },
    { id: 'streak', name: 'Streak' },
    { id: 'level', name: 'Level' },
    ...(mitVisionen ? [{ id: 'visionen', name: 'Visionen' }] : []),
    ...(mitVorbildern ? [{ id: 'vorbilder', name: 'Vorbilder' }] : []),
  ];
  const rahmen = useRef<HTMLDivElement>(null);
  const leiste = useRef<HTMLElement>(null);
  const reihe = useRef<HTMLDivElement>(null);
  const aktiv = useAktiverAbschnitt(sprung.map((eintrag) => eintrag.id).join('|'), bereit, leiste);

  useEffect(() => {
    const rahmenKnoten = rahmen.current;
    const leisteKnoten = leiste.current;
    if (!rahmenKnoten || !leisteKnoten) {
      return;
    }
    const setzen = () => {
      rahmenKnoten.style.setProperty('--handbuch-leiste', `${leisteKnoten.getBoundingClientRect().height}px`);
    };
    setzen();
    const beobachter = new ResizeObserver(setzen);
    beobachter.observe(leisteKnoten);
    return () => {
      beobachter.disconnect();
      rahmenKnoten.style.removeProperty('--handbuch-leiste');
    };
  }, [bereit, sprung.length]);

  useEffect(() => {
    const reiheKnoten = reihe.current;
    const chip = reiheKnoten?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!reiheKnoten || !chip) {
      return;
    }
    const sicht = reiheKnoten.getBoundingClientRect();
    const kasten = chip.getBoundingClientRect();
    const auslauf = Number.parseFloat(getComputedStyle(reiheKnoten).paddingRight) || 0;
    if (kasten.left < sicht.left) {
      reiheKnoten.scrollLeft -= sicht.left - kasten.left;
    } else if (kasten.right > sicht.right - auslauf) {
      reiheKnoten.scrollLeft += kasten.right - (sicht.right - auslauf);
    }
  }, [aktiv]);

  if (!bereit) {
    return <Ladeanzeige />;
  }

  const xpAmTag = durchschnittXpProTag();

  return (
    <div ref={rahmen} className="min-w-0 space-y-6">
      <nav ref={leiste} aria-label={tx('Handbuch')} className="handbuch-leiste -mx-4 md:-mx-8">
        <div ref={reihe} className="chip-reihe eintrag-chips flex min-w-0 gap-2 overflow-x-auto py-2 ps-4 pe-6 md:ps-8 md:pe-8">
          {sprung.map((eintrag) => (
            <Chip key={eintrag.id} href={`#${eintrag.id}`} aktiv={aktiv === eintrag.id}>
              {tx(eintrag.name)}
            </Chip>
          ))}
        </div>
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
        <ul className="list-none space-y-1 px-4 py-3 text-sm leading-5">
          <li>{tx('Pause: {tage} Tag frei', { tage: zahl(ERLAUBTE_PAUSENTAGE) })}</li>
          <li>{txMenge(SCHUTZ.schwelleTage, 'Schutz: alle {tage} Tage, unter Heute einsetzen', { tage: zahl(SCHUTZ.schwelleTage) })}</li>
          <li>{txMenge(RUECKKEHR.fristTage, 'Rückkehr: {frist} Tage, wenn kein Schutz', { frist: zahl(RUECKKEHR.fristTage) })}</li>
          <li>{tx('Schutz und Rückkehr geben keine XP')}</li>
        </ul>
        <div className="border-t border-rand">
        <Tabelle
          spalten={[tx('Streak'), tx('Faktor')]}
          zeilen={STREAK_BEISPIELE.map((tage) => [txMenge(tage, '{tage} Tage', { tage: zahl(tage) }), faktorText(momentumFuerSerie(tage))])}
        />
        </div>
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

function useAktiverAbschnitt(schluessel: string, bereit: boolean, leiste: RefObject<HTMLElement | null>): string {
  const erste = schluessel.split('|')[0] ?? '';
  const [aktiv, setAktiv] = useState(erste);

  useEffect(() => {
    if (!bereit) {
      return;
    }
    const ids = schluessel.split('|').filter((id) => id.length > 0);
    let rahmen = 0;

    const messen = () => {
      rahmen = 0;
      const unterkante = leiste.current?.getBoundingClientRect().bottom ?? 0;
      setAktiv((bisher) => {
        const naechstes = abschnittImBlick(ids, unterkante);
        return bisher === naechstes ? bisher : naechstes;
      });
    };

    const planen = () => {
      if (rahmen !== 0) {
        return;
      }
      rahmen = window.requestAnimationFrame(messen);
    };

    messen();
    window.addEventListener('scroll', planen, { passive: true });
    window.addEventListener('resize', planen);
    return () => {
      window.removeEventListener('scroll', planen);
      window.removeEventListener('resize', planen);
      if (rahmen !== 0) {
        window.cancelAnimationFrame(rahmen);
      }
    };
  }, [schluessel, bereit, leiste]);

  return aktiv || erste;
}

function abschnittImBlick(ids: readonly string[], unterkante: number): string {
  let gewaehlt = ids[0] ?? '';
  for (const id of ids) {
    const abschnitt = document.getElementById(id);
    if (abschnitt && abschnitt.getBoundingClientRect().top <= unterkante + 4) {
      gewaehlt = id;
    }
  }
  const letzter = ids[ids.length - 1];
  if (!letzter || gewaehlt === letzter || window.scrollY <= 0) {
    return gewaehlt;
  }
  const amEnde = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  const knoten = document.getElementById(letzter);
  if (amEnde && knoten && knoten.getBoundingClientRect().top > unterkante + 4) {
    return letzter;
  }
  return gewaehlt;
}

function HandbuchAbschnitt({ id, titel, children }: { id: string; titel: string; children: ReactNode }) {
  return (
    <section id={id} className="handbuch-abschnitt min-w-0 md:max-w-[720px]">
      <div className="md:px-4">
        <AbschnittKopf titel={tx(titel)} />
      </div>
      <FlaecheInnen className="max-w-full overflow-x-auto overscroll-x-contain">
        <div>{children}</div>
      </FlaecheInnen>
    </section>
  );
}

function Tabelle({ spalten, zeilen, zahlAb = 1 }: { spalten: string[]; zeilen: ReactNode[][]; zahlAb?: number }) {
  const ausrichtung = (index: number) => (index >= zahlAb ? 'zahl text-right' : 'text-left');
  return (
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
  );
}
