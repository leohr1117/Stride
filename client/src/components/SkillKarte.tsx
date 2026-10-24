import { Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import type { SkillEreignis } from '../../../shared/api/index.ts';
import { istAn } from '../../../shared/spiel/sichtbarkeit.ts';
import { lokalesDatum, tagesUeberschrift, uhrzeit, zahl } from '../format.ts';
import { useSichtbarkeit } from '../funktionen.ts';
import { Icon } from './Icons.tsx';

export function SkillKarte({ skill, onOeffnen }: { skill: SkillEreignis; onOeffnen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOeffnen}
      className="flex w-full items-center gap-3 rounded-2xl border border-xp/40 bg-xp/5 px-3 py-3 text-left transition hover:bg-xp/10"
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${skill.faehigkeitFarbe}22`, color: skill.faehigkeitFarbe }}
      >
        <Icon name={skill.faehigkeitIcon} className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate font-medium">
          <Sparkles className="size-4 shrink-0 text-xp" />
          {skill.titel}
        </span>
        <span className="block truncate text-xs text-leise">{skill.faehigkeitName}</span>
      </span>
      <span className="zahl shrink-0 text-sm font-semibold text-xp">+{zahl(skill.xp)} XP</span>
    </button>
  );
}

export function SkillDetail({ skill }: { skill: SkillEreignis }) {
  const faehigkeitenAn = istAn('faehigkeiten', useSichtbarkeit());
  const wann = `${tagesUeberschrift(lokalesDatum(new Date(skill.erstelltAm)))} · ${uhrzeit(skill.erstelltAm)}`;
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-leise">{wann}</p>
        <p className="zahl text-lg font-semibold text-xp">+{zahl(skill.xp)} XP</p>
      </div>
      {faehigkeitenAn ? (
        <Link to={`/faehigkeiten/${skill.faehigkeitId}`} className="block text-sm font-medium hover:underline">
          {skill.faehigkeitName}
        </Link>
      ) : (
        <p className="text-sm font-medium">{skill.faehigkeitName}</p>
      )}
    </div>
  );
}
