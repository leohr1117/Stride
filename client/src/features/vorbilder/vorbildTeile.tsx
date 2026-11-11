import { InfoHinweis } from '../../ui/index.ts';
import { tx } from '../../text.ts';

export const WERTE_HINWEIS =
  'Die Ähnlichkeit misst die Form des Profils, nicht die Höhe der Level. Die Werte sind grobe Schätzungen aus öffentlichen Infos, keine Wissenschaft. Ein ~ oder ein hohler Punkt im Radar heißt: Dazu gibt es kaum verlässliche Infos.';

const HINWEIS_KNOPF = 'inline-flex size-4 items-center justify-center rounded-full text-leise hover:text-haupt';

const MARKE = 'ms-1.5 inline-flex items-center rounded-full border border-rand px-2 text-[12px] leading-4 text-leise';

export function SchaetzungMarke() {
  return (
    <span data-schaetzung="" className={MARKE}>
      {tx('Schätzung')}
    </span>
  );
}

export function aehnlichkeitName(basis: string, wert: string): string {
  return `${basis} ${tx('etwa {wert}, geschätzt', { wert })}`;
}

export function vorbildLevelSichtbar(level: string, unsicher: boolean): string {
  return tx('Lvl {level}', { level: unsicher ? `~${level}` : level });
}

export function AehnlichkeitVorsatz({ wert, stumm = false }: { wert: string; stumm?: boolean }) {
  return (
    <>
      {stumm ? null : <span className="sr-only">{tx('etwa {wert}, geschätzt', { wert })}</span>}
      <span aria-hidden="true">≈ </span>
    </>
  );
}

export function UnsicherWert({ sichtbar, wert }: { sichtbar: string; wert: string }) {
  return (
    <>
      <span aria-hidden="true" className="text-leise">
        {sichtbar}
      </span>
      <span className="sr-only">{tx('{wert}, unsicher', { wert })}</span>
    </>
  );
}

export function WerteHinweis({ name }: { name: string }) {
  return <InfoHinweis text={WERTE_HINWEIS} name={name} knopfKlasse={HINWEIS_KNOPF} />;
}

export function SchaetzungZusatz({ name }: { name?: string }) {
  return (
    <span className="flex h-[18px] items-center">
      <span className="inline-flex items-center">
        <SchaetzungMarke />
        {name ? <WerteHinweis name={name} /> : null}
      </span>
    </span>
  );
}

export function Legende({ eintraege }: { eintraege: { name: string; farbe: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-leise">
      {eintraege.map((eintrag) => (
        <span key={eintrag.name} className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: eintrag.farbe }} />
          {eintrag.name}
        </span>
      ))}
    </div>
  );
}
