import { useState } from 'react';
import type { ZugangStatus } from '../../../../shared/api/index.ts';
import {
  ZUSTIMMUNG_DIALOG_SATZ,
  ZUSTIMMUNG_DIALOG_TITEL,
  ZUSTIMMUNG_KASTEN,
  ZUSTIMMUNG_KNOPF,
  teileZustimmung,
} from '../../../../shared/recht/fassung.ts';
import { RECHT_SEITEN } from '../../../../shared/recht/seiten.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { api } from '../../api/index.ts';
import { tx } from '../../text.ts';
import { Fehlermeldung, Knopf } from '../../ui/index.ts';

function rechtPfad(id: 'nutzung' | 'datenschutz'): string {
  return RECHT_SEITEN.find((seite) => seite.id === id)?.pfad ?? '/';
}

function SatzLinks({ satz }: { satz: string }) {
  const teile = teileZustimmung(satz, tx('Nutzungsbedingungen'), tx('Datenschutzerklärung'));
  return teile.map((teil, index) =>
    teil.art === 'text' ? (
      <span key={index}>{teil.text}</span>
    ) : (
      <a key={index} href={rechtPfad(teil.art)} className="underline">
        {teil.text}
      </a>
    ),
  );
}

export function ZustimmungsKasten({
  an,
  fehler,
  onAendern,
}: {
  an: boolean;
  fehler: string | null;
  onAendern: (an: boolean) => void;
}) {
  return (
    <div className="feld" data-feld-fehler={fehler ? '' : undefined}>
      <div className="flex min-h-12 items-start gap-3">
        <input
          id="zustimmung"
          name="zustimmung"
          type="checkbox"
          checked={an}
          aria-required="true"
          aria-invalid={fehler ? true : undefined}
          aria-describedby={fehler ? 'zustimmung-fehler' : undefined}
          className="mt-1 size-6 shrink-0 accent-[var(--akzent)]"
          onChange={(ereignis) => onAendern(ereignis.target.checked)}
        />
        <label htmlFor="zustimmung" className="min-w-0 pt-1 text-sm leading-5 break-words">
          <SatzLinks satz={tx(ZUSTIMMUNG_KASTEN)} />
        </label>
      </div>
      {fehler ? (
        <p id="zustimmung-fehler" className="feld-fehler text-[13px] leading-[18px] break-words text-gefahr" role="alert">
          <span aria-hidden="true">⚠ </span>
          {tx(fehler)}
        </p>
      ) : null}
    </div>
  );
}

export function ZustimmungDialog({
  faellig,
  onErledigt,
}: {
  faellig: boolean;
  onErledigt: (status: ZugangStatus) => void;
}) {
  const [zurueck, setZurueck] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<unknown>(null);
  const [letztePflicht, setLetztePflicht] = useState(faellig);
  if (faellig !== letztePflicht) {
    setLetztePflicht(faellig);
    if (!faellig) {
      setZurueck(false);
    }
  }

  const senden = async () => {
    if (laeuft) {
      return;
    }
    setLaeuft(true);
    setFehler(null);
    try {
      onErledigt(await api.stimmeZu());
    } catch (anfrageFehler) {
      setFehler(anfrageFehler);
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <Dialog
      offen={faellig && !zurueck}
      titel={tx(ZUSTIMMUNG_DIALOG_TITEL)}
      art="warnung"
      onSchliessen={() => setZurueck(true)}
    >
      <div className="space-y-5">
        <p className="text-sm leading-relaxed break-words text-leise">
          <SatzLinks satz={tx(ZUSTIMMUNG_DIALOG_SATZ)} />
        </p>
        <Fehlermeldung fehler={fehler} />
        <div className="dialog-aktionen">
          <Knopf onClick={() => setZurueck(true)}>{tx('Abbrechen')}</Knopf>
          <Knopf variante="primaer" autoFocus aria-busy={laeuft || undefined} onClick={() => void senden()}>
            {tx(ZUSTIMMUNG_KNOPF)}
          </Knopf>
        </div>
      </div>
    </Dialog>
  );
}
