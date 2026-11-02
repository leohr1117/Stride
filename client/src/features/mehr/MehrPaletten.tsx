import { EllipsisVertical } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { palettenDerAnsicht, type EigenePalette, type PaletteEingabe } from '../../../../shared/features/darstellung/eigenePaletten.ts';
import type { Farbtrio } from '../../../../shared/features/darstellung/paletten.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { useSchnellAktion } from '../../components/SchnellAktion.tsx';
import { AnlegeZeile, Zeile, ZeilenGruppe } from '../../components/Zeile.tsx';
import { tx } from '../../text.ts';
import { EINGABE_STIL, Fehlermeldung, Feld, Formular, InfoHinweis, Knopf, Ladeanzeige, Leer } from '../../ui/index.ts';
import { wendeErscheinung } from '../darstellung/stil.ts';
import { Bereich, DARSTELLUNG_ZURUECK, useEinstellungen } from './rahmen.tsx';

const ABSCHNITT = 'ueberschrift abschnittskopf text-[13px] font-semibold leading-[18px] tracking-normal text-leise normal-case';

type Modus = { art: 'neu' } | { art: 'lesen' | 'bearbeiten'; id: string };

function PalettenMenue({ onBearbeiten, onLoeschen }: { onBearbeiten: () => void; onLoeschen: () => void }) {
  const [offen, setOffen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={tx('Aktionen')}
        aria-expanded={offen}
        className="flex size-12 items-center justify-center rounded-full text-leise hover:bg-flaeche-2 hover:text-haupt"
        onClick={() => setOffen((bisher) => !bisher)}
      >
        <EllipsisVertical className="size-5" />
      </button>
      {offen ? (
        <div className="absolute end-0 top-12 z-10 min-w-40 rounded-lg border border-rand bg-flaeche py-1 shadow-lg">
          <button
            type="button"
            className="flex min-h-12 w-full items-center px-4 text-left text-sm"
            onClick={() => {
              setOffen(false);
              onBearbeiten();
            }}
          >
            {tx('Bearbeiten')}
          </button>
          <button
            type="button"
            className="flex min-h-12 w-full items-center border-t border-rand px-4 text-left text-sm text-gefahr"
            onClick={() => {
              setOffen(false);
              onLoeschen();
            }}
          >
            {tx('Löschen')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Farbpunkte({ farben }: { farben: Farbtrio }) {
  return (
    <span className="flex shrink-0" aria-hidden="true">
      <span className="size-3 rounded-full" style={{ background: farben.primaer }} />
      <span className="-ml-1 size-3 rounded-full" style={{ background: farben.akzent }} />
      <span className="-ml-1 size-3 rounded-full border border-rand" style={{ background: farben.hintergrund }} />
    </span>
  );
}

function PalettenFormular({
  titel,
  start,
  fehler,
  speichert,
  onSchliessen,
  onSpeichern,
}: {
  titel: string;
  start: PaletteEingabe;
  fehler: unknown;
  speichert: boolean;
  onSchliessen: () => void;
  onSpeichern: (eingabe: PaletteEingabe) => void;
}) {
  const [name, setName] = useState(start.name);
  const [primaer, setPrimaer] = useState(start.primaer);
  const [akzent, setAkzent] = useState(start.akzent);
  const [hintergrund, setHintergrund] = useState(start.hintergrund);
  const senden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    onSpeichern({ name, primaer, akzent, hintergrund });
  };
  return (
    <Dialog offen titel={titel} onSchliessen={onSchliessen}>
      <Formular onAbsenden={senden}>
        <Feld label="Name">
          <input
            autoFocus
            value={name}
            maxLength={40}
            onChange={(ereignis) => setName(ereignis.currentTarget.value)}
            className={EINGABE_STIL}
          />
        </Feld>
        <div className="space-y-4">
          <div className="flex items-center">
            <h3 className={ABSCHNITT}>{tx('Farben')}</h3>
            <InfoHinweis name="Farben" text="Primär: Knöpfe. Akzent: Hervorhebungen. Hintergrund: Fläche. Streak, Ring und Schalter haben feste Farben." />
          </div>
          <Feld label="Primär">
            <input
              type="color"
              value={primaer}
              onChange={(ereignis) => setPrimaer(ereignis.currentTarget.value)}
              className="size-9 cursor-pointer border border-rand bg-transparent p-0.5"
            />
          </Feld>
          <Feld label="Akzent">
            <input
              type="color"
              value={akzent}
              onChange={(ereignis) => setAkzent(ereignis.currentTarget.value)}
              className="size-9 cursor-pointer border border-rand bg-transparent p-0.5"
            />
          </Feld>
          <Feld label="Hintergrund">
            <input
              type="color"
              value={hintergrund}
              onChange={(ereignis) => setHintergrund(ereignis.currentTarget.value)}
              className="size-9 cursor-pointer border border-rand bg-transparent p-0.5"
            />
          </Feld>
        </div>
        <div data-vorschau="" className="flex items-center gap-3 rounded-xl bg-flaeche-2 px-3 py-2">
          <span className="size-6 shrink-0 rounded-full" style={{ background: primaer }} aria-hidden="true" />
          <span className="size-6 shrink-0 rounded-full" style={{ background: akzent }} aria-hidden="true" />
          <span className="size-6 shrink-0 rounded-full border border-rand" style={{ background: hintergrund }} aria-hidden="true" />
          <span className="min-w-0 break-words text-sm">{name.trim() || tx('Palette')}</span>
        </div>
        <Fehlermeldung fehler={fehler} />
        <Knopf type="submit" variante="primaer" disabled={speichert}>
          {tx("Speichern")}
        </Knopf>
      </Formular>
    </Dialog>
  );
}

function Farbzeile({ label, farbe }: { label: string; farbe: string }) {
  return (
    <Feld label={label}>
      <p className="flex items-center gap-2 text-sm">
        <span className="size-4 shrink-0 rounded-full border border-rand" style={{ background: farbe }} aria-hidden="true" />
        <span className="zahl">{farbe}</span>
      </p>
    </Feld>
  );
}

export function PalettenSeite() {
  const { data, error, isPending, speichern } = useEinstellungen();
  const [modus, setModus] = useState<Modus | null>(null);
  const schnell = useSchnellAktion();

  useEffect(() => {
    if (!modus || modus.art === 'neu' || !data) {
      return;
    }
    if (!data.paletten.some((palette) => palette.id === modus.id)) {
      setModus(null);
    }
  }, [data, modus]);

  if (isPending) {
    return <Bereich titel={tx("Paletten")} zurueck={DARSTELLUNG_ZURUECK} kinder={<Ladeanzeige />} />;
  }
  if (error || !data) {
    return <Bereich titel={tx("Paletten")} zurueck={DARSTELLUNG_ZURUECK} kinder={<Fehlermeldung fehler={error} />} />;
  }

  const sichtbar = palettenDerAnsicht(data.paletten, data.stil);
  const offen = modus?.art === 'lesen' || modus?.art === 'bearbeiten' ? sichtbar.find((palette) => palette.id === modus.id) : undefined;
  const startNeu: PaletteEingabe = {
    name: '',
    primaer: data.primaer,
    akzent: data.akzent,
    hintergrund: data.hintergrund,
  };

  const loeschen = (palette: EigenePalette) => {
    setModus(null);
    speichern.mutate(
      { paletteLoeschen: palette.id },
      {
        onSuccess: () =>
          schnell.melde(tx('„{name}" gelöscht', { name: palette.name }), () => {
            speichern.mutate({
              paletteNeu: {
                name: palette.name,
                primaer: palette.primaer,
                akzent: palette.akzent,
                hintergrund: palette.hintergrund,
                ...(palette.stil ? { stil: palette.stil } : {}),
              },
            });
          }),
      },
    );
  };

  return (
    <Bereich
      titel={tx("Paletten")}
      zurueck={DARSTELLUNG_ZURUECK}
      kinder={
        <div className="space-y-4">
          {!modus && speichern.error ? <Fehlermeldung fehler={speichern.error} /> : null}
          {sichtbar.length === 0 ? <Leer text={tx("Noch keine Palette.")} /> : null}
          <ZeilenGruppe>
            {sichtbar.map((palette) => (
              <Zeile
                key={palette.id}
                titel={palette.name}
                symbol={<Farbpunkte farben={palette} />}
                onKlick={() => setModus({ art: 'lesen', id: palette.id })}
              />
            ))}
            <AnlegeZeile
              text="Palette anlegen"
              onKlick={() => {
                speichern.reset();
                setModus({ art: 'neu' });
              }}
            />
          </ZeilenGruppe>
          {modus?.art === 'neu' ? (
            <PalettenFormular
              key="neu"
              titel={tx("Palette")}
              start={startNeu}
              fehler={speichern.error}
              speichert={speichern.isPending}
              onSchliessen={() => setModus(null)}
              onSpeichern={(eingabe) => speichern.mutate({ paletteNeu: { ...eingabe, stil: data.stil } }, { onSuccess: () => setModus(null) })}
            />
          ) : null}
          {modus?.art === 'lesen' && offen ? (
            <Dialog
              offen
              titel={offen.name}
              onSchliessen={() => setModus(null)}
              menu={
                <PalettenMenue
                  onBearbeiten={() => {
                    speichern.reset();
                    setModus({ art: 'bearbeiten', id: offen.id });
                  }}
                  onLoeschen={() => loeschen(offen)}
                />
              }
            >
              <div className="space-y-4">
                <Farbzeile label="Primär" farbe={offen.primaer} />
                <Farbzeile label="Akzent" farbe={offen.akzent} />
                <Farbzeile label="Hintergrund" farbe={offen.hintergrund} />
                <Knopf
                  variante="primaer"
                  className="w-full"
                  onClick={() => {
                    wendeErscheinung({
                      primaer: offen.primaer,
                      akzent: offen.akzent,
                      hintergrund: offen.hintergrund,
                      glimmen: data.glimmen,
                    });
                    speichern.mutate(
                      { primaer: offen.primaer, akzent: offen.akzent, hintergrund: offen.hintergrund },
                      { onSuccess: () => setModus(null) },
                    );
                  }}
                >
                  {tx('Auswählen')}
                </Knopf>
              </div>
            </Dialog>
          ) : null}
          {modus?.art === 'bearbeiten' && offen ? (
            <PalettenFormular
              key={offen.id}
              titel={tx("Palette")}
              start={offen}
              fehler={speichern.error}
              speichert={speichern.isPending}
              onSchliessen={() => setModus({ art: 'lesen', id: offen.id })}
              onSpeichern={(eingabe) =>
                speichern.mutate(
                  { paletteAendern: { id: offen.id, ...eingabe } },
                  { onSuccess: () => setModus(null) },
                )
              }
            />
          ) : null}
        </div>
      }
    />
  );
}
