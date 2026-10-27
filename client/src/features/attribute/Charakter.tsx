import { attributName, klassenText, tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { Archive, Award, Plus, Shapes } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Attribut, Erfolge, ErfolgKategorie, ErfolgStufe } from '../../../../shared/api/index.ts';
import { ATTRIBUT_TYP_INFO, NEUTRAL_FARBE, type AttributKennung, type AttributTyp } from '../../../../shared/spiel/begriffe.ts';
import { istTypAktiv } from '../../../../shared/spiel/funktionen.ts';
import { erfolgSichtbar, istAn, type Sichtbarkeit } from '../../../../shared/spiel/sichtbarkeit.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { Abschnitt, KurzListe } from '../../components/Ausklappbar.tsx';
import { AttributBereich, AttributFormular, AttributKatalog } from './AttributVerwaltung.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { FaehigkeitFormular } from '../../components/FaehigkeitFormular.tsx';
import { SchnellZeile } from '../../components/SchnellAktion.tsx';
import { Icon } from '../../components/Icons.tsx';
import { InvestitionenBereich } from '../investitionen/Investitionen.tsx';
import { KlassenUndTitel } from '../../components/KlassenTitel.tsx';
import { archivBeschriftung, Fehlermeldung, Fortschrittsbalken, Karte, Knopf, Ladeanzeige, LevelRing } from '../../ui/index.ts';
import { kurzesDatum, zahl } from '../../format.ts';
import { useSichtbarkeit } from '../../funktionen.ts';

const KARTEN_SICHTBAR = 4;

type Bearbeitung =
  | { art: 'bearbeiten'; attribut: Attribut }
  | { art: 'katalog'; typ: AttributTyp; vorauswahl?: AttributKennung }
  | null;

type Ansicht = 'erfolge' | 'klassen' | null;

function dialogTitel(bearbeitung: Bearbeitung): string {
  if (bearbeitung?.art === 'bearbeiten') {
    return tx('{name} bearbeiten', { name: attributName(bearbeitung.attribut) });
  }
  return bearbeitung?.typ === 'status' ? tx('Haben hinzufügen') : tx('Können hinzufügen');
}

