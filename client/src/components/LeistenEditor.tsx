import { tx } from '../text.ts';
import { ChevronDown, ChevronUp, Minus, RotateCcw, Undo2, type LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  entfernePlatz,
  haengePlatzAn,
  istFesterPlatz,
  LEISTE_MAX,
  LEISTE_STANDARD,
  sichtbareLeiste,
  tauschMitSichtbar,
} from '../../../shared/spiel/leiste.ts';
import { SEITEN } from '../../../shared/spiel/navigation.ts';
import type { Ebenen } from '../../../shared/spiel/ebenen.ts';
import type { Funktionen } from '../../../shared/spiel/funktionen.ts';
import { pfadAktiv, type Sichtbarkeit } from '../../../shared/spiel/sichtbarkeit.ts';
import { navAusLeiste, type NavEintrag } from '../navigation.ts';
import { Knopf, Leer } from '../ui/index.ts';

function gleicheListe(links: readonly string[], rechts: readonly string[]): boolean {
  return links.length === rechts.length && links.every((pfad, index) => pfad === rechts[index]);
}

function weitereSeiten(wert: readonly string[], sichtbarkeit: Sichtbarkeit): NavEintrag[] {
  return SEITEN.flatMap((seite) => {
    if (istFesterPlatz(seite.pfad) || wert.includes(seite.pfad) || !pfadAktiv(seite.pfad, sichtbarkeit)) {
      return [];
    }
    const eintrag = navAusLeiste(seite.pfad);
    return eintrag ? [eintrag] : [];
  });
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
  const beweglich = plaetze.filter((platz) => !istFesterPlatz(platz.eintrag.pfad));
  const fest = plaetze.find((platz) => istFesterPlatz(platz.eintrag.pfad));
  const vorschau = (platz: { index: number; eintrag: NavEintrag }) => {
    const NavIcon = platz.eintrag.icon;
    return (
      <div key={platz.eintrag.pfad} className="flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium text-leise">
        <NavIcon className="size-5" strokeWidth={1.75} />
        {tx(platz.eintrag.label)}
      </div>
    );
  };

  const zeile = (platz: { index: number; eintrag: NavEintrag }, knoepfe: boolean, reihe?: number) => (
    <div key={platz.eintrag.pfad} className="flex items-center gap-2 rounded-2xl border border-rand bg-flaeche px-3 py-2">
      <span className="zahl w-4 shrink-0 text-center text-xs text-leise">{(reihe ?? beweglich.length) + 1}</span>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-flaeche-2 text-haupt">
        <Symbol icon={platz.eintrag.icon} />
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium break-words">{tx(platz.eintrag.label)}</span>
      {knoepfe && reihe !== undefined ? (
        <>
          <button
            type="button"
            aria-label={tx('{name} nach oben', { name: tx(platz.eintrag.label) })}
            disabled={deaktiviert || reihe === 0}
            onClick={() => aendere(tauschMitSichtbar(wert, platz.index, -1, aktiv))}
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-flaeche-2 text-haupt disabled:opacity-30"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            aria-label={tx('{name} nach unten', { name: tx(platz.eintrag.label) })}
            disabled={deaktiviert || reihe === beweglich.length - 1}
            onClick={() => aendere(tauschMitSichtbar(wert, platz.index, 1, aktiv))}
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-flaeche-2 text-haupt disabled:opacity-30"
          >
            <ChevronDown className="size-4" />
          </button>
          <button
            type="button"
            aria-label={tx('{name} entfernen', { name: tx(platz.eintrag.label) })}
            disabled={deaktiviert}
            onClick={() => aendere(entfernePlatz(wert, platz.index))}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gefahr/15 text-gefahr disabled:opacity-30"
          >
            <Minus className="size-4" />
          </button>
        </>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-5">
      {hinweis && <p className="text-sm font-medium text-akzent">{tx(hinweis)}</p>}

      <section className="space-y-2">
        <h2 className="ueberschrift abschnittskopf text-[13px] font-semibold leading-[18px] tracking-normal text-leise normal-case">
          {tx("Vorschau")}
        </h2>
        <div className="mobilleiste flex min-h-16 items-center rounded-2xl border border-rand px-1">
          {plaetze.map(vorschau)}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="ueberschrift abschnittskopf text-[13px] font-semibold leading-[18px] tracking-normal text-leise normal-case">
          {tx("In der Leiste")}
        </h2>
        {plaetze.length === 0 && (
          <Leer text={tx("Noch keine Seite. Wähle unten eine aus.")} />
        )}
        <div className="space-y-2">
          {beweglich.map((platz, reihe) => zeile(platz, true, reihe))}
          {fest ? zeile(fest, false) : null}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="ueberschrift abschnittskopf text-[13px] font-semibold leading-[18px] tracking-normal text-leise normal-case">
          {tx("Weitere Seiten")}
        </h2>
        {weitereSeiten(wert, sichtbarkeit).map((seite) => (
          <button
            key={seite.pfad}
            type="button"
            disabled={deaktiviert || voll}
            onClick={() => aendere(haengePlatzAn(wert, seite.pfad, aktiv))}
            className="flex w-full items-center gap-3 rounded-2xl border border-rand bg-flaeche px-3 py-2 text-left disabled:opacity-40"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-flaeche-2 text-haupt">
              <Symbol icon={seite.icon} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium break-words">{tx(seite.label)}</span>
              {voll ? <span className="block text-xs text-leise">{tx("Alle Plätze sind belegt.")}</span> : null}
            </span>
            <span className="shrink-0 text-sm font-medium text-akzent">{tx("Hinzufügen")}</span>
          </button>
        ))}
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
