import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { standardVorlage } from '../../../../shared/features/darstellung/paletten.ts';
import { SPRACH_NAME, SPRACHEN } from '../../../../shared/sprache/kern.ts';
import { LeistenEditor } from '../../components/LeistenEditor.tsx';
import { Fehlermeldung, InfoHinweis, Ladeanzeige, Optionsliste } from '../../ui/index.ts';
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
          <p className="hidden text-sm text-leise md:block">{tx("Die Leiste gibt es nur auf dem Handy. Am PC findest du alle Seiten links in der Seitenleiste.")}</p>
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
            <section>
              <div className="mb-2 flex items-center">
                <h2 className="ueberschrift abschnittskopf min-w-0 text-[13px] font-semibold leading-[18px] tracking-normal text-leise normal-case">
                  {tx('Sprache')}
                </h2>
                <InfoHinweis text={tx('Gilt für die Oberfläche. Namen und Einträge bleiben, wie du sie geschrieben hast.')} />
              </div>
              <Optionsliste
                name={tx('Sprache')}
                wert={sprache}
                onAendern={(code) => {
                  waehle(code);
                  speichern.mutate({ sprache: code }, { onError: () => uebernehme(data.sprache, true) });
                }}
                optionen={SPRACHEN.map((code) => ({
                  wert: code,
                  label: <span lang={code}>{SPRACH_NAME[code]}</span>,
                }))}
              />
            </section>
            <AnsichtSteuerung />
            <ZeilenGruppe>
              <Zeile titel={tx("Leiste")} nach="/mehr/darstellung/leiste" />
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
