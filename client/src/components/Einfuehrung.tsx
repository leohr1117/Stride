import { tx } from '../text.ts';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { useEffect, useLayoutEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { EinstellungenAenderung } from '../../../shared/api/index.ts';
import { SPRACH_NAME, SPRACHEN, type Sprache } from '../../../shared/sprache/kern.ts';
import {
  FOKUS_PFLICHT,
  PROFILNAME_MAX,
  PROFILNAME_PLATZHALTER,
  ZIELSTREBIGKEIT_INFO,
  type FokusId,
  type ZielAuswahl,
} from '../../../shared/spiel/profil.ts';
import { api, SCHLUESSEL } from '../api/index.ts';
import { useSprache } from '../sprache.tsx';
import { EINGABE_STIL, Fehlermeldung, Feld, Formular, Knopf, Ladeanzeige } from '../ui/index.ts';
import { FokusVorschau, FokusWahl, ZielWahl } from './ProfilErstellung.tsx';

/** Überlebt den Neuaufbau beim Sprachwechsel, damit ältere Speichern nicht gewinnen. */
let speicherKette: Promise<void> = Promise.resolve();

function spracheMerken(code: Sprache, queryClient: QueryClient): Promise<void> {
  const naechste = speicherKette
    .catch(() => undefined)
    .then(() => api.aendereEinstellungen({ sprache: code }))
    .then((neu) => {
      queryClient.setQueryData(SCHLUESSEL.einstellungen, neu);
    });
  speicherKette = naechste.then(
    () => undefined,
    () => undefined,
  );
  return naechste;
}

const SCHRITTE = ['sprache', 'profilname', 'fokus', 'ziel', 'erstesZiel', 'abschluss'] as const;
type Schritt = (typeof SCHRITTE)[number];

const ERSTES: Record<Exclude<ZielAuswahl, 'einfach'>, { titel: string; label: string; platz: string; art: 'vision' | 'projekt' | 'faehigkeit' }> = {
  traeumer: { titel: 'Dein großes Ziel', label: 'Vision', platz: 'z. B. Marathon laufen', art: 'vision' },
  macher: { titel: 'Dein erstes Projekt', label: 'Projekt', platz: 'z. B. Wohnung einrichten', art: 'projekt' },
  uebung: { titel: 'Worin zuerst?', label: 'Fähigkeit', platz: 'z. B. Gitarre', art: 'faehigkeit' },
};

function schrittAus(zustand: unknown): Schritt | null {
  if (typeof zustand !== 'object' || zustand === null) {
    return null;
  }
  const wert = (zustand as { einfuehrung?: unknown }).einfuehrung;
  return SCHRITTE.includes(wert as Schritt) ? (wert as Schritt) : null;
}

function schreibeSchritt(schritt: Schritt, ersetzen: boolean): void {
  const basis = { ...((history.state ?? {}) as Record<string, unknown>) };
  delete basis.dialog;
  const zustand = { ...basis, einfuehrung: schritt };
  if (ersetzen) {
    history.replaceState(zustand, '');
  } else {
    history.pushState(zustand, '');
  }
}

function nummerVon(schritt: Schritt): number {
  if (schritt === 'sprache') return 1;
  if (schritt === 'profilname') return 2;
  if (schritt === 'fokus') return 3;
  if (schritt === 'ziel') return 4;
  return 5;
}

function Fortschritt({ schritt, gesamt }: { schritt: number; gesamt: number }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={gesamt}
      aria-valuenow={schritt}
      aria-valuetext={tx('Schritt {nr} von {gesamt}', { nr: schritt, gesamt })}
      className="mx-auto flex h-1 w-full max-w-36 gap-1"
    >
      {Array.from({ length: gesamt }, (_, index) => (
        <span
          key={index}
          className={`h-1 flex-1 rounded-full ${index < schritt ? '' : 'bg-rand'}`}
          style={index < schritt ? { backgroundColor: 'var(--fortschritt, var(--akzent))' } : undefined}
        />
      ))}
    </div>
  );
}

