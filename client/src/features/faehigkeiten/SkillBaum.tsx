import { useMemo, type CSSProperties } from 'react';
import { Check } from 'lucide-react';
import type { Faehigkeit, SkillKnoten } from '../../../../shared/api/index.ts';
import { kompakt } from '../../format.ts';
import { Icon } from '../../components/Icons.tsx';
import { berechneBaum, type BaumLayout, type BaumPosition } from './skillbaumLayout.ts';
import { skillVariablen, useSkillToene, type SkillToene } from './skillToene.ts';

const SPALTE = 104;
const EBENE = 108;
const KNOTEN = 44;
const WURZEL = 56;
const OBEN = 4;
const TITEL = 32;

type Zustand = 'frei' | 'verfuegbar' | 'gesperrt';

interface BaumDaten {
  faehigkeit: Faehigkeit;
  layout: BaumLayout;
  knotenNachId: Map<number, SkillKnoten>;
  zustand: (knoten: SkillKnoten) => Zustand;
}

function ermittleZustand(knoten: SkillKnoten, knotenNachId: Map<number, SkillKnoten>): Zustand {
  if (knoten.freigeschaltetAm !== null) {
    return 'frei';
  }
  const eltern = knoten.elternId === null ? undefined : knotenNachId.get(knoten.elternId);
  return !eltern || eltern.freigeschaltetAm !== null ? 'verfuegbar' : 'gesperrt';
}

function mitte(position: BaumPosition, wurzel = false): { x: number; y: number } {
  const groesse = wurzel ? WURZEL : KNOTEN;
  return { x: position.spalte * SPALTE + SPALTE / 2, y: position.ebene * EBENE + OBEN + groesse / 2 };
}

const XP_NORMAL = 3;
const XP_MITTEL = 4;

function xpSchrift(text: string): string {
  if (text.length > XP_MITTEL) {
    return 'text-[10px]';
  }
  if (text.length > XP_NORMAL) {
    return 'text-[11px]';
  }
  return 'text-xs';
}

function KnotenScheibe({ zustand, farbe, toene, xp }: { zustand: Zustand; farbe: string; toene: SkillToene; xp: number }) {
  const text = kompakt(xp);
  const stil = {
    ...skillVariablen(farbe, toene),
    outlineColor: farbe,
    width: KNOTEN,
    height: KNOTEN,
  } as CSSProperties;
  if (zustand === 'verfuegbar') {
    stil.borderColor = toene.text;
  } else if (zustand === 'gesperrt') {
    stil.borderColor = `color-mix(in srgb, ${farbe} 28%, var(--rand))`;
  }
  return (
    <span
      className={`baum-knoten relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 transition duration-200 group-hover:scale-105 group-focus-visible:scale-105 group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 ${
        zustand === 'frei'
          ? 'baum-frei border-transparent text-white'
          : zustand === 'verfuegbar'
            ? 'baum-puls bg-flaeche text-haupt'
            : 'border-dashed bg-flaeche-2/70 text-haupt'
      }`}
      style={stil}
    >
      <span className={`zahl max-w-full px-0.5 leading-none font-semibold whitespace-nowrap ${xpSchrift(text)}`}>{text}</span>
      {zustand === 'frei' && <Check data-haken="" aria-hidden className="absolute bottom-0.5 size-3" strokeWidth={2} style={{ color: '#ffffff' }} />}
    </span>
  );
}

function Graph({ daten, onWaehlen }: { daten: BaumDaten; onWaehlen: (id: number) => void }) {
  const { faehigkeit, layout, zustand } = daten;
  const breite = layout.spalten * SPALTE;
  const hoehe = (layout.ebenen - 1) * EBENE + OBEN + KNOTEN + TITEL + 10;
  const wurzel = mitte(layout.wurzel, true);
  const toene = useSkillToene(faehigkeit.farbe);

  return (
    <div className="relative" style={{ width: breite, height: hoehe, ...skillVariablen(faehigkeit.farbe, toene) }}>
      <svg className="absolute inset-0 overflow-visible" width={breite} height={hoehe} aria-hidden="true">
        {faehigkeit.knoten.map((knoten) => {
          const position = layout.positionen.get(knoten.id);
          if (!position) {
            return null;
          }
          const elternIstWurzel = knoten.elternId === null || !layout.positionen.has(knoten.elternId);
          const elternPosition = (!elternIstWurzel && knoten.elternId !== null && layout.positionen.get(knoten.elternId)) || layout.wurzel;
          const von = mitte(elternPosition, elternIstWurzel);
          const nach = mitte(position);
          const start = von.y + (elternIstWurzel ? WURZEL / 2 : KNOTEN / 2 + TITEL);
          const ende = nach.y - KNOTEN / 2;
          const knick = start + (ende - start) * 0.55;
          const knotenZustand = zustand(knoten);
          const frei = knotenZustand === 'frei';
          const offen = knotenZustand === 'verfuegbar';
          return (
            <path
              key={knoten.id}
              d={`M ${von.x} ${start} C ${von.x} ${knick}, ${nach.x} ${knick}, ${nach.x} ${ende}`}
              fill="none"
              strokeLinecap="round"
              stroke={frei || offen ? faehigkeit.farbe : 'var(--rand)'}
              strokeWidth={frei ? 2.5 : 2}
              strokeOpacity={frei ? 0.95 : offen ? 0.55 : 0.85}
              strokeDasharray={frei ? undefined : '4 6'}
            />
          );
        })}
      </svg>

      <div
        className="baum-wurzel absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2"
        style={{
          left: wurzel.x,
          top: wurzel.y,
          width: WURZEL,
          height: WURZEL,
          borderColor: toene.text,
          backgroundColor: `color-mix(in srgb, ${faehigkeit.farbe} 16%, var(--flaeche))`,
          color: toene.text,
        }}
      >
        <Icon name={faehigkeit.icon} data-symbol="" className="size-6" />
      </div>

      {faehigkeit.knoten.map((knoten) => {
        const position = layout.positionen.get(knoten.id);
        if (!position) {
          return null;
        }
        const punkt = mitte(position);
        const knotenZustand = zustand(knoten);
        return (
          <button
            key={knoten.id}
            type="button"
            data-zustand={knotenZustand}
            onClick={() => onWaehlen(knoten.id)}
            className="group absolute flex flex-col items-center gap-1 px-1 text-center"
            style={{ left: punkt.x - SPALTE / 2, top: punkt.y - KNOTEN / 2, width: SPALTE }}
          >
            <KnotenScheibe zustand={knotenZustand} farbe={faehigkeit.farbe} toene={toene} xp={knoten.xp} />
            <span
              className={`line-clamp-2 w-full break-words text-[11px] leading-tight ${
                knotenZustand === 'frei' ? 'font-semibold text-haupt' : knotenZustand === 'verfuegbar' ? 'font-medium text-haupt' : 'text-leise'
              }`}
            >
              {knoten.titel}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SkillBaum({ faehigkeit, onWaehlen }: { faehigkeit: Faehigkeit; onWaehlen: (id: number) => void }) {
  const daten = useMemo<BaumDaten>(() => {
    const knotenNachId = new Map(faehigkeit.knoten.map((knoten) => [knoten.id, knoten]));
    return {
      faehigkeit,
      layout: berechneBaum(faehigkeit.knoten),
      knotenNachId,
      zustand: (knoten) => ermittleZustand(knoten, knotenNachId),
    };
  }, [faehigkeit]);

  return <Graph daten={daten} onWaehlen={onWaehlen} />;
}
