import { useEffect, useRef, useState } from 'react';
import type { EigenePalette } from '../../../../shared/features/darstellung/eigenePaletten.ts';
import { palettenNachDesign, standardVorlage, type Farbtrio } from '../../../../shared/features/darstellung/paletten.ts';
import { STIL_INFO, STILE, type Stil } from '../../../../shared/features/darstellung/stile.ts';
import { Zeile, ZeilenGruppe } from '../../components/Zeile.tsx';
import { farbAnfang, farbLoslassen, farbUebernehmen, farbZiehen, type FarbZustand } from '../darstellung/ansichtFarbe.ts';
import { Fehlermeldung, InfoHinweis, Knopf, Ladeanzeige, Leer } from '../../ui/index.ts';
import { wendeErscheinung, wendeStilAn } from '../darstellung/stil.ts';
import { tx } from '../../text.ts';
import { useEinstellungen } from './rahmen.tsx';

const STIL_FORM: Record<Stil, { radius: string; balken: string; schrift: string; sperrung: string; gross: 'uppercase' | 'none' }> = {
  standard: { radius: '8px', balken: '4px', schrift: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', sperrung: '0', gross: 'none' },
  minimal: { radius: '16px', balken: '999px', schrift: 'inherit', sperrung: '0', gross: 'none' },
  jade: { radius: '10px', balken: '2px', schrift: 'inherit', sperrung: '-0.02em', gross: 'none' },
  holo: { radius: '4px', balken: '0', schrift: 'ui-sans-serif, system-ui, sans-serif', sperrung: '0.08em', gross: 'uppercase' },
  antik: { radius: '2px', balken: '0', schrift: 'Georgia, serif', sperrung: '0.06em', gross: 'uppercase' },
};

export function systemDunkel(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function gleicheFarben(a: Farbtrio, b: Farbtrio): boolean {
  return a.primaer === b.primaer && a.akzent === b.akzent && a.hintergrund === b.hintergrund;
}

function farbenDerAnsicht(stil: Stil, gemerkt: Partial<Record<Stil, Farbtrio>> | undefined): Farbtrio {
  const gespeichert = gemerkt?.[stil];
  if (gespeichert) {
    return gespeichert;
  }
  const vorlage = standardVorlage(stil, systemDunkel());
  return { primaer: vorlage.primaer, akzent: vorlage.akzent, hintergrund: vorlage.hintergrund };
}

function StilAuswahl({ wert, werte = STILE, onAendern }: { wert: Stil; werte?: readonly Stil[]; onAendern: (stil: Stil) => void }) {
  const dunkel = systemDunkel();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {werte.map((stil) => {
        const info = STIL_INFO[stil];
        const form = STIL_FORM[stil];
        const vorlage = standardVorlage(stil, dunkel);
        const aktiv = stil === wert;
        return (
          <button
            key={stil}
            type="button"
            onClick={() => onAendern(stil)}
            aria-pressed={aktiv}
            className={`rounded-xl border p-2 text-left transition ${aktiv ? 'border-akzent ring-1 ring-akzent' : 'border-rand hover:border-leise/60'}`}
          >
            <span
              className="block space-y-1.5 border p-2.5"
              style={{ borderRadius: form.radius, background: vorlage.flaechen.flaeche, borderColor: vorlage.flaechen.rand }}
            >
              <span className="block h-1.5 w-3/4" style={{ borderRadius: form.balken, background: vorlage.primaer }} />
              <span className="block h-1.5 w-1/2" style={{ borderRadius: form.balken, background: vorlage.akzent }} />
            </span>
            <span
              className="mt-2 block text-xs font-medium text-balance break-words"
              style={{ fontFamily: form.schrift, letterSpacing: form.sperrung, textTransform: form.gross }}
            >
              {tx(info.label)}
            </span>
          </button>
        );
      })}
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

function AnsichtWahl({
  stil,
  farben: gespeichert,
  gemerkt,
  paletten,
  glimmen,
  onStil,
  onFarben,
  onStandard,
}: {
  stil: Stil;
  farben: Farbtrio;
  gemerkt: Partial<Record<Stil, Farbtrio>>;
  paletten: readonly EigenePalette[];
  glimmen: boolean;
  onStil: (stil: Stil) => void;
  onFarben: (farben: Farbtrio) => void;
  onStandard: () => void;
}) {
  const stand = useRef<FarbZustand>(farbAnfang(gespeichert));
  const [farben, setFarben] = useState(gespeichert);
  useEffect(() => {
    const neu = farbUebernehmen(stand.current, gespeichert);
    stand.current = neu;
    setFarben(neu.anzeige);
  }, [gespeichert.primaer, gespeichert.akzent, gespeichert.hintergrund]);

  const uebernehmen = (neu: FarbZustand) => {
    stand.current = neu;
    setFarben(neu.anzeige);
    wendeErscheinung({ ...neu.anzeige, glimmen });
  };

  const ziehe = (feld: keyof Farbtrio, wert: string) => {
    uebernehmen(farbZiehen(stand.current, feld, wert));
  };

  const loslassen = (feld: keyof Farbtrio, wert: string) => {
    const neu = farbLoslassen(farbZiehen(stand.current, feld, wert));
    const gleich =
      neu.gespeichert.primaer === stand.current.gespeichert.primaer &&
      neu.gespeichert.akzent === stand.current.gespeichert.akzent &&
      neu.gespeichert.hintergrund === stand.current.gespeichert.hintergrund;
    if (gleich) {
      uebernehmen(farbAnfang(stand.current.gespeichert));
      return;
    }
    uebernehmen(neu);
    onFarben(neu.gespeichert);
  };

  const sofort = (neu: Farbtrio) => {
    uebernehmen(farbAnfang(neu));
    onFarben(neu);
  };

  const soll = standardVorlage(stil, systemDunkel());
  const istStandard = gleicheFarben(farben, soll);

  const waehleStil = (neu: Stil) => {
    uebernehmen(farbAnfang(farbenDerAnsicht(neu, gemerkt)));
    onStil(neu);
  };

  return (
    <div className="space-y-8">
      <div id="ansichten" className="space-y-3">
        <Abschnittskopf titel={tx("Ansichten")} info={tx("Form, Schrift und Kanten.")} leise />
        <StilAuswahl wert={stil} onAendern={waehleStil} />
      </div>
      <div id="farben" className="space-y-4">
        <Abschnittskopf titel={tx("Farben")} leise />
        <div className="space-y-3">
          <Abschnittskopf
            ebene="h3"
            titel={tx("Standardfarben")}
            info={tx("Die Palette dieser Ansicht, danach die anderen.")}
          />
          <div className="space-y-3">
            {palettenNachDesign(stil).map((gruppe) => (
              <section key={gruppe.stil} aria-label={tx(gruppe.label)} className="space-y-2">
                <p className="text-xs font-medium text-leise">{tx(gruppe.label)}</p>
                <div className="flex flex-wrap gap-2">
                  {gruppe.vorlagen.map((vorlage) => {
                    const aktiv = gleicheFarben(farben, vorlage);
                    return (
                      <button
                        key={vorlage.name}
                        type="button"
                        aria-pressed={aktiv}
                        onClick={() => sofort({ primaer: vorlage.primaer, akzent: vorlage.akzent, hintergrund: vorlage.hintergrund })}
                        className={`flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${aktiv ? 'border-akzent' : 'border-rand'}`}
                      >
                        <Farbpunkte farben={vorlage} />
                        {tx(vorlage.name)}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
        <div className="space-y-3 border-t border-rand pt-5">
          <Abschnittskopf
            ebene="h3"
            titel={tx("Eigene Paletten")}
            info={tx("Auswählen übernimmt die Farben. Anlegen und Löschen liegt unter Paletten.")}
          />
          {paletten.length === 0 ? (
            <Leer text={tx("Noch keine Palette.")} />
          ) : (
            <div className="flex flex-wrap gap-2" role="group" aria-label={tx("Eigene Paletten")}>
              {paletten.map((palette) => {
                const aktiv = gleicheFarben(farben, palette);
                return (
                  <button
                    key={palette.id}
                    type="button"
                    aria-pressed={aktiv}
                    onClick={() => sofort({ primaer: palette.primaer, akzent: palette.akzent, hintergrund: palette.hintergrund })}
                    className={`flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1 text-left text-xs break-words ${aktiv ? 'border-akzent' : 'border-rand'}`}
                  >
                    <Farbpunkte farben={palette} />
                    {palette.name}
                  </button>
                );
              })}
            </div>
          )}
          <ZeilenGruppe>
            <Zeile titel={tx("Paletten")} nach="/mehr/darstellung/paletten" />
          </ZeilenGruppe>
        </div>
        <div className="space-y-3 border-t border-rand pt-5">
          <Abschnittskopf
            ebene="h3"
            titel={tx("Eigene Farben")}
            info={tx("Nur für dich gespeichert. Zurücksetzen holt die Palette der Ansicht.")}
          />
          <Farbwahl label={tx("Primär")} wert={farben.primaer} onZiehen={(wert) => ziehe('primaer', wert)} onLoslassen={(wert) => loslassen('primaer', wert)} />
          <Farbwahl label={tx("Akzent")} wert={farben.akzent} onZiehen={(wert) => ziehe('akzent', wert)} onLoslassen={(wert) => loslassen('akzent', wert)} />
          <Farbwahl label={tx("Hintergrund")} wert={farben.hintergrund} onZiehen={(wert) => ziehe('hintergrund', wert)} onLoslassen={(wert) => loslassen('hintergrund', wert)} />
          <Knopf
            variante="leise"
            disabled={istStandard}
            onClick={() => {
              uebernehmen(farbAnfang({ primaer: soll.primaer, akzent: soll.akzent, hintergrund: soll.hintergrund }));
              onStandard();
            }}
          >
            {tx("Zurücksetzen")}
          </Knopf>
        </div>
      </div>
    </div>
  );
}

function Abschnittskopf({
  titel,
  info,
  ebene = 'h2',
  leise = false,
}: {
  titel: string;
  info?: string;
  ebene?: 'h2' | 'h3';
  leise?: boolean;
}) {
  const Tag = ebene;
  return (
    <div className="flex min-w-0 items-center">
      <Tag className={`min-w-0 text-sm font-medium text-balance break-words ${leise ? 'text-leise' : ''}`}>{titel}</Tag>
      {info ? <InfoHinweis text={info} /> : null}
    </div>
  );
}

function Farbwahl({
  label,
  wert,
  onZiehen,
  onLoslassen,
}: {
  label: string;
  wert: string;
  onZiehen: (farbe: string) => void;
  onLoslassen: (farbe: string) => void;
}) {
  const feld = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const element = feld.current;
    if (!element) {
      return;
    }
    const los = () => onLoslassen(element.value);
    element.addEventListener('change', los);
    return () => element.removeEventListener('change', los);
  }, [onLoslassen]);

  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <span className="zahl text-xs text-leise uppercase">{wert}</span>
        <input
          ref={feld}
          type="color"
          value={wert}
          onInput={(ereignis) => onZiehen(ereignis.currentTarget.value)}
          onChange={() => undefined}
          onBlur={(ereignis) => onLoslassen(ereignis.currentTarget.value)}
          className="size-9 cursor-pointer border border-rand bg-transparent p-0.5"
        />
      </span>
    </label>
  );
}

export function AnsichtSteuerung() {
  const { data, error, isPending, speichern } = useEinstellungen();
  if (isPending) {
    return <Ladeanzeige />;
  }
  if (error || !data) {
    return <Fehlermeldung fehler={error} />;
  }
  return (
    <>
      <AnsichtWahl
        stil={data.stil}
        farben={farbenDerAnsicht(data.stil, data.ansichtFarben)}
        gemerkt={data.ansichtFarben}
        paletten={data.paletten}
        glimmen={data.glimmen}
        onStil={(stil) => {
          const farben = farbenDerAnsicht(stil, data.ansichtFarben);
          void wendeStilAn(stil).then((bereit) => {
            if (bereit) {
              wendeErscheinung({ ...farben, glimmen: data.glimmen });
            }
          });
          speichern.mutate({ stil });
        }}
        onFarben={(farben) => speichern.mutate(farben)}
        onStandard={() => {
          const vorlage = standardVorlage(data.stil, systemDunkel());
          wendeErscheinung({
            primaer: vorlage.primaer,
            akzent: vorlage.akzent,
            hintergrund: vorlage.hintergrund,
            glimmen: data.glimmen,
          });
          speichern.mutate({ farbenZuruecksetzen: true });
        }}
      />
      <Fehlermeldung fehler={speichern.error} />
    </>
  );
}
