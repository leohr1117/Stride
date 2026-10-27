import { tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { Flag, ListChecks, Mountain, Plus, Sparkles, Target, type LucideIcon } from 'lucide-react';
import { type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import { DAUER_OPTIONEN } from '../../../../shared/spiel/begriffe.ts';
import { funktionsSperre } from '../../../../shared/spiel/abhaengigkeiten.ts';
import { FUNKTION_BLOECKE, type Funktion } from '../../../../shared/spiel/funktionen.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import {
  empfehlungSchluessel,
  empfohleneFunktionen,
  investitionWegenRessourcen,
  naechsteEmpfehlung,
  startZielArt,
  taetigkeitenSchrittErledigt,
  zielAnzahl,
  type FunktionsEmpfehlung,
  type StartZielArt,
} from '../../../../shared/features/handbuch/handbuchPfad.ts';
import { LEVEL_KURVEN, xpBisLevel } from '../../../../shared/spiel/level.ts';
import { momentumFuerSerie } from '../../../../shared/spiel/momentum.ts';
import { LEVEL_MARKEN, VISION_BEISPIELE, type LevelBeispiel } from '../../../../shared/spiel/orientierung.ts';
import { beispielVorbilder, durchschnittXpProTag } from '../../../../shared/features/vorbilder/vorbilder.ts';
import { basisXp, visionBeute } from '../../../../shared/spiel/xp.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { Abschnitt } from '../../components/Ausklappbar.tsx';
import { EbenenWahl } from '../../components/EbenenWahl.tsx';
import { useEintragOeffnen } from '../../components/Layout.tsx';
import { Zeile, ZeilenGruppe } from '../../components/Zeile.tsx';
import { FUNKTION_BILD } from '../../funktionsBild.tsx';
import { Karte, Knopf, Ladeanzeige } from '../../ui/index.ts';
import { faktorText, zahl, zeitspanne } from '../../format.ts';
import { TAETIGKEITEN_GESEHEN, leseMerker } from '../../speicher.ts';
import { TrainingKarte } from './TrainingKarte.tsx';

const ZIEL_STATION: Record<Exclude<StartZielArt, 'faehigkeit'>, { titel: string; icon: LucideIcon }> = {
  visionen: { titel: 'Vision anlegen', icon: Mountain },
  projekte: { titel: 'Projekt anlegen', icon: Flag },
  vorhaben: { titel: 'Vorhaben anlegen', icon: Target },
};

const STREAK_BEISPIELE = [7, 30, 100, 365];

const FUNKTION_LABEL = new Map(FUNKTION_BLOECKE.flatMap((block) => block.eintraege.map((eintrag) => [eintrag.funktion, eintrag.label])));
const FUNKTION_ORT = new Map(FUNKTION_BLOECKE.flatMap((block) => block.eintraege.map((eintrag) => [eintrag.funktion, eintrag.ort])));

function texteZusammen(...teile: Array<string | null | undefined>): string | undefined {
  const texte = teile.filter((teil): teil is string => Boolean(teil)).map((teil) => tx(teil));
  return texte.length > 0 ? texte.join(' ') : undefined;
}

interface Station {
  schluessel: string;
  titel: ReactNode;
  an: boolean;
  aktion?: ReactNode;
}

export function HandbuchSeite() {
  const eintragOeffnen = useEintragOeffnen();
  const { data: einstellungen, isPending } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const { data: erfolge } = useQuery({ queryKey: SCHLUESSEL.erfolge, queryFn: api.erfolge });
  const { data: ziele } = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele });
  const { data: faehigkeitenListe } = useQuery({
    queryKey: SCHLUESSEL.faehigkeiten,
    queryFn: api.faehigkeiten,
    enabled: Boolean(einstellungen?.funktionen.faehigkeiten),
  });
  const { data: attribute = [] } = useQuery({
    queryKey: SCHLUESSEL.attribute,
    queryFn: api.attribute,
    enabled: Boolean(einstellungen?.funktionen.status),
  });

  if (isPending || !einstellungen) {
    return <Ladeanzeige />;
  }

  const visionen = ziele?.visionen.length ?? 0;
  const projekte = ziele?.projekte.length ?? 0;
  const vorhaben = ziele?.vorhaben.length ?? 0;
  const eintraege = erfolge?.kategorien.find((kategorie) => kategorie.kennzahl === 'eintraege')?.wert ?? 0;
  const bereit = Boolean(ziele && erfolge);
  const pfadStand = {
    taetigkeitenGeprueft: leseMerker(TAETIGKEITEN_GESEHEN),
    visionen,
    projekte,
    vorhaben,
    faehigkeiten: faehigkeitenListe?.length ?? 0,
    eintraege,
    stufe: einstellungen.zielstrebigkeit,
    funktionen: einstellungen.funktionen,
    ebenen: einstellungen.ebenen,
  };
  const empfohlen = bereit ? empfehlungSchluessel(naechsteEmpfehlung(pfadStand)) : null;
  const ressourcenAn = investitionWegenRessourcen(einstellungen.funktionen.status, attribute);
  const vorschlaege = empfohleneFunktionen(einstellungen.fokus, { ressourcen: ressourcenAn });
  const vorschlagAus = new Set(vorschlaege.filter((eintrag) => !einstellungen.funktionen[eintrag.funktion]).map((eintrag) => eintrag.funktion));
  const vorschlagInfo = new Map(vorschlaege.map((eintrag) => [eintrag.funktion, eintrag.info]));
  const taetigkeitenErledigt = taetigkeitenSchrittErledigt(pfadStand);
  const art = startZielArt(einstellungen.ebenen, einstellungen.funktionen);

  const startStationen: Station[] = [
    {
      schluessel: 'start:taetigkeiten',
      titel: tx("Tätigkeiten prüfen"),
      an: taetigkeitenErledigt,
      aktion: (
        <Link to="/mehr/inhalte#taetigkeiten" className="inline-flex items-center gap-1 text-sm font-medium text-akzent hover:underline">
          <ListChecks className="size-4" />
          {tx("Tätigkeiten ansehen")}
        </Link>
      ),
    },
  ];
  if (art === 'faehigkeit') {
    startStationen.push({
      schluessel: 'start:faehigkeit',
      titel: tx("Fähigkeit anlegen"),
      an: pfadStand.faehigkeiten > 0,
      aktion: (
        <Link to="/charakter" className="inline-flex items-center gap-1 text-sm font-medium text-akzent hover:underline">
          <Sparkles className="size-4" />
          {tx("Unter Charakter anlegen")}
        </Link>
      ),
    });
  } else if (art !== null) {
    const ziel = ZIEL_STATION[art];
    const Icon = ziel.icon;
    startStationen.push({
      schluessel: 'start:ziel',
      titel: tx(ziel.titel),
      an: zielAnzahl(pfadStand) > 0,
      aktion: (
        <Link to="/ziele" className="inline-flex items-center gap-1 text-sm font-medium text-akzent hover:underline">
          <Icon className="size-4" />
          {tx("Unter Ziele anlegen")}
        </Link>
      ),
    });
  }
  startStationen.push({
    schluessel: 'start:eintrag',
    titel: tx("Ersten Eintrag anlegen"),
    an: eintraege > 0,
    aktion: (
      <Knopf variante="primaer" onClick={() => eintragOeffnen()}>
        <Plus className="size-4" />
        {tx("Eintrag anlegen")}
      </Knopf>
    ),
  });
  const startGeschafft = startStationen.filter((station) => station.an).length;

  const funktionsInfo = (funktion: Funktion, grund?: string) =>
    texteZusammen(
      funktionsSperre(funktion, einstellungen.funktionen, einstellungen.ebenen, einstellungen.attribute),
      grund,
      FUNKTION_ORT.get(funktion),
    );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight break-words md:text-3xl">{tx("Handbuch")}</h1>
      </header>

      <TrainingKarte an={istAn('training', einstellungen)} />

      {vorschlagAus.size > 0 && (
        <ZeilenGruppe titel={tx("Empfohlen")}>
          {vorschlaege
            .filter((eintrag) => vorschlagAus.has(eintrag.funktion))
            .map((eintrag) => (
              <FunktionsZeile
                key={eintrag.funktion}
                funktion={eintrag.funktion}
                info={funktionsInfo(eintrag.funktion, eintrag.info)}
                an={false}
                hervorgehoben
              />
            ))}
        </ZeilenGruppe>
      )}

      <Abschnitt
        titel={tx("Erste Schritte")}
        kennung="handbuch-erste-schritte"
        aktion={<span className="zahl text-sm text-leise">{startGeschafft} / {startStationen.length}</span>}
      >
        <ol className="space-y-3">
          {startStationen.map((station, index) => (
            <PfadStation
              key={station.schluessel}
              station={station}
              letzte={index === startStationen.length - 1}
              empfohlen={empfohlen === station.schluessel}
            />
          ))}
        </ol>
      </Abschnitt>

      <Abschnitt titel={tx("Nach Vorliebe")} kennung="handbuch-nach-vorliebe" anfangEingeklappt>
        <div className="space-y-8">
          {FUNKTION_BLOECKE.map((block) => {
            const eintraege = block.eintraege.filter(
              (eintrag) => eintrag.funktion !== 'handbuch' && !vorschlagAus.has(eintrag.funktion),
            );
            if (eintraege.length === 0) {
              return null;
            }
            return (
              <ZeilenGruppe key={block.seite} titel={block.seite}>
                {eintraege.map((eintrag) => (
                  <FunktionsZeile
                    key={eintrag.funktion}
                    funktion={eintrag.funktion}
                    info={texteZusammen(vorschlagInfo.get(eintrag.funktion), eintrag.ort)}
                    an={istAn(eintrag.funktion, einstellungen)}
                  />
                ))}
              </ZeilenGruppe>
            );
          })}
          <EbenenWahl />
        </div>
      </Abschnitt>

      <Abschnitt titel={tx("Nachschlagen")} kennung="handbuch-nachschlagen" anfangEingeklappt>
        <Nachschlagen mitVorbildern={istAn('vorbilder', einstellungen)} mitVisionen={istAn('visionen', einstellungen)} />
      </Abschnitt>
    </div>
  );
}

