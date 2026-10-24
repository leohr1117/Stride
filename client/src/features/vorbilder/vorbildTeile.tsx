import { InfoHinweis } from '../../ui/index.ts';
import { tx } from '../../text.ts';

export const WERTE_HINWEIS = 'Die Werte sind grobe Schätzungen aus öffentlichen Infos, keine Wissenschaft.';

export function WerteHinweis() {
  return (
    <InfoHinweis text={WERTE_HINWEIS} label={tx("Hinweis zu den Werten")} />
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
