import { tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { Archive, Plus } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'react-router';
import type { Aufgabe } from '../../../../shared/api/aufgaben.ts';
import { datumInZone } from '../../../../shared/spiel/datum.ts';
import { erscheintAlsNaechstes, istEinmaligErledigt } from '../../../../shared/spiel/aufgabe.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { Abschnitt } from '../../components/Ausklappbar.tsx';
import { ZurueckZumMehr } from '../../components/ZurueckZumMehr.tsx';
import { archivBeschriftung, Fehlermeldung, InfoHinweis, Karte, Knopf, Ladeanzeige } from '../../ui/index.ts';
import { AufgabenListe, useAufgaben } from './Aufgaben.tsx';
import { AufgabenFormular } from './AufgabenDialog.tsx';

const AUFGABEN_INFO = 'Eine Erledigung wird ein Eintrag mit der Tätigkeit der Aufgabe. Jede Fälligkeit einmal.';
const AUFGABEN_INFO_TODOIST =
  'Eine Erledigung wird ein Eintrag mit der Tätigkeit der Aufgabe. Jede Fälligkeit einmal. Jede Sache liegt entweder hier oder in Todoist.';

function herkunftVon(zustand: unknown): string | null {
  if (typeof zustand !== 'object' || zustand === null || !('herkunft' in zustand)) {
    return null;
  }
  return zustand.herkunft === '/' ? '/' : null;
}

type DialogStand = { aufgabe: Aufgabe | null } | null;

export function AufgabenSeite() {
  const ort = useLocation();
  const vonHeute = herkunftVon(ort.state) === '/';
  const offenQuery = useAufgaben(false);
  const archivQuery = useAufgaben(true);
  const { data: verbindungen } = useQuery({ queryKey: SCHLUESSEL.verbindungen, queryFn: api.verbindungen });
  const { data: einstellungen } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const [dialog, setDialog] = useState<DialogStand>(null);
  const [archivOffen, setArchivOffen] = useState(false);

  if (offenQuery.isPending) {
    return <Ladeanzeige />;
  }
  if (offenQuery.error) {
    return <Fehlermeldung fehler={offenQuery.error} />;
  }

  const heute = datumInZone(new Date(), einstellungen?.zeitzone ?? null);
  const aufgaben = offenQuery.data.filter((aufgabe) => !aufgabe.archiviert);
  const offen = aufgaben.filter((aufgabe) => !istEinmaligErledigt(aufgabe) && !erscheintAlsNaechstes(aufgabe, heute));
  const alsNaechstes = aufgaben.filter((aufgabe) => !istEinmaligErledigt(aufgabe) && erscheintAlsNaechstes(aufgabe, heute));
  const erledigt = aufgaben.filter((aufgabe) => istEinmaligErledigt(aufgabe));
  const archiv = archivQuery.data ?? [];
  const info = verbindungen?.todoist.verbunden ? AUFGABEN_INFO_TODOIST : AUFGABEN_INFO;

  return (
    <div className="space-y-6">
      {vonHeute ? <ZurueckZumMehr pfad="/" label="Übersicht" /> : null}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{tx('Aufgaben')}</h1>
          <InfoHinweis text={info} />
        </div>
        <Knopf variante="primaer" onClick={() => setDialog({ aufgabe: null })}>
          <Plus className="size-4" />
          {tx('Aufgabe')}
        </Knopf>
      </header>

      {offen.length === 0 && alsNaechstes.length === 0 && erledigt.length === 0 && (
        <Karte className="py-10 text-center text-sm text-leise">{tx('Noch keine Aufgaben.')}</Karte>
      )}

      {offen.length > 0 && (
        <Karte>
          <AufgabenListe aufgaben={offen} onBearbeiten={(aufgabe) => setDialog({ aufgabe })} />
        </Karte>
      )}

      {alsNaechstes.length > 0 && (
        <Abschnitt titel="Als Nächstes" kennung="aufgaben-als-naechstes" anfangEingeklappt>
          <Karte>
            <AufgabenListe aufgaben={alsNaechstes} onBearbeiten={(aufgabe) => setDialog({ aufgabe })} />
          </Karte>
        </Abschnitt>
      )}

      {erledigt.length > 0 && (
        <Abschnitt titel="Erledigt" kennung="aufgaben-erledigt" zusatz={<span className="zahl text-xs text-leise">{erledigt.length}</span>}>
          <Karte>
            <AufgabenListe aufgaben={erledigt} onBearbeiten={(aufgabe) => setDialog({ aufgabe })} />
          </Karte>
        </Abschnitt>
      )}

      {archivQuery.error ? <Fehlermeldung fehler={archivQuery.error} /> : null}
      {archiv.length > 0 && (
        <section className="space-y-2">
          <div className="flex justify-center">
            <Knopf variante="leise" onClick={() => setArchivOffen((wert) => !wert)}>
              <Archive className="size-4" />
              {archivBeschriftung(archivOffen, archiv.length)}
            </Knopf>
          </div>
          {archivOffen &&
            archiv.map((aufgabe) => (
              <button
                key={aufgabe.id}
                type="button"
                onClick={() => setDialog({ aufgabe })}
                className="block w-full truncate rounded-xl border border-rand px-4 py-3 text-left text-sm"
              >
                {aufgabe.name}
              </button>
            ))}
        </section>
      )}

      <Dialog
        offen={dialog !== null}
        titel={dialog?.aufgabe ? tx('Aufgabe bearbeiten') : tx('Neue Aufgabe')}
        onSchliessen={() => setDialog(null)}
      >
        {dialog && (
          <AufgabenFormular key={dialog.aufgabe?.id ?? 'neu'} aufgabe={dialog.aufgabe} onFertig={() => setDialog(null)} />
        )}
      </Dialog>
    </div>
  );
}
