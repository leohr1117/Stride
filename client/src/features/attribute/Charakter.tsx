import { klassenText, tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { Award, Shapes } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { Charakter, Erfolge, ErfolgKategorie, ErfolgStufe } from '../../../../shared/api/index.ts';
import { erfolgSichtbar, istAn, pfadAktiv, type Sichtbarkeit } from '../../../../shared/spiel/sichtbarkeit.ts';
import { SEITEN } from '../../../../shared/spiel/navigation.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { Liste, Zeile } from '../../components/Zeile.tsx';
import { KlassenUndTitel } from '../../components/KlassenTitel.tsx';
import { Fehlermeldung, Fortschrittsbalken, Karte, Ladeanzeige, LevelRing } from '../../ui/index.ts';
import { kurzesDatum, zahl } from '../../format.ts';
import { useSichtbarkeit } from '../../funktionen.ts';

type Ansicht = 'erfolge' | 'klassen' | null;

export function CharakterSeite() {
  const { data: charakter, error, isPending } = useQuery({ queryKey: SCHLUESSEL.charakter, queryFn: api.charakter });
  const { data: alleAttribute = [] } = useQuery({ queryKey: SCHLUESSEL.attribute, queryFn: api.attribute });
  const sichtbarkeit = useSichtbarkeit();
  const funktionen = sichtbarkeit.funktionen;
  const [ansicht, setAnsicht] = useState<Ansicht>(null);

  if (isPending) {
    return <Ladeanzeige />;
  }
  if (error) {
    return <Fehlermeldung fehler={error} />;
  }

  return (
    <div className="space-y-6">
      <Karte className="flex items-center gap-5">
        <LevelRing level={charakter.level.level} anteil={charakter.level.fortschritt} groesse={104} />
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
      </Karte>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Statistik label={tx("Einträge")} wert={charakter.statistik.eintraegeGesamt} />
        <Statistik label={tx("Meilensteine")} wert={charakter.statistik.meilensteine} />
        {istAn('vorhaben', sichtbarkeit) && (
          <Statistik label={tx("Kleine Ziele geschafft")} wert={charakter.statistik.vorhabenGeschafft} />
        )}
        <Statistik label={tx("Aktive Tage")} wert={charakter.statistik.aktiveTage} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ErfolgeKnopf onClick={() => setAnsicht('erfolge')} />
        <AnsichtKnopf
          icon={<Shapes className="size-4 text-akzent" />}
          label={funktionen.koennen ? tx("Klassen und Titel") : tx("Titel")}
          onClick={() => setAnsicht('klassen')}
        />
      </div>

      <ProfilZeilen charakter={charakter} />

      <Dialog
        offen={ansicht !== null}
        titel={ansicht === 'erfolge' ? tx("Erfolge") : funktionen.koennen ? tx("Klassen und Titel") : tx("Titel")}
        onSchliessen={() => setAnsicht(null)}
      >
        {ansicht === 'erfolge' && <ErfolgeListe />}
        {ansicht === 'klassen' && <KlassenUndTitel attribute={alleAttribute} klasse={charakter.klasse} />}
      </Dialog>
    </div>
  );
}

function sichtbareKategorien(erfolge: Erfolge | undefined, sichtbarkeit: Sichtbarkeit): ErfolgKategorie[] {
  return (erfolge?.kategorien ?? []).filter((kategorie) => erfolgSichtbar(kategorie.kennzahl, sichtbarkeit));
}

function freigeschalteteStufen(kategorien: ErfolgKategorie[]): ErfolgStufe[] {
  const stufen: ErfolgStufe[] = [];
  for (const kategorie of kategorien) {
    for (const stufe of kategorie.stufen) {
      if (stufe.erreichtAm !== null) {
        stufen.push(stufe);
      }
    }
  }
  return stufen;
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

function AnsichtKnopf({
  icon,
  label,
  wert,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  wert?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-rand bg-flaeche px-4 py-3 text-left transition hover:border-leise/50"
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </span>
      {wert && <span className="zahl text-sm text-leise">{wert}</span>}
    </button>
  );
}

function ErfolgeKnopf({ onClick }: { onClick: () => void }) {
  const sichtbarkeit = useSichtbarkeit();
  const { data: erfolge } = useQuery({ queryKey: SCHLUESSEL.erfolge, queryFn: api.erfolge });
  const kategorien = sichtbareKategorien(erfolge, sichtbarkeit);
  let gesamt = 0;
  for (const kategorie of kategorien) {
    gesamt += kategorie.stufen.length;
  }
  return (
    <AnsichtKnopf
      icon={<Award className="size-4 text-xp" />}
      label={tx("Erfolge")}
      wert={erfolge ? `${freigeschalteteStufen(kategorien).length} / ${gesamt}` : undefined}
      onClick={onClick}
    />
  );
}

function ErfolgeListe() {
  const sichtbarkeit = useSichtbarkeit();
  const { data: erfolge, error } = useQuery({ queryKey: SCHLUESSEL.erfolge, queryFn: api.erfolge });
  if (!erfolge) {
    return <Fehlermeldung fehler={error} />;
  }
  return (
    <div className="space-y-3">
      {sichtbareKategorien(erfolge, sichtbarkeit).map((kategorie) => (
        <ErfolgKarte key={kategorie.kennzahl} kategorie={kategorie} />
      ))}
    </div>
  );
}

function ErfolgKarte({ kategorie }: { kategorie: ErfolgKategorie }) {
  const naechste = kategorie.stufen.find((stufe) => stufe.erreichtAm === null);
  return (
    <div className="rounded-2xl border border-rand bg-flaeche p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 text-sm font-medium break-words">{tx(kategorie.label)}</h3>
        <span className="zahl text-xs text-leise">
          {zahl(Math.floor(kategorie.wert))}
          {naechste && ` / ${zahl(naechste.schwelle)}`}
        </span>
      </div>
      <div className="mt-2">
        <Fortschrittsbalken anteil={naechste ? kategorie.wert / naechste.schwelle : 1} farbe="var(--fortschritt)" hoehe="h-1.5" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {kategorie.stufen.map((stufe) => (
          <span
            key={stufe.schluessel}
            title={
              stufe.erreichtAm
                ? tx('Erreicht am {datum}', { datum: kurzesDatum(stufe.erreichtAm) })
                : tx('Ab {schwelle}', { schwelle: zahl(stufe.schwelle) })
            }
            className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
              stufe.erreichtAm ? 'bg-xp/15 font-medium text-xp' : 'bg-flaeche-2 text-leise'
            }`}
          >
            {stufe.erreichtAm && <Award className="size-3" />}
            {tx(stufe.name)}
          </span>
        ))}
      </div>
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

function Statistik({ label, wert }: { label: string; wert: number }) {
  return (
    <div className="rounded-2xl border border-rand bg-flaeche p-3">
      <p className="zahl text-xl font-bold">{zahl(wert)}</p>
      <p className="truncate text-xs text-leise">{label}</p>
    </div>
  );
}
