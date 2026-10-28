import { attributName, tx } from '../text.ts';
import { CircleCheck, CircleX, Swords, Trophy } from 'lucide-react';
import { Link } from 'react-router';
import type { BonusQuelle, Eintrag } from '../../../shared/api/index.ts';
import { NEUTRAL_FARBE } from '../../../shared/spiel/begriffe.ts';
import { istAn } from '../../../shared/spiel/sichtbarkeit.ts';
import { bonusProzent, dauerText, faktorText, lokalesDatum, mitVorzeichen, tagesUeberschrift, uhrzeit, zahl } from '../format.ts';
import { useSichtbarkeit } from '../funktionen.ts';
import type { SchnellZiel } from '../schnell.ts';
import { Icon } from './Icons.tsx';
import { SchnellNebenaktion, SchnellZeile } from './SchnellAktion.tsx';

const BONUS: Record<BonusQuelle, string> = {
  bestaendigkeit: 'Tageskette',
  weitermachen: 'Weitergemacht',
  anlauf: 'Anlauf',
  rueckkehr: 'Rückkehr',
  meilenstein: 'Meilenstein',
  comeback: 'Comeback',
  knoten: 'Fertigkeit',
  basis: 'Basis',
  beute: 'Beute',
  rueckblick: 'Rückblick',
  vision: 'Vision',
  abschluss: 'Projekt abgeschlossen',
};

const FALLBACK_FARBE = NEUTRAL_FARBE;

function kernzeile(eintrag: Eintrag): string | null {
  if (eintrag.vorhaben) {
    const stand =
      eintrag.abschluss === 'geschafft' ? `${tx('Geschafft:')} ` : eintrag.abschluss === 'gescheitert' ? `${tx('Gescheitert:')} ` : '';
    return `${stand}${eintrag.vorhaben.titel}`;
  }
  const notiz = eintrag.notiz.trim().split('\n')[0] ?? '';
  if (notiz) {
    return notiz;
  }
  return eintrag.projektName;
}

function MeilensteinPill({ gross = false }: { gross?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-xp/15 font-semibold text-xp ${
        gross ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-0.5 text-[10px] tracking-wide uppercase'
      }`}
    >
      <Trophy className={gross ? 'size-3.5' : 'size-3'} />
      {tx("Meilenstein")}
    </span>
  );
}

function schnellZiel(eintrag: Eintrag): SchnellZiel {
  const notiz = eintrag.notiz.trim().split('\n')[0] ?? '';
  const hinweis = eintrag.abschluss
    ? tx('Die {xp} XP werden wieder abgezogen. Das Vorhaben wird dabei wieder geöffnet.', { xp: eintrag.xp })
    : tx('Die {xp} XP werden wieder abgezogen.', { xp: eintrag.xp });
  return { art: 'eintrag', id: eintrag.id, name: notiz || eintrag.vorlageName, hinweis };
}

export function EintragKarte({ eintrag, onOeffnen }: { eintrag: Eintrag; onOeffnen: () => void }) {
  const sichtbarkeit = useSichtbarkeit();
  const bossSieg = istAn('bossAngriffe', sichtbarkeit) && eintrag.bossSieg != null;
  const kern = kernzeile(eintrag);
  const farbe = eintrag.kontext?.farbe ?? FALLBACK_FARBE;
  const rahmen = bossSieg
    ? 'boss-sieg border-gefahr/40 bg-gefahr/5'
    : eintrag.meilenstein
      ? 'border-xp/40 bg-xp/5'
      : 'border-rand bg-flaeche';
  return (
    <SchnellZeile ziel={schnellZiel(eintrag)} className={`rounded-2xl border ${rahmen}`} hintergrund="bg-transparent">
      {(menue) => (
    <div className="relative">
    <button
      type="button"
      onClick={onOeffnen}
      className="flex w-full items-center gap-3 px-3 py-3 pr-12 text-left"
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl"
        style={
          bossSieg
            ? { backgroundColor: 'color-mix(in srgb, var(--gefahr) 13%, transparent)', color: 'var(--gefahr)' }
            : { backgroundColor: `${farbe}22`, color: farbe }
        }
      >
        {bossSieg ? (
          <Swords className="size-5 text-gefahr" aria-hidden="true" />
        ) : eintrag.meilenstein ? (
          <Trophy className="size-5 text-xp" />
        ) : (
          <Icon name={eintrag.vorlageIcon} className="size-5" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-medium ${bossSieg ? 'text-gefahr' : ''}`}>{eintrag.vorlageName}</span>
        {kern ? <span className="block truncate text-xs text-leise">{kern}</span> : null}
        {eintrag.meilenstein && !bossSieg ? (
          <span className="mt-1 block">
            <MeilensteinPill />
          </span>
        ) : null}
      </span>
      <span className="zahl shrink-0 text-sm font-semibold text-xp">+{zahl(eintrag.xp)} XP</span>
    </button>
    <div className="absolute top-1 right-1">{menue}</div>
    </div>
      )}
    </SchnellZeile>
  );
}

