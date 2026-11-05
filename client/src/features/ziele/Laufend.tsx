import { tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import type { VorhabenMitProjekt } from '../../../../shared/api/index.ts';
import { zielTitel } from '../../../../shared/spiel/ebenen.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useSichtbarkeit } from '../../funktionen.ts';
import { useEintragOeffnen } from '../../components/Layout.tsx';
import { Liste, Zeile } from '../../components/Zeile.tsx';
import { BossRing } from '../bosse/BossRing.tsx';
import { Fehlermeldung, Knopf, Ladeanzeige, Leer, Ueberschrift } from '../../ui/index.ts';
import { bossZeile, VorhabenKennzahlen } from '../../components/VorhabenInfo.tsx';

export function LaufendSeite() {
  const sichtbarkeit = useSichtbarkeit();
  const bosseAn = istAn('bossAngriffe', sichtbarkeit);
  const projekteAn = istAn('projekte', sichtbarkeit);
  const { data: laufendes, error, isPending } = useQuery({ queryKey: SCHLUESSEL.laufendes, queryFn: api.laufendes });

  if (isPending) {
    return <Ladeanzeige />;
  }
  if (error) {
    return <Fehlermeldung fehler={error} />;
  }

  const bosse = bosseAn ? laufendes.bosse : [];
  const vorhaben = bosseAn ? laufendes.vorhaben : [...laufendes.bosse, ...laufendes.vorhaben];
  const leer = bosse.length === 0 && vorhaben.length === 0;

  return (
    <div className="space-y-6">
      {leer && <Leer text={tx('Nichts am Laufen.')} />}

      {bosse.length > 0 && (
        <section className="space-y-2">
          <Ueberschrift titel={tx('Bosse')} className="gruppen-kopf" />
          <Liste>
            {bosse.map((eintrag) => (
              <LaufendesVorhaben key={eintrag.id} vorhaben={eintrag} zeigeBoss projekteAn={projekteAn} />
            ))}
          </Liste>
        </section>
      )}

      {vorhaben.length > 0 && (
        <section className="space-y-2">
          <Ueberschrift titel={tx(zielTitel('vorhaben'))} className="gruppen-kopf" />
          <Liste>
            {vorhaben.map((eintrag) => (
              <LaufendesVorhaben key={eintrag.id} vorhaben={eintrag} zeigeBoss={false} projekteAn={projekteAn} />
            ))}
          </Liste>
        </section>
      )}
    </div>
  );
}

function LaufendesVorhaben({
  vorhaben,
  zeigeBoss,
  projekteAn,
}: {
  vorhaben: VorhabenMitProjekt;
  zeigeBoss: boolean;
  projekteAn: boolean;
}) {
  const eintragOeffnen = useEintragOeffnen();
  const boss = zeigeBoss ? vorhaben.boss : null;
  const weiter = () =>
    eintragOeffnen(
      projekteAn && vorhaben.projektId !== null
        ? { projektId: vorhaben.projektId, vorhabenId: vorhaben.id }
        : { vorhabenId: vorhaben.id },
    );
  const zumProjekt = projekteAn && vorhaben.projektId !== null ? `/projekte/${vorhaben.projektId}` : undefined;

  if (boss) {
    return (
      <div className="zeile flex min-h-12 items-center gap-3 px-4 py-3">
        <BossRing ring={boss.ring} erwacht={boss.phase === 'erwacht'} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base leading-6">{vorhaben.titel}</p>
          <p className="truncate text-[13px] leading-[18px] text-leise">{bossZeile(boss)}</p>
          {projekteAn && vorhaben.projektName ? (
            <p className="truncate text-[13px] leading-[18px] text-leise">{vorhaben.projektName}</p>
          ) : null}
          <VorhabenKennzahlen vorhaben={vorhaben} ohneXp />
        </div>
        <Knopf className="shrink-0" data-schnell-frei="" onClick={weiter}>
          {tx('Weiter')}
        </Knopf>
      </div>
    );
  }

  return (
    <Zeile
      typ="lesen"
      pfeil={false}
      nach={zumProjekt}
      name={vorhaben.titel}
      titel={vorhaben.titel}
      neben={projekteAn && vorhaben.projektName ? vorhaben.projektName : undefined}
      rechts={
        <Knopf className="shrink-0" data-schnell-frei="" onClick={weiter}>
          {tx('Weiter')}
        </Knopf>
      }
    />
  );
}
