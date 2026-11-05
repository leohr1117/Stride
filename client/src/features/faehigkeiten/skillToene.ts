import { useEffect, useState, type CSSProperties } from 'react';
import { kontrast, mische } from '../../../../shared/spiel/farben.ts';

const WEISS = '#ffffff';
const SCHWARZ = '#000000';
const MINDEST = 4.5;

export interface SkillToene {
  tief: string;
  tiefer: string;
  text: string;
}

function anteilBisWeiss(farbe: string): number {
  for (let schritt = 0; schritt <= 20; schritt += 1) {
    const kandidat = schritt === 0 ? farbe : mische(farbe, SCHWARZ, schritt / 20);
    if (kontrast(WEISS, kandidat) >= MINDEST) {
      return schritt / 20;
    }
  }
  return 1;
}

export function skillToene(farbe: string, flaeche: string): SkillToene {
  const anteil = anteilBisWeiss(farbe);
  const tief = anteil === 0 ? farbe : mische(farbe, SCHWARZ, anteil);
  const tiefer = mische(farbe, SCHWARZ, Math.min(1, anteil + 0.15));
  const text = kontrast(farbe, flaeche) >= MINDEST ? farbe : tief;
  return { tief, tiefer, text };
}

function flaecheJetzt(): string {
  if (typeof document === 'undefined') {
    return WEISS;
  }
  const wert = getComputedStyle(document.documentElement).getPropertyValue('--flaeche').trim();
  return wert || WEISS;
}

export function useSkillToene(farbe: string): SkillToene {
  const [flaeche, setFlaeche] = useState(flaecheJetzt);
  useEffect(() => {
    const lies = () => setFlaeche(flaecheJetzt());
    lies();
    const beobachter = new MutationObserver(lies);
    beobachter.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'data-stil', 'data-schema'],
    });
    return () => beobachter.disconnect();
  }, []);
  return skillToene(farbe, flaeche);
}

export function skillVariablen(farbe: string, toene: SkillToene): CSSProperties {
  return {
    '--skillfarbe': farbe,
    '--skill-tief': toene.tief,
    '--skill-tiefer': toene.tiefer,
    '--skill-text': toene.text,
  } as CSSProperties;
}