function AbschlussZeile({ titel, wert }: { titel: string; wert: string }) {
  return (
    <div className="flex min-h-14 items-center gap-3 border-b border-rand">
      <span className="shrink-0 text-sm">{titel}</span>
      <span className="min-w-0 flex-1 truncate text-right text-sm text-leise">{wert}</span>
    </div>
  );
}

export function EinfuehrungAblauf({ onHalten, onLos }: { onHalten: () => void; onLos: () => void }) {
  const { sprache, waehle } = useSprache();
  const client = useQueryClient();
  const navigiere = useNavigate();
  const zugang = useQuery({ queryKey: SCHLUESSEL.zugang, queryFn: api.zugang });
  const [schritt, setSchritt] = useState<Schritt>('sprache');
  const [name, setName] = useState('');
  const [nameBeruehrt, setNameBeruehrt] = useState(false);
  const [fokus, setFokus] = useState<FokusId[]>([]);
  const [ziel, setZiel] = useState<ZielAuswahl>('macher');
  const [zielName, setZielName] = useState('');
  const [nameFehler, setNameFehler] = useState<string | null>(null);
  const [fokusFehler, setFokusFehler] = useState(false);
  const [zielFehler, setZielFehler] = useState<string | null>(null);
  const [fehler, setFehler] = useState<unknown>(null);
  const [speichert, setSpeichert] = useState(false);

  const vorbelegung = zugang.data?.benutzername?.trim() || PROFILNAME_PLATZHALTER;
  const gesamt = ziel === 'einfach' ? 4 : 5;
  const erstes = ziel === 'einfach' ? null : ERSTES[ziel];

  useEffect(() => {
    const vorbelegt = zugang.data?.benutzername?.trim();
    if (!nameBeruehrt && name === '' && vorbelegt) {
      setName(vorbelegt);
    }
  }, [zugang.data, nameBeruehrt, name]);

  useLayoutEffect(() => {
    if (!fokusFehler) {
      return;
    }
    document.getElementById('einfuehrung-fokus')?.focus();
  }, [fokusFehler]);

  useLayoutEffect(() => {
    schreibeSchritt('sprache', true);
    const beiPop = () => {
      const gefunden = schrittAus(history.state);
      if (gefunden) {
        setSchritt(gefunden);
        setFehler(null);
      }
    };
    window.addEventListener('popstate', beiPop);
    return () => window.removeEventListener('popstate', beiPop);
  }, []);

  const vor = (nach: Schritt) => {
    setFehler(null);
    schreibeSchritt(nach, false);
    setSchritt(nach);
  };

  const waehleSprache = (code: Sprache) => {
    waehle(code);
    void spracheMerken(code, client).catch(() => undefined);
  };

  const spracheWeiter = () => {
    if (speichert) {
      return;
    }
    setSpeichert(true);
    setFehler(null);
    void spracheMerken(sprache, client)
      .then(() => vor('profilname'))
      .catch((grund: unknown) => setFehler(grund))
      .finally(() => setSpeichert(false));
  };

  const speichern = (mitZiel: boolean) => {
    if (speichert) {
      return;
    }
    setSpeichert(true);
    setFehler(null);
    onHalten();
    const charakterName = (name.trim() || vorbelegung).slice(0, PROFILNAME_MAX);
    const koerper: EinstellungenAenderung = {
      charakterName,
      zielstrebigkeit: ziel,
      fokus: [...fokus],
      profilAngelegt: true,
      sprache,
    };
    if (mitZiel && erstes) {
      koerper.startZiel = { art: erstes.art, name: zielName.trim() };
    }
    void api
      .aendereEinstellungen(koerper)
      .then(async (neu) => {
        client.setQueryData(SCHLUESSEL.einstellungen, neu);
        await client.invalidateQueries({ queryKey: SCHLUESSEL.vorlagen });
        await client.invalidateQueries({ queryKey: SCHLUESSEL.attribute });
        await client.invalidateQueries({ queryKey: SCHLUESSEL.ziele });
        await client.invalidateQueries({ queryKey: SCHLUESSEL.faehigkeiten });
        schreibeSchritt('abschluss', false);
        setSchritt('abschluss');
      })
      .catch((grund: unknown) => setFehler(grund))
      .finally(() => setSpeichert(false));
  };

  const ueberspringen = () => {
    if (speichert) {
      return;
    }
    if (schritt === 'profilname') {
      if (!name.trim()) {
        setName(vorbelegung);
      }
      vor('fokus');
      return;
    }
    if (schritt === 'fokus') {
      setFokus([]);
      vor('ziel');
      return;
    }
    if (schritt === 'ziel') {
      setZiel('macher');
      vor('erstesZiel');
      return;
    }
    if (schritt === 'erstesZiel') {
      speichern(false);
    }
  };

  const absenden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (speichert) {
      return;
    }
    if (schritt === 'sprache') {
      spracheWeiter();
      return;
    }
    if (schritt === 'profilname') {
      if (!name.trim()) {
        setNameFehler('Der Name darf nicht leer sein.');
        return;
      }
      setNameFehler(null);
      vor('fokus');
      return;
    }
    if (schritt === 'fokus') {
      if (fokus.length === 0) {
        setFokusFehler(true);
        return;
      }
      setFokusFehler(false);
      vor('ziel');
      return;
    }
    if (schritt === 'ziel') {
      if (ziel === 'einfach') {
        speichern(false);
        return;
      }
      vor('erstesZiel');
      return;
    }
    if (schritt === 'erstesZiel') {
      if (!zielName.trim()) {
        setZielFehler('Der Name darf nicht leer sein.');
        return;
      }
      setZielFehler(null);
      speichern(true);
      return;
    }
    if (!abschlussBereit) {
      return;
    }
    onLos();
    navigiere('/', { replace: true });
  };

  const listenAn = schritt === 'abschluss';
  const stand = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen, enabled: listenAn });
  const vorlagen = useQuery({ queryKey: SCHLUESSEL.vorlagen, queryFn: api.vorlagen, enabled: listenAn });
  const attribute = useQuery({ queryKey: SCHLUESSEL.attribute, queryFn: api.attribute, enabled: listenAn });
  const ziele = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele, enabled: listenAn });
  const faehigkeiten = useQuery({ queryKey: SCHLUESSEL.faehigkeiten, queryFn: api.faehigkeiten, enabled: listenAn });
  const abschlussFehler = stand.error ?? vorlagen.error ?? attribute.error ?? ziele.error ?? faehigkeiten.error;
  const abschlussBereit = Boolean(stand.data && vorlagen.data && attribute.data && ziele.data && faehigkeiten.data);

  const wiederholen = () => {
    void stand.refetch();
    void vorlagen.refetch();
    void attribute.refetch();
    void ziele.refetch();
    void faehigkeiten.refetch();
  };

  let titel = '';
  let untertitel = '';
  let inhalt: ReactNode = null;
  let knopf = 'Weiter';

  if (schritt === 'sprache') {
    titel = 'Sprache';
    knopf = fehler ? 'Erneut versuchen' : 'Weiter';
    inhalt = (
      <div data-schritt-inhalt="" role="radiogroup" aria-label={tx('Sprache')} className="space-y-2">
        {SPRACHEN.map((code) => {
          const aktiv = sprache === code;
          return (
            <button
              key={code}
              type="button"
              role="radio"
              lang={code}
              aria-checked={aktiv}
              onClick={() => waehleSprache(code)}
              className={`sprach-wahl min-h-14 w-full rounded-2xl border px-4 text-left text-sm font-medium break-words transition ${aktiv ? 'border-akzent bg-akzent/10' : 'border-rand bg-flaeche hover:border-leise/50'}`}
            >
              {SPRACH_NAME[code]}
            </button>
          );
        })}
      </div>
    );
  } else if (schritt === 'profilname') {
    titel = 'Wie heißt du in Stride?';
    untertitel = 'Halte fest, was du tust. Daraus werden Level und Streak.';
    inhalt = (
      <div data-schritt-inhalt="">
      <Feld label="Profilname" fehler={nameFehler}>
        <input
          name="nickname"
          autoComplete="nickname"
          maxLength={PROFILNAME_MAX}
          value={name}
          onChange={(ereignis) => {
            setNameBeruehrt(true);
            setName(ereignis.target.value);
            setNameFehler(null);
          }}
          className={EINGABE_STIL}
        />
      </Feld>
      </div>
    );
  } else if (schritt === 'fokus') {
    titel = 'Worin willst du wachsen?';
    untertitel = 'Wähle eins oder mehrere.';
    inhalt = (
      <div className="space-y-3">
        <FokusVorschau fokus={fokus} />
        <div data-schritt-inhalt="">
          <div id="einfuehrung-fokus" tabIndex={-1}>
            <FokusWahl
              wert={fokus}
              onAendern={(wert) => {
                setFokusFehler(false);
                setFokus(wert);
              }}
              ungueltig={fokusFehler}
              fehlerId={fokusFehler ? 'einfuehrung-fokus-fehler' : undefined}
            />
          </div>
          {fokusFehler ? (
            <p id="einfuehrung-fokus-fehler" className="feld-fehler text-[13px] leading-[18px] break-words text-gefahr" role="alert">
              <span aria-hidden="true">⚠ </span>
              {tx(FOKUS_PFLICHT)}
            </p>
          ) : null}
        </div>
      </div>
    );
  } else if (schritt === 'ziel') {
    titel = 'Was willst du erreichen?';
    knopf = fehler ? 'Erneut versuchen' : 'Weiter';
    inhalt = (
      <div data-schritt-inhalt="">
        <ZielWahl wert={ziel} onAendern={setZiel} />
      </div>
    );
  } else if (schritt === 'erstesZiel' && erstes) {
    titel = erstes.titel;
    knopf = fehler ? 'Erneut versuchen' : 'Jetzt anlegen';
    inhalt = (
      <div data-schritt-inhalt="">
        <Feld label={erstes.label} fehler={zielFehler}>
          <input
            name="zielname"
            maxLength={80}
            value={zielName}
            placeholder={tx(erstes.platz)}
            onChange={(ereignis) => {
              setZielName(ereignis.target.value);
              setZielFehler(null);
            }}
            className={EINGABE_STIL}
          />
        </Feld>
      </div>
    );
  } else if (schritt === 'abschluss') {
    titel = 'Eingerichtet';
    knopf = abschlussFehler ? 'Erneut versuchen' : 'Fertig';
    const daten = stand.data;
    const aktiveVorlagen = (vorlagen.data ?? []).filter((eintrag) => !eintrag.archiviert);
    const aktiveAttribute = (attribute.data ?? []).filter((eintrag) => !eintrag.archiviert);
    const koennen = aktiveAttribute.filter((eintrag) => eintrag.typ === 'attribut');
    const haben = aktiveAttribute.filter((eintrag) => eintrag.typ === 'status');
    const stufe = daten?.zielstrebigkeit;
    const bereiche = stufe ? tx(ZIELSTREBIGKEIT_INFO[stufe].text) : '—';
    const spracheName = daten?.sprache ? SPRACH_NAME[daten.sprache] : '—';
    const vision = ziele.data?.visionen.find((eintrag) => !eintrag.archiviert);
    const projekt = ziele.data?.projekte.find((eintrag) => !eintrag.archiviert);
    const faehigkeit = faehigkeiten.data?.find((eintrag) => !eintrag.archiviert);
    const angelegt = vision
      ? { art: tx('Vision'), name: vision.titel }
      : projekt
        ? { art: tx('Projekt'), name: projekt.name }
        : faehigkeit
          ? { art: tx('Fähigkeit'), name: faehigkeit.name }
          : null;
    inhalt = abschlussFehler ? null : !abschlussBereit || !daten ? (
      <Ladeanzeige />
    ) : (
      <div className="space-y-3">
        <p className="text-[13px] text-leise break-words">{tx('Alles änderst du unter Mehr.')}</p>
        <div data-schritt-inhalt="">
          <AbschlussZeile titel={tx('Profilname')} wert={daten.charakterName} />
          <AbschlussZeile titel={tx('Sprache')} wert={spracheName} />
          <AbschlussZeile titel={tx('Tätigkeiten')} wert={aktiveVorlagen.length > 0 ? aktiveVorlagen.map((eintrag) => eintrag.name).join(', ') : '—'} />
          {daten.funktionen.koennen && koennen.length > 0 ? (
            <AbschlussZeile titel={tx('Können')} wert={koennen.map((eintrag) => eintrag.name).join(', ')} />
          ) : null}
          {daten.funktionen.status && haben.length > 0 ? (
            <AbschlussZeile titel={tx('Haben')} wert={haben.map((eintrag) => eintrag.name).join(', ')} />
          ) : null}
          <AbschlussZeile titel={tx('Bereiche')} wert={bereiche} />
          {angelegt ? <AbschlussZeile titel={angelegt.art} wert={angelegt.name} /> : null}
        </div>
      </div>
    );
  }

  const zeigenKopf = schritt !== 'abschluss';
  const pfeil = schritt !== 'sprache' && schritt !== 'abschluss';
  const darfSpringen = schritt !== 'sprache' && schritt !== 'abschluss';

  return (
    <main className="mx-auto flex h-dvh w-full max-w-[480px] flex-col px-4">
      {zeigenKopf ? (
        <header className="grid h-14 shrink-0 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-2">
          {pfeil ? (
            <button
              type="button"
              aria-label={tx('Zurück')}
              onClick={() => history.back()}
              className="inline-flex size-11 items-center justify-center rounded-xl text-haupt"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
          ) : (
            <span />
          )}
          <Fortschritt schritt={nummerVon(schritt)} gesamt={gesamt} />
          {darfSpringen ? (
            <button type="button" onClick={ueberspringen} className="px-1 text-sm text-leise">
              {tx('Überspringen')}
            </button>
          ) : (
            <span />
          )}
        </header>
      ) : (
        <div className="h-6 shrink-0" />
      )}
      <Formular
        onAbsenden={schritt === 'abschluss' && abschlussFehler ? (ereignis) => { ereignis.preventDefault(); wiederholen(); } : absenden}
        className="flex min-h-0 flex-1 flex-col md:flex-none max-md:[&_.formular-felder]:flex max-md:[&_.formular-felder]:min-h-0 max-md:[&_.formular-felder]:flex-1 max-md:[&_.formular-felder]:flex-col max-md:[&_.formular-felder]:overflow-y-auto"
      >
        {schritt === 'sprache' ? (
          <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <img src="/logo-v2.svg" alt="" className="size-7" />
            Stride
          </div>
        ) : null}
        <h1 className="text-2xl leading-8 font-semibold break-words">{tx(titel)}</h1>
        {untertitel ? <p className="text-[13px] leading-5 text-leise break-words">{tx(untertitel)}</p> : null}
        {inhalt}
        <Fehlermeldung fehler={schritt === 'abschluss' ? abschlussFehler : fehler} />
        <Knopf
          type="submit"
          variante="primaer"
          className="w-full"
          aria-busy={speichert || (schritt === 'abschluss' && !abschlussBereit && !abschlussFehler) || undefined}
        >
          {tx(knopf)}
        </Knopf>
      </Formular>
    </main>
  );
}
