import { useQuery } from '@tanstack/react-query';
import { Flag, Landmark, Mountain, Target, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ebenenSperre, funktionsSperre } from '../../../../shared/spiel/abhaengigkeiten.ts';
import {
  hinweisAusblenden,
  setzeEbene,
  ZIEL_MARKE,
  type Ebene,
} from '../../../../shared/spiel/ebenen.ts';
import {
  BEREICH_GRUPPEN,
  BEREICH_SCHALTER,
  istFunktion,
  type BereichEintrag,
  type Funktion,
} from '../../../../shared/spiel/funktionen.ts';
import { investitionWegenRessourcen } from '../../../../shared/features/handbuch/handbuchPfad.ts';
import { toastZielFuer } from '../../../../shared/spiel/navigation.ts';
import { istAn, type Sichtbarkeit } from '../../../../shared/spiel/sichtbarkeit.ts';
import { BOSS_SCHALTER } from '../../../../shared/spiel/xp.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useBestaetigung } from '../../components/Bestaetigung.tsx';
import { Toast } from '../../components/Toast.tsx';
import { Fehlermeldung, InfoHinweis, Ladeanzeige } from '../../ui/index.ts';
import { ZeileSchalter, ZeilenGruppe } from '../../components/Zeile.tsx';
import { FUNKTION_BILD } from '../../funktionsBild.tsx';
import { bestaetigeAusblenden } from '../../ebenenFrage.ts';
import { tx } from '../../text.ts';
import { Bereich, useEinstellungen, useSprungmarke } from './rahmen.tsx';

const FUNKTION_INFO: Partial<Record<Funktion, string>> = {
  basis: 'Tägliche Aufgaben zum Abhaken.',
  bossAngriffe: BOSS_SCHALTER,
  verfallKoennen: 'Ungenutzte Können-Attribute verlieren XP. Wie stark, stellst du pro Attribut ein.',
  verfallHaben: 'Ungenutzte Haben-Attribute verlieren XP. Wie stark, stellst du pro Attribut ein.',
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
  ressourcenAn: boolean,
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
      untertitel: sperre ? tx(sperre) : schalter === 'ausruestung' && ressourcenAn ? tx('Empfohlen bei Ressourcen') : undefined,
      info: FUNKTION_INFO[schalter],
    };
  }
  const schalter = eintrag.schalter;
  const sperre = ebenenSperre(schalter, einstellungen.ebenen);
  return {
    sperre,
    Icon: EBENEN_ICON[schalter],
    an: einstellungen.ebenen[schalter],
    untertitel: sperre ? tx(sperre) : tx(ZIEL_MARKE[schalter].kuerzel),
    info: undefined,
  };
}

export function MehrFunktionenSeite() {
  const { data: einstellungen, error, isPending, speichern } = useEinstellungen();
  const { data: attribute = [] } = useQuery({
    queryKey: SCHLUESSEL.attribute,
    queryFn: api.attribute,
    enabled: Boolean(einstellungen?.funktionen.status),
  });
  const ressourcenAn = investitionWegenRessourcen(Boolean(einstellungen?.funktionen.status), attribute);
  const navigiere = useNavigate();
  const bestaetigen = useBestaetigung();
  const [meldung, setMeldung] = useState<{ name: string; ziel: string } | null>(null);
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

  return (
    <Bereich
      titel={tx('Bereiche')}
      kinder={
        <div className="space-y-8">
          <div className="inline-flex items-center">
            <h2 className="text-lg font-semibold">{tx('Funktionen')}</h2>
            <InfoHinweis text="Hier schaltest du Bereiche der App ein und aus. Ausgeblendetes bleibt gespeichert." />
          </div>
          <div className="space-y-6">
            {BEREICH_GRUPPEN.map((gruppe) => (
              <div
                key={gruppe}
                id={gruppe === 'Auf Ziele' ? 'ziel-stufen' : undefined}
                className={gruppe === 'Auf Ziele' ? 'scroll-mt-24' : undefined}
              >
                <ZeilenGruppe titel={gruppe}>
                  {BEREICH_SCHALTER.filter((eintrag) => eintrag.gruppe === gruppe).map((eintrag) => {
                    const felder = zeileFelder(eintrag, einstellungen, ressourcenAn);
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