function FunktionsZeile({
  funktion,
  info,
  an,
  hervorgehoben = false,
}: {
  funktion: FunktionsEmpfehlung['funktion'];
  info?: string;
  an: boolean;
  hervorgehoben?: boolean;
}) {
  if (funktion === 'handbuch') {
    return null;
  }
  const ort = FUNKTION_BILD[funktion];
  const Icon = ort.icon;
  return (
    <Zeile
      titel={tx(FUNKTION_LABEL.get(funktion) ?? funktion)}
      info={info}
      className={hervorgehoben ? 'bg-akzent/10' : ''}
      symbol={<Icon className="size-5" aria-hidden />}
      pfeil={false}
      rechts={
        <span className="flex items-center gap-3">
          <Link to={`/mehr/funktionen#funktion-${funktion}`} className="text-sm font-medium text-akzent">
            {tx("Schalten")}
          </Link>
          {an && ort.pfad ? (
            <Link to={ort.pfad} className="text-sm font-medium text-akzent">
              {tx("Öffnen")}
            </Link>
          ) : null}
        </span>
      }
    />
  );
}

function PfadStation({ station, letzte, empfohlen }: { station: Station; letzte: boolean; empfohlen: boolean }) {
  return (
    <li className="relative pl-8" aria-current={empfohlen ? 'step' : undefined}>
      {!letzte && <span className="absolute top-5 bottom-0 left-[0.7rem] w-px bg-rand" aria-hidden />}
      <span
        className={`absolute top-4 left-0 z-10 size-6 rounded-full border-2 ${
          station.an ? 'pfad-an border-akzent bg-akzent' : empfohlen ? 'skill-leuchten border-akzent bg-flaeche' : 'border-rand bg-flaeche-2'
        }`}
        style={empfohlen && !station.an ? ({ '--skillfarbe': 'var(--akzent)' } as CSSProperties) : undefined}
        aria-hidden
      />
      <Karte className={`space-y-2 ${empfohlen ? 'border-akzent bg-akzent/10' : station.an ? 'border-akzent/35' : ''}`}>
        <div className="min-w-0">
          {empfohlen && <p className="text-[10px] font-semibold tracking-wide text-akzent uppercase">{tx("Empfohlen")}</p>}
          <div className="font-medium break-words">{typeof station.titel === 'string' ? tx(station.titel) : station.titel}</div>
        </div>
        {station.aktion}
      </Karte>
    </li>
  );
}

