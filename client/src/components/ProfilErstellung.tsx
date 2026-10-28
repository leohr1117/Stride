import { Info } from 'lucide-react';
import { attributName, tx } from '../text.ts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import type { Einstellungen } from '../../../shared/api/index.ts';
import { attributVorlage } from '../../../shared/features/attribute/attributKatalog.ts';
import type { AttributKennung } from '../../../shared/spiel/begriffe.ts';
import { START_BOSS_NAME, START_PROJEKT, startBossSichtbar, vorbildVorschlag } from '../../../shared/spiel/onboarding.ts';
import {
  alterInJahren,
  FOKUS_LISTE,
  geburtsjahrGueltig,
  GEBURTSJAHR_MIN,
  PROFIL_SCHRITTE,
  PROFILNAME_MAX,
  PROFILNAME_PLATZHALTER,
  startAttribute,
  startTaetigkeiten,
  ZIEL_FRAGE,
  ZIELSTREBIGKEIT_INFO,
  ZIELSTREBIGKEITEN,
  type FokusId,
  type ProfilSchritt,
  type Zielstrebigkeit,
} from '../../../shared/spiel/profil.ts';
import { api, SCHLUESSEL } from '../api/index.ts';
import { zahl } from '../format.ts';
import { useSprache } from '../sprache.tsx';
import { EINGABE_STIL, Fehlermeldung, Feld, Formular, Karte, Knopf } from '../ui/index.ts';

const SCHRITT_TEXT: Record<ProfilSchritt, { titel: string; text: string }> = {
  profilname: { titel: 'Profilname', text: 'Name auf dem Charakter.' },
  geburtsjahr: { titel: 'Geburtsjahr', text: 'Daraus wird das Alter.' },
  ziel: { titel: ZIEL_FRAGE, text: 'Welche Ziele es gibt, und ob Fähigkeiten dazu kommen.' },
  fokus: { titel: 'Fokus', text: 'Erste Werte und Tätigkeiten.' },
};
const SCHRITTE = PROFIL_SCHRITTE.map((id) => ({ id, ...SCHRITT_TEXT[id] }));
const BALKEN = PROFIL_SCHRITTE.length + 1;

type Wahl = 'an' | 'aus' | null;

function aufzaehlung(namen: string[]): string {
  if (namen.length <= 1) {
    return namen[0] ?? '';
  }
  return tx('{liste} und {letzter}', {
    liste: namen.slice(0, -1).join(', '),
    letzter: namen[namen.length - 1] ?? '',
  });
}

function attributNamen(kennungen: readonly AttributKennung[]): string {
  return aufzaehlung(kennungen.map((kennung) => attributName({ kennung, name: attributVorlage(kennung).name })));
}

