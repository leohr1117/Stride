import { tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { Swords } from 'lucide-react';
import { Link } from 'react-router';
import type { VorhabenMitProjekt } from '../../../../shared/api/index.ts';
import { zielTitel } from '../../../../shared/spiel/ebenen.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useSichtbarkeit } from '../../funktionen.ts';
import { Abschnitt, KurzListe } from '../../components/Ausklappbar.tsx';
import { useEintragOeffnen } from '../../components/Layout.tsx';
import { BossRing } from '../bosse/BossRing.tsx';
import { Fehlermeldung, Knopf, Ladeanzeige, Leer } from '../../ui/index.ts';
import { bossZeile, VorhabenKennzahlen } from '../../components/VorhabenInfo.tsx';

const BOSSE_SICHTBAR = 4;
const VORHABEN_SICHTBAR = 8;

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
      {leer && <Leer text={tx("Nichts am Laufen.")} />}

      {bosse.length > 0 && (
        <Abschnitt titel={tx("Bosse")} kennung="laufend-bosse">
          <KurzListe
            eintraege={bosse}
            anzahl={BOSSE_SICHTBAR}
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
            darstellen={(eintrag) => (
              <LaufendesVorhaben key={eintrag.id} vorhaben={eintrag} zeigeBoss projekteAn={projekteAn} />
            )}
          />
        </Abschnitt>
      )}

      {vorhaben.length > 0 && (
        <Abschnitt titel={zielTitel('vorhaben')} kennung="laufend-vorhaben">
          <KurzListe
            eintraege={vorhaben}
            anzahl={VORHABEN_SICHTBAR}
            className="space-y-2"
            darstellen={(eintrag) => (
              <LaufendesVorhaben key={eintrag.id} vorhaben={eintrag} zeigeBoss={false} projekteAn={projekteAn} />
            )}
          />
        </Abschnitt>
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

  return (
    <div className={`rounded-2xl border bg-flaeche px-4 py-3 ${boss ? 'border-gefahr/40' : 'border-rand'}`}>
      <div className="flex items-center gap-3">
        {boss && <BossRing ring={boss.ring} erwacht={boss.phase === 'erwacht'} />}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {boss && <Swords className="size-4 shrink-0 text-gefahr" />}
            <span className="truncate">{vorhaben.titel}</span>
          </p>
          {boss && <p className="truncate text-xs text-leise">{bossZeile(boss)}</p>}
          {projekteAn && vorhaben.projektId !== null && (
            <Link
              to={`/projekte/${vorhaben.projektId}`}
              className="flex items-center gap-1.5 text-xs text-leise hover:text-haupt"
            >
              <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: vorhaben.farbe }} />
              <span className="truncate">{vorhaben.projektName}</span>
            </Link>
          )}
          <VorhabenKennzahlen vorhaben={vorhaben} ohneXp={boss !== null} />
        </div>
        <Knopf
          className="shrink-0 px-3 py-1.5"
          onClick={() =>
            eintragOeffnen(
              projekteAn && vorhaben.projektId !== null
                ? { projektId: vorhaben.projektId, vorhabenId: vorhaben.id }
                : { vorhabenId: vorhaben.id },
            )
          }
        >
          {tx("Weiter")}
        </Knopf>
      </div>
    </div>
  );
}
