import { tx } from '../text.ts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { Faehigkeit } from '../../../shared/api/index.ts';
import { FARBEN, GRENZEN, type IconName } from '../../../shared/spiel/begriffe.ts';
import { api } from '../api/index.ts';
import { IconAuswahl } from './IconAuswahl.tsx';
import { EINGABE_STIL, Farbauswahl, Feld, Fehlermeldung, Formular, Knopf } from '../ui/index.ts';

export function FaehigkeitFormular({
  faehigkeit,
  onFertig,
}: {
  faehigkeit: Faehigkeit | null;
  onFertig: (gespeichert: Faehigkeit) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(faehigkeit?.name ?? '');
  const [beschreibung, setBeschreibung] = useState(faehigkeit?.beschreibung ?? '');
  const [farbe, setFarbe] = useState(faehigkeit?.farbe ?? FARBEN[1]);
  const [icon, setIcon] = useState<IconName>((faehigkeit?.icon as IconName | undefined) ?? 'code');

  const speichern = useMutation({
    mutationFn: () => {
      const daten = { name, beschreibung, farbe, icon };
      if (!faehigkeit) {
        return api.erstelleFaehigkeit(daten);
      }
      return api.aendereFaehigkeit(faehigkeit.id, daten);
    },
    onSuccess: (gespeichert) => {
      void queryClient.invalidateQueries();
      onFertig(gespeichert);
    },
  });

  const absenden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    speichern.mutate();
  };

  return (
    <Formular onAbsenden={absenden}>
      <Feld label={tx("Titel")}>
        <input
          className={EINGABE_STIL}
          value={name}
          maxLength={GRENZEN.nameMax}
          onChange={(ereignis) => setName(ereignis.target.value)}
          autoFocus
        />
      </Feld>
      <Feld label={tx("Beschreibung")}>
        <input
          className={EINGABE_STIL}
          value={beschreibung}
          maxLength={GRENZEN.beschreibungMax}
          onChange={(ereignis) => setBeschreibung(ereignis.target.value)}
        />
      </Feld>
      <Feld label={tx("Symbol")}>
        <IconAuswahl wert={icon} farbe={farbe} onAendern={setIcon} />
      </Feld>
      <Feld label={tx("Farbe")}>
        <Farbauswahl wert={farbe} onAendern={setFarbe} />
      </Feld>
      <Fehlermeldung fehler={speichern.error} />
      <Knopf type="submit" variante="primaer" className="w-full" disabled={!name.trim() || speichern.isPending}>
        {tx("Speichern")}
      </Knopf>
    </Formular>
  );
}
