import { tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { DAUER_OPTIONEN } from '../../../../shared/spiel/begriffe.ts';
import { funktionsSperre } from '../../../../shared/spiel/abhaengigkeiten.ts';
import { FUNKTION_BLOECKE, type Funktion } from '../../../../shared/spiel/funktionen.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import {
  empfohleneFunktionen,
  investitionWegenRessourcen,
  type FunktionsEmpfehlung,
} from '../../../../shared/features/handbuch/handbuchPfad.ts';
import { LEVEL_KURVEN, xpBisLevel } from '../../../../shared/spiel/level.ts';
import { momentumFuerSerie } from '../../../../shared/spiel/momentum.ts';
import { LEVEL_MARKEN, VISION_BEISPIELE, type LevelBeispiel } from '../../../../shared/spiel/orientierung.ts';
import { beispielVorbilder, durchschnittXpProTag } from '../../../../shared/features/vorbilder/vorbilder.ts';
import { basisXp, visionBeute } from '../../../../shared/spiel/xp.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { Abschnitt } from '../../components/Ausklappbar.tsx';
import { EbenenWahl } from '../../components/EbenenWahl.tsx';
import { Zeile, ZeilenGruppe } from '../../components/Zeile.tsx';
import { FUNKTION_BILD } from '../../funktionsBild.tsx';
import { Karte, Ladeanzeige } from '../../ui/index.ts';
import { faktorText, zahl, zeitspanne } from '../../format.ts';
import { HinweisKarte } from './HinweisKarte.tsx';
import { SchutzKarte } from './SchutzKarte.tsx';

const STREAK_BEISPIELE = [7, 30, 100, 365];

const FUNKTION_LABEL = new Map(FUNKTION_BLOECKE.flatMap((block) => block.eintraege.map((eintrag) => [eintrag.funktion, eintrag.label])));

function texteZusammen(...teile: Array<string | null | undefined>): string | undefined {
  const texte = teile.filter((teil): teil is string => Boolean(teil)).map((teil) => tx(teil));
  return texte.length > 0 ? texte.join(' ') : undefined;
}

export function HandbuchSeite() {
  const { data: einstellungen, isPending } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const { data: attribute = [] } = useQuery({
    queryKey: SCHLUESSEL.attribute,
    queryFn: api.attribute,
    enabled: Boolean(einstellungen?.funktionen.status),
  });

  if (isPending || !einstellungen) {
    return <Ladeanzeige />;
  }

  const ressourcenAn = investitionWegenRessourcen(einstellungen.funktionen.status, attribute);
  const vorschlaege = empfohleneFunktionen(einstellungen.fokus, { ressourcen: ressourcenAn });
  const vorschlagAus = new Set(vorschlaege.filter((eintrag) => !einstellungen.funktionen[eintrag.funktion]).map((eintrag) => eintrag.funktion));
  const vorschlagInfo = new Map(vorschlaege.map((eintrag) => [eintrag.funktion, eintrag.info]));

  const funktionsInfo = (funktion: Funktion, grund?: string) =>
    texteZusammen(
      funktionsSperre(funktion, einstellungen.funktionen, einstellungen.ebenen, einstellungen.attribute),
      grund,
    );

  return (
    <div className="space-y-6">
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
        titel={tx("Nach Vorliebe")}
        kennung="handbuch-nach-vorliebe"
        info="Was die App kann. Einschalten geht unter App & Verbindungen."
      >
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
                    info={texteZusammen(vorschlagInfo.get(eintrag.funktion))}
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
  return beispielVorbilder().map((vorbild) => [tx(vorbild.name), richtungZelle(vorbild.richtung), zahl(vorbild.level)]);
}

function beispielZeilen(beispiele: LevelBeispiel[], beute: (level: number) => number): ReactNode[][] {
  return beispiele.map((beispiel) => [tx(beispiel.titel), zahl(beispiel.level), tx('{xp} XP', { xp: zahl(beute(beispiel.level)) })]);
}

function Nachschlagen({ mitVorbildern, mitVisionen }: { mitVorbildern: boolean; mitVisionen: boolean }) {
  const xpAmTag = durchschnittXpProTag();
  return (
    <div className="space-y-4">
      <SchutzKarte />
      <HinweisKarte />
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
