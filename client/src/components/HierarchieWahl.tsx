import { useMemo } from 'react';
import { gewaehlterName, type WahlKnoten } from '../projektHierarchie.ts';
import { AuswahlBlatt, type AuswahlOption } from './AuswahlBlatt.tsx';

function flach(knoten: readonly WahlKnoten[], ebene: number, ziel: AuswahlOption[]): void {
  for (const eintrag of knoten) {
    ziel.push({
      wert: eintrag.wert,
      name: eintrag.name,
      farbe: eintrag.farbe,
      ebene,
      waehlbar: eintrag.waehlbar,
    });
    flach(eintrag.kinder, ebene + 1, ziel);
  }
}

export function HierarchieWahl({
  label,
  wert,
  knoten,
  onAendern,
  disabled = false,
}: {
  label: string;
  wert: string;
  knoten: WahlKnoten[];
  onAendern: (wert: string) => void;
  disabled?: boolean;
}) {
  const optionen = useMemo(() => {
    const liste: AuswahlOption[] = [];
    flach(knoten, 0, liste);
    return liste;
  }, [knoten]);

  return (
    <AuswahlBlatt
      label={label}
      modus="einzeln"
      wert={wert}
      optionen={optionen}
      disabled={disabled}
      anzeige={gewaehlterName(knoten, wert) ?? label}
      onAendern={onAendern}
    />
  );
}
