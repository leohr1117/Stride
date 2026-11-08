import { klassenText, tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import type { Charakter } from '../../../../shared/api/index.ts';
import type { AttributTyp } from '../../../../shared/spiel/begriffe.ts';
import { istAn, pfadAktiv } from '../../../../shared/spiel/sichtbarkeit.ts';
import { SEITEN } from '../../../../shared/spiel/navigation.ts';
import { MIN_RADAR_ACHSEN } from '../../../../shared/spiel/radar.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { ProfilBild } from '../../components/ProfilBild.tsx';
import { KopfAktion } from '../../components/Kopf.tsx';
import { Liste, Zeile } from '../../components/Zeile.tsx';
import { KlassenUndTitel } from '../../components/KlassenTitel.tsx';
import { AttributRadar } from '../../components/mitDiagramm.tsx';
import { Fehlermeldung, Ladeanzeige, LevelRing } from '../../ui/index.ts';
import { zahl } from '../../format.ts';
import { useSichtbarkeit } from '../../funktionen.ts';

export function CharakterSeite() {
  const { data: charakter, error, isPending } = useQuery({ queryKey: SCHLUESSEL.charakter, queryFn: api.charakter });
  const { data: alleAttribute = [] } = useQuery({ queryKey: SCHLUESSEL.attribute, queryFn: api.attribute });
  const sichtbarkeit = useSichtbarkeit();
  const funktionen = sichtbarkeit.funktionen;
  const [klassenOffen, setKlassenOffen] = useState(false);

  if (isPending) {
    return <Ladeanzeige />;
  }
  if (error) {
    return <Fehlermeldung fehler={error} />;
  }

  const klassenName = funktionen.koennen ? tx("Klassen und Titel") : tx("Titel");

  return (
    <div className="space-y-6">
      <KopfAktion>
        <Link
          to="/mehr/profil"
          aria-label={tx("Profil bearbeiten")}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-leise hover:bg-flaeche-2 hover:text-haupt"
        >
          <Pencil className="size-5" aria-hidden="true" />
        </Link>
      </KopfAktion>
      <div className="flex items-start gap-5">
        <LevelRing
          level={charakter.level.level}
          anteil={charakter.level.fortschritt}
          groesse={104}
          mitte={<ProfilBild klasse={charakter.klasse} groesse="size-16" />}
        />
        <div className="min-w-0 flex-1">
          <p className="kopfblock-name truncate text-2xl font-bold tracking-tight">{charakter.name}</p>
          <Identitaet klasse={charakter.klasse} titel={charakter.titel} />
          <p className="zahl text-sm text-leise break-words">
            {tx('{xp} XP · noch {rest} bis Level {level}', {
              xp: zahl(charakter.level.xpGesamt),
              rest: zahl(charakter.level.xpFuerNaechstes - charakter.level.xpImLevel),
              level: charakter.level.level + 1,
            })}
          </p>
        </div>
      </div>

      <Kennzahlen charakter={charakter} />
      <Spektren charakter={charakter} />

      <Liste>
        <Zeile titel={klassenName} name={klassenName} onKlick={() => setKlassenOffen(true)} />
      </Liste>

      <ProfilZeilen charakter={charakter} />

      <Dialog offen={klassenOffen} titel={klassenName} onSchliessen={() => setKlassenOffen(false)}>
        <KlassenUndTitel attribute={alleAttribute} klasse={charakter.klasse} />
      </Dialog>
    </div>
  );
}

function Identitaet({ klasse, titel }: { klasse: string; titel: string | null }) {
  const sichtbarkeit = useSichtbarkeit();
  const klasseSichtbar = istAn('koennen', sichtbarkeit);
  if (!klasseSichtbar && !titel) {
    return null;
  }
  const klasseAnzeige = klassenText(klasse);
  const text = klasseSichtbar && titel ? `${klasseAnzeige} · ${titel}` : klasseSichtbar ? klasseAnzeige : titel;
  return <p className="mt-0.5 text-sm font-medium break-words text-akzent">{text}</p>;
}

function Kennzahlen({ charakter }: { charakter: Charakter }) {
  const sichtbarkeit = useSichtbarkeit();
  const werte = [
    { label: tx("Einträge"), wert: charakter.statistik.eintraegeGesamt },
    { label: tx("Meilensteine"), wert: charakter.statistik.meilensteine },
    ...(istAn('vorhaben', sichtbarkeit)
      ? [{ label: tx("Kleine Ziele geschafft"), wert: charakter.statistik.vorhabenGeschafft }]
      : []),
    { label: tx("Aktive Tage"), wert: charakter.statistik.aktiveTage },
  ];
  return (
    <div className="flex" data-kennzahlen="">
      {werte.map((eintrag) => (
        <div key={eintrag.label} className="min-w-0 flex-1 border-e border-rand px-2 py-1 last:border-e-0">
          <p className="zahl text-lg font-bold">{zahl(eintrag.wert)}</p>
          <p className="text-[11px] leading-tight text-leise">{eintrag.label}</p>
        </div>
      ))}
    </div>
  );
}

function Spektren({ charakter }: { charakter: Charakter }) {
  const sichtbarkeit = useSichtbarkeit();
  const kandidaten: { typ: AttributTyp; name: string; werte: Charakter['attribute'] }[] = [];
  if (istAn('koennen', sichtbarkeit)) {
    kandidaten.push({ typ: 'attribut', name: 'Können', werte: charakter.attribute });
  }
  if (istAn('status', sichtbarkeit)) {
    kandidaten.push({ typ: 'status', name: 'Haben', werte: charakter.status });
  }
  const bloecke = kandidaten.filter((eintrag) => eintrag.werte.length >= MIN_RADAR_ACHSEN);
  if (bloecke.length === 0) {
    return null;
  }
  return (
    <div className={`grid w-full min-w-0 gap-3 ${bloecke.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`} data-spektren="">
      {bloecke.map((eintrag) => (
        <div key={eintrag.typ} className="min-w-0">
          <p className="mb-1 text-center text-[13px] leading-[18px] font-semibold text-leise">{tx(eintrag.name)}</p>
          <AttributRadar typ={eintrag.typ} werte={eintrag.werte} kompakt />
        </div>
      ))}
    </div>
  );
}

function ProfilZeilen({ charakter }: { charakter: Charakter }) {
  const sichtbarkeit = useSichtbarkeit();
  const faehigkeitenAn = pfadAktiv('/faehigkeiten', sichtbarkeit);
  const investitionenAn = pfadAktiv('/investitionen', sichtbarkeit);
  const { data: faehigkeiten = [] } = useQuery({
    queryKey: SCHLUESSEL.faehigkeiten,
    queryFn: api.faehigkeiten,
    enabled: faehigkeitenAn,
  });
  const { data: investitionen = [] } = useQuery({
    queryKey: SCHLUESSEL.investitionen,
    queryFn: api.investitionen,
    enabled: investitionenAn,
  });
  const zahlen = new Map<string, number>([
    ['/koennen', charakter.attribute.length],
    ['/haben', charakter.status.length],
    ['/faehigkeiten', faehigkeiten.filter((eintrag) => !eintrag.archiviert).length],
    ['/investitionen', investitionen.filter((eintrag) => !eintrag.archiviert).length],
  ]);
  const seiten = SEITEN.filter((seite) => seite.profilzeile && pfadAktiv(seite.pfad, sichtbarkeit));
  if (seiten.length === 0) {
    return null;
  }
  return (
    <Liste>
      {seiten.map((seite) => (
        <Zeile key={seite.pfad} nach={seite.pfad} titel={tx(seite.name)} name={tx(seite.name)} wert={zahl(zahlen.get(seite.pfad) ?? 0)} />
      ))}
    </Liste>
  );
}


