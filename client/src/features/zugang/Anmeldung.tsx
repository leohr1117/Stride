import { feldLeer, tx } from '../../text.ts';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { ZugangModus, ZugangStatus } from '../../../../shared/api/index.ts';
import { PASSWORT_MAX } from '../../../../shared/spiel/passwort.ts';
import { ApiFehler, api, beobachteAnmeldung } from '../../api/index.ts';
import { SpracheAbgleich } from '../../sprache.tsx';
import { Fehlermeldung, Feld, Knopf, Ladeanzeige, EINGABE_STIL, PasswortFeld } from '../../ui/index.ts';
import { AnmeldeRahmen } from './AnmeldeRahmen.tsx';
import { seitenwechsel } from './anmeldungFelder.ts';
import { BenutzernameFestlegen } from './BenutzernameFestlegen.tsx';
import { GoogleAnlage, GoogleKnopf, GoogleOder, googleHinweis, useGoogleRueckkehr } from './GoogleAnmeldung.tsx';

function Anmeldung({
  modus,
  onErfolg,
  onKonto,
  google = false,
  hinweis = null,
  onHinweisWeg,
}: {
  modus: Exclude<ZugangModus, 'bereit' | 'benutzername'>;
  onErfolg: (status: ZugangStatus) => void;
  onKonto?: () => void;
  google?: boolean;
  hinweis?: string | null;
  onHinweisWeg?: () => void;
}) {
  const [benutzername, setBenutzername] = useState('');
  const [passwort, setPasswort] = useState('');
  const [wiederholung, setWiederholung] = useState('');
  const [fehler, setFehler] = useState<unknown>(null);
  const [abweichung, setAbweichung] = useState<string | null>(null);
  const [nameFehler, setNameFehler] = useState<string | null>(null);
  const [passwortFehler, setPasswortFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const neu = modus === 'einrichten';
  const mitName = modus !== 'passwort';

  const senden = async (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (laeuft) {
      return;
    }
    const nameLeer = mitName && benutzername.trim() === '';
    const passwortLeer = passwort === '';
    if (nameLeer || passwortLeer) {
      setNameFehler(nameLeer ? 'Der Benutzername fehlt.' : null);
      setPasswortFehler(passwortLeer ? feldLeer('Passwort') : null);
      setAbweichung(null);
      setFehler(null);
      return;
    }
    setNameFehler(null);
    setPasswortFehler(null);
    if (neu && passwort !== wiederholung) {
      setAbweichung('Die Passwörter stimmen nicht überein.');
      setFehler(null);
      return;
    }
    setAbweichung(null);
    setLaeuft(true);
    setFehler(null);
    try {
      const status = await api.anmelden({ benutzername: mitName ? benutzername.trim() : undefined, passwort });
      onErfolg(status);
      seitenwechsel(window);
    } catch (anmeldeFehler) {
      setPasswort('');
      setWiederholung('');
      setFehler(anmeldeFehler);
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <AnmeldeRahmen onAbsenden={(ereignis) => void senden(ereignis)} titel={neu ? 'Passwort festlegen' : 'Anmelden'}>
        {hinweis ? (
          <p role="status" className="text-leise">
            {tx(hinweis)}
          </p>
        ) : null}
        {mitName && (
          <Feld label={tx("Benutzername")} fehler={nameFehler}>
            <input
              id="username"
              className={EINGABE_STIL}
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              value={benutzername}
              onChange={(ereignis) => {
                setBenutzername(ereignis.target.value);
                setNameFehler(null);
                onHinweisWeg?.();
              }}
            />
          </Feld>
        )}
        <PasswortFeld
          id={neu ? 'new-password' : 'current-password'}
          label={tx("Passwort")}
          name="password"
          autoComplete={neu ? 'new-password' : 'current-password'}
          maxLength={PASSWORT_MAX}
          autoFocus={!mitName}
          fehler={passwortFehler}
          value={passwort}
          onChange={(ereignis) => {
            setPasswort(ereignis.target.value);
            setPasswortFehler(null);
            onHinweisWeg?.();
          }}
        />
        {neu && (
          <PasswortFeld
            id="new-password-repeat"
            label={tx("Passwort wiederholen")}
            fehler={abweichung}
            name="password-repeat"
            autoComplete="new-password"
            maxLength={PASSWORT_MAX}
            value={wiederholung}
            onChange={(ereignis) => {
              setWiederholung(ereignis.target.value);
              setAbweichung(null);
            }}
          />
        )}
        <Fehlermeldung fehler={fehler} />
        <Knopf type="submit" variante="primaer" className="w-full" aria-busy={laeuft || undefined}>
          {neu ? tx("Festlegen") : tx("Anmelden")}
        </Knopf>
        {onKonto ? (
          <Knopf type="button" variante="text" className="w-full" onClick={onKonto}>
            {tx('Konto erstellen')}
          </Knopf>
        ) : null}
        {google && modus === 'anmelden' ? <GoogleOder /> : null}
        {google && modus === 'anmelden' ? <GoogleKnopf /> : null}
    </AnmeldeRahmen>
  );
}

function fehlerZuordnung(fehler: unknown): { name: string | null; passwort: string | null; allgemein: unknown } {
  const text = fehler instanceof ApiFehler ? fehler.message : '';
  if (text.startsWith('Der Benutzername')) {
    return { name: text, passwort: null, allgemein: null };
  }
  if (text.startsWith('Das Passwort')) {
    return { name: null, passwort: text, allgemein: null };
  }
  return { name: null, passwort: null, allgemein: fehler };
}

function KontoErstellen({
  onErfolg,
  onZurueck,
  googleEmail = null,
  onAbgelaufen,
}: {
  onErfolg: (status: ZugangStatus) => void;
  onZurueck: () => void;
  googleEmail?: string | null;
  onAbgelaufen?: () => void;
}) {
  const [benutzername, setBenutzername] = useState('');
  const [passwort, setPasswort] = useState('');
  const [fehler, setFehler] = useState<unknown>(null);
  const [nameFehler, setNameFehler] = useState<string | null>(null);
  const [passwortFehler, setPasswortFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const senden = async (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (laeuft) {
      return;
    }
    const nameLeer = benutzername.trim() === '';
    const passwortLeer = passwort === '';
    if (nameLeer || passwortLeer) {
      setNameFehler(nameLeer ? 'Der Benutzername fehlt.' : null);
      setPasswortFehler(passwortLeer ? feldLeer('Passwort') : null);
      setFehler(null);
      setPasswort('');
      return;
    }
    setNameFehler(null);
    setPasswortFehler(null);
    setLaeuft(true);
    setFehler(null);
    try {
      if (googleEmail) {
        const aktuell = await api.zugang();
        if (!aktuell.googleAnlage) {
          onAbgelaufen?.();
          return;
        }
      }
      const status = await api.registrieren({ benutzername: benutzername.trim(), passwort });
      onErfolg(status);
      seitenwechsel(window);
    } catch (anlageFehler) {
      const zuordnung = fehlerZuordnung(anlageFehler);
      setNameFehler(zuordnung.name);
      setPasswortFehler(zuordnung.passwort);
      setFehler(zuordnung.allgemein);
      setPasswort('');
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <AnmeldeRahmen onAbsenden={(ereignis) => void senden(ereignis)} titel="Konto erstellen">
      {googleEmail ? <GoogleAnlage email={googleEmail} /> : null}
      <Feld label={tx('Benutzername')} fehler={nameFehler}>
        <input
          id="username"
          className={EINGABE_STIL}
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          value={benutzername}
          onChange={(ereignis) => {
            setBenutzername(ereignis.target.value);
            setNameFehler(null);
          }}
        />
      </Feld>
      <PasswortFeld
        id="new-password"
        label={tx('Passwort')}
        name="password"
        autoComplete="new-password"
        maxLength={PASSWORT_MAX}
        hinweis="Mindestens 10 Zeichen."
        fehler={passwortFehler}
        value={passwort}
        onChange={(ereignis) => {
          setPasswort(ereignis.target.value);
          setPasswortFehler(null);
        }}
      />
      <Fehlermeldung fehler={fehler} />
      <Knopf type="submit" variante="primaer" className="w-full" aria-busy={laeuft || undefined}>
        {tx('Konto erstellen')}
      </Knopf>
      <Knopf type="button" variante="text" className="w-full" onClick={onZurueck}>
        {tx('Ich habe schon ein Konto')}
      </Knopf>
    </AnmeldeRahmen>
  );
}

export function ZugangTor({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ZugangStatus | null>(null);
  const [fehler, setFehler] = useState<unknown>(null);
  const [kontoOffen, setKontoOffen] = useState(false);
  const rueckkehr = useGoogleRueckkehr(status !== null && status.modus !== 'bereit');

  const lade = useCallback(async () => {
    try {
      setFehler(null);
      setStatus(await api.zugang());
    } catch (ladeFehler) {
      setFehler(ladeFehler);
    }
  }, []);

  useEffect(() => {
    void lade();
  }, [lade]);

  useEffect(
    () =>
      beobachteAnmeldung(() => {
        queryClient.clear();
        setStatus(null);
        setKontoOffen(false);
        void lade();
      }),
    [queryClient, lade],
  );

  if (!status && fehler) {
    return (
      <main className="flex sicht-mitte items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-3">
          <Fehlermeldung fehler={fehler} />
          <Knopf variante="primaer" onClick={() => void lade()}>
            {tx("Erneut versuchen")}
          </Knopf>
        </div>
      </main>
    );
  }
  if (!status) {
    return <Ladeanzeige />;
  }
  if (status.modus === 'benutzername') {
    return <BenutzernameFestlegen onErfolg={setStatus} />;
  }
  if (status.modus !== 'bereit') {
    const abgelaufen = rueckkehr.code === 'b' && !status.googleAnlage;
    const fallB = rueckkehr.code === 'b' && Boolean(status.googleAnlage) && status.registrierung && status.modus === 'anmelden';
    const hinweis = googleHinweis(abgelaufen ? 'd' : rueckkehr.code);
    if (status.modus === 'anmelden' && status.registrierung && (kontoOffen || fallB) && !abgelaufen) {
      return (
        <KontoErstellen
          googleEmail={status.googleAnlage}
          onAbgelaufen={() => {
            setKontoOffen(false);
            rueckkehr.setze('d');
          }}
          onErfolg={setStatus}
          onZurueck={() => setKontoOffen(false)}
        />
      );
    }
    return (
      <Anmeldung
        modus={status.modus}
        google={status.google === true}
        hinweis={hinweis}
        onHinweisWeg={rueckkehr.weg}
        onErfolg={setStatus}
        onKonto={status.modus === 'anmelden' && status.registrierung ? () => setKontoOffen(true) : undefined}
      />
    );
  }
  return (
    <>
      <SpracheAbgleich />
      {children}
    </>
  );
}
