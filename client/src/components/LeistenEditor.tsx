import { tx } from '../text.ts';
import { ChevronDown, ChevronUp, Minus, Plus, RotateCcw, Undo2, type LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  entfernePlatz,
  haengePlatzAn,
  LEISTE_MAX,
  LEISTE_STANDARD,
  leistenMitte,
  sichtbareLeiste,
  tauschMitSichtbar,
} from '../../../shared/spiel/leiste.ts';
import type { Ebenen } from '../../../shared/spiel/ebenen.ts';
import type { Funktionen } from '../../../shared/spiel/funktionen.ts';
import { pfadAktiv, type Sichtbarkeit } from '../../../shared/spiel/sichtbarkeit.ts';
import { EINSTELLUNGEN, HANDBUCH, navAusLeiste, sichtbareGruppen, type NavEintrag } from '../navigation.ts';
import { Knopf, Leer } from '../ui/index.ts';

function gleicheListe(links: readonly string[], rechts: readonly string[]): boolean {
  return links.length === rechts.length && links.every((pfad, index) => pfad === rechts[index]);
}

function auswahlGruppen(sichtbarkeit: Sichtbarkeit): { titel: string | null; eintraege: NavEintrag[] }[] {
  const weiter = [EINSTELLUNGEN];
  if (pfadAktiv(HANDBUCH.pfad, sichtbarkeit)) {
    weiter.unshift(HANDBUCH);
  }
  return [...sichtbareGruppen(sichtbarkeit.funktionen, sichtbarkeit.ebenen), { titel: 'Weiteres', eintraege: weiter }];
}

function Symbol({ icon: Zeichen, className = 'size-5' }: { icon: LucideIcon; className?: string }) {
  return <Zeichen className={className} />;
}