function Tabelle({
  titel,
  spalten,
  zeilen,
  zahlAb = 1,
  einzeilig = false,
}: {
  titel: string;
  spalten: string[];
  zeilen: ReactNode[][];
  zahlAb?: number;
  einzeilig?: boolean;
}) {
  return (
    <Karte className="overflow-x-auto">
      <h2 className="mb-2 font-semibold break-words">{tx(titel)}</h2>
      <table className={`${einzeilig ? 'w-max min-w-full' : 'w-full'} text-sm`}>
        <thead>
          <tr className="text-left text-xs text-leise">
            {spalten.map((spalte, index) => (
              <th key={spalte} className={`py-1.5 font-medium ${einzeilig ? 'whitespace-nowrap' : ''} ${index >= zahlAb ? 'text-right' : ''}`}>
                {tx(spalte)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-rand">
          {zeilen.map((zeile, zeilenIndex) => (
            <tr key={zeilenIndex}>
              {zeile.map((zelle, index) => (
                <td key={index} className={`py-1.5 ${einzeilig ? 'whitespace-nowrap' : ''} ${index >= zahlAb ? 'zahl text-right' : ''}`}>
                  {zelle}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Karte>
  );
}

function richtungZelle(richtung: string | null): ReactNode {
  if (!richtung) {
    return '—';
  }
  const teile = tx(richtung).split('/');
  return teile.map((teil, index) => (index === 0 ? teil : <span key={teil}>/<wbr />{teil}</span>));
}

function vorbildZeilen(): ReactNode[][] {
  return beispielVorbilder().map((vorbild) => [vorbild.name, richtungZelle(vorbild.richtung), zahl(vorbild.level)]);
}

function beispielZeilen(beispiele: LevelBeispiel[], beute: (level: number) => number): ReactNode[][] {
  return beispiele.map((beispiel) => [tx(beispiel.titel), zahl(beispiel.level), tx('{xp} XP', { xp: zahl(beute(beispiel.level)) })]);
}

function Nachschlagen({ mitVorbildern, mitVisionen }: { mitVorbildern: boolean; mitVisionen: boolean }) {
  const xpAmTag = durchschnittXpProTag();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Tabelle
          titel={tx("Ein Eintrag")}
          spalten={[tx("Dauer"), tx("XP ohne Boni")]}
          zeilen={[[tx('Keine Angabe'), zahl(basisXp(null))], ...DAUER_OPTIONEN.map((option) => [tx(option.label), zahl(basisXp(option.stunden))])]}
        />
        <Tabelle
          titel={tx("Momentum")}
          spalten={[tx("Streak"), tx("Faktor")]}
          zeilen={STREAK_BEISPIELE.map((tage) => [tx('{tage} Tage', { tage: zahl(tage) }), faktorText(momentumFuerSerie(tage))])}
        />
      </div>
      <Tabelle
        titel="Charakter-Level"
        spalten={[tx('Level'), tx('XP gesamt'), tx('Bei {xp} XP am Tag', { xp: zahl(xpAmTag) })]}
        zeilen={LEVEL_MARKEN.map((level) => {
          const xp = xpBisLevel(level, LEVEL_KURVEN.charakter);
          return [zahl(level), zahl(xp), zeitspanne(xp / xpAmTag)];
        })}
      />
      {mitVisionen && (
        <Tabelle titel="Visions-Level" spalten={[tx('Beispiel'), tx('Level'), tx('Beute')]} zeilen={beispielZeilen(VISION_BEISPIELE, visionBeute)} />
      )}
      {mitVorbildern && (
        <Tabelle
          titel={tx("Vorbilder")}
          spalten={[tx("Person"), tx("Richtung"), tx("Level")]}
          zahlAb={2}
          zeilen={vorbildZeilen()}
        />
      )}
    </div>
  );
}
