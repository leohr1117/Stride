import { useState, type FormEvent } from 'react';
import type { ZugangStatus } from '../../../../shared/api/index.ts';
import { api } from '../../api/index.ts';
import { tx } from '../../text.ts';
import { Fehlermeldung, Feld, Knopf, EINGABE_STIL } from '../../ui/index.ts';
import { AnmeldeRahmen } from './AnmeldeRahmen.tsx';

export function BenutzernameFestlegen({ onErfolg }: { onErfolg: (status: ZugangStatus) => void }) {
  const [benutzername, setBenutzername] = useState('');
  const [fehler, setFehler] = useState<unknown>(null);
  const [nameFehler, setNameFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const senden = async (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (laeuft) {
      return;
    }
    if (benutzername.trim() === '') {
      setNameFehler('Der Benutzername fehlt.');
      setFehler(null);
      return;
    }
    setNameFehler(null);
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
    <AnmeldeRahmen onAbsenden={(ereignis) => void senden(ereignis)} titel="Benutzername festlegen">
      <Feld label={tx('Benutzername')} fehler={nameFehler}>
        <input
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
      <Fehlermeldung fehler={fehler} />
      <Knopf type="submit" variante="primaer" className="w-full" aria-busy={laeuft || undefined}>
        {tx('Festlegen')}
      </Knopf>
    </AnmeldeRahmen>
  );
}
