import { InfoHinweis } from '../../ui/index.ts';

export const WERTE_HINWEIS =
  'Die Ähnlichkeit misst die Form des Profils, nicht die Höhe der Level. Die Werte sind grobe Schätzungen aus öffentlichen Infos, keine Wissenschaft.';

const HINWEIS_KNOPF = 'inline-flex size-4 items-center justify-center rounded-full text-leise hover:text-haupt';

export function WerteHinweis({ name }: { name: string }) {
  return <InfoHinweis text={WERTE_HINWEIS} name={name} knopfKlasse={HINWEIS_KNOPF} />;
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
