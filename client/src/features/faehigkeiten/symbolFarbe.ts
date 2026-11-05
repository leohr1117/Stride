import { useEffect, useState } from 'react';
import { lesbareFarbe } from '../../../../shared/spiel/farben.ts';

const MINDEST = 3;

export function symbolFarbe(farbe: string, hintergrund: string): string {
  return lesbareFarbe(farbe, [hintergrund], MINDEST);
}

function flaecheJetzt(): string {
  if (typeof document === 'undefined') {
    return '#ffffff';
  }
  const wert = getComputedStyle(document.documentElement).getPropertyValue('--flaeche').trim();
  return wert || '#ffffff';
}

export function useSymbolFarbe(farbe: string): string {
  const [hintergrund, setHintergrund] = useState(flaecheJetzt);
  useEffect(() => {
    const lies = () => setHintergrund(flaecheJetzt());
    lies();
    const beobachter = new MutationObserver(lies);
    beobachter.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'data-stil', 'data-schema'],
    });
    return () => beobachter.disconnect();
  }, []);
  return symbolFarbe(farbe, hintergrund);
}
