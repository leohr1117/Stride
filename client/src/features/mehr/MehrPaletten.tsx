import { EllipsisVertical } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { EigenePalette, PaletteEingabe } from '../../../../shared/features/darstellung/eigenePaletten.ts';
import type { Farbtrio } from '../../../../shared/features/darstellung/paletten.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { useSchnellAktion } from '../../components/SchnellAktion.tsx';
import { Zeile, ZeilenGruppe } from '../../components/Zeile.tsx';
import { tx } from '../../text.ts';
import { EINGABE_STIL, Fehlermeldung, Feld, Formular, Knopf, Ladeanzeige, Leer } from '../../ui/index.ts';
import { Bereich, DARSTELLUNG_ZURUECK, useEinstellungen } from './rahmen.tsx';

type Modus = { art: 'neu' } | { art: 'lesen' | 'bearbeiten'; id: string };

function PalettenMenue({ onLoeschen }: { onLoeschen: () => void }) {
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
            className="flex min-h-12 w-full items-center px-4 text-left text-sm text-gefahr"
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
    <Dialog
      offen
      titel={titel}
      info={tx("Primär für Knöpfe, Akzent für XP, Hintergrund für die Fläche.")}
      onSchliessen={onSchliessen}
    >
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
        <Fehlermeldung fehler={fehler} />
        <Knopf type="submit" variante="primaer" disabled={speichert}>
          {tx("Speichern")}
        </Knopf>
      </Formular>
    </Dialog>
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

  const offen = modus?.art === 'lesen' || modus?.art === 'bearbeiten' ? data.paletten.find((palette) => palette.id === modus.id) : undefined;
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
              paletteNeu: { name: palette.name, primaer: palette.primaer, akzent: palette.akzent, hintergrund: palette.hintergrund },
            });
          }),
      },
    );
  };

  return (
    <Bereich
      titel={tx("Paletten")}
      info={tx("Anlegen, Bearbeiten und Löschen. Auswählen bleibt unter Darstellung.")}
      zurueck={DARSTELLUNG_ZURUECK}
      kinder={
        <div className="space-y-4">
          <Knopf
            variante="primaer"
            onClick={() => {
              speichern.reset();
              setModus({ art: 'neu' });
            }}
          >
            {tx("Neue Palette")}
          </Knopf>
          {!modus && speichern.error ? <Fehlermeldung fehler={speichern.error} /> : null}
          {data.paletten.length === 0 ? (
            <Leer text={tx("Noch keine Palette.")} />
          ) : (
            <ZeilenGruppe>
              {data.paletten.map((palette) => (
                <Zeile
                  key={palette.id}
                  titel={palette.name}
                  symbol={<Farbpunkte farben={palette} />}
                  onKlick={() => setModus({ art: 'lesen', id: palette.id })}
                />
              ))}
            </ZeilenGruppe>
          )}
          {modus?.art === 'neu' ? (
            <PalettenFormular
              key="neu"
              titel={tx("Neue Palette")}
              start={startNeu}
              fehler={speichern.error}
              speichert={speichern.isPending}
              onSchliessen={() => setModus(null)}
              onSpeichern={(eingabe) => speichern.mutate({ paletteNeu: eingabe }, { onSuccess: () => setModus(null) })}
            />
          ) : null}
          {modus?.art === 'lesen' && offen ? (
            <Dialog
              offen
              titel={offen.name}
              onSchliessen={() => setModus(null)}
              menu={<PalettenMenue onLoeschen={() => loeschen(offen)} />}
            >
              <Farbpunkte farben={offen} />
              <p className="zahl mt-3 text-xs text-leise uppercase">
                {offen.primaer} · {offen.akzent} · {offen.hintergrund}
              </p>
              <div className="mt-5">
                <Knopf
                  onClick={() => {
                    speichern.reset();
                    setModus({ art: 'bearbeiten', id: offen.id });
                  }}
                >
                  {tx("Bearbeiten")}
                </Knopf>
              </div>
            </Dialog>
          ) : null}
          {modus?.art === 'bearbeiten' && offen ? (
            <PalettenFormular
              key={offen.id}
              titel={tx("Palette bearbeiten")}
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
