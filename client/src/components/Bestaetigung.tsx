import { createContext, useCallback, useContext, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { tx } from '../text.ts';
import { Dialog } from './Dialog.tsx';
import { EINGABE_STIL, Formular, Knopf } from '../ui/index.ts';

export interface BestaetigungsAnfrage {
  titel: string;
  text: string;
  knopf: string;
  gefahr?: boolean;
  eingabe?: { hinweis: string; wert: string };
}

type Bestaetigen = (anfrage: BestaetigungsAnfrage) => Promise<boolean>;

export interface EingabeAnfrage {
  titel: string;
  wert: string;
  maxLaenge: number;
  label: string;
}

type Eingeben = (anfrage: EingabeAnfrage) => Promise<string | null>;

interface OffeneAnfrage extends BestaetigungsAnfrage {
  antworten: (bestaetigt: boolean) => void;
}

interface OffeneEingabe extends EingabeAnfrage {
  antworten: (wert: string | null) => void;
}

const BestaetigungKontext = createContext<Bestaetigen | null>(null);
const EingabeKontext = createContext<Eingeben | null>(null);

export function useBestaetigung(): Bestaetigen {
  const bestaetigen = useContext(BestaetigungKontext);
  if (!bestaetigen) {
    throw new Error('useBestaetigung muss innerhalb von <BestaetigungProvider> verwendet werden.');
  }
  return bestaetigen;
}

export function useEingabe(): Eingeben {
  const eingeben = useContext(EingabeKontext);
  if (!eingeben) {
    throw new Error('useEingabe muss innerhalb von <BestaetigungProvider> verwendet werden.');
  }
  return eingeben;
}

export function BestaetigungProvider({ children }: { children: ReactNode }) {
  const [anfrage, setAnfrage] = useState<OffeneAnfrage | null>(null);
  const [offen, setOffen] = useState(false);
  const [eingabe, setEingabe] = useState('');
  const aktuell = useRef<OffeneAnfrage | null>(null);
  const [freiAnfrage, setFreiAnfrage] = useState<OffeneEingabe | null>(null);
  const [freiOffen, setFreiOffen] = useState(false);
  const [freiText, setFreiText] = useState('');
  const freiAktuell = useRef<OffeneEingabe | null>(null);

  const brichEingabeAb = useCallback(() => {
    freiAktuell.current?.antworten(null);
    freiAktuell.current = null;
    setFreiOffen(false);
  }, []);

  const bestaetigen = useCallback<Bestaetigen>(
    (neu) =>
      new Promise<boolean>((aufloesen) => {
        aktuell.current?.antworten(false);
        brichEingabeAb();
        const naechste = { ...neu, antworten: aufloesen };
        aktuell.current = naechste;
        setEingabe('');
        setAnfrage(naechste);
        setOffen(true);
      }),
    [brichEingabeAb],
  );

  const eingeben = useCallback<Eingeben>(
    (neu) =>
      new Promise<string | null>((aufloesen) => {
        aktuell.current?.antworten(false);
        aktuell.current = null;
        setOffen(false);
        freiAktuell.current?.antworten(null);
        const naechste = { ...neu, antworten: aufloesen };
        freiAktuell.current = naechste;
        setFreiText(neu.wert);
        setFreiAnfrage(naechste);
        setFreiOffen(true);
      }),
    [],
  );

  const antworten = useCallback((bestaetigt: boolean) => {
    aktuell.current?.antworten(bestaetigt);
    aktuell.current = null;
    setOffen(false);
  }, []);
  const abbrechen = useCallback(() => antworten(false), [antworten]);
  const freiAbbrechen = useCallback(() => {
    freiAktuell.current?.antworten(null);
    freiAktuell.current = null;
    setFreiOffen(false);
  }, []);
  const freiSenden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    const wert = freiText.trim();
    if (!wert) {
      return;
    }
    freiAktuell.current?.antworten(wert);
    freiAktuell.current = null;
    setFreiOffen(false);
  };
  const erwartet = anfrage?.eingabe?.wert;
  const eingabeOk = erwartet === undefined || eingabe.trim() === erwartet;
  const senden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (eingabeOk) {
      antworten(true);
    }
  };

  return (
    <BestaetigungKontext.Provider value={bestaetigen}>
      <EingabeKontext.Provider value={eingeben}>
      {children}
      <Dialog offen={offen} titel={anfrage ? tx(anfrage.titel) : ''} onSchliessen={abbrechen}>
        <Formular onAbsenden={senden} abstand="space-y-5">
          <p className="text-sm leading-relaxed text-leise">{anfrage ? tx(anfrage.text) : ''}</p>
          {anfrage?.eingabe && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">{tx(anfrage.eingabe.hinweis)}</span>
              <input
                className={EINGABE_STIL}
                value={eingabe}
                autoFocus
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(ereignis) => setEingabe(ereignis.target.value)}
              />
            </label>
          )}
          <div className="flex gap-2">
            <Knopf className="flex-1" onClick={abbrechen}>
              {tx('Abbrechen')}
            </Knopf>
            <Knopf
              className="flex-1"
              type="submit"
              variante={anfrage?.gefahr ? 'gefahr' : 'primaer'}
              disabled={!eingabeOk}
              autoFocus={anfrage?.eingabe === undefined}
            >
              {anfrage ? tx(anfrage.knopf) : ''}
            </Knopf>
          </div>
        </Formular>
      </Dialog>
      <Dialog offen={freiOffen} titel={freiAnfrage ? tx(freiAnfrage.titel) : ''} onSchliessen={freiAbbrechen}>
        <Formular onAbsenden={freiSenden} abstand="space-y-5">
          <input
            className={EINGABE_STIL}
            aria-label={freiAnfrage ? tx(freiAnfrage.label) : tx('Eingabe')}
            value={freiText}
            maxLength={freiAnfrage?.maxLaenge}
            autoFocus
            autoComplete="off"
            onFocus={(ereignis) => ereignis.currentTarget.select()}
            onChange={(ereignis) => setFreiText(ereignis.target.value)}
          />
          <div className="flex gap-2">
            <Knopf className="flex-1" onClick={freiAbbrechen}>
              {tx('Abbrechen')}
            </Knopf>
            <Knopf className="flex-1" type="submit" variante="primaer" disabled={!freiText.trim()}>
              {tx('Speichern')}
            </Knopf>
          </div>
        </Formular>
      </Dialog>
      </EingabeKontext.Provider>
    </BestaetigungKontext.Provider>
  );
}
