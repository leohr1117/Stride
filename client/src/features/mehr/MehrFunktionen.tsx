import { Flag, Landmark, Lightbulb, Mountain, Target, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ebenenSperre, funktionsSperre } from '../../../../shared/spiel/abhaengigkeiten.ts';
import { hinweisAusblenden, setzeEbene, type Ebene } from '../../../../shared/spiel/ebenen.ts';
import {
  BEREICH_GRUPPEN,
  BEREICH_SCHALTER,
  istFunktion,
  type BereichEintrag,
  type Funktion,
} from '../../../../shared/spiel/funktionen.ts';
import { toastZielFuer } from '../../../../shared/spiel/navigation.ts';
import { istAn, type Sichtbarkeit } from '../../../../shared/spiel/sichtbarkeit.ts';
import { BOSS_SCHALTER } from '../../../../shared/spiel/xp.ts';
import { useBestaetigung } from '../../components/Bestaetigung.tsx';
import { Toast } from '../../components/Toast.tsx';
import { Fehlermeldung, Ladeanzeige } from '../../ui/index.ts';
import { ZeileSchalter, ZeilenGruppe } from '../../components/Zeile.tsx';
import { FUNKTION_BILD } from '../../funktionsBild.tsx';
import { bestaetigeAusblenden } from '../../ebenenFrage.ts';
import { leseMerker, merke } from '../../speicher.ts';
import { tx } from '../../text.ts';
import { Bereich, useEinstellungen, useSprungmarke } from './rahmen.tsx';

const GERAETE_SCHALTER = [
  {
    schalter: 'hinweise',
    label: 'Hinweise auf Heute',
    untertitel: 'Gilt nur auf diesem Gerät.',
    gruppe: 'Funktionen',
    icon: Lightbulb,
  },
] as const;

const VERFALL_INFO = 'Attribute ohne Einträge verlieren mit der Zeit XP. Wie stark, stellst du pro Attribut ein.';

const FUNKTION_INFO: Partial<Record<Funktion, string>> = {
  basis: 'Tägliche Aufgaben zum Abhaken.',
  bossAngriffe: BOSS_SCHALTER,
  verfallKoennen: VERFALL_INFO,
  verfallHaben: VERFALL_INFO,
};

const EBENEN_ICON: Record<Ebene, LucideIcon> = {
  visionen: Mountain,
  projekte: Flag,
  vorhaben: Target,
  organisationen: Landmark,
};

function zeilenId(eintrag: BereichEintrag): string {
  return istFunktion(eintrag.schalter) ? `funktion-${eintrag.schalter}` : `ziel-${eintrag.schalter}`;
}

function zeileFelder(
  eintrag: BereichEintrag,
  einstellungen: Sichtbarkeit,
): {
  sperre: string | null;
  Icon: LucideIcon;
  an: boolean;
  untertitel: string | undefined;
  info: string | undefined;
} {
  if (istFunktion(eintrag.schalter)) {
    const schalter = eintrag.schalter;
    const sperre = funktionsSperre(schalter, einstellungen.funktionen, einstellungen.ebenen, einstellungen.attribute);
    return {
      sperre,
      Icon: FUNKTION_BILD[schalter].icon,
      an: istAn(schalter, einstellungen),
      untertitel: sperre ? tx(sperre) : eintrag.untertitel ? tx(eintrag.untertitel) : undefined,
      info: sperre ? undefined : FUNKTION_INFO[schalter],
    };
  }
  const schalter = eintrag.schalter;
  const sperre = ebenenSperre(schalter, einstellungen.ebenen);
  return {
    sperre,
    Icon: EBENEN_ICON[schalter],
    an: einstellungen.ebenen[schalter],
    untertitel: sperre ? tx(sperre) : eintrag.untertitel ? tx(eintrag.untertitel) : undefined,
    info: undefined,
  };
}

