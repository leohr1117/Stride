import { tx } from '../../text.ts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { AktivierungsModus, Attribut } from '../../../../shared/api/index.ts';
import type { AttributVorlage } from '../../../../shared/features/attribute/attributKatalog.ts';
import { GRENZEN } from '../../../../shared/spiel/begriffe.ts';
import { LEVEL_SCHAETZUNG } from '../../../../shared/spiel/orientierung.ts';
import { berechneLevel, LEVEL_KURVEN } from '../../../../shared/spiel/level.ts';
import { zielXpNachAnteil } from '../../../../shared/spiel/umverteilung.ts';
import { api } from '../../api/index.ts';
import { zahl } from '../../format.ts';
import { Fehlermeldung, Knopf, VorschlagFeld } from '../../ui/index.ts';

export function ziffern(max: number) {
  return (roh: string) => roh.replace(/\D/g, '').slice(0, max);
}

function gesamtXp(attribute: Attribut[]): number {
  let summe = 0;
  for (const attribut of attribute) {
    summe += attribut.level.xpGesamt;
  }
  return summe;
}

export function Aktivierung({
  vorlage,
  archiviert,
  attribute,
  onFertig,
}: {
  vorlage: AttributVorlage;
  archiviert: Attribut | undefined;
  attribute: Attribut[];
  onFertig: () => void;
}) {
  const queryClient = useQueryClient();
  const [modus, setModus] = useState<AktivierungsModus>('behalten');
  const [level, setLevel] = useState('');
  const levelZahl = /^\d+$/.test(level) ? Number(level) : Number.NaN;
  const levelGueltig = Number.isInteger(levelZahl) && levelZahl >= 1 && levelZahl <= GRENZEN.visionLevelMax;
  const schaetzung = LEVEL_SCHAETZUNG.map((stufe) => ({
    id: String(stufe),
    wert: String(stufe),
    zeile: zahl(stufe),
    name: zahl(stufe),
  }));
  const anteilLevel =
    archiviert?.archivAnteil != null
      ? berechneLevel(zielXpNachAnteil(archiviert.archivAnteil, gesamtXp(attribute)), LEVEL_KURVEN[vorlage.typ]).level
      : null;

  const optionen: { wert: AktivierungsModus; label: string }[] = archiviert
    ? [
        { wert: 'behalten', label: tx('Level {level} behalten', { level: zahl(archiviert.level.level) }) },
        ...(anteilLevel !== null
          ? [{ wert: 'anteil' as const, label: tx('Neu berechnen · Level {level}', { level: zahl(anteilLevel) }) }]
          : []),
        { wert: 'level', label: tx("Selbst schätzen") },
      ]
    : [
        { wert: 'behalten', label: tx("Bei Level 1 starten") },
        { wert: 'level', label: tx("Selbst schätzen") },
      ];

  const aktivieren = useMutation({
    mutationFn: () => api.aktiviereAttribut(vorlage.kennung, modus, modus === 'level' ? levelZahl : null),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onFertig();
    },
  });

  return (
    <div className="space-y-3 border-t border-rand pt-3">
      <div className="space-y-1.5">
        {optionen.map((option) => (
          <label key={option.wert} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name={`modus-${vorlage.kennung}`}
              checked={modus === option.wert}
              onChange={() => setModus(option.wert)}
              className="accent-[var(--akzent)]"
            />
            {option.label}
          </label>
        ))}
      </div>
      {modus === 'level' && (
        <VorschlagFeld
          label="Level"
          text={level}
          onText={setLevel}
          optionen={schaetzung}
          fokus
          fehler={
            level === '' || levelGueltig
              ? null
              : levelZahl < 1 || !Number.isInteger(levelZahl)
                ? tx('Das Level muss mindestens 1 sein.')
                : tx('Das Level darf höchstens {max} sein.', { max: zahl(GRENZEN.visionLevelMax) })
          }
          bereinige={ziffern(5)}
        />
      )}
      <Fehlermeldung fehler={aktivieren.error} />
      <Knopf
        variante="primaer"
        className="w-full"
        onClick={() => aktivieren.mutate()}
        disabled={aktivieren.isPending || (modus === 'level' && !levelGueltig)}
      >
        {archiviert ? tx("Wiederherstellen") : tx("Hinzufügen")}
      </Knopf>
    </div>
  );
}
