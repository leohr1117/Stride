import type { Faehigkeit, Vorlage } from '../../../../shared/api/index.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { AuswahlBlatt } from '../../components/AuswahlBlatt.tsx';
import { projekteFuerVision, parseZiel, type ZielBlick } from '../../todoistZiel.ts';
import { tx } from '../../text.ts';
import { EINGABE_STIL, Fehlermeldung, Feld, InfoHinweis, Knopf, Schalter } from '../../ui/index.ts';
import { DauerWahl, FaehigkeitWahl, TextFeld, WeitereFelder, ZielWahl } from './felder.tsx';
import { HINWEIS_MEILENSTEIN, useMitziehText, visionHinweis } from './gemeinsam.ts';
import {
  gruppenProjekt,
  mitVorlage,
  visionProjektSetzen,
  vorlageIdAusWahl,
  vorlageName,
  weiteresGesetzt,
  zaehlOptionen,
  zielSetzen,
  type ZuordnungsStand,
} from './zuordnung.ts';

export function ZuordnungBlatt({
  offen,
  titel,
  art,
  stand,
  erste,
  blick,
  taetigkeiten,
  faehigkeiten,
  faehigkeitenAn,
  zieleAn,
  pending,
  fehler,
  onSpeichern,
  onSchliessen,
}: {
  offen: boolean;
  titel: string;
  art: 'standard' | 'projekt' | 'label';
  stand: ZuordnungsStand;
  erste: string;
  blick: ZielBlick;
  taetigkeiten: readonly Vorlage[];
  faehigkeiten: readonly Faehigkeit[];
  faehigkeitenAn: boolean;
  zieleAn: boolean;
  pending: boolean;
  fehler: unknown;
  onSpeichern: (stand: ZuordnungsStand) => void;
  onSchliessen: () => void;
}) {
  const notiz = useMitziehText(stand.notiz);
  const erkenntnis = useMitziehText(stand.erkenntnis);
  const gruppe = art === 'standard' ? null : gruppenProjekt(stand, blick);
  const optionen = zaehlOptionen(erste, taetigkeiten, gruppe?.id ?? null, gruppe?.name ?? null, stand.vorlageId);
  const vorhaben = stand.zielArt === 'vorhaben' && stand.zielId !== null;
  const visionListe = stand.zielArt === 'vision' && stand.zielId !== null ? projekteFuerVision(blick, stand.zielId) : [];
  const hinweis = visionHinweis(stand.zielArt, stand.zielId, stand.projektId, blick);
  const anzeige = stand.vorlageId === null ? erste : (vorlageName(taetigkeiten, stand.vorlageId) ?? erste);

  const setze = (naechster: ZuordnungsStand) => {
    if (!pending) {
      onSpeichern(naechster);
    }
  };

  const fertig = () => {
    if (notiz.text !== stand.notiz || erkenntnis.text !== stand.erkenntnis) {
      onSpeichern({ ...stand, notiz: notiz.text, erkenntnis: erkenntnis.text });
    }
    onSchliessen();
  };

  return (
    <Dialog offen={offen} titel={titel} onSchliessen={onSchliessen}>
      <div className="blatt-sofort">
        <div className="blatt-sofort-felder space-y-4">
          <Feld label="Zählt als">
            <AuswahlBlatt
              modus="einzeln"
              label={tx('Zählt als')}
              wert={stand.vorlageId === null ? '' : String(stand.vorlageId)}
              anzeige={anzeige}
              optionen={optionen}
              disabled={pending}
              onAendern={(wert) => {
                if (wert.startsWith('gruppe-')) {
                  return;
                }
                setze(mitVorlage(stand, vorlageIdAusWahl(wert)));
              }}
            />
          </Feld>
          {art !== 'standard' && zieleAn ? (
            <>
              <ZielWahl
                blick={blick}
                art={stand.zielArt}
                id={stand.zielId}
                disabled={pending}
                onAendern={(wert) => setze(zielSetzen(stand, parseZiel(wert), taetigkeiten, blick))}
              />
              {visionListe.length > 1 ? (
                <Feld label="Projekt">
                  <select
                    className={EINGABE_STIL}
                    aria-label={tx('Projekt')}
                    disabled={pending}
                    value={stand.projektId ?? ''}
                    onChange={(ereignis) => {
                      const roh = ereignis.target.value;
                      setze(visionProjektSetzen(stand, roh === '' ? null : Number(roh), taetigkeiten));
                    }}
                  >
                    <option value="">{tx('Projekt')}</option>
                    {visionListe.map((projekt) => (
                      <option key={projekt.id} value={projekt.id}>
                        {projekt.name}
                      </option>
                    ))}
                  </select>
                </Feld>
              ) : null}
              {hinweis ? <p className="text-sm text-gefahr">{hinweis}</p> : null}
            </>
          ) : null}
          {art !== 'standard' ? (
            <WeitereFelder anfangOffen={weiteresGesetzt(stand)}>
              <DauerWahl wert={stand.stunden} disabled={pending} onAendern={(stunden) => setze({ ...stand, stunden })} />
              {faehigkeitenAn ? (
                <FaehigkeitWahl
                  faehigkeiten={faehigkeiten}
                  wert={stand.faehigkeitId}
                  disabled={pending}
                  onAendern={(faehigkeitId) => setze({ ...stand, faehigkeitId })}
                />
              ) : null}
              {vorhaben ? (
                <Feld label="Stand">
                  <select
                    className={EINGABE_STIL}
                    aria-label={tx('Stand')}
                    disabled={pending}
                    value={stand.abschluss ?? ''}
                    onChange={(ereignis) => {
                      const roh = ereignis.target.value;
                      const abschluss = roh === 'geschafft' || roh === 'gescheitert' ? roh : null;
                      setze({ ...stand, abschluss });
                    }}
                  >
                    <option value="">{tx('Dran geblieben')}</option>
                    <option value="geschafft">{tx('Geschafft')}</option>
                    <option value="gescheitert">{tx('Gescheitert')}</option>
                  </select>
                </Feld>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center text-sm font-medium">
                    {tx('Meilenstein')}
                    <InfoHinweis text={HINWEIS_MEILENSTEIN} />
                  </span>
                  <Schalter
                    kompakt
                    label="Meilenstein"
                    an={stand.meilenstein}
                    deaktiviert={pending}
                    onAendern={(meilenstein) => setze({ ...stand, meilenstein })}
                  />
                </div>
              )}
              {stand.abschluss === 'gescheitert' ? (
                <TextFeld
                  label="Was nimmst du mit?"
                  wert={erkenntnis.text}
                  onAendern={erkenntnis.setText}
                  onFocus={erkenntnis.onFocus}
                  onBlur={() => erkenntnis.onBlur((text) => setze({ ...stand, erkenntnis: text }))}
                />
              ) : null}
              <TextFeld
                label="Notiz"
                wert={notiz.text}
                onAendern={notiz.setText}
                onFocus={notiz.onFocus}
                onBlur={() => notiz.onBlur((text) => setze({ ...stand, notiz: text }))}
              />
            </WeitereFelder>
          ) : null}
        </div>
        <div className="blatt-sofort-fuss space-y-3">
          <Fehlermeldung fehler={fehler} />
          <Knopf className="w-full" onClick={fertig}>
            {tx('Fertig')}
          </Knopf>
        </div>
      </div>
    </Dialog>
  );
}