export function MehrFunktionenSeite() {
  const { data: einstellungen, error, isPending, speichern } = useEinstellungen();
  const navigiere = useNavigate();
  const bestaetigen = useBestaetigung();
  const [meldung, setMeldung] = useState<{ name: string; ziel: string } | null>(null);
  const [hinweiseAn, setHinweiseAn] = useState(() => !leseMerker('stride.hinweiseAus'));
  useSprungmarke(!isPending && Boolean(einstellungen));

  if (isPending) {
    return <Bereich titel={tx('Bereiche')} kinder={<Ladeanzeige />} />;
  }
  if (error || !einstellungen) {
    return <Bereich titel={tx('Bereiche')} kinder={<Fehlermeldung fehler={error} />} />;
  }

  const zeigeToast = (eintrag: BereichEintrag, an: boolean) => {
    if (an) {
      setMeldung({ name: eintrag.label, ziel: toastZielFuer(eintrag.schalter) });
    } else {
      setMeldung(null);
    }
  };

  const schalteFunktion = (eintrag: BereichEintrag, an: boolean) => {
    if (!istFunktion(eintrag.schalter)) {
      return;
    }
    const funktion = eintrag.schalter;
    speichern.mutate(
      { funktionen: { ...einstellungen.funktionen, [funktion]: an } },
      { onSuccess: () => zeigeToast(eintrag, an) },
    );
  };

  const schalteEbene = async (eintrag: BereichEintrag, an: boolean) => {
    if (istFunktion(eintrag.schalter)) {
      return;
    }
    const nachher = setzeEbene(einstellungen.ebenen, eintrag.schalter, an);
    const hinweis = hinweisAusblenden(einstellungen.ebenen, nachher, einstellungen.ebenenZahlen);
    if (!(await bestaetigeAusblenden(bestaetigen, hinweis))) {
      return;
    }
    speichern.mutate({ ebenen: nachher }, { onSuccess: () => zeigeToast(eintrag, an) });
  };

  const schalteHinweise = (an: boolean) => {
    merke('stride.hinweiseAus', !an);
    setHinweiseAn(an);
    if (an) {
      setMeldung({ name: 'Hinweise auf Heute', ziel: '/' });
    } else {
      setMeldung(null);
    }
  };

  return (
    <Bereich
      titel={tx('Bereiche')}
      kinder={
        <div className="space-y-6">
          <p className="text-[13px] leading-5 text-leise break-words">{tx('Ausschalten blendet aus. Gelöscht wird nichts.')}</p>
          <div className="space-y-6">
            {BEREICH_GRUPPEN.map((gruppe) => (
              <div
                key={gruppe}
                id={gruppe === 'Auf Ziele' ? 'ziel-stufen' : undefined}
                className={gruppe === 'Auf Ziele' ? 'scroll-mt-24' : undefined}
              >
                <ZeilenGruppe titel={gruppe}>
                  {BEREICH_SCHALTER.filter((eintrag) => eintrag.gruppe === gruppe).map((eintrag) => {
                    const felder = zeileFelder(eintrag, einstellungen);
                    const Icon = felder.Icon;
                    return (
                      <ZeileSchalter
                        key={eintrag.schalter}
                        id={zeilenId(eintrag)}
                        className="scroll-mt-24"
                        titel={tx(eintrag.label)}
                        untertitel={felder.untertitel}
                        symbol={<Icon className="size-5" aria-hidden />}
                        info={felder.info}
                        an={felder.an}
                        onAendern={(wert) => {
                          if (istFunktion(eintrag.schalter)) {
                            schalteFunktion(eintrag, wert);
                          } else {
                            void schalteEbene(eintrag, wert);
                          }
                        }}
                        deaktiviert={felder.sperre !== null}
                      />
                    );
                  })}
                  {GERAETE_SCHALTER.filter((eintrag) => eintrag.gruppe === gruppe).map((eintrag) => {
                    const Icon = eintrag.icon;
                    return (
                      <ZeileSchalter
                        key={eintrag.schalter}
                        id={`geraet-${eintrag.schalter}`}
                        className="scroll-mt-24"
                        titel={tx(eintrag.label)}
                        untertitel={tx(eintrag.untertitel)}
                        symbol={<Icon className="size-5" aria-hidden />}
                        an={hinweiseAn}
                        onAendern={schalteHinweise}
                      />
                    );
                  })}
                </ZeilenGruppe>
              </div>
            ))}
          </div>
          <Fehlermeldung fehler={speichern.error} />
          {meldung ? (
            <Toast
              key={`${meldung.name}-${meldung.ziel}`}
              text={tx('{name} an', { name: tx(meldung.name) })}
              rolle="status"
              aktion={() => {
                const ziel = meldung.ziel;
                setMeldung(null);
                void navigiere(ziel);
              }}
              aktionLabel="Öffnen"
              onEnde={() => setMeldung(null)}
            />
          ) : null}
        </div>
      }
    />
  );
}
