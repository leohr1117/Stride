import { tx } from '../text.ts';
import { Swords, Trophy } from 'lucide-react';
import type { BonusQuelle, Eintrag } from '../../../shared/api/index.ts';
import { NEUTRAL_FARBE } from '../../../shared/spiel/begriffe.ts';
import { istAn } from '../../../shared/spiel/sichtbarkeit.ts';
import { bonusProzent, dauerText, faktorText, lokalesDatum, tagesUeberschrift, uhrzeit, zahl } from '../format.ts';
import { useSichtbarkeit } from '../funktionen.ts';
import type { SchnellZiel } from '../schnell.ts';
import { Icon } from './Icons.tsx';
import { SchnellZeile } from './SchnellAktion.tsx';

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

export function eintragSchnellZiel(eintrag: Eintrag): SchnellZiel {
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
    <SchnellZeile ziel={eintragSchnellZiel(eintrag)} className={`rounded-2xl border ${rahmen}`} hintergrund="bg-transparent">
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

function wofuerText(eintrag: Eintrag, boss: boolean): string {
  const teile: string[] = [];
  if (eintrag.projektName) {
    teile.push(eintrag.projektName);
  }
  if (eintrag.kontext && eintrag.kontext.titel !== eintrag.projektName) {
    teile.push(eintrag.kontext.titel);
  }
  if (eintrag.vorhaben && !boss) {
    const stand =
      eintrag.abschluss === 'geschafft' ? `${tx('Geschafft:')} ` : eintrag.abschluss === 'gescheitert' ? `${tx('Gescheitert:')} ` : '';
    const anlauf = eintrag.vorhaben.anlauf > 1 ? ` · ${tx('{anlauf}. Anlauf', { anlauf: eintrag.vorhaben.anlauf })}` : '';
    teile.push(`${stand}${eintrag.vorhaben.titel}${anlauf}`);
  }
  if (eintrag.faehigkeit) {
    teile.push(eintrag.faehigkeit.name);
  }
  if (eintrag.knotenTitel) {
    teile.push(eintrag.knotenTitel);
  }
  if (eintrag.basisAufgabe) {
    teile.push(eintrag.basisAufgabe);
  }
  return teile.join(' · ');
}

function DetailZeile({ label, wert }: { label: string; wert: string }) {
  if (!wert) {
    return null;
  }
  return (
    <div className="flex min-h-12 items-start gap-3 py-3">
      <span className="w-28 shrink-0 text-sm text-leise">{label}</span>
      <span className="min-w-0 flex-1 text-sm break-words whitespace-pre-line">{wert}</span>
    </div>
  );
}

export function EintragDetail({ eintrag }: { eintrag: Eintrag }) {
  const sichtbarkeit = useSichtbarkeit();
  const boss = istAn('bossAngriffe', sichtbarkeit) && eintrag.bossSieg != null ? eintrag.bossSieg : null;
  const wann = `${tagesUeberschrift(lokalesDatum(new Date(eintrag.erstelltAm)))} · ${uhrzeit(eintrag.erstelltAm)}`;
  const dauer =
    eintrag.stunden === null
      ? ''
      : Math.abs(eintrag.faktor - 1) > 0.005
        ? `${dauerText(eintrag.stunden)} · ${faktorText(eintrag.faktor)}`
        : dauerText(eintrag.stunden);
  const extras = [
    ...(istAn('ausruestung', sichtbarkeit) && eintrag.ausruestungBonus > 0
      ? [tx('Investitionen {bonus}', { bonus: bonusProzent(eintrag.ausruestungBonus) })]
      : []),
    ...eintrag.boni.filter((quelle) => quelle !== 'meilenstein' && quelle !== 'beute').map((quelle) => tx(BONUS[quelle])),
  ];
  const erkenntnis = eintrag.erkenntnis?.trim() ?? '';
  const notiz = [eintrag.notiz.trim(), erkenntnis ? `${tx('Mitgenommen:')} ${erkenntnis}` : '']
    .filter((teil) => teil.length > 0)
    .join('\n');

  return (
    <div>
      <DetailZeile label={tx('Tätigkeit')} wert={eintrag.vorlageName} />
      <DetailZeile label={tx('Wofür?')} wert={wofuerText(eintrag, boss !== null)} />
      <DetailZeile label={tx('Dauer')} wert={dauer} />
      <DetailZeile label={tx('Datum')} wert={wann} />
      <div className="flex min-h-12 items-start gap-3 py-3">
        <span className="w-28 shrink-0 text-sm text-leise">{tx('XP')}</span>
        <span className="min-w-0 flex-1 text-sm">
          <span className="zahl font-semibold text-xp">+{zahl(eintrag.xp)} XP</span>
          {extras.map((text) => (
            <span key={text} className="mt-1 block">
              {text}
            </span>
          ))}
        </span>
      </div>
      <DetailZeile label={tx('Notiz')} wert={notiz} />
      {boss && (
        <div className="mt-2 rounded-2xl border border-gefahr/40 bg-gefahr/10 p-3">
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
    </div>
  );
}
