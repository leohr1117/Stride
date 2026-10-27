import { tx } from '../../text.ts';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { ZugangModus, ZugangStatus } from '../../../../shared/api/index.ts';
import { api, beobachteAnmeldung } from '../../api/index.ts';
import { SpracheAbgleich } from '../../sprache.tsx';
import { Fehlermeldung, Feld, Formular, Knopf, Ladeanzeige, EINGABE_STIL, PasswortFeld } from '../../ui/index.ts';

function Anmeldung({ modus, onErfolg }: { modus: Exclude<ZugangModus, 'bereit' | 'benutzername'>; onErfolg: (status: ZugangStatus) => void }) {
  const [benutzername, setBenutzername] = useState('');
  const [passwort, setPasswort] = useState('');
  const [wiederholung, setWiederholung] = useState('');
  const [fehler, setFehler] = useState<unknown>(null);
  const [laeuft, setLaeuft] = useState(false);
  const neu = modus === 'einrichten';
  const mitName = modus !== 'passwort';

  const senden = async (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (neu && passwort !== wiederholung) {
      setFehler(new Error(tx("Die Passwörter stimmen nicht überein.")));
      return;
    }
    setLaeuft(true);
    setFehler(null);
    try {
      onErfolg(await api.anmelden({ benutzername: mitName ? benutzername.trim() : undefined, passwort }));
    } catch (anmeldeFehler) {
      setFehler(anmeldeFehler);
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <main className="flex sicht-mitte items-center justify-center px-4">
      <Formular onAbsenden={(ereignis) => void senden(ereignis)} className="w-full max-w-sm rounded-2xl border border-rand bg-flaeche p-6">
        <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <img src="/logo-v2.svg" alt="" className="size-7" />
          Stride
        </div>
        {mitName && (
          <Feld label={tx("Benutzername")}>
            <input
              className={EINGABE_STIL}
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              required
              value={benutzername}
              onChange={(ereignis) => setBenutzername(ereignis.target.value)}
            />
          </Feld>
        )}
        <PasswortFeld
          label={tx("Passwort")}
          name="password"
          autoComplete={neu ? 'new-password' : 'current-password'}
          autoFocus={!mitName}
          required
          value={passwort}
          onChange={(ereignis) => setPasswort(ereignis.target.value)}
        />
        {neu && (
          <PasswortFeld
            label={tx("Passwort wiederholen")}
            name="password-repeat"
            autoComplete="new-password"
            required
            value={wiederholung}
            onChange={(ereignis) => setWiederholung(ereignis.target.value)}
          />
        )}
        <Fehlermeldung fehler={fehler} />
        <Knopf type="submit" variante="primaer" className="w-full" disabled={laeuft || passwort === '' || (mitName && benutzername.trim() === '')}>
          {neu ? tx("Festlegen") : tx("Anmelden")}
        </Knopf>
      </Formular>
    </main>
  );
}

function BenutzernameFestlegen({ onErfolg }: { onErfolg: (status: ZugangStatus) => void }) {
  const [benutzername, setBenutzername] = useState('');
  const [fehler, setFehler] = useState<unknown>(null);
  const [laeuft, setLaeuft] = useState(false);

  const senden = async (ereignis: FormEvent) => {
    ereignis.preventDefault();
    setLaeuft(true);
    setFehler(null);
    try {
      onErfolg(await api.setzeBenutzername(benutzername.trim()));
    } catch (namensFehler) {
      setFehler(namensFehler);
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <main className="flex sicht-mitte items-center justify-center px-4">
      <Formular onAbsenden={(ereignis) => void senden(ereignis)} className="w-full max-w-sm rounded-2xl border border-rand bg-flaeche p-6">
        <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <img src="/logo-v2.svg" alt="" className="size-7" />
          Stride
        </div>
        <Feld label={tx("Benutzername")}>
          <input
            className={EINGABE_STIL}
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            required
            value={benutzername}
            onChange={(ereignis) => setBenutzername(ereignis.target.value)}
          />
        </Feld>
        <Fehlermeldung fehler={fehler} />
        <Knopf type="submit" variante="primaer" className="w-full" disabled={laeuft || benutzername.trim() === ''}>
          {tx("Festlegen")}
        </Knopf>
      </Formular>
    </main>
  );
}

export function ZugangTor({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ZugangStatus | null>(null);
  const [fehler, setFehler] = useState<unknown>(null);

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
    return <Anmeldung modus={status.modus} onErfolg={setStatus} />;
  }
  return (
    <>
      <SpracheAbgleich />
      {children}
    </>
  );
}
