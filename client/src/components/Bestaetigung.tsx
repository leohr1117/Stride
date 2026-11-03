import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { tx } from '../text.ts';
import { Dialog } from './Dialog.tsx';
import { EINGABE_STIL, Feld, Knopf } from '../ui/index.ts';

export interface BestaetigungsAnfrage {
  titel: string;
  text: string;
  knopf: string;
  gefahr?: boolean;
  eingabe?: { hinweis: string; wert: string };
}

type Bestaetigen = (anfrage: BestaetigungsAnfrage) => Promise<boolean>;

interface OffeneAnfrage extends BestaetigungsAnfrage {
  antworten: (bestaetigt: boolean) => void;
}

const BestaetigungKontext = createContext<Bestaetigen | null>(null);

export function useBestaetigung(): Bestaetigen {
  const bestaetigen = useContext(BestaetigungKontext);
  if (!bestaetigen) {
    throw new Error('useBestaetigung muss innerhalb von <BestaetigungProvider> verwendet werden.');
  }
  return bestaetigen;
}

export function BestaetigungProvider({ children }: { children: ReactNode }) {
  const [anfrage, setAnfrage] = useState<OffeneAnfrage | null>(null);
  const [offen, setOffen] = useState(false);
  const [eingabe, setEingabe] = useState('');
  const aktuell = useRef<OffeneAnfrage | null>(null);

  const bestaetigen = useCallback<Bestaetigen>(
    (neu) =>
      new Promise<boolean>((aufloesen) => {
        aktuell.current?.antworten(false);
        const naechste = { ...neu, antworten: aufloesen };
        aktuell.current = naechste;
        setEingabe('');
        setAnfrage(naechste);
        setOffen(true);
      }),
    [],
  );

  const antworten = useCallback((bestaetigt: boolean) => {
    aktuell.current?.antworten(bestaetigt);
    aktuell.current = null;
    setOffen(false);
  }, []);
  const abbrechen = useCallback(() => antworten(false), [antworten]);
  const erwartet = anfrage?.eingabe?.wert;
  const eingabeOk = erwartet === undefined || eingabe.trim() === erwartet;
  const zerstoerend = Boolean(anfrage && (anfrage.gefahr || anfrage.eingabe));

  return (
    <BestaetigungKontext.Provider value={bestaetigen}>
      {children}
      <Dialog offen={offen} titel={anfrage ? tx(anfrage.titel) : ''} art="warnung" onSchliessen={abbrechen}>
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-leise">{anfrage ? tx(anfrage.text) : ''}</p>
          {anfrage?.eingabe ? (
            <Feld label={anfrage.eingabe.hinweis}>
              <input
                className={EINGABE_STIL}
                value={eingabe}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(ereignis) => setEingabe(ereignis.target.value)}
                onKeyDown={(ereignis) => {
                  if (ereignis.key === 'Enter') {
                    ereignis.preventDefault();
                  }
                }}
              />
            </Feld>
          ) : null}
          <div className="dialog-aktionen">
            <Knopf autoFocus={zerstoerend} onClick={abbrechen}>
              {tx('Abbrechen')}
            </Knopf>
            {zerstoerend ? (
              <Knopf
                variante="warnung"
                disabled={!eingabeOk}
                onClick={() => {
                  if (eingabeOk) {
                    antworten(true);
                  }
                }}
              >
                {anfrage ? tx(anfrage.knopf) : ''}
              </Knopf>
            ) : (
              <Knopf
                variante="primaer"
                autoFocus={anfrage !== null}
                onClick={() => antworten(true)}
              >
                {anfrage ? tx(anfrage.knopf) : ''}
              </Knopf>
            )}
          </div>
        </div>
      </Dialog>
    </BestaetigungKontext.Provider>
  );
}
