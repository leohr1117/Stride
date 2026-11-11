import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useLocation, useParams } from 'react-router';
import type { ErfolgStufe, Erfolge } from '../../../../shared/api/index.ts';
import { FOKUS_LISTE, ZIEL_FRAGE, ZIELSTREBIGKEIT_INFO, type FokusId } from '../../../../shared/spiel/profil.ts';
import { erfolgSichtbar, type Sichtbarkeit } from '../../../../shared/spiel/sichtbarkeit.ts';
import { api, SCHLUESSEL, meldeAnmeldungAbgelaufen } from '../../api/index.ts';
import { AbschnittKopf, Fehlermeldung, Ladeanzeige, Optionsliste } from '../../ui/index.ts';
import { Absender } from '../../components/Absender.tsx';
import { useBestaetigung } from '../../components/Bestaetigung.tsx';
import { DichteZeilen, Liste, Zeile } from '../../components/Zeile.tsx';
import { useSichtbarkeit } from '../../funktionen.ts';
import { tx } from '../../text.ts';
import { KontoLoeschen } from './KontoLoeschen.tsx';
import { GoogleKonto } from './GoogleKonto.tsx';
import { AccountsBereich } from './MehrAccounts.tsx';
import { FokusSeite, PasswortSeite } from './MehrProfilZugang.tsx';
import { JahrSeite, NameSeite, ZielSeite } from './MehrProfilName.tsx';
import { Bereich, FormularSeite, PROFIL_HASH, PROFIL_ZURUECK, useEinstellungen, useHashWeiter } from './rahmen.tsx';

function fokusText(fokus: readonly FokusId[]): string {
  const namen = fokus
    .map((id) => FOKUS_LISTE.find((eintrag) => eintrag.id === id)?.label)
    .filter((name): name is string => Boolean(name))
    .map((name) => tx(name));
  return namen.length > 0 ? namen.join(', ') : '—';
}

function waehlbareTitel(erfolge: Erfolge, sichtbarkeit: Sichtbarkeit): ErfolgStufe[] {
  const stufen: ErfolgStufe[] = [];
  for (const kategorie of erfolge.kategorien) {
    if (!erfolgSichtbar(kategorie.kennzahl, sichtbarkeit)) {
      continue;
    }
    for (const stufe of kategorie.stufen) {
      if (stufe.erreichtAm !== null) {
        stufen.push(stufe);
      }
    }
  }
  if (erfolge.titel && !stufen.some((stufe) => stufe.schluessel === erfolge.titel)) {
    for (const kategorie of erfolge.kategorien) {
      const stufe = kategorie.stufen.find((eintrag) => eintrag.schluessel === erfolge.titel && eintrag.erreichtAm !== null);
      if (stufe) {
        stufen.push(stufe);
      }
    }
  }
  return stufen;
}

function titelName(erfolge: Erfolge | undefined): string {
  if (!erfolge?.titel) {
    return '—';
  }
  for (const kategorie of erfolge.kategorien) {
    const stufe = kategorie.stufen.find((eintrag) => eintrag.schluessel === erfolge.titel);
    if (stufe) {
      return tx(stufe.name);
    }
  }
  return '—';
}

function ProfilListe() {
  const { data, error, isPending } = useEinstellungen();
  const { data: zugang, isPending: zugangLaedt } = useQuery({ queryKey: SCHLUESSEL.zugang, queryFn: api.zugang });
  const inhaber = zugang?.rolle === 'inhaber';
  const admin = Boolean(zugang?.admin);
  const { data: konten } = useQuery({ queryKey: SCHLUESSEL.konten, queryFn: api.konten, enabled: inhaber });
  const { data: adminKonten } = useQuery({
    queryKey: SCHLUESSEL.adminKonten,
    queryFn: api.adminKonten,
    enabled: admin && !inhaber,
  });
  const accountZahl = inhaber ? konten?.length : adminKonten?.length;
  const { data: erfolge } = useQuery({ queryKey: SCHLUESSEL.erfolge, queryFn: api.erfolge });
  const [abmeldeFehler, setAbmeldeFehler] = useState<unknown>(null);
  const bestaetigen = useBestaetigung();
  const abmelden = async () => {
    const ja = await bestaetigen({
      titel: 'Abmelden?',
      text: 'Die Sitzung auf diesem Gerät endet.',
      knopf: 'Abmelden',
      gefahr: true,
    });
    if (!ja) {
      return;
    }
    try {
      await api.abmelden();
      meldeAnmeldungAbgelaufen();
    } catch (fehler) {
      setAbmeldeFehler(fehler);
    }
  };
  if (isPending || zugangLaedt) {
    return <Bereich titel={tx("Konto")} kinder={<Ladeanzeige />} />;
  }
  if (error || !data) {
    return <Bereich titel={tx("Konto")} kinder={<Fehlermeldung fehler={error} />} />;
  }
  return (
    <Bereich
      titel={tx("Konto")}
      kinder={
        <DichteZeilen>
        <>
          <section>
            <AbschnittKopf titel={tx("Profil")} />
            <Liste>
              <Zeile titel={tx("Profilname")} wert={data.charakterName} nach="/mehr/profil/name" />
              {data.funktionen.erfolge ? (
                <Zeile titel={tx("Titel")} wert={titelName(erfolge)} nach="/mehr/profil/titel" />
              ) : null}
              <Zeile
                titel={tx("Geburtsjahr")}
                wert={data.geburtsjahr === null ? '—' : String(data.geburtsjahr)}
                nach="/mehr/profil/jahr"
              />
              <Zeile
                titel={tx(ZIEL_FRAGE)}
                wert={data.zielstrebigkeit ? tx(ZIELSTREBIGKEIT_INFO[data.zielstrebigkeit].titel) : '—'}
                nach="/mehr/profil/ziel"
              />
              <Zeile titel={tx("Fokus")} wert={fokusText(data.fokus)} nach="/mehr/profil/fokus" />
            </Liste>
          </section>
          <section>
            <AbschnittKopf titel={tx("Anmeldung")} />
            <Liste>
              {zugang?.benutzername ? (
                <Zeile
                  id="profil-benutzername"
                  titel={tx("Benutzername")}
                  wert={zugang.benutzername}
                  pfeil={false}
                />
              ) : null}
              <Zeile titel={tx("Passwort")} nach="/mehr/profil/passwort" />
              <GoogleKonto zugang={zugang} />
              {inhaber || admin ? (
                <Zeile titel={tx("Accounts")} wert={accountZahl === undefined ? undefined : String(accountZahl)} nach="/mehr/profil/accounts" />
              ) : null}
              <Zeile titel={tx("Abmelden")} gefahr pfeil={false} onKlick={() => void abmelden()} />
            </Liste>
          </section>
          <KontoLoeschen
            benutzername={zugang?.benutzername ?? null}
            admin={admin}
            inhaber={inhaber}
            konten={konten}
          />
          <Fehlermeldung fehler={abmeldeFehler} />
          <Absender className="mt-6" />
        </>
        </DichteZeilen>
      }
    />
  );
}

