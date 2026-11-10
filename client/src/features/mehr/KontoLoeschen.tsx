import { Download } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { Rolle } from '../../../../shared/api/zugang.ts';
import { EXPORT_ADRESSE, api, meldeAnmeldungAbgelaufen } from '../../api/index.ts';
import { Liste, Zeile } from '../../components/Zeile.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { merkeSitzung } from '../../speicher.ts';
import { feldLeer, tx } from '../../text.ts';
import { Fehlermeldung, Knopf, PasswortFeld } from '../../ui/index.ts';

export const KONTO_GELOESCHT_SCHLUESSEL = 'stride.kontoGeloescht';

export function KontoLoeschen({
  benutzername,
  admin,
  inhaber,
  konten,
}: {
  benutzername: string | null;
  admin: boolean;
  inhaber: boolean;
  konten: readonly { rolle: Rolle }[] | undefined;
}) {
  const [offen, setOffen] = useState(false);
  const [passwort, setPasswort] = useState('');
  const [feldFehler, setFeldFehler] = useState<string | null>(null);
  const [fehler, setFehler] = useState<unknown>(null);
  const [laeuft, setLaeuft] = useState(false);
  const listeFehlt = inhaber && konten === undefined;
  const inhaberZahl = konten?.filter((konto) => konto.rolle === 'inhaber').length ?? 0;
  const einziges = konten?.length === 1;
  const letzterInhaber = inhaber && (konten?.length ?? 0) > 1 && inhaberZahl < 2;
  const gesperrt = listeFehlt || letzterInhaber;

  const oeffnen = () => {
    setPasswort('');
    setFeldFehler(null);
    setFehler(null);
    setOffen(true);
  };

  const senden = async (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (laeuft) {
      return;
    }
    if (passwort === '') {
      setFeldFehler(feldLeer('Passwort'));
      setFehler(null);
      return;
    }
    setFeldFehler(null);
    setFehler(null);
    setLaeuft(true);
    try {
      await api.loescheEigenesKonto(passwort);
      merkeSitzung(KONTO_GELOESCHT_SCHLUESSEL, true);
      meldeAnmeldungAbgelaufen();
    } catch (loeschFehler) {
      setFehler(loeschFehler);
      setLaeuft(false);
    }
  };

  return (
    <section className="mt-6">
      <Liste>
        <Zeile
          titel={tx('Konto löschen')}
          gefahr
          pfeil={false}
          deaktiviert={gesperrt}
          onKlick={gesperrt ? undefined : oeffnen}
        />
      </Liste>
      {letzterInhaber ? (
        <p className="mt-2 px-4 text-[13px] leading-[18px] break-words text-leise">
          {tx('Du bist der einzige Inhaber. Solange es andere Accounts gibt, kannst du dein Konto nicht löschen.')}
        </p>
      ) : null}
      <Dialog offen={offen} titel={tx('Konto löschen?')} art="warnung" onSchliessen={() => setOffen(false)}>
        <div className="space-y-5">
          <p className="text-sm leading-relaxed break-words text-leise">
            {tx('Alle Daten dieses Kontos werden endgültig gelöscht. Das lässt sich nicht rückgängig machen.')}
          </p>
          {einziges ? (
            <>
              <Liste>
                <Zeile
                  titel={tx('Exportieren')}
                  href={EXPORT_ADRESSE}
                  download
                  pfeil={false}
                  symbol={<Download aria-hidden="true" />}
                />
              </Liste>
              <p className="text-sm leading-relaxed break-words text-leise">
                {tx(
                  'Du bist das einzige Konto. Danach hat diese Stride-Instanz kein Konto mehr; wer sie als Nächstes öffnet, legt ein neues Inhaber-Konto an.',
                )}
              </p>
            </>
          ) : null}
          {admin ? (
            <p className="text-sm leading-relaxed break-words text-leise">
              {tx('Danach hat diese Stride-Instanz keinen Admin, bis der Betreiber einen neuen festlegt.')}
            </p>
          ) : null}
          <form
            onSubmit={(ereignis) => {
              void senden(ereignis);
            }}
          >
            <div className="space-y-5">
              <p className="text-sm leading-relaxed break-words text-leise">{tx('Gib zur Bestätigung dein Passwort ein.')}</p>
              <PasswortFeld
                id="konto-loeschen-passwort"
                label="Passwort"
                name="password"
                autoComplete="current-password"
                benutzername={benutzername ?? ''}
                value={passwort}
                fehler={feldFehler}
                onChange={(ereignis) => {
                  setPasswort(ereignis.target.value);
                  setFeldFehler(null);
                }}
              />
              <Fehlermeldung fehler={fehler} />
              <div className="dialog-aktionen">
                <Knopf autoFocus onClick={() => setOffen(false)}>
                  {tx('Abbrechen')}
                </Knopf>
                <Knopf type="submit" variante="warnung" aria-busy={laeuft || undefined}>
                  {tx('Endgültig löschen')}
                </Knopf>
              </div>
            </div>
          </form>
        </div>
      </Dialog>
    </section>
  );
}
