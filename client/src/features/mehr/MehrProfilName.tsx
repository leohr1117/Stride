import { useEffect, useState, type FormEvent } from 'react';
import { ebenenFuerStufe, hinweisAusblenden } from '../../../../shared/spiel/ebenen.ts';
import { bestaetigeAusblenden } from '../../ebenenFrage.ts';
import { GEBURTSJAHR_MIN, PROFILNAME_MAX, ZIEL_FRAGE, alterInJahren, geburtsjahrGueltig, type Zielstrebigkeit } from '../../../../shared/spiel/profil.ts';
import { useBestaetigung } from '../../components/Bestaetigung.tsx';
import { ZielWahl } from '../../components/ProfilErstellung.tsx';
import { EINGABE_STIL, Feld, Fehlermeldung, Formular, Knopf, Ladeanzeige } from '../../ui/index.ts';
import { tx, txMenge } from '../../text.ts';
import { FormularSeite, PROFIL_ZURUECK, useEinstellungen } from './rahmen.tsx';

export function NameSeite() {
  const { data, error, isPending, speichern } = useEinstellungen();
  const [profilname, setProfilname] = useState('');
  const [nameFehler, setNameFehler] = useState<string | null>(null);
  useEffect(() => {
    if (data) {
      setProfilname(data.charakterName);
    }
  }, [data]);
  const senden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    const name = profilname.trim();
    if (name === '') {
      setNameFehler('Der Name darf nicht leer sein.');
      return;
    }
    setNameFehler(null);
    if (speichern.isPending || name === data?.charakterName) {
      return;
    }
    speichern.mutate({ charakterName: name });
  };
  if (isPending) {
    return <FormularSeite titel={tx("Profilname")} zurueck={PROFIL_ZURUECK} kinder={<Ladeanzeige />} />;
  }
  if (error || !data) {
    return <FormularSeite titel={tx("Profilname")} zurueck={PROFIL_ZURUECK} kinder={<Fehlermeldung fehler={error} />} />;
  }
  return (
    <FormularSeite
      titel={tx("Profilname")}
      zurueck={PROFIL_ZURUECK}
      kinder={
        <Formular onAbsenden={senden}>
          <Feld label={tx("Profilname")} fehler={nameFehler}>
            <input
              className={EINGABE_STIL}
              value={profilname}
              maxLength={PROFILNAME_MAX}
              onChange={(ereignis) => {
                setProfilname(ereignis.target.value);
                setNameFehler(null);
              }}
            />
          </Feld>
          <Knopf type="submit" variante="primaer" className="w-full" aria-busy={speichern.isPending || undefined}>
            {tx("Speichern")}
          </Knopf>
          <Fehlermeldung fehler={speichern.error} />
        </Formular>
      }
    />
  );
}

function altersHinweis(jahr: number): string {
  const alter = alterInJahren(jahr);
  if (alter <= 0) {
    return tx('Du bist in diesem Jahr geboren.');
  }
  if (alter === 1) {
    return tx('Das entspricht ungefähr einem Jahr.');
  }
  return txMenge(alter, 'Das entspricht ungefähr {alter} Jahren.', { alter });
}

export function JahrSeite() {
  const { data, error, isPending, speichern } = useEinstellungen();
  const [jahrText, setJahrText] = useState('');
  useEffect(() => {
    if (data) {
      setJahrText(data.geburtsjahr === null ? '' : String(data.geburtsjahr));
    }
  }, [data]);
  const jahr = jahrText.trim() === '' ? null : Number(jahrText);
  const jahrOk = jahr === null || geburtsjahrGueltig(jahr);
  const geaendert = Boolean(data) && jahrOk && jahr !== data?.geburtsjahr;
  const senden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (!jahrOk) {
      ereignis.currentTarget.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    if (!geaendert || speichern.isPending) {
      return;
    }
    speichern.mutate({ geburtsjahr: jahr });
  };
  if (isPending) {
    return <FormularSeite titel={tx("Geburtsjahr")} zurueck={PROFIL_ZURUECK} kinder={<Ladeanzeige />} />;
  }
  if (error || !data) {
    return <FormularSeite titel={tx("Geburtsjahr")} zurueck={PROFIL_ZURUECK} kinder={<Fehlermeldung fehler={error} />} />;
  }
  return (
    <FormularSeite
      titel={tx("Geburtsjahr")}
      zurueck={PROFIL_ZURUECK}
      kinder={
        <Formular onAbsenden={senden}>
          <Feld
            label={tx("Geburtsjahr")}
            fehler={jahrOk ? null : 'Das Geburtsjahr liegt außerhalb des erlaubten Bereichs.'}
            hinweis={jahrOk && jahr !== null ? altersHinweis(jahr) : undefined}
          >
            <input
              className={EINGABE_STIL}
              type="number"
              inputMode="numeric"
              min={GEBURTSJAHR_MIN}
              max={new Date().getFullYear()}
              value={jahrText}
              onChange={(ereignis) => setJahrText(ereignis.target.value)}
            />
          </Feld>
          <Knopf type="submit" variante="primaer" className="w-full" aria-busy={speichern.isPending || undefined}>
            {tx("Speichern")}
          </Knopf>
          <Fehlermeldung fehler={speichern.error} />
        </Formular>
      }
    />
  );
}

export function ZielSeite() {
  const { data, error, isPending, speichern } = useEinstellungen();
  const bestaetigen = useBestaetigung();
  const [ziel, setZiel] = useState<Zielstrebigkeit | null>(null);
  useEffect(() => {
    if (data) {
      setZiel(data.zielstrebigkeit);
    }
  }, [data]);
  const geaendert = ziel !== null && ziel !== data?.zielstrebigkeit;
  const senden = async (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (speichern.isPending || !geaendert || !data || !ziel) {
      return;
    }
    const hinweis = hinweisAusblenden(data.ebenen, ebenenFuerStufe(ziel), data.ebenenZahlen);
    if (!(await bestaetigeAusblenden(bestaetigen, hinweis))) {
      return;
    }
    speichern.mutate({ zielstrebigkeit: ziel });
  };
  if (isPending) {
    return <FormularSeite titel={ZIEL_FRAGE} zurueck={PROFIL_ZURUECK} kinder={<Ladeanzeige />} />;
  }
  if (error || !data) {
    return <FormularSeite titel={ZIEL_FRAGE} zurueck={PROFIL_ZURUECK} kinder={<Fehlermeldung fehler={error} />} />;
  }
  return (
    <FormularSeite
      titel={ZIEL_FRAGE}
      zurueck={PROFIL_ZURUECK}
      kinder={
        <Formular onAbsenden={(ereignis) => void senden(ereignis)}>
          <ZielWahl wert={ziel} onAendern={setZiel} />
          <Knopf type="submit" variante="primaer" className="w-full" aria-busy={speichern.isPending || undefined}>
            {tx("Speichern")}
          </Knopf>
          <Fehlermeldung fehler={speichern.error} />
        </Formular>
      }
    />
  );
}
