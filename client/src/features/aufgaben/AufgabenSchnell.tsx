import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Ziele } from '../../../../shared/api/ziele.ts';
import type { Sprache } from '../../../../shared/sprache/kern.ts';
import { GRENZEN } from '../../../../shared/spiel/begriffe.ts';
import { NAMEN_INFO } from '../../../../shared/spiel/aufgabe.ts';
import {
  nameOhneStuecke,
  type SchnellEbenen,
  type SchnellErgebnis,
  type SchnellSpanne,
  type SchnellStueck,
  type SchnellTreffer,
  type SchnellVorschlag,
  type SchnellZiel,
} from '../../../../shared/spiel/schnelleingabe.ts';
import { tx } from '../../text.ts';
import { InfoHinweis } from '../../ui/index.ts';
import {
  anfangsStand,
  ergebnisVon,
  kreuz,
  nebenweg,
  nebenwege,
  tippe,
  uebernimmVorschlag,
  vorschlagAmCursor,
  type SchnellAnfang,
  type SchnellFeld,
  type SchnellKontext,
  type SchnellStand,
} from './schnellStand.ts';

const NAME_STIL =
  'relative w-full rounded-xl border border-rand bg-transparent px-3 py-2.5 text-sm leading-5 text-transparent outline-none transition focus:border-akzent';

export function useSchnellFelder({
  anfang,
  heute,
  sprache,
  ziele,
  ebenen,
  onProjekt,
  onTermin,
}: {
  anfang: SchnellAnfang;
  heute: string;
  sprache: Sprache;
  ziele: Ziele | undefined;
  ebenen: SchnellEbenen;
  onProjekt: (id: number | null) => void;
  onTermin: () => void;
}) {
  const kontext = useMemo(
    () => kontextAus(heute, sprache, ziele, ebenen),
    [heute, sprache, ziele, ebenen.projekte, ebenen.organisationen, ebenen.visionen],
  );
  const anfangRef = useRef(anfang);
  const [stand, setStand] = useState(() => anfangsStand(anfangRef.current, kontext));
  const [cursor, setCursor] = useState(anfangRef.current.name.length);
  const [sprung, setSprung] = useState(0);
  const standRef = useRef(stand);
  standRef.current = stand;
  const onProjektRef = useRef(onProjekt);
  onProjektRef.current = onProjekt;
  const onTerminRef = useRef(onTermin);
  onTerminRef.current = onTermin;

  const melde = (vorher: SchnellStand, nachher: SchnellStand) => {
    if (nachher.projektId !== vorher.projektId) {
      onProjektRef.current(nachher.projektId);
    }
    if (nachher.faelligAm !== '' || nachher.faelligUm !== '') {
      onTerminRef.current();
    }
  };

  const wende = (naechster: SchnellStand, vorher = stand) => {
    melde(vorher, naechster);
    setStand(naechster);
  };

  useEffect(() => {
    const aktuell = standRef.current;
    const naechster = tippe(aktuell, aktuell.name, kontext);
    if (gleichStand(aktuell, naechster)) {
      return;
    }
    if (naechster.projektId !== aktuell.projektId) {
      onProjektRef.current(naechster.projektId);
    }
    if (naechster.faelligAm !== '' || naechster.faelligUm !== '') {
      onTerminRef.current();
    }
    setStand(naechster);
  }, [kontext]);

  const ergebnis = useMemo(() => ergebnisVon(stand, kontext), [stand, kontext]);

  return {
    name: stand.name,
    nameRein: nameOhneStuecke(stand.name, ergebnis.stuecke),
    faelligAm: stand.faelligAm,
    faelligUm: stand.faelligUm,
    prioritaet: stand.prioritaet,
    projektId: stand.projektId,
    organisationId: stand.organisationId,
    visionId: stand.visionId,
    ergebnis,
    cursor,
    sprung,
    setzeName: (name: string, naechsterCursor: number) => {
      setCursor(naechsterCursor);
      wende(tippe(stand, name, kontext));
    },
    setzeCursor: setCursor,
    kreuz: (stueck: SchnellStueck) => wende(kreuz(stand, stueck, kontext)),
    waehle: (vorschlag: SchnellVorschlag, treffer: SchnellTreffer) => {
      const einsetzen = `${vorschlag.zeichen}${treffer.name}`;
      const laenge = stand.name.length - (vorschlag.bis - vorschlag.von) + einsetzen.length;
      if (laenge > GRENZEN.nameMax) {
        return;
      }
      setCursor(vorschlag.von + einsetzen.length);
      setSprung((wert) => wert + 1);
      wende(uebernimmVorschlag(stand, vorschlag, treffer, kontext));
    },
    setzeDatum: (wert: string) => wende(nebenweg(stand, 'datum', wert === '' ? null : wert, kontext)),
    setzeUhrzeit: (wert: string) => wende(nebenweg(stand, 'uhrzeit', wert === '' ? null : wert, kontext)),
    setzePrioritaet: (wert: number | null) => wende(nebenweg(stand, 'prioritaet', wert, kontext)),
    setzeProjekt: (wert: number | null) => wende(nebenweg(stand, 'projekt', wert, kontext)),
    leereTermin: () => wende(nebenwege(stand, { datum: null, uhrzeit: null }, kontext)),
  };
}

