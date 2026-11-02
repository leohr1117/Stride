import { useMutation } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { FOKUS_PFLICHT, type FokusId } from '../../../../shared/spiel/profil.ts';
import { api } from '../../api/index.ts';
import { FokusVorschau, FokusWahl } from '../../components/ProfilErstellung.tsx';
import { Fehlermeldung, Formular, Knopf, Ladeanzeige, PasswortFeld } from '../../ui/index.ts';
import { tx } from '../../text.ts';
import { FormularSeite, PROFIL_ZURUECK, useEinstellungen } from './rahmen.tsx';

const FOKUS_FEHLER = 'fokus-pflicht';
const FOKUS_KURZ = 'Speichern archiviert abgewählte Attribute.';

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
  const leer = fokus.length === 0;
  if (isPending) {
    return <FormularSeite titel={tx("Fokus")} zurueck={PROFIL_ZURUECK} kinder={<Ladeanzeige />} />;
  }
  if (error || !data) {
    return <FormularSeite titel={tx("Fokus")} zurueck={PROFIL_ZURUECK} kinder={<Fehlermeldung fehler={error} />} />;
  }
  return (
    <FormularSeite
      titel={tx("Fokus")}
      zurueck={PROFIL_ZURUECK}
      kinder={
        <Formular onAbsenden={senden}>
          <FokusWahl wert={fokus} onAendern={setFokus} ungueltig={leer} fehlerId={leer ? FOKUS_FEHLER : undefined} />
          {leer ? (
            <p id={FOKUS_FEHLER} className="feld-fehler text-[13px] leading-[18px] break-words text-gefahr" role="alert">
              <span aria-hidden="true">⚠ </span>
              {tx(FOKUS_PFLICHT)}
            </p>
          ) : null}
          <FokusVorschau fokus={fokus} />
          <Knopf type="submit" variante="primaer" className="w-full" disabled={!geaendert || speichern.isPending}>
            {tx("Speichern")}
          </Knopf>
          <p className="text-[13px] leading-[18px] text-leise">{tx(FOKUS_KURZ)}</p>
          <Fehlermeldung fehler={speichern.error} />
        </Formular>
      }
    />
  );
}

const PASSWORT_KURZ = 'Das Passwort muss mindestens 10 Zeichen haben.';
const PASSWORT_LANG = 'Das Passwort darf höchstens 200 Zeichen haben.';
const PASSWORT_FALSCH = 'Das Passwort ist falsch.';
const PASSWORT_FEHLT = 'Das bisherige Passwort fehlt.';
const PASSWORT_ABWEICHUNG = 'Die Passwörter stimmen nicht überein.';

function passwortOrt(text: string): 'bisher' | 'neu' | null {
  if (text === PASSWORT_FALSCH || text === PASSWORT_FEHLT) {
    return 'bisher';
  }
  if (text === PASSWORT_KURZ || text === PASSWORT_LANG) {
    return 'neu';
  }
  return null;
}

export function PasswortSeite() {
  const [bisher, setBisher] = useState('');
  const [neu, setNeu] = useState('');
  const [wiederholung, setWiederholung] = useState('');
  const [fehler, setFehler] = useState<unknown>(null);
  const [feldFehler, setFeldFehler] = useState<{ bisher: string | null; neu: string | null; wiederholung: string | null }>({
    bisher: null,
    neu: null,
    wiederholung: null,
  });
  const [gespeichert, setGespeichert] = useState(false);
  const aendern = useMutation({
    mutationFn: () => api.aenderePasswort(bisher, neu),
    onSuccess: () => {
      setBisher('');
      setNeu('');
      setWiederholung('');
      setFehler(null);
      setFeldFehler({ bisher: null, neu: null, wiederholung: null });
      setGespeichert(true);
    },
    onError: (aenderFehler) => {
      setGespeichert(false);
      const text = aenderFehler instanceof Error ? aenderFehler.message : '';
      const ort = passwortOrt(text);
      if (ort === 'bisher') {
        setFeldFehler({ bisher: text, neu: null, wiederholung: null });
        setFehler(null);
        return;
      }
      if (ort === 'neu') {
        setFeldFehler({ bisher: null, neu: text, wiederholung: null });
        setFehler(null);
        return;
      }
      setFeldFehler({ bisher: null, neu: null, wiederholung: null });
      setFehler(aenderFehler);
    },
  });
  const senden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    const naechstes = { bisher: null as string | null, neu: null as string | null, wiederholung: null as string | null };
    if (neu.length < 10) {
      naechstes.neu = PASSWORT_KURZ;
    } else if (neu.length > 200) {
      naechstes.neu = PASSWORT_LANG;
    }
    if (neu !== wiederholung) {
      naechstes.wiederholung = PASSWORT_ABWEICHUNG;
    }
    if (naechstes.neu || naechstes.wiederholung) {
      setGespeichert(false);
      setFeldFehler(naechstes);
      setFehler(null);
      return;
    }
    setFeldFehler({ bisher: null, neu: null, wiederholung: null });
    aendern.mutate();
  };
  return (
    <FormularSeite
      titel={tx("Passwort")}
      zurueck={PROFIL_ZURUECK}
      kinder={
        <Formular onAbsenden={senden}>
          <PasswortFeld
            label="Bisheriges"
            name="current-password"
            autoComplete="current-password"
            value={bisher}
            fehler={feldFehler.bisher}
            onChange={(ereignis) => {
              setBisher(ereignis.target.value);
              setFeldFehler((stand) => ({ ...stand, bisher: null }));
            }}
          />
          <PasswortFeld
            label="Neues"
            hinweis="Mindestens 10 Zeichen."
            name="new-password"
            autoComplete="new-password"
            value={neu}
            fehler={feldFehler.neu}
            onChange={(ereignis) => {
              setNeu(ereignis.target.value);
              setFeldFehler((stand) => ({ ...stand, neu: null }));
            }}
          />
          <PasswortFeld
            label="Wiederholen"
            fehler={feldFehler.wiederholung}
            autoComplete="new-password"
            value={wiederholung}
            onChange={(ereignis) => {
              setWiederholung(ereignis.target.value);
              setFeldFehler((stand) => ({ ...stand, wiederholung: null }));
            }}
          />
          <Knopf type="submit" variante="primaer" className="w-full" disabled={bisher === '' || neu === '' || aendern.isPending}>
            {tx("Passwort ändern")}
          </Knopf>
          {gespeichert && <p className="text-sm text-leise">{tx("Passwort gespeichert.")}</p>}
          <Fehlermeldung fehler={fehler} />
        </Formular>
      }
    />
  );
}
