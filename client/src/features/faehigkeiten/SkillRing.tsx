import type { CSSProperties } from 'react';
import { Icon } from '../../components/Icons.tsx';
import { skillVariablen, useSkillToene } from './skillToene.ts';

export function SkillRing({ frei, gesamt, farbe, icon }: { frei: number; gesamt: number; farbe: string; icon: string }) {
  const anteil = gesamt === 0 ? 0 : Math.min(1, frei / gesamt);
  const toene = useSkillToene(farbe);
  const stil = { ...skillVariablen(farbe, toene), '--anteil': String(anteil) } as CSSProperties;
  return (
    <div className="skill-ring" style={stil} data-leer={anteil <= 0 ? '' : undefined}>
      <div className="skill-ring-spur" />
      {anteil > 0 && <div className="skill-ring-bogen" />}
      {anteil > 0 && (
        <div className="skill-ring-punkt-lage">
          <span className="skill-ring-punkt" />
        </div>
      )}
      <div className="skill-ring-mitte">
        <Icon name={icon} data-symbol="" className="size-6" style={{ color: 'var(--skill-text)' }} />
        <span className="zahl mt-0.5 text-xs font-semibold">
          {frei}/{gesamt}
        </span>
      </div>
    </div>
  );
}
