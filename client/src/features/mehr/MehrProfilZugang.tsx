import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { FOKUS_PFLICHT, type FokusId } from '../../../../shared/spiel/profil.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { FokusWahl } from '../../components/ProfilErstellung.tsx';
import { EINGABE_STIL, Feld, Fehlermeldung, Knopf, Ladeanzeige, PasswortFeld } from '../../ui/index.ts';
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
        <form onSubmit={senden} className="space-y-4">
          <FokusWahl wert={fokus} onAendern={setFokus} />
          {fokus.length === 0 && <p className="text-xs text-leise">{FOKUS_PFLICHT}</p>}
          <Knopf type="submit" variante="primaer" className="w-full" disabled={!geaendert || speichern.isPending}>
            {tx("Speichern")}
          </Knopf>
          <Fehlermeldung fehler={speichern.error} />
        </form>
      }
    />
  );
}

export function BenutzerSeite() {
  const queryClient = useQueryClient();
  const { data: zugang } = useQuery({ queryKey: SCHLUESSEL.zugang, queryFn: api.zugang });
  const [benutzername, setBenutzername] = useState('');
  const [fehler, setFehler] = useState<unknown>(null);
  useEffect(() => {
    if (zugang?.benutzername) {
      setBenutzername(zugang.benutzername);
    }
  }, [zugang?.benutzername]);
  const speichern = useMutation({
    mutationFn: () => api.setzeBenutzername(benutzername.trim()),
    onSuccess: (status) => {
      queryClient.setQueryData(SCHLUESSEL.zugang, status);
      setFehler(null);
      void queryClient.invalidateQueries({ queryKey: SCHLUESSEL.konten });
    },
    onError: setFehler,
  });
  return (
    <FormularSeite
      titel={tx("Benutzername")}
      zurueck={PROFIL_ZURUECK}
      kinder={
        <form
          onSubmit={(ereignis) => {
            ereignis.preventDefault();
            speichern.mutate();
          }}
          className="space-y-4"
        >
          <Feld label={tx("Benutzername")}>
            <input
              className={EINGABE_STIL}
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={benutzername}
              onChange={(ereignis) => setBenutzername(ereignis.target.value)}
            />
          </Feld>
          <Knopf
            type="submit"
            variante="primaer"
            className="w-full"
            disabled={speichern.isPending || benutzername.trim() === '' || benutzername.trim() === zugang?.benutzername}
          >
            {tx("Speichern")}
          </Knopf>
          <Fehlermeldung fehler={fehler ?? speichern.error} />
        </form>
      }
    />
  );
}

export function PasswortSeite() {
  const [bisher, setBisher] = useState('');
  const [neu, setNeu] = useState('');
  const [wiederholung, setWiederholung] = useState('');
  const [fehler, setFehler] = useState<unknown>(null);
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
      setFehler(new Error(tx("Die Passwörter stimmen nicht überein.")));
      return;
    }
    aendern.mutate();
  };
  return (
    <FormularSeite
      titel={tx("Passwort")}
      zurueck={PROFIL_ZURUECK}
      kinder={
        <form onSubmit={senden} className="space-y-4">
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
            autoComplete="new-password"
            value={wiederholung}
            onChange={(ereignis) => setWiederholung(ereignis.target.value)}
          />
          <Knopf type="submit" variante="primaer" className="w-full" disabled={bisher === '' || neu === '' || aendern.isPending}>
            {tx("Passwort ändern")}
          </Knopf>
          {gespeichert && <p className="text-sm text-leise">{tx("Passwort gespeichert.")}</p>}
          <Fehlermeldung fehler={fehler ?? aendern.error} />
        </form>
      }
    />
  );
}
