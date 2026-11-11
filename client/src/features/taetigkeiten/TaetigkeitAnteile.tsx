import type { Attribut } from '../../../../shared/api/index.ts';
import { Icon } from '../../components/Icons.tsx';
import { prozentPunkte } from '../../format.ts';
import { attributName, tx } from '../../text.ts';
import { AnteilRegler } from '../../ui/index.ts';

function wertText(wert: number): string {
  if (wert > 0) {
    return `+${prozentPunkte(wert)}`;
  }
  if (wert < 0) {
    return `\u2212${prozentPunkte(Math.abs(wert))}`;
  }
  return prozentPunkte(0);
}

function wertBeschreibung(wert: number): string {
  if (wert > 0) {
    return tx('Plus {prozent} Prozent', { prozent: wert });
  }
  if (wert < 0) {
    return tx('Abzug {prozent} Prozent', { prozent: Math.abs(wert) });
  }
  return tx('keine Wirkung');
}

export function AnteilGruppe({
  titel,
  attribute,
  werte,
  schritt,
  onAendern,
}: {
  titel: string;
  attribute: Attribut[];
  werte: Map<number, number>;
  schritt: number;
  onAendern: (attributId: number, wert: number) => void;
}) {
  if (attribute.length === 0) {
    return null;
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-leise">{titel}</p>
      {attribute.map((attribut) => {
        const wert = werte.get(attribut.id) ?? 0;
        const name = attributName(attribut);
        return (
          <div key={attribut.id} className="space-y-1">
            <div className="flex items-center gap-3">
              <Icon name={attribut.icon} className="size-4 shrink-0" style={{ color: attribut.farbe }} />
              <span className="min-w-0 flex-1 text-sm break-words">{name}</span>
              <span className={`zahl w-16 shrink-0 text-right text-xs ${wert < 0 ? 'text-gefahr' : wert === 0 ? 'text-leise' : ''}`}>
                {wertText(wert)}
              </span>
            </div>
            <AnteilRegler
              wert={wert}
              farbe={attribut.farbe}
              schritt={schritt}
              beschreibung={wertBeschreibung(wert)}
              onAendern={(naechster) => onAendern(attribut.id, naechster)}
              aria-label={tx('Anteil {name}', { name })}
            />
            {wert < 0 ? (
              <p className="text-xs text-leise">{tx('zieht {prozent} % der Grund-XP ab', { prozent: Math.abs(wert) })}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