export function ZielWahl({ wert, onAendern }: { wert: Zielstrebigkeit | null; onAendern: (wert: Zielstrebigkeit) => void }) {
  return (
    <div role="radiogroup" aria-label={tx(ZIEL_FRAGE)} className="space-y-2">
      {ZIELSTREBIGKEITEN.map((id) => {
        const info = ZIELSTREBIGKEIT_INFO[id];
        const aktiv = wert === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={aktiv}
            onClick={() => onAendern(id)}
            className={`w-full rounded-2xl border px-4 py-3 text-left transition ${aktiv ? 'border-akzent bg-akzent/10' : 'border-rand bg-flaeche hover:border-leise/50'}`}
          >
            <span className="block text-sm font-medium break-words">{tx(info.titel)}</span>
            <span className="mt-0.5 block text-xs text-leise break-words">{tx(info.text)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function FokusWahl({ wert, onAendern }: { wert: readonly FokusId[]; onAendern: (wert: FokusId[]) => void }) {
  const umschalten = (id: FokusId) => {
    onAendern(wert.includes(id) ? wert.filter((eintrag) => eintrag !== id) : [...wert, id]);
  };
  return (
    <div role="group" aria-label={tx("Fokus")} className="grid gap-2 sm:grid-cols-2">
      {FOKUS_LISTE.map((info) => {
        const aktiv = wert.includes(info.id);
        return (
          <button
            key={info.id}
            type="button"
            aria-pressed={aktiv}
            onClick={() => umschalten(info.id)}
            className={`rounded-2xl border px-4 py-3 text-left transition ${aktiv ? 'border-akzent bg-akzent/10' : 'border-rand bg-flaeche hover:border-leise/50'}`}
          >
            <span className="block text-sm font-medium break-words">{tx(info.label)}</span>
            <span className="mt-0.5 block text-xs text-leise break-words">{tx(info.text)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function FokusVorschau({ fokus }: { fokus: readonly FokusId[] }) {
  if (fokus.length === 0) {
    return null;
  }
  const gewaehlt = startAttribute(fokus).gewaehlt;
  return (
    <div className="space-y-1 text-xs text-leise">
      <p className="break-words">{tx('Sichtbar: {liste}.', { liste: attributNamen(gewaehlt) })}</p>
      <p className="break-words">
        {tx('Tätigkeiten: {liste}.', { liste: aufzaehlung(startTaetigkeiten(fokus).map((taetigkeit) => tx(taetigkeit.name))) })}
      </p>
    </div>
  );
}

function AngebotKarte({
  label,
  name,
  meta,
  info,
  wahl,
  onWahl,
  gesperrt,
}: {
  label: string;
  name: string;
  meta: string;
  info: string;
  wahl: Wahl;
  onWahl: (wahl: 'an' | 'aus') => void;
  gesperrt: boolean;
}) {
  const [offen, setOffen] = useState(false);
  const rahmen = useRef<HTMLSpanElement>(null);
  const kasten = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!offen) {
      return;
    }
    const zu = (ereignis: PointerEvent) => {
      const ziel = ereignis.target as Node;
      if (!rahmen.current?.contains(ziel) && !kasten.current?.contains(ziel)) {
        setOffen(false);
      }
    };
    const taste = (ereignis: KeyboardEvent) => {
      if (ereignis.key === 'Escape') {
        ereignis.stopPropagation();
        setOffen(false);
      }
    };
    document.addEventListener('pointerdown', zu);
    document.addEventListener('keydown', taste);
    return () => {
      document.removeEventListener('pointerdown', zu);
      document.removeEventListener('keydown', taste);
    };
  }, [offen]);

  return (
    <Karte label={label} className={wahl === null ? '' : 'entschieden'}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="ueberschrift text-xs font-semibold tracking-wide uppercase">{label}</h2>
        <span ref={rahmen} className="flex shrink-0 items-center leading-none">
          <button
            type="button"
            aria-label={tx("Info")}
            aria-expanded={offen}
            onClick={(ereignis) => {
              setOffen((wert) => !wert);
              if (ereignis.detail !== 0) {
                ereignis.currentTarget.blur();
              }
            }}
            className="inline-flex size-4 items-center justify-center rounded-full text-leise hover:text-haupt"
          >
            <Info className="size-4" strokeWidth={1.75} />
          </button>
        </span>
      </div>
      <p className="mt-3 text-base font-semibold break-words">{name}</p>
      <p className="mt-0.5 text-xs text-leise break-words">{meta}</p>
      {offen ? (
        <p ref={kasten} className="mt-3 w-full rounded-xl border border-rand bg-flaeche p-3 text-xs break-words">
          {info}
        </p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <Knopf
          type="button"
          variante="primaer"
          data-rolle="annehmen"
          data-angebot={wahl === 'an' ? 'an' : undefined}
          aria-pressed={wahl === 'an'}
          className="min-w-0 flex-1 whitespace-nowrap"
          disabled={gesperrt}
          onClick={() => onWahl('an')}
        >
          {tx("Annehmen")}
        </Knopf>
        <Knopf
          type="button"
          variante="sekundaer"
          data-angebot={wahl === 'aus' ? 'aus' : undefined}
          aria-pressed={wahl === 'aus'}
          className="min-w-0 flex-1 whitespace-nowrap"
          disabled={gesperrt}
          onClick={() => onWahl('aus')}
        >
          {tx("Überspringen")}
        </Knopf>
      </div>
    </Karte>
  );
}

export function ProfilErstellung({ start }: { start: Einstellungen }) {
  const queryClient = useQueryClient();
  const navigiere = useNavigate();
  const { sprache } = useSprache();
  const [schritt, setSchritt] = useState(0);
  const [jahrText, setJahrText] = useState(start.geburtsjahr === null ? '' : String(start.geburtsjahr));
  const [name, setName] = useState(start.charakterName === PROFILNAME_PLATZHALTER ? '' : start.charakterName);
  const [ziel, setZiel] = useState<Zielstrebigkeit | null>(start.zielstrebigkeit);
  const [fokus, setFokus] = useState<FokusId[]>(start.fokus);
  const [vorbildWahl, setVorbildWahl] = useState<Wahl>(null);
  const [bossWahl, setBossWahl] = useState<Wahl>(null);
  const jahr = jahrText.trim() === '' ? null : Number(jahrText);
  const jahrGueltig = jahr !== null && geburtsjahrGueltig(jahr);
  const nameGueltig = name.trim().length > 0 && name.trim().length <= PROFILNAME_MAX;
  const startAktiv = schritt === PROFIL_SCHRITTE.length;
  const id = startAktiv ? null : (PROFIL_SCHRITTE[schritt] ?? null);
  const ersterFokus = fokus[0] ?? null;
  const vorschlag = ersterFokus ? vorbildVorschlag(ersterFokus) : null;
  const bossSichtbar = ziel !== null && startBossSichtbar(ziel);
  const startBereit = vorschlag !== null && vorbildWahl !== null && (!bossSichtbar || bossWahl !== null);
  const gueltig = startAktiv
    ? startBereit
    : {
        profilname: nameGueltig,
        geburtsjahr: jahrGueltig,
        ziel: ziel !== null,
        fokus: fokus.length > 0,
      }[id ?? 'profilname'];
  const frage = SCHRITTE[schritt] ?? SCHRITTE[0];

  const speichern = useMutation({
    mutationFn: () => {
      if (jahr === null || ziel === null || vorschlag === null) {
        throw new Error(tx("Die Angaben sind unvollständig."));
      }
      return api.aendereEinstellungen({
        geburtsjahr: jahr,
        charakterName: name.trim(),
        zielstrebigkeit: ziel,
        fokus,
        sprache,
        profilAngelegt: true,
        startVorbild: vorbildWahl === 'an' ? vorschlag.schluessel : null,
        startBoss: bossSichtbar && bossWahl === 'an',
      });
    },
    onSuccess: (neu) => {
      queryClient.setQueryData(SCHLUESSEL.einstellungen, neu);
      void queryClient.invalidateQueries();
      void navigiere('/handbuch');
    },
  });

  const weiter = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (!gueltig || speichern.isPending) {
      return;
    }
    if (startAktiv) {
      speichern.mutate();
      return;
    }
    setSchritt(schritt + 1);
  };

  const zurueck = () => {
    if (startAktiv) {
      setVorbildWahl(null);
      setBossWahl(null);
    }
    setSchritt(schritt - 1);
  };

  return (
    <main className="flex sicht-mitte items-center justify-center px-4 py-10">
      <Formular onAbsenden={weiter} abstand="space-y-6" className="w-full max-w-lg">
        <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <img src="/logo-v2.svg" alt="" className="size-7" />
          Stride
        </div>
        <div
          className="flex gap-1.5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={BALKEN}
          aria-valuenow={schritt + 1}
          aria-label={tx("Fortschritt")}
        >
          {Array.from({ length: BALKEN }, (_, index) => (
            <span key={index} className={`h-1 flex-1 rounded-full ${index <= schritt ? 'bg-akzent' : 'bg-flaeche-2'}`} />
          ))}
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight break-words">{startAktiv ? tx("Zum Start") : tx(frage.titel)}</h1>
          <p className="text-sm text-leise break-words">
            {startAktiv
              ? tx(bossSichtbar ? 'Zwei Angebote. Beides kannst du auslassen.' : 'Ein Angebot. Du kannst es auslassen.')
              : tx(frage.text)}
          </p>
          {startAktiv ? null : <p className="text-xs text-leise">{tx("Später in den Einstellungen änderbar.")}</p>}
        </div>

        {id === 'profilname' && (
          <Feld label={tx("Profilname")}>
            <input
              className={EINGABE_STIL}
              name="nickname"
              autoComplete="nickname"
              maxLength={PROFILNAME_MAX}
              autoFocus
              value={name}
              onChange={(ereignis) => setName(ereignis.target.value)}
            />
          </Feld>
        )}
        {id === 'geburtsjahr' && (
          <Feld label={tx("Geburtsjahr")} hinweis={jahrGueltig && jahr !== null ? altersHinweis(jahr) : undefined}>
            <input
              className={EINGABE_STIL}
              type="number"
              inputMode="numeric"
              name="bday-year"
              autoComplete="bday-year"
              min={GEBURTSJAHR_MIN}
              max={new Date().getFullYear()}
              autoFocus
              value={jahrText}
              onChange={(ereignis) => setJahrText(ereignis.target.value)}
            />
          </Feld>
        )}
        {id === 'ziel' && <ZielWahl wert={ziel} onAendern={setZiel} />}
        {id === 'fokus' && (
          <div className="space-y-3">
            <FokusWahl wert={fokus} onAendern={setFokus} />
            <FokusVorschau fokus={fokus} />
          </div>
        )}
        {startAktiv && vorschlag ? (
          <div className="space-y-3">
            <AngebotKarte
              label={tx("Vorbild")}
              name={vorschlag.name}
              meta={tx(vorschlag.bekanntFuer)}
              info={tx("Vorschlag aus dem Fokus.")}
              wahl={vorbildWahl}
              onWahl={setVorbildWahl}
              gesperrt={speichern.isPending}
            />
            {bossSichtbar && ersterFokus ? (
              <AngebotKarte
                label={tx("Erster Boss")}
                name={tx(START_BOSS_NAME[ersterFokus])}
                meta={tx('Projekt {name} · 7 Tage', { name: tx(START_PROJEKT) })}
                info={tx("Sieben Tage. Angreifen kann er erst, wenn Bosse angeschaltet werden.")}
                wahl={bossWahl}
                onWahl={setBossWahl}
                gesperrt={speichern.isPending}
              />
            ) : null}
          </div>
        ) : null}

        <Fehlermeldung fehler={speichern.error} />
        <div className="flex items-center justify-between gap-2">
          {schritt > 0 ? (
            <Knopf type="button" variante="leise" onClick={zurueck} disabled={speichern.isPending}>
              {tx("Zurück")}
            </Knopf>
          ) : (
            <span />
          )}
          <Knopf type="submit" variante="primaer" disabled={!gueltig || speichern.isPending}>
            {startAktiv ? tx("Zum Handbuch") : tx("Weiter")}
          </Knopf>
        </div>
      </Formular>
    </main>
  );
}

function altersHinweis(jahr: number): string {
  const alter = alterInJahren(jahr);
  if (alter <= 0) {
    return tx("Du bist in diesem Jahr geboren.");
  }
  if (alter === 1) {
    return tx("Das entspricht ungefähr einem Jahr.");
  }
  return tx('Das entspricht ungefähr {alter} Jahren.', { alter: zahl(alter) });
}
