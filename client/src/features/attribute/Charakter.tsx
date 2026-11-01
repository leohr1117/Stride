import { klassenText, tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { Award, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import type { Charakter, Erfolge, ErfolgKategorie, ErfolgStufe } from '../../../../shared/api/index.ts';
import type { AttributTyp } from '../../../../shared/spiel/begriffe.ts';
import { erfolgSichtbar, istAn, pfadAktiv, type Sichtbarkeit } from '../../../../shared/spiel/sichtbarkeit.ts';
import { SEITEN } from '../../../../shared/spiel/navigation.ts';
import { MIN_RADAR_ACHSEN } from '../../../../shared/spiel/radar.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { KopfAktion } from '../../components/Kopf.tsx';
import { Liste, Zeile } from '../../components/Zeile.tsx';
import { KlassenUndTitel } from '../../components/KlassenTitel.tsx';
import { AttributRadar } from '../../components/mitDiagramm.tsx';
import { Fehlermeldung, Fortschrittsbalken, Ladeanzeige, LevelRing } from '../../ui/index.ts';
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
      <div className="flex items-center gap-5">
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
      </div>

      <Kennzahlen charakter={charakter} />
      <Spektren charakter={charakter} />

      <Liste>
        <ErfolgeZeile onClick={() => setAnsicht('erfolge')} />
        <Zeile titel={klassenName} name={klassenName} onKlick={() => setAnsicht('klassen')} />
      </Liste>

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

function ErfolgeZeile({ onClick }: { onClick: () => void }) {
  const sichtbarkeit = useSichtbarkeit();
  const { data: erfolge } = useQuery({ queryKey: SCHLUESSEL.erfolge, queryFn: api.erfolge });
  const kategorien = sichtbareKategorien(erfolge, sichtbarkeit);
  let gesamt = 0;
  for (const kategorie of kategorien) {
    gesamt += kategorie.stufen.length;
  }
  const stand = erfolge ? `${freigeschalteteStufen(kategorien).length}/${gesamt}` : undefined;
  return <Zeile titel={tx("Erfolge")} name={tx("Erfolge")} wert={stand} onKlick={onClick} />;
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
    <div className="flex w-full min-w-0 max-w-full gap-3 overflow-x-auto overscroll-x-contain" data-spektren="">
      {bloecke.map((eintrag) => (
        <div key={eintrag.typ} className="min-w-[168px] flex-1">
          <p className="mb-1 text-center text-[13px] leading-[18px] font-semibold text-leise">{tx(eintrag.name)}</p>
          <AttributRadar typ={eintrag.typ} werte={eintrag.werte} kompakt />
        </div>
      ))}
    </div>
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