export function AufgabenName({
  name,
  ergebnis,
  cursor,
  sprung,
  onName,
  onCursor,
  onKreuz,
  onVorschlag,
}: {
  name: string;
  ergebnis: SchnellErgebnis;
  cursor: number;
  sprung: number;
  onName: (name: string, cursor: number) => void;
  onCursor: (cursor: number) => void;
  onKreuz: (stueck: SchnellStueck) => void;
  onVorschlag: (vorschlag: SchnellVorschlag, treffer: SchnellTreffer) => void;
}) {
  const feld = useRef<HTMLInputElement>(null);
  const spiegel = useRef<HTMLDivElement>(null);
  const letzterSprung = useRef(0);
  const vorschlag = vorschlagAmCursor(ergebnis.vorschlaege, cursor);
  const spannen: SchnellSpanne[] = [
    ...ergebnis.stuecke.map((stueck) => ({ von: stueck.von, bis: stueck.bis })),
    ...ergebnis.vorschlaege.map((eintrag) => ({ von: eintrag.von, bis: eintrag.bis })),
  ];

  const sync = (input: HTMLInputElement) => {
    if (spiegel.current) {
      spiegel.current.scrollLeft = input.scrollLeft;
    }
  };

  useLayoutEffect(() => {
    const input = feld.current;
    if (!input) {
      return;
    }
    sync(input);
    if (sprung === 0 || sprung === letzterSprung.current) {
      return;
    }
    letzterSprung.current = sprung;
    input.focus();
    input.setSelectionRange(cursor, cursor);
  }, [name, cursor, sprung]);

  return (
    <div>
      <div className="space-y-1.5">
        <span className="flex items-center text-sm font-medium">
          {tx('Name')}
          <InfoHinweis text={NAMEN_INFO} />
        </span>
        <div className="relative">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-xl bg-flaeche-2" />
          <div
            ref={spiegel}
            aria-hidden="true"
            data-spiegel=""
            className="pointer-events-none absolute inset-px overflow-hidden px-3 py-2.5 text-sm leading-5 whitespace-pre text-haupt"
          >
            {spiegelTeile(name, spannen).map((teil, index) =>
              teil.treffer ? (
                <span key={index} data-treffer="1" className="rounded-[2px] bg-akzent/28">
                  {teil.text}
                </span>
              ) : (
                <span key={index}>{teil.text}</span>
              ),
            )}
          </div>
          <input
            ref={feld}
            aria-label={tx('Name')}
            aria-autocomplete="list"
            aria-expanded={vorschlag !== null}
            aria-controls={vorschlag ? 'aufgaben-vorschlaege' : undefined}
            className={NAME_STIL}
            style={{ caretColor: 'var(--haupt)' }}
            value={name}
            maxLength={GRENZEN.nameMax}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            onChange={(ereignis) => {
              onName(ereignis.target.value, ereignis.target.selectionStart ?? ereignis.target.value.length);
              sync(ereignis.target);
            }}
            onSelect={(ereignis) => onCursor(ereignis.currentTarget.selectionStart ?? 0)}
            onKeyUp={(ereignis) => onCursor(ereignis.currentTarget.selectionStart ?? 0)}
            onClick={(ereignis) => onCursor(ereignis.currentTarget.selectionStart ?? 0)}
            onScroll={(ereignis) => sync(ereignis.currentTarget)}
          />
        </div>
      </div>
      {vorschlag && vorschlag.treffer.length > 0 && (
        <div
          id="aufgaben-vorschlaege"
          role="listbox"
          aria-label={tx('Vorschläge')}
          className="mt-1.5 overflow-hidden rounded-xl border border-rand bg-flaeche-2"
        >
          {vorschlag.treffer.map((treffer) => (
            <button
              key={`${vorschlag.art}-${treffer.id}`}
              type="button"
              role="option"
              className="flex min-h-11 w-full items-center border-t border-rand px-3 py-2.5 text-left text-sm first:border-t-0 hover:bg-akzent/10"
              onMouseDown={(ereignis) => ereignis.preventDefault()}
              onClick={() => onVorschlag(vorschlag, treffer)}
            >
              {treffer.name}
            </button>
          ))}
        </div>
      )}
      {ergebnis.stuecke.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ergebnis.stuecke.map((stueck) => (
            <button
              key={`${stueck.art}-${stueck.von}-${stueck.bis}`}
              type="button"
              aria-label={tx('{text} nicht erkennen', { text: stueck.text })}
              onClick={() => onKreuz(stueck)}
              className="inline-flex items-center gap-1.5 rounded-full bg-akzent/12 px-2 py-1 text-xs text-akzent"
            >
              {stueck.text}
              <X className="size-3" strokeWidth={1.75} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function spiegelTeile(name: string, spannen: readonly SchnellSpanne[]): { text: string; treffer: boolean }[] {
  const sortiert = [...spannen].filter((spanne) => spanne.bis > spanne.von).sort((a, b) => a.von - b.von);
  const teile: { text: string; treffer: boolean }[] = [];
  let cursor = 0;
  for (const spanne of sortiert) {
    const von = Math.max(cursor, spanne.von);
    if (von > cursor) {
      teile.push({ text: name.slice(cursor, von), treffer: false });
    }
    if (spanne.bis > von) {
      teile.push({ text: name.slice(von, spanne.bis), treffer: true });
    }
    cursor = Math.max(cursor, spanne.bis);
  }
  if (cursor < name.length) {
    teile.push({ text: name.slice(cursor), treffer: false });
  }
  return teile;
}

function kontextAus(heute: string, sprache: Sprache, ziele: Ziele | undefined, ebenen: SchnellEbenen): SchnellKontext {
  return {
    heute,
    sprache,
    projekte: alsZiele(ziele?.projekte),
    organisationen: alsZiele(ziele?.organisationen),
    visionen: (ziele?.visionen ?? [])
      .filter((vision) => !vision.archiviert && vision.titel.trim() !== '')
      .map((vision) => ({ id: vision.id, name: vision.titel.trim() })),
    ebenen: {
      projekte: ebenen.projekte,
      organisationen: ebenen.organisationen,
      visionen: ebenen.visionen,
    },
  };
}

function alsZiele(eintraege: readonly { id: number; name: string; archiviert: boolean }[] | undefined): SchnellZiel[] {
  if (!eintraege) {
    return [];
  }
  return eintraege
    .filter((eintrag) => !eintrag.archiviert && eintrag.name.trim() !== '')
    .map((eintrag) => ({ id: eintrag.id, name: eintrag.name.trim() }));
}

function gleichStand(a: SchnellStand, b: SchnellStand): boolean {
  if (
    a.name !== b.name ||
    a.faelligAm !== b.faelligAm ||
    a.faelligUm !== b.faelligUm ||
    a.prioritaet !== b.prioritaet ||
    a.projektId !== b.projektId ||
    a.organisationId !== b.organisationId ||
    a.visionId !== b.visionId
  ) {
    return false;
  }
  const felder: SchnellFeld[] = ['datum', 'uhrzeit', 'prioritaet', 'projekt', 'organisation', 'vision'];
  if (felder.some((feld) => a.herkunft[feld] !== b.herkunft[feld])) {
    return false;
  }
  if (a.entlassen.length !== b.entlassen.length) {
    return false;
  }
  return a.entlassen.every((spanne, index) => spanne.von === b.entlassen[index]?.von && spanne.bis === b.entlassen[index]?.bis);
}
