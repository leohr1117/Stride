import { useEffect, useState, type FormEvent } from 'react';
import { ebenenFuerStufe, hinweisAusblenden } from '../../../../shared/spiel/ebenen.ts';
import { GEBURTSJAHR_MIN, PROFILNAME_MAX, ZIEL_FRAGE, geburtsjahrGueltig, type Zielstrebigkeit } from '../../../../shared/spiel/profil.ts';
import { useBestaetigung } from '../../components/Bestaetigung.tsx';
import { ZielWahl } from '../../components/ProfilErstellung.tsx';
import { EINGABE_STIL, Feld, Fehlermeldung, Knopf, Ladeanzeige } from '../../ui/index.ts';
import { tx } from '../../text.ts';
import { FormularSeite, PROFIL_ZURUECK, useEinstellungen } from './rahmen.tsx';

export function NameSeite() {
  const { data, error, isPending, speichern } = useEinstellungen();
  const [profilname, setProfilname] = useState('');
  useEffect(() => {
    if (data) {
      setProfilname(data.charakterName);
    }
  }, [data]);
  const senden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    const name = profilname.trim();
    if (name !== '' && name !== data?.charakterName) {
      speichern.mutate({ charakterName: name });
    }
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
        <form onSubmit={senden} className="space-y-4">
          <Feld label={tx("Profilname")}>
            <input
              className={EINGABE_STIL}
              value={profilname}
              maxLength={PROFILNAME_MAX}
              onChange={(ereignis) => setProfilname(ereignis.target.value)}
            />
          </Feld>
          <Knopf
            type="submit"
            variante="primaer"
            className="w-full"
            disabled={speichern.isPending || profilname.trim() === '' || profilname.trim() === data.charakterName}
          >
            {tx("Speichern")}
          </Knopf>
          <Fehlermeldung fehler={speichern.error} />
        </form>
      }
    />
  );
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
    if (geaendert) {
      speichern.mutate({ geburtsjahr: jahr });
    }
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
        <form onSubmit={senden} className="space-y-4">
          <Feld label={tx("Geburtsjahr")}>
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
          {!jahrOk && <p className="text-xs text-gefahr">{tx("Das Geburtsjahr liegt außerhalb des erlaubten Bereichs.")}</p>}
          <Knopf type="submit" variante="primaer" className="w-full" disabled={!geaendert || speichern.isPending}>
            {tx("Speichern")}
          </Knopf>
          <Fehlermeldung fehler={speichern.error} />
        </form>
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
    if (!geaendert || !data || !ziel) {
      return;
    }
    const hinweis = hinweisAusblenden(data.ebenen, ebenenFuerStufe(ziel), data.ebenenZahlen);
    if (
      hinweis &&
      !(await bestaetigen({
        titel: tx("Ebenen ausblenden?"),
        text: hinweis,
        knopf: tx("Ausblenden"),
      }))
    ) {
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
        <form onSubmit={(ereignis) => void senden(ereignis)} className="space-y-4">
          <ZielWahl wert={ziel} onAendern={setZiel} />
          <Knopf type="submit" variante="primaer" className="w-full" disabled={!geaendert || speichern.isPending}>
            {tx("Speichern")}
          </Knopf>
          <Fehlermeldung fehler={speichern.error} />
        </form>
      }
    />
  );
}
