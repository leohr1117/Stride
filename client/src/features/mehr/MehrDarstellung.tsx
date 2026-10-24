import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { standardVorlage } from '../../../../shared/features/darstellung/paletten.ts';
import { SPRACH_NAME, SPRACHEN } from '../../../../shared/sprache/kern.ts';
import { LeistenEditor } from '../../components/LeistenEditor.tsx';
import { Fehlermeldung, InfoHinweis, Ladeanzeige } from '../../ui/index.ts';
import { Zeile, ZeilenGruppe, ZeileSchalter } from '../../components/Zeile.tsx';
import { wendeErscheinung } from '../darstellung/stil.ts';
import { useSprache } from '../../sprache.tsx';
import { tx } from '../../text.ts';
import { AnsichtSteuerung, systemDunkel } from './MehrAnsicht.tsx';
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
            <ZeilenGruppe>
              <div className="px-4 py-3">
                <div className="flex min-w-0 items-center">
                  <span className="min-w-0 text-sm font-medium break-words">{tx('Sprache')}</span>
                  <InfoHinweis text={tx('Gilt für die Oberfläche. Namen und Einträge bleiben, wie du sie geschrieben hast.')} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1 rounded-xl bg-flaeche-2 p-1" role="group" aria-label={tx('Sprache')}>
                  {SPRACHEN.map((code) => (
                    <button
                      key={code}
                      type="button"
                      lang={code}
                      aria-pressed={sprache === code}
                      onClick={() => {
                        waehle(code);
                        speichern.mutate({ sprache: code }, { onError: () => uebernehme(data.sprache, true) });
                      }}
                      className={`sprach-wahl rounded-lg px-2.5 py-1 text-sm font-medium ${
                        sprache === code ? 'bg-flaeche text-haupt shadow-sm' : 'text-leise'
                      }`}
                    >
                      {SPRACH_NAME[code]}
                    </button>
                  ))}
                </div>
              </div>
            </ZeilenGruppe>
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
  if (teil === 'ansicht') {
    return <Navigate to="/mehr/darstellung" replace />;
  }
  if (teil) {
    return <Navigate to="/mehr/darstellung" replace />;
  }
  return <DarstellungListe />;
}