export function LeistenEditor({
  wert,
  funktionen,
  ebenen,
  deaktiviert,
  hinweis,
  onAendern,
}: {
  wert: string[];
  funktionen: Funktionen;
  ebenen: Ebenen;
  deaktiviert: boolean;
  hinweis: string | null;
  onAendern: (pfade: string[]) => void;
}) {
  const historie = useRef<string[][]>([]);
  const [schritte, setSchritte] = useState(0);
  const sichtbarkeit: Sichtbarkeit = { funktionen, ebenen };
  const aktiv = (pfad: string) => pfadAktiv(pfad, sichtbarkeit);
  const voll = sichtbareLeiste(wert, funktionen, ebenen).length >= LEISTE_MAX;
  const standard = gleicheListe(wert, LEISTE_STANDARD);

  const aendere = (neu: string[]) => {
    if (deaktiviert || gleicheListe(neu, wert)) {
      return;
    }
    historie.current.push([...wert]);
    setSchritte(historie.current.length);
    onAendern(neu);
  };

  const rueckgaengig = () => {
    const vorher = historie.current.pop();
    setSchritte(historie.current.length);
    if (vorher) {
      onAendern(vorher);
    }
  };

  const plaetze = wert.flatMap((pfad, index) => {
    const eintrag = navAusLeiste(pfad);
    return eintrag && aktiv(pfad) ? [{ index, eintrag }] : [];
  });
  const mitte = leistenMitte(plaetze.length);
  const vorschau = (platz: { index: number; eintrag: NavEintrag }) => {
    const NavIcon = platz.eintrag.icon;
    return (
      <div key={platz.eintrag.pfad} className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium text-leise">
        <NavIcon className="size-5" />
        {tx(platz.eintrag.label)}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {hinweis && <p className="text-sm font-medium text-akzent">{tx(hinweis)}</p>}

      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold tracking-wider text-leise uppercase">{tx("In der Leiste")}</h2>
        {plaetze.length === 0 && (
          <Leer text={tx("Noch keine Seite. Wähle unten eine aus.")} />
        )}
        <div className="space-y-2">
          {plaetze.map((platz, reihe) => (
            <div key={platz.eintrag.pfad} className="flex items-center gap-2 rounded-2xl border border-rand bg-flaeche px-3 py-2">
              <span className="zahl w-4 shrink-0 text-center text-xs text-leise">{reihe + 1}</span>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-flaeche-2 text-haupt">
                <Symbol icon={platz.eintrag.icon} />
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium break-words">{tx(platz.eintrag.label)}</span>
              <button
                type="button"
                aria-label={tx('{name} nach oben', { name: tx(platz.eintrag.label) })}
                disabled={deaktiviert || reihe === 0}
                onClick={() => aendere(tauschMitSichtbar(wert, platz.index, -1, aktiv))}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-flaeche-2 text-haupt disabled:opacity-30"
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                type="button"
                aria-label={tx('{name} nach unten', { name: tx(platz.eintrag.label) })}
                disabled={deaktiviert || reihe === plaetze.length - 1}
                onClick={() => aendere(tauschMitSichtbar(wert, platz.index, 1, aktiv))}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-flaeche-2 text-haupt disabled:opacity-30"
              >
                <ChevronDown className="size-4" />
              </button>
              <button
                type="button"
                aria-label={tx('{name} entfernen', { name: tx(platz.eintrag.label) })}
                disabled={deaktiviert}
                onClick={() => aendere(entfernePlatz(wert, platz.index))}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gefahr/15 text-gefahr disabled:opacity-30"
              >
                <Minus className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold tracking-wider text-leise uppercase">{tx("Vorschau")}</h2>
        <div className="mobilleiste flex items-end rounded-2xl border border-rand px-1 pt-6 pb-1">
          {plaetze.slice(0, mitte).map(vorschau)}
          <div className="flex flex-1 justify-center">
            <div
              aria-hidden
              className="knopf-rund -mt-6 mb-2 flex size-14 items-center justify-center rounded-full bg-akzent text-akzent-text shadow-lg shadow-akzent/30"
            >
              <Plus className="size-7" strokeWidth={2.5} />
            </div>
          </div>
          {plaetze.slice(mitte).map(vorschau)}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[11px] font-semibold tracking-wider text-leise uppercase">{tx("Weitere Seiten")}</h2>
          {voll && <p className="text-xs text-leise">{tx("Alle Plätze sind belegt.")}</p>}
        </div>
        {auswahlGruppen(sichtbarkeit).map((gruppe) => {
          const frei = gruppe.eintraege.filter((seite) => !wert.includes(seite.pfad));
          if (frei.length === 0) {
            return null;
          }
          return (
            <div key={gruppe.titel ?? 'start'} className="space-y-2">
              {gruppe.titel && <p className="text-xs font-medium text-leise">{tx(gruppe.titel)}</p>}
              {frei.map((seite) => (
                <button
                  key={seite.pfad}
                  type="button"
                  disabled={deaktiviert || voll}
                  onClick={() => aendere(haengePlatzAn(wert, seite.pfad, aktiv))}
                  className="flex w-full items-center gap-3 rounded-2xl border border-rand bg-flaeche px-3 py-2 text-left disabled:opacity-40"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-akzent/15 text-akzent">
                    <Plus className="size-4" />
                  </span>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-flaeche-2 text-haupt">
                    <Symbol icon={seite.icon} />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium break-words">{tx(seite.label)}</span>
                </button>
              ))}
            </div>
          );
        })}
      </section>

      <div className="flex flex-wrap gap-2">
        <Knopf onClick={rueckgaengig} disabled={deaktiviert || schritte === 0}>
          <Undo2 className="size-4" />
          {tx("Rückgängig")}
        </Knopf>
        <Knopf onClick={() => aendere([...LEISTE_STANDARD])} disabled={deaktiviert || standard}>
          <RotateCcw className="size-4" />
          {tx("Standard")}
        </Knopf>
      </div>
    </div>
  );
}
