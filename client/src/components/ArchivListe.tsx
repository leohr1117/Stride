import { useState } from 'react';
import { Archive } from 'lucide-react';
import type { SchnellZiel } from '../schnell.ts';
import { SchnellZeile } from './SchnellAktion.tsx';
import { Icon } from './Icons.tsx';
import { archivBeschriftung, Knopf } from '../ui/index.ts';

export function ArchivListe({
  eintraege,
}: {
  eintraege: { schluessel: string; name: string; icon: string; farbe: string; ziel: SchnellZiel }[];
}) {
  const [offen, setOffen] = useState(false);
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
