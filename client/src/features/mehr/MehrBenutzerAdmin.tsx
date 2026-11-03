import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import type { AdminKonto } from '../../../../shared/api/zugang.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { EINGABE_STIL, Fehlermeldung, Feld, Formular, Knopf } from '../../ui/index.ts';
import { tx } from '../../text.ts';

const NAME_VERGEBEN = 'Der Name ist schon vergeben.';
const SERVER_VERGEBEN = 'Der Benutzername ist schon vergeben.';
const NAME_LEER = 'Der Benutzername darf nicht leer sein.';
const NAME_LANG = 'Der Benutzername darf höchstens 40 Zeichen haben.';

export interface BenutzernameZiel {
  id: number;
  benutzername: string;
}

function feldAusFehler(fehler: unknown): string | null {
  const text = fehler instanceof Error ? fehler.message : '';
  if (text === SERVER_VERGEBEN) {
    return NAME_VERGEBEN;
  }
  if (text === NAME_LEER || text === NAME_LANG) {
    return text;
  }
  return null;
}

/** Abbrechen geht denselben Weg wie Esc, damit ein geändertes Blatt nachfragt. */
function schliessenWieEsc(): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
}

export function BenutzernameDialog({
  konto,
  onSchliessen,
}: {
  konto: BenutzernameZiel | null;
  onSchliessen: () => void;
}) {
  const queryClient = useQueryClient();
  const [entwurf, setEntwurf] = useState<string | null>(null);
  const [feldFehler, setFeldFehler] = useState<string | null>(null);
  const [fehler, setFehler] = useState<unknown>(null);
  const id = konto?.id ?? 0;
  const bisher = konto?.benutzername ?? '';
  const name = entwurf ?? bisher;

  useEffect(() => {
    setEntwurf(null);
    setFeldFehler(null);
    setFehler(null);
  }, [id]);

  const speichern = useMutation({
    mutationFn: (benutzername: string) => api.aendereAdminBenutzername(id, benutzername),
    onSuccess: (gespeichert) => {
      setEntwurf(null);
      setFeldFehler(null);
      setFehler(null);
      queryClient.setQueryData<AdminKonto[]>(SCHLUESSEL.adminKonten, (alt) =>
        alt?.map((eintrag) => (eintrag.id === gespeichert.id ? gespeichert : eintrag)),
      );
      void queryClient.invalidateQueries({ queryKey: SCHLUESSEL.adminKonten });
      void queryClient.invalidateQueries({ queryKey: SCHLUESSEL.konten });
      void queryClient.invalidateQueries({ queryKey: SCHLUESSEL.zugang });
      onSchliessen();
    },
    onError: (speicherFehler) => {
      const amFeld = feldAusFehler(speicherFehler);
      if (amFeld) {
        setFeldFehler(amFeld);
        setFehler(null);
        return;
      }
      setFeldFehler(null);
      setFehler(speicherFehler);
    },
  });

  const senden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (!konto || speichern.isPending) {
      return;
    }
    const naechster = name.trim();
    if (naechster.length < 1) {
      setFeldFehler(NAME_LEER);
      setFehler(null);
      return;
    }
    if (naechster.length > 40) {
      setFeldFehler(NAME_LANG);
      setFehler(null);
      return;
    }
    if (naechster === bisher) {
      onSchliessen();
      return;
    }
    setFeldFehler(null);
    speichern.mutate(naechster);
  };

  return (
    <Dialog offen={konto !== null} titel={tx('Benutzername ändern')} onSchliessen={onSchliessen}>
      <Formular onAbsenden={senden}>
        <Feld label="Benutzername" fehler={feldFehler}>
          <input
            className={EINGABE_STIL}
            name="benutzername"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-required="true"
            value={name}
            onChange={(ereignis) => {
              setEntwurf(ereignis.target.value);
              setFeldFehler(null);
            }}
          />
        </Feld>
        <Fehlermeldung fehler={fehler} />
        <div className="dialog-aktionen">
          <Knopf type="button" onClick={schliessenWieEsc}>
            {tx('Abbrechen')}
          </Knopf>
          <Knopf type="submit" variante="primaer" aria-busy={speichern.isPending || undefined}>
            {tx('Speichern')}
          </Knopf>
        </div>
      </Formular>
    </Dialog>
  );
}
