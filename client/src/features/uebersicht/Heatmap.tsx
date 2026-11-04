import type { HeatmapTag } from '../../../../shared/api/index.ts';
import { TAGE_PRO_WOCHE } from '../../../../shared/spiel/datum.ts';
import { ausTagesSchluessel, kurzesDatum, monatKurz, zahl } from '../../format.ts';
import { tx } from '../../text.ts';

const HEATMAP_STUFEN = [0.25, 0.5, 0.75, 1];
const WOCHENTAG_LABEL = ['Mo', '', 'Mi', '', 'Fr', '', ''];

function heatmapStufe(xp: number, maximum: number): number {
  if (xp <= 0 || maximum === 0) {
    return 0;
  }
  const anteil = xp / maximum;
  return HEATMAP_STUFEN.find((grenze) => grenze >= anteil) ?? 1;
}

function heatmapFarbe(stufe: number): string {
  return stufe === 0
    ? 'var(--flaeche-2)'
    : `color-mix(in srgb, var(--akzent) ${Math.round(stufe * 100)}%, var(--flaeche-2))`;
}

function inWochen(tage: HeatmapTag[]): (HeatmapTag | null)[][] {
  const erster = tage[0];
  const versatz = erster ? (ausTagesSchluessel(erster.datum).getDay() + TAGE_PRO_WOCHE - 1) % TAGE_PRO_WOCHE : 0;
  const zellen: (HeatmapTag | null)[] = [...new Array<null>(versatz).fill(null), ...tage];
  const wochen: (HeatmapTag | null)[][] = [];
  for (let index = 0; index < zellen.length; index += TAGE_PRO_WOCHE) {
    wochen.push(zellen.slice(index, index + TAGE_PRO_WOCHE));
  }
  return wochen;
}

function monatsBeschriftungen(wochen: (HeatmapTag | null)[][]): string[] {
  let letzterMonat = -1;
  return wochen.map((woche) => {
    const tag = woche.find((zelle) => zelle !== null);
    if (!tag) {
      return '';
    }
    const datum = ausTagesSchluessel(tag.datum);
    if (datum.getMonth() === letzterMonat) {
      return '';
    }
    letzterMonat = datum.getMonth();
    return monatKurz(datum);
  });
}

export function Heatmap({ tage }: { tage: HeatmapTag[] }) {
  let maximum = 0;
  for (const tag of tage) {
    maximum = Math.max(maximum, tag.xp);
  }
  const wochen = inWochen(tage);
  const monate = monatsBeschriftungen(wochen);

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-2">
        <div
          className="inline-grid gap-[2px] text-[10px] leading-none text-leise"
          style={{ gridTemplateColumns: `auto repeat(${wochen.length}, minmax(0.75rem, 1.25rem))` }}
        >
          <span />
          {monate.map((monat, index) => (
            <span key={`monat-${index}`} className="h-3 w-0 overflow-visible whitespace-nowrap">
              {monat}
            </span>
          ))}
          {WOCHENTAG_LABEL.map((label, zeile) => (
            <HeatmapZeile key={zeile} label={label ? tx(label) : ''} wochen={wochen} zeile={zeile} maximum={maximum} />
          ))}
        </div>
        <div className="flex items-center justify-end gap-[2px] text-[10px] text-leise">
          <span className="mr-1">{tx('Weniger')}</span>
          {[0, ...HEATMAP_STUFEN].map((stufe) => (
            <span key={stufe} className="size-2.5 rounded-[3px]" style={{ backgroundColor: heatmapFarbe(stufe) }} />
          ))}
          <span className="ml-1">{tx('Mehr')}</span>
        </div>
      </div>
    </div>
  );
}

function HeatmapZeile({
  label,
  wochen,
  zeile,
  maximum,
}: {
  label: string;
  wochen: (HeatmapTag | null)[][];
  zeile: number;
  maximum: number;
}) {
  return (
    <>
      <span className="flex items-center pr-1.5">{label}</span>
      {wochen.map((woche, spalte) => {
        const tag = woche[zeile] ?? null;
        if (tag === null) {
          return <span key={`leer-${spalte}`} />;
        }
        return (
          <span
            key={tag.datum}
            title={`${kurzesDatum(`${tag.datum}T12:00:00`)}: ${zahl(tag.xp)} XP`}
            className="aspect-square rounded-[3px]"
            style={{ backgroundColor: heatmapFarbe(heatmapStufe(tag.xp, maximum)) }}
          />
        );
      })}
    </>
  );
}