function TitelSeite() {
  const queryClient = useQueryClient();
  const sichtbarkeit = useSichtbarkeit();
  const { data: erfolge, error, isPending } = useQuery({ queryKey: SCHLUESSEL.erfolge, queryFn: api.erfolge });
  const setzen = useMutation({
    mutationFn: (schluessel: string | null) => api.setzeTitel(schluessel),
    onSuccess: (neu) => {
      queryClient.setQueryData(SCHLUESSEL.erfolge, neu);
      void queryClient.invalidateQueries();
    },
  });
  if (isPending) {
    return <FormularSeite titel={tx("Titel")} zurueck={PROFIL_ZURUECK} kinder={<Ladeanzeige />} />;
  }
  if (error || !erfolge) {
    return <FormularSeite titel={tx("Titel")} zurueck={PROFIL_ZURUECK} kinder={<Fehlermeldung fehler={error} />} />;
  }
  const optionen = [
    { wert: '', label: 'Kein Titel' },
    ...waehlbareTitel(erfolge, sichtbarkeit).map((stufe) => ({ wert: stufe.schluessel, label: tx(stufe.name) })),
  ];
  const aktuell = erfolge.titel ?? '';
  return (
    <FormularSeite
      titel={tx("Titel")}
      zurueck={PROFIL_ZURUECK}
      kinder={
        <>
          <Optionsliste
            name={tx("Titel")}
            optionen={optionen}
            wert={aktuell}
            onAendern={(wert) => {
              if (setzen.isPending || wert === aktuell) {
                return;
              }
              setzen.mutate(wert === '' ? null : wert);
            }}
          />
          <Fehlermeldung fehler={setzen.error} />
        </>
      }
    />
  );
}

export function MehrProfilSeite() {
  const { teil } = useParams();
  const { pathname } = useLocation();
  const einstellungen = useEinstellungen();
  useHashWeiter(PROFIL_HASH);
  if (pathname.startsWith('/mehr/profil/benutzernamen')) {
    return <Navigate to="/mehr/profil/accounts" replace />;
  }
  if (teil === 'name') {
    return <NameSeite />;
  }
  if (teil === 'titel') {
    if (einstellungen.isPending) {
      return <FormularSeite titel={tx('Titel')} zurueck={PROFIL_ZURUECK} kinder={<Ladeanzeige />} />;
    }
    if (!einstellungen.data?.funktionen.erfolge) {
      return <Navigate to="/mehr/profil" replace />;
    }
    return <TitelSeite />;
  }
  if (teil === 'jahr') {
    return <JahrSeite />;
  }
  if (teil === 'ziel') {
    return <ZielSeite />;
  }
  if (teil === 'fokus') {
    return <FokusSeite />;
  }
  if (teil === 'stufen') {
    return <Navigate to="/mehr/funktionen#ziel-stufen" replace />;
  }
  if (teil === 'benutzer') {
    return <Navigate to="/mehr/profil" replace />;
  }
  if (teil === 'passwort') {
    return <PasswortSeite />;
  }
  if (teil === 'accounts') {
    return <AccountsBereich />;
  }
  if (teil) {
    return <Navigate to="/mehr/profil" replace />;
  }
  return <ProfilListe />;
}