function MetaChip({ kinder }: { kinder: string }) {
  return <span className="max-w-full truncate rounded-full bg-flaeche-2 px-2.5 py-1 text-xs">{kinder}</span>;
}

export function EintragDetail({ eintrag, onEntfernt }: { eintrag: Eintrag; onEntfernt?: () => void }) {
  const sichtbarkeit = useSichtbarkeit();
  const projekteAn = istAn('projekte', sichtbarkeit);
  const faehigkeitenAn = istAn('faehigkeiten', sichtbarkeit);
  const boss = istAn('bossAngriffe', sichtbarkeit) && eintrag.bossSieg != null ? eintrag.bossSieg : null;
  const wann = `${tagesUeberschrift(lokalesDatum(new Date(eintrag.erstelltAm)))} · ${uhrzeit(eintrag.erstelltAm)}`;
  const boni = eintrag.boni
    .filter((quelle) => quelle !== 'meilenstein' && (boss === null || quelle !== 'beute'))
    .map((quelle) => tx(BONUS[quelle]));
  const maxAbs = eintrag.anteile.reduce((bisher, anteil) => Math.max(bisher, Math.abs(anteil.xp)), 0);
  const faktorAbweichend = Math.abs(eintrag.faktor - 1) > 0.005;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-leise">{wann}</p>
          {eintrag.meilenstein && boss === null ? <MeilensteinPill gross /> : null}
        </div>
        <p className="zahl shrink-0 text-lg font-semibold text-xp">+{zahl(eintrag.xp)} XP</p>
      </div>

      <div className="space-y-2">
        {eintrag.projektName &&
          (projekteAn && eintrag.projektId !== null ? (
            <Link to={`/projekte/${eintrag.projektId}`} className="block truncate text-sm font-medium hover:underline">
              {eintrag.projektName}
            </Link>
          ) : (
            <p className="truncate text-sm font-medium">{eintrag.projektName}</p>
          ))}
        {eintrag.kontext && eintrag.kontext.titel !== eintrag.projektName && (
          <p className="flex min-w-0 items-center gap-2 text-sm text-leise">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: eintrag.kontext.farbe }} />
            <span className="truncate">{eintrag.kontext.titel}</span>
          </p>
        )}
        {eintrag.vorhaben && boss === null && (
          <p className="flex items-center gap-1.5 text-sm">
            {eintrag.abschluss === 'geschafft' && <CircleCheck className="size-4 shrink-0 text-xp" />}
            {eintrag.abschluss === 'gescheitert' && <CircleX className="size-4 shrink-0 text-leise" />}
            <span className="min-w-0">
              {eintrag.abschluss === 'geschafft' && `${tx('Geschafft:')} `}
              {eintrag.abschluss === 'gescheitert' && `${tx('Gescheitert:')} `}
              {eintrag.vorhaben.titel}
              {eintrag.vorhaben.anlauf > 1 ? ` · ${tx('{anlauf}. Anlauf', { anlauf: eintrag.vorhaben.anlauf })}` : ''}
            </span>
          </p>
        )}
        {eintrag.notiz && <p className="text-sm whitespace-pre-line">{eintrag.notiz}</p>}
        {eintrag.erkenntnis && (
          <p className="text-sm">
            <span className="text-leise">{tx('Mitgenommen:')} </span>
            {eintrag.erkenntnis}
          </p>
        )}
      </div>

      {boss && (
        <div className="rounded-2xl border border-gefahr/40 bg-gefahr/10 p-3">
          <div className="flex items-center gap-2">
            <Swords className="size-4 shrink-0 text-gefahr" aria-hidden="true" />
            <p className="min-w-0 truncate font-medium text-gefahr">{eintrag.vorhaben?.titel}</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <MetaChip kinder={tx('Level {level}', { level: zahl(boss.level) })} />
            <MetaChip kinder={tx('{xp} Kampf-XP', { xp: zahl(boss.kampfXp) })} />
            {boss.beute > 0 ? <MetaChip kinder={tx('+{xp} XP Siegbonus', { xp: zahl(boss.beute) })} /> : null}
          </div>
        </div>
      )}

      {(eintrag.stunden !== null ||
        faktorAbweichend ||
        (istAn('ausruestung', sichtbarkeit) && eintrag.ausruestungBonus > 0) ||
        eintrag.basisAufgabe ||
        eintrag.faehigkeit ||
        eintrag.knotenTitel ||
        eintrag.herkunft ||
        boni.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {eintrag.stunden !== null ? <MetaChip kinder={dauerText(eintrag.stunden)} /> : null}
          {faktorAbweichend ? <MetaChip kinder={faktorText(eintrag.faktor)} /> : null}
          {istAn('ausruestung', sichtbarkeit) && eintrag.ausruestungBonus > 0 ? (
            <MetaChip kinder={tx('Investitionen {bonus}', { bonus: bonusProzent(eintrag.ausruestungBonus) })} />
          ) : null}
          {eintrag.basisAufgabe ? <MetaChip kinder={tx('Basis · {name}', { name: eintrag.basisAufgabe })} /> : null}
          {eintrag.faehigkeit ? (
            faehigkeitenAn ? (
              <Link
                to={`/faehigkeiten/${eintrag.faehigkeit.id}`}
                className="max-w-full truncate rounded-full bg-flaeche-2 px-2.5 py-1 text-xs hover:underline"
              >
                {tx('Fähigkeit · {name}', { name: eintrag.faehigkeit.name })}
              </Link>
            ) : (
              <MetaChip kinder={tx('Fähigkeit · {name}', { name: eintrag.faehigkeit.name })} />
            )
          ) : null}
          {eintrag.knotenTitel ? <MetaChip kinder={tx('Fertigkeit · {name}', { name: eintrag.knotenTitel })} /> : null}
          {eintrag.herkunft ? <MetaChip kinder={tx('Herkunft · {name}', { name: eintrag.herkunft })} /> : null}
          {boni.map((bonus) => (
            <MetaChip key={bonus} kinder={bonus} />
          ))}
        </div>
      )}

      {eintrag.anteile.length > 0 && (
        <div className="space-y-1.5">
          {eintrag.anteile.map((anteil) => {
            const breite = maxAbs > 0 ? Math.max(8, Math.round((Math.abs(anteil.xp) / maxAbs) * 100)) : 0;
            const farbe = anteil.xp < 0 ? 'var(--gefahr)' : anteil.farbe || FALLBACK_FARBE;
            return (
              <div key={anteil.attributId} className="flex items-center gap-2 rounded-xl bg-flaeche-2 px-2.5 py-1.5">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: anteil.farbe || FALLBACK_FARBE }} />
                <span className="min-w-0 flex-1 truncate text-sm">{attributName({ name: anteil.name })}</span>
                <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-grund">
                  <span className="block h-full rounded-full" style={{ width: `${breite}%`, backgroundColor: farbe }} />
                </span>
                <span className={`zahl w-12 shrink-0 text-right text-xs ${anteil.xp < 0 ? 'text-gefahr' : ''}`}>
                  {mitVorzeichen(anteil.xp)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <SchnellNebenaktion ziel={schnellZiel(eintrag)} onErledigt={onEntfernt} />
    </div>
  );
}
