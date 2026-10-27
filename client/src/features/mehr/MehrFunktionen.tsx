import { useQuery } from '@tanstack/react-query';
import { funktionsSperre } from '../../../../shared/spiel/abhaengigkeiten.ts';
import { FUNKTION_BLOECKE, type Funktion } from '../../../../shared/spiel/funktionen.ts';
import { investitionWegenRessourcen } from '../../../../shared/features/handbuch/handbuchPfad.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { BOSS_SCHALTER } from '../../../../shared/spiel/xp.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { EbenenWahl } from '../../components/EbenenWahl.tsx';
import { Fehlermeldung, Ladeanzeige } from '../../ui/index.ts';
import { ZeileSchalter, ZeilenGruppe } from '../../components/Zeile.tsx';
import { FUNKTION_BILD } from '../../funktionsBild.tsx';
import { tx } from '../../text.ts';
import { Bereich, useEinstellungen, useSprungmarke } from './rahmen.tsx';

const FUNKTION_INFO: Partial<Record<Funktion, string>> = {
  basis: 'Tägliche Aufgaben zum Abhaken.',
  training: 'Eine Einheit ist ein Eintrag. Aufwärmen zählt nicht zum Bestwert.',
  bossAngriffe: BOSS_SCHALTER,
  verfallKoennen: 'Ungenutzte Können-Attribute verlieren XP. Wie stark, stellst du pro Attribut ein.',
  verfallHaben: 'Ungenutzte Haben-Attribute verlieren XP. Wie stark, stellst du pro Attribut ein.',
};

function hinweisText(...teile: Array<string | null | undefined>): string | undefined {
  const texte = teile.filter((teil): teil is string => Boolean(teil));
  return texte.length > 0 ? texte.join(' ') : undefined;
}

export function MehrFunktionenSeite() {
  const { data: einstellungen, error, isPending, speichern } = useEinstellungen();
  const { data: attribute = [] } = useQuery({
    queryKey: SCHLUESSEL.attribute,
    queryFn: api.attribute,
    enabled: Boolean(einstellungen?.funktionen.status),
  });
  const ressourcenAn = investitionWegenRessourcen(Boolean(einstellungen?.funktionen.status), attribute);
  useSprungmarke(!isPending && Boolean(einstellungen));

  if (isPending) {
    return <Bereich titel={tx("Funktionen")} kinder={<Ladeanzeige />} />;
  }
  if (error || !einstellungen) {
    return <Bereich titel={tx("Funktionen")} kinder={<Fehlermeldung fehler={error} />} />;
  }

  return (
    <Bereich
      titel={tx("Funktionen")}
      kinder={
        <div className="space-y-8">
          <div className="space-y-6">
            {FUNKTION_BLOECKE.map((block) => (
              <ZeilenGruppe key={block.seite} titel={block.seite}>
                {block.eintraege.map(({ funktion, label, ort }) => {
                  const sperre = funktionsSperre(
                    funktion,
                    einstellungen.funktionen,
                    einstellungen.ebenen,
                    einstellungen.attribute,
                  );
                  const Icon = FUNKTION_BILD[funktion].icon;
                  return (
                    <ZeileSchalter
                      key={funktion}
                      id={`funktion-${funktion}`}
                      className="scroll-mt-24"
                      titel={tx(label)}
                      untertitel={funktion === 'ausruestung' && ressourcenAn ? tx("Empfohlen bei Ressourcen") : undefined}
                      symbol={<Icon className="size-5" aria-hidden />}
                      info={hinweisText(sperre, FUNKTION_INFO[funktion], ort)}
                      an={istAn(funktion, einstellungen)}
                      onAendern={(an) => speichern.mutate({ funktionen: { ...einstellungen.funktionen, [funktion]: an } })}
                      deaktiviert={sperre !== null}
                    />
                  );
                })}
              </ZeilenGruppe>
            ))}
          </div>
          <EbenenWahl />
          <Fehlermeldung fehler={speichern.error} />
        </div>
      }
    />
  );
}