export function CharakterSeite() {
  const { data: charakter, error, isPending } = useQuery({ queryKey: SCHLUESSEL.charakter, queryFn: api.charakter });
  const { data: alleAttribute = [] } = useQuery({ queryKey: SCHLUESSEL.attribute, queryFn: api.attribute });
  const sichtbarkeit = useSichtbarkeit();
  const funktionen = sichtbarkeit.funktionen;
  const [bearbeitung, setBearbeitung] = useState<Bearbeitung>(null);
  const [ansicht, setAnsicht] = useState<Ansicht>(null);

  if (isPending) {
    return <Ladeanzeige />;
  }
  if (error) {
    return <Fehlermeldung fehler={error} />;
  }
  const aktiveAttribute = [...charakter.attribute, ...charakter.status];
  const istArchivierbar = (attribut: Attribut) => {
    const aktive = attribut.typ === 'status' ? charakter.status : charakter.attribute;
    return aktive.length > 1;
  };

  return (
    <div className="space-y-6">
      <Karte className="flex items-center gap-5">
        <LevelRing level={charakter.level.level} anteil={charakter.level.fortschritt} groesse={104} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight">{charakter.name}</h1>
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

      {funktionen.koennen && (
        <AttributBereich
          typ="attribut"
          werte={charakter.attribute}
          erschoepfungen={charakter.erschoepfungen}
          onNeu={() => setBearbeitung({ art: 'katalog', typ: 'attribut' })}
          onBearbeiten={(attribut) => setBearbeitung({ art: 'bearbeiten', attribut })}
        />
      )}
      {funktionen.status && (
        <AttributBereich
          typ="status"
          werte={charakter.status}
          erschoepfungen={charakter.erschoepfungen}
          onNeu={() => setBearbeitung({ art: 'katalog', typ: 'status' })}
          onBearbeiten={(attribut) => setBearbeitung({ art: 'bearbeiten', attribut })}
        />
      )}

      {funktionen.faehigkeiten && <Faehigkeiten />}

      {istAn('ausruestung', sichtbarkeit) && (
        <InvestitionenBereich />
      )}

      <Archiv
        onAttributWiederherstellen={(attribut) =>
          attribut.kennung !== null && setBearbeitung({ art: 'katalog', typ: attribut.typ, vorauswahl: attribut.kennung })
        }
      />

      <Dialog offen={bearbeitung !== null} titel={dialogTitel(bearbeitung)} onSchliessen={() => setBearbeitung(null)}>
        {bearbeitung?.art === 'bearbeiten' && (
          <AttributFormular
            key={bearbeitung.attribut.id}
            attribut={bearbeitung.attribut}
            archivierbar={istArchivierbar(bearbeitung.attribut)}
            andere={aktiveAttribute.filter(
              (attribut) => attribut.id !== bearbeitung.attribut.id && istTypAktiv(funktionen, attribut.typ),
            )}
            onFertig={() => setBearbeitung(null)}
          />
        )}
        {bearbeitung?.art === 'katalog' && (
          <AttributKatalog
            key={`${bearbeitung.typ}-${bearbeitung.vorauswahl ?? ''}`}
            typ={bearbeitung.typ}
            attribute={alleAttribute}
            vorauswahl={bearbeitung.vorauswahl}
            onFertig={() => setBearbeitung(null)}
          />
        )}
      </Dialog>

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
        <Fortschrittsbalken anteil={naechste ? kategorie.wert / naechste.schwelle : 1} farbe="var(--xp)" hoehe="h-1.5" />
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

function Faehigkeiten() {
  const { data: faehigkeiten = [], error } = useQuery({ queryKey: SCHLUESSEL.faehigkeiten, queryFn: api.faehigkeiten });
  const [neuOffen, setNeuOffen] = useState(false);
  const navigieren = useNavigate();
  const aktive = faehigkeiten.filter((faehigkeit) => !faehigkeit.archiviert);

  return (
    <Abschnitt
      titel={tx("Fähigkeiten")}
      kennung="faehigkeiten"
      aktion={
        <Knopf variante="leise" className="px-2 py-1" onClick={() => setNeuOffen(true)}>
          <Plus className="size-4" />
          {tx("Fähigkeit")}
        </Knopf>
      }
    >
      <Fehlermeldung fehler={error} />
      {aktive.length === 0 && <Karte className="py-8 text-center text-sm text-leise">{tx("Noch keine Fähigkeiten.")}</Karte>}
      <KurzListe
        eintraege={aktive}
        anzahl={KARTEN_SICHTBAR}
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
        darstellen={(faehigkeit) => {
          const frei = faehigkeit.knoten.filter((knoten) => knoten.freigeschaltetAm !== null).length;
          return (
            <SchnellZeile
              key={faehigkeit.id}
              className="rounded-2xl border border-rand"
              ziel={{
                art: 'faehigkeit',
                id: faehigkeit.id,
                name: faehigkeit.name,
                archiviert: faehigkeit.archiviert,
                loeschbar: faehigkeit.loeschbar,
              }}
            >
              {(menue) => (
                <div className="relative">
                  <Link to={`/faehigkeiten/${faehigkeit.id}`} className="block p-4 pr-14 transition hover:bg-flaeche-2">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${faehigkeit.farbe}22`, color: faehigkeit.farbe }}
                      >
                        <Icon name={faehigkeit.icon} className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="truncate font-semibold">{faehigkeit.name}</h3>
                          <span className="zahl shrink-0 whitespace-nowrap text-sm font-semibold">{tx('Lvl {level}', { level: faehigkeit.level.level })}</span>
                        </div>
                        <p className="truncate text-xs text-leise">
                          {tx(faehigkeit.stufe)}
                          {faehigkeit.knoten.length > 0 && ` · ${frei}/${faehigkeit.knoten.length}`}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Fortschrittsbalken anteil={faehigkeit.level.fortschritt} farbe={faehigkeit.farbe} hoehe="h-1.5" />
                    </div>
                  </Link>
                  <div className="absolute top-1 right-1">{menue}</div>
                </div>
              )}
            </SchnellZeile>
          );
        }}
      />

      <Dialog offen={neuOffen} titel={tx("Neue Fähigkeit")} onSchliessen={() => setNeuOffen(false)}>
        {neuOffen && (
          <FaehigkeitFormular
            faehigkeit={null}
            onFertig={(gespeichert) => {
              setNeuOffen(false);
              void navigieren(`/faehigkeiten/${gespeichert.id}`);
            }}
          />
        )}
      </Dialog>
    </Abschnitt>
  );
}

function Archiv({ onAttributWiederherstellen }: { onAttributWiederherstellen: (attribut: Attribut) => void }) {
  const sichtbarkeit = useSichtbarkeit();
  const funktionen = sichtbarkeit.funktionen;
  const faehigkeitenAn = istAn('faehigkeiten', sichtbarkeit);
  const investitionenAn = istAn('ausruestung', sichtbarkeit);
  const [offen, setOffen] = useState(false);
  const { data: attribute = [] } = useQuery({ queryKey: SCHLUESSEL.attribute, queryFn: api.attribute });
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
  const eintraege = [
    ...attribute
      .filter((attribut) => attribut.archiviert && istTypAktiv(funktionen, attribut.typ))
      .map((attribut) => ({
        schluessel: `a-${attribut.id}`,
        name: attributName(attribut),
        art: tx(ATTRIBUT_TYP_INFO[attribut.typ].label),
        icon: attribut.icon,
        farbe: attribut.farbe,
        ziel: {
          art: 'attribut' as const,
          id: attribut.id,
          name: attributName(attribut),
          archiviert: true,
          loeschbar: attribut.loeschbar,
          onWiederherstellen: attribut.kennung !== null ? () => onAttributWiederherstellen(attribut) : undefined,
        },
      })),
    ...(faehigkeitenAn
      ? faehigkeiten.filter((faehigkeit) => faehigkeit.archiviert)
      .map((faehigkeit) => ({
        schluessel: `f-${faehigkeit.id}`,
        name: faehigkeit.name,
        art: tx("Fähigkeit"),
        icon: faehigkeit.icon,
        farbe: faehigkeit.farbe,
        ziel: {
          art: 'faehigkeit' as const,
          id: faehigkeit.id,
          name: faehigkeit.name,
          archiviert: true,
          loeschbar: faehigkeit.loeschbar,
        },
      }))
      : []),
    ...(investitionenAn ? investitionen.filter((eintrag) => eintrag.archiviert).map((eintrag) => ({
      schluessel: `i-${eintrag.id}`,
      name: eintrag.name,
      art: tx("Investition"),
      icon: eintrag.icon,
      farbe: NEUTRAL_FARBE,
      ziel: {
        art: 'investition' as const,
        id: eintrag.id,
        name: eintrag.name,
        archiviert: true,
        loeschbar: eintrag.loeschbar,
      },
    })) : []),
  ];

  if (eintraege.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex justify-center">
        <Knopf variante="leise" onClick={() => setOffen(!offen)}>
          <Archive className="size-4" />
          {archivBeschriftung(offen, eintraege.length)}
        </Knopf>
      </div>
      {offen && (
        <div className="space-y-2">
          {eintraege.map((eintrag) => (
            <SchnellZeile key={eintrag.schluessel} className="rounded-xl border border-rand" ziel={eintrag.ziel}>
              {(menue) => (
                <div className="flex items-center gap-3 py-1 pr-1 pl-4">
                  <Icon name={eintrag.icon} className="size-4 shrink-0" style={{ color: eintrag.farbe }} />
                  <span className="min-w-0 flex-1 truncate text-sm">{eintrag.name}</span>
                  <span className="shrink-0 text-xs text-leise">{eintrag.art}</span>
                  {menue}
                </div>
              )}
            </SchnellZeile>
          ))}
        </div>
      )}
    </section>
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
