import { tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { VorhabenMitProjekt } from '../../../../shared/api/index.ts';
import { zielTitel } from '../../../../shared/spiel/ebenen.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useSichtbarkeit } from '../../funktionen.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { useEintragOeffnen } from '../../components/Layout.tsx';
import { Liste, Zeile } from '../../components/Zeile.tsx';
import { BossFormular } from '../bosse/BossFormular.tsx';
import { BossRing } from '../bosse/BossRing.tsx';
import { Fehlermeldung, Knopf, Ladeanzeige, Leer, Ueberschrift } from '../../ui/index.ts';


export function LaufendSeite() {
  const sichtbarkeit = useSichtbarkeit();
  const bosseAn = istAn('bossAngriffe', sichtbarkeit);
  const projekteAn = istAn('projekte', sichtbarkeit);
  const { data: laufendes, error, isPending } = useQuery({ queryKey: SCHLUESSEL.laufendes, queryFn: api.laufendes });
  const [bossBlatt, setBossBlatt] = useState<VorhabenMitProjekt | null>(null);

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
    <div className="laufend-seite space-y-6">
      {leer && <Leer text={tx('Nichts am Laufen.')} />}

      {bosse.length > 0 && (
        <section className="space-y-2">
          <Ueberschrift titel={tx('Bosse')} className="gruppen-kopf" />
          <Liste className="symbol-liste">
            {bosse.map((eintrag) => (
              <LaufendesVorhaben
                key={eintrag.id}
                vorhaben={eintrag}
                zeigeBoss
                projekteAn={projekteAn}
                onBoss={() => setBossBlatt(eintrag)}
              />
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
      <Dialog offen={bossBlatt !== null} titel={tx('Boss')} onSchliessen={() => setBossBlatt(null)}>
        {bossBlatt && (
          <BossFormular
            key={bossBlatt.id}
            vorhaben={bossBlatt}
            projektName={bossBlatt.projektName}
            onFertig={() => setBossBlatt(null)}
          />
        )}
      </Dialog>
    </div>
  );
}

function LaufendesVorhaben({
  vorhaben,
  zeigeBoss,
  projekteAn,
  onBoss,
}: {
  vorhaben: VorhabenMitProjekt;
  zeigeBoss: boolean;
  projekteAn: boolean;
  onBoss?: () => void;
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
      <div className="zeile symbol-zeile relative flex min-h-16 items-center gap-3 px-4 py-3">
        <button type="button" className="absolute inset-0 z-0" aria-label={vorhaben.titel} onClick={onBoss} />
        <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-3">
          <BossRing ring={boss.ring} erwacht={boss.phase === 'erwacht'} />
          <div className="zeilen-text min-w-0 flex-1">
            <p className="truncate text-base leading-6 font-medium">{vorhaben.titel}</p>
          </div>
        </div>
        <Knopf variante="text" className="relative z-10 -my-1 shrink-0" data-schnell-frei="" onClick={weiter}>
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
        <Knopf variante="text" className="-my-1 shrink-0" data-schnell-frei="" onClick={weiter}>
          {tx('Weiter')}
        </Knopf>
      }
    />
  );
}
