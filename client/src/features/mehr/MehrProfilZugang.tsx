import { useMutation } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { FOKUS_PFLICHT, type FokusId } from '../../../../shared/spiel/profil.ts';
import { api } from '../../api/index.ts';
import { FokusVorschau, FokusWahl } from '../../components/ProfilErstellung.tsx';
import { Fehlermeldung, Formular, Knopf, Ladeanzeige, PasswortFeld } from '../../ui/index.ts';
import { tx } from '../../text.ts';
import { FormularSeite, PROFIL_ZURUECK, useEinstellungen } from './rahmen.tsx';

const FOKUS_INFO = 'Speichern ergänzt fehlende Attribute, archiviert andere und legt fehlende Starter-Tätigkeiten an.';

function gleicheFokus(links: readonly FokusId[], rechts: readonly FokusId[]): boolean {
  if (links.length !== rechts.length) {
    return false;
  }
  const menge = new Set(rechts);
  return links.every((id) => menge.has(id));
}

export function FokusSeite() {
  const { data, error, isPending, speichern } = useEinstellungen();
  const [fokus, setFokus] = useState<FokusId[]>([]);
  useEffect(() => {
    if (data) {
      setFokus(data.fokus);
    }
  }, [data]);
  const geaendert = Boolean(data) && !gleicheFokus(fokus, data?.fokus ?? []) && fokus.length > 0;
  const senden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (geaendert) {
      speichern.mutate({ fokus: [...fokus] });
    }
  };
  if (isPending) {
    return <FormularSeite titel={tx("Fokus")} info={FOKUS_INFO} zurueck={PROFIL_ZURUECK} kinder={<Ladeanzeige />} />;
  }
  if (error || !data) {
    return <FormularSeite titel={tx("Fokus")} info={FOKUS_INFO} zurueck={PROFIL_ZURUECK} kinder={<Fehlermeldung fehler={error} />} />;
  }
  return (
    <FormularSeite
      titel={tx("Fokus")}
      info={FOKUS_INFO}
      zurueck={PROFIL_ZURUECK}
      kinder={
        <Formular onAbsenden={senden}>
          <FokusWahl wert={fokus} onAendern={setFokus} />
          <FokusVorschau fokus={fokus} />
          {fokus.length === 0 && <p className="text-xs text-leise">{tx(FOKUS_PFLICHT)}</p>}
          <Knopf type="submit" variante="primaer" className="w-full" disabled={!geaendert || speichern.isPending}>
            {tx("Speichern")}
          </Knopf>
          <Fehlermeldung fehler={speichern.error} />
        </Formular>
      }
    />
  );
}

export function PasswortSeite() {
  const [bisher, setBisher] = useState('');
  const [neu, setNeu] = useState('');
  const [wiederholung, setWiederholung] = useState('');
  const [fehler, setFehler] = useState<unknown>(null);
  const [abweichung, setAbweichung] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState(false);
  const aendern = useMutation({
    mutationFn: () => api.aenderePasswort(bisher, neu),
    onSuccess: () => {
      setBisher('');
      setNeu('');
      setWiederholung('');
      setFehler(null);
      setGespeichert(true);
    },
    onError: (aenderFehler) => {
      setGespeichert(false);
      setFehler(aenderFehler);
    },
  });
  const senden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (neu !== wiederholung) {
      setGespeichert(false);
      setAbweichung('Die Passwörter stimmen nicht überein.');
      setFehler(null);
      return;
    }
    setAbweichung(null);
    aendern.mutate();
  };
  return (
    <FormularSeite
      titel={tx("Passwort")}
      zurueck={PROFIL_ZURUECK}
      kinder={
        <Formular onAbsenden={senden}>
          <PasswortFeld
            label={tx("Bisheriges Passwort")}
            name="current-password"
            autoComplete="current-password"
            value={bisher}
            onChange={(ereignis) => setBisher(ereignis.target.value)}
          />
          <PasswortFeld
            label={tx("Neues Passwort")}
            hinweis={tx("Mindestens 10 Zeichen.")}
            name="new-password"
            autoComplete="new-password"
            value={neu}
            onChange={(ereignis) => setNeu(ereignis.target.value)}
          />
          <PasswortFeld
            label={tx("Neues Passwort wiederholen")}
            fehler={abweichung}
            autoComplete="new-password"
            value={wiederholung}
            onChange={(ereignis) => {
              setWiederholung(ereignis.target.value);
              setAbweichung(null);
            }}
          />
          <Knopf type="submit" variante="primaer" className="w-full" disabled={bisher === '' || neu === '' || aendern.isPending}>
            {tx("Passwort ändern")}
          </Knopf>
          {gespeichert && <p className="text-sm text-leise">{tx("Passwort gespeichert.")}</p>}
          <Fehlermeldung fehler={fehler ?? aendern.error} />
        </Formular>
      }
    />
  );
}
