import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { standardVorlage } from '../../../../shared/features/darstellung/paletten.ts';
import { SPRACH_NAME, SPRACHEN, type Sprache } from '../../../../shared/sprache/kern.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { LeistenEditor } from '../../components/LeistenEditor.tsx';
import { Fehlermeldung, Ladeanzeige, Optionsliste } from '../../ui/index.ts';
import { Zeile, ZeilenGruppe, ZeileSchalter } from '../../components/Zeile.tsx';
import { wendeErscheinung } from '../darstellung/stil.ts';
import { useSprache } from '../../sprache.tsx';
import { tx } from '../../text.ts';
import { AnsichtSteuerung, systemDunkel } from './MehrAnsicht.tsx';
import { PalettenSeite } from './MehrPaletten.tsx';
import { Bereich, DARSTELLUNG_HASH, DARSTELLUNG_ZURUECK, useEinstellungen, useHashWeiter } from './rahmen.tsx';

function LeisteSeite() {
  const { data, error, isPending, speichern } = useEinstellungen();
  const [hinweis, setHinweis] = useState<{ text: string; id: number } | null>(null);
  useEffect(() => {
    if (!hinweis) {
      return;
    }
    const id = window.setTimeout(() => setHinweis(null), 1800);
    return () => window.clearTimeout(id);
  }, [hinweis]);
  if (isPending) {
    return <Bereich titel={tx("Leiste")} zurueck={DARSTELLUNG_ZURUECK} kinder={<Ladeanzeige />} />;
  }
  if (error || !data) {
    return <Bereich titel={tx("Leiste")} zurueck={DARSTELLUNG_ZURUECK} kinder={<Fehlermeldung fehler={error} />} />;
  }
  return (
    <Bereich
      titel={tx("Leiste")}
      zurueck={DARSTELLUNG_ZURUECK}
      kinder={
        <>
          <p className="hidden text-sm text-leise md:block">{tx("Gilt nur auf dem Handy.")}</p>
          <LeistenEditor
            wert={data.mobilLeiste}
            funktionen={data.funktionen}
            ebenen={data.ebenen}
            deaktiviert={speichern.isPending}
            hinweis={hinweis?.text ?? null}
            onAendern={(mobilLeiste) =>
              speichern.mutate({ mobilLeiste }, { onSuccess: () => setHinweis({ text: 'Gespeichert.', id: Date.now() }) })
            }
          />
          <Fehlermeldung fehler={speichern.error} />
        </>
      }
    />
  );
}

function SprachZeile({ sprache, onWaehlen }: { sprache: Sprache; onWaehlen: (code: Sprache) => void }) {
  const [offen, setOffen] = useState(false);
  return (
    <>
      <ZeilenGruppe>
        <Zeile
          titel={tx('Sprache')}
          name={`${tx('Sprache')}, ${SPRACH_NAME[sprache]}`}
          wert={<span lang={sprache}>{SPRACH_NAME[sprache]}</span>}
          info={tx('Gilt für die Oberfläche. Namen und Einträge bleiben, wie du sie geschrieben hast.')}
          onKlick={() => setOffen(true)}
        />
      </ZeilenGruppe>
      <Dialog offen={offen} titel={tx('Sprache')} onSchliessen={() => setOffen(false)}>
        <Optionsliste
          name={tx('Sprache')}
          wert={sprache}
          onAendern={(code) => {
            setOffen(false);
            onWaehlen(code);
          }}
          optionen={SPRACHEN.map((code) => ({
            wert: code,
            label: <span lang={code}>{SPRACH_NAME[code]}</span>,
          }))}
        />
      </Dialog>
    </>
  );
}

function DarstellungListe() {
  const { data, error, isPending, speichern } = useEinstellungen();
  const { sprache, waehle, uebernehme } = useSprache();
  if (isPending) {
    return <Bereich titel={tx("Darstellung")} kinder={<Ladeanzeige />} />;
  }
  if (error || !data) {
    return <Bereich titel={tx("Darstellung")} kinder={<Fehlermeldung fehler={error} />} />;
  }
  return (
    <Bereich
      titel={tx("Darstellung")}
      kinder={
        <>
          <div className="space-y-8">
            <SprachZeile
              sprache={sprache}
              onWaehlen={(code) => {
                waehle(code);
                speichern.mutate({ sprache: code }, { onError: () => uebernehme(data.sprache, true) });
              }}
            />
            <AnsichtSteuerung />
            <ZeilenGruppe>
              <Zeile titel={tx("Leiste")} nach="/mehr/darstellung/leiste" />
            </ZeilenGruppe>
            <ZeilenGruppe titel="Effekte">
              <ZeileSchalter titel={tx("Sound")} an={data.sound} onAendern={(sound) => speichern.mutate({ sound })} deaktiviert={speichern.isPending} />
              <ZeileSchalter
                titel={tx("Glühen")}
                an={data.glimmen}
                onAendern={(glimmen) => {
                  const farben = data.eigeneFarben
                    ? { primaer: data.primaer, akzent: data.akzent, hintergrund: data.hintergrund }
                    : standardVorlage(data.stil, systemDunkel());
                  wendeErscheinung({ ...farben, glimmen });
                  speichern.mutate({ glimmen });
                }}
                deaktiviert={speichern.isPending}
              />
            </ZeilenGruppe>
          </div>
          <Fehlermeldung fehler={speichern.error} />
        </>
      }
    />
  );
}

export function MehrDarstellungSeite() {
  const { teil } = useParams();
  useHashWeiter(DARSTELLUNG_HASH);
  if (teil === 'leiste') {
    return <LeisteSeite />;
  }
  if (teil === 'paletten') {
    return <PalettenSeite />;
  }
  if (teil === 'ansicht') {
    return <Navigate to="/mehr/darstellung" replace />;
  }
  if (teil) {
    return <Navigate to="/mehr/darstellung" replace />;
  }
  return <DarstellungListe />;
}
