import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useParams } from 'react-router';
import type { ErfolgStufe, Erfolge } from '../../../../shared/api/index.ts';
import { EBENEN, ZIEL_MARKE, type Ebenen } from '../../../../shared/spiel/ebenen.ts';
import { FOKUS_LISTE, ZIEL_FRAGE, ZIELSTREBIGKEIT_INFO, type FokusId } from '../../../../shared/spiel/profil.ts';
import { erfolgSichtbar, type Sichtbarkeit } from '../../../../shared/spiel/sichtbarkeit.ts';
import { api, SCHLUESSEL, meldeAnmeldungAbgelaufen } from '../../api/index.ts';
import { Fehlermeldung, Karte, Ladeanzeige } from '../../ui/index.ts';
import { Zeile, ZeilenGruppe } from '../../components/Zeile.tsx';
import { useSichtbarkeit } from '../../funktionen.ts';
import { tx } from '../../text.ts';
import { AccountsBereich } from './MehrAccounts.tsx';
import { BenutzerSeite, FokusSeite, PasswortSeite } from './MehrProfilZugang.tsx';
import { JahrSeite, NameSeite, ZielSeite } from './MehrProfilName.tsx';
import { Bereich, FormularSeite, PROFIL_HASH, PROFIL_ZURUECK, useEinstellungen, useHashWeiter } from './rahmen.tsx';

function fokusText(fokus: readonly FokusId[]): string {
  const namen = fokus
    .map((id) => FOKUS_LISTE.find((eintrag) => eintrag.id === id)?.label)
    .filter((name): name is string => Boolean(name))
    .map((name) => tx(name));
  return namen.length > 0 ? namen.join(', ') : '—';
}

function stufenText(ebenen: Ebenen): string {
  const namen = EBENEN.filter((ebene) => ebenen[ebene]).map((ebene) => tx(ZIEL_MARKE[ebene].mehrzahl));
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
  const { data: konten } = useQuery({ queryKey: SCHLUESSEL.konten, queryFn: api.konten, enabled: inhaber });
  const { data: erfolge } = useQuery({ queryKey: SCHLUESSEL.erfolge, queryFn: api.erfolge });
  const [abmeldeFehler, setAbmeldeFehler] = useState<unknown>(null);
  const abmelden = async () => {
    try {
      await api.abmelden();
      meldeAnmeldungAbgelaufen();
    } catch (fehler) {
      setAbmeldeFehler(fehler);
    }
  };
  if (isPending || zugangLaedt) {
    return <Bereich titel={tx("Profil")} kinder={<Ladeanzeige />} />;
  }
  if (error || !data) {
    return <Bereich titel={tx("Profil")} kinder={<Fehlermeldung fehler={error} />} />;
  }
  return (
    <Bereich
      titel={tx("Profil")}
      kinder={
        <div className="space-y-8">
          <ZeilenGruppe titel="Du">
            <Zeile titel={tx("Profilname")} wert={data.charakterName} nach="/mehr/profil/name" />
            <Zeile titel={tx("Titel")} wert={titelName(erfolge)} nach="/mehr/profil/titel" />
            <Zeile
              titel={tx("Geburtsjahr")}
              wert={data.geburtsjahr === null ? '—' : String(data.geburtsjahr)}
              nach="/mehr/profil/jahr"
            />
            <Zeile
              titel={ZIEL_FRAGE}
              wert={data.zielstrebigkeit ? tx(ZIELSTREBIGKEIT_INFO[data.zielstrebigkeit].titel) : '—'}
              nach="/mehr/profil/ziel"
            />
            <Zeile titel={tx("Fokus")} wert={fokusText(data.fokus)} nach="/mehr/profil/fokus" />
            <Zeile titel={tx("Ziel-Stufen")} wert={stufenText(data.ebenen)} nach="/mehr/funktionen#ziel-stufen" />
          </ZeilenGruppe>
          <ZeilenGruppe titel={tx("Anmeldung")}>
            {zugang?.benutzername ? (
              <Zeile titel={tx("Benutzername")} wert={zugang.benutzername} nach="/mehr/profil/benutzer" />
            ) : null}
            <Zeile titel={tx("Passwort")} nach="/mehr/profil/passwort" />
            <Zeile titel={tx("Abmelden")} gefahr pfeil={false} onKlick={() => void abmelden()} />
          </ZeilenGruppe>
          {inhaber ? (
            <ZeilenGruppe titel={tx("Accounts")}>
              <Zeile titel={tx("Accounts")} wert={konten ? String(konten.length) : undefined} nach="/mehr/profil/accounts" />
            </ZeilenGruppe>
          ) : null}
          <Fehlermeldung fehler={abmeldeFehler} />
        </div>
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
  const optionen: { schluessel: string | null; name: string }[] = [
    { schluessel: null, name: tx("Kein Titel") },
    ...waehlbareTitel(erfolge, sichtbarkeit).map((stufe) => ({ schluessel: stufe.schluessel, name: stufe.name })),
  ];
  const aktuell = erfolge.titel;
  return (
    <FormularSeite
      titel={tx("Titel")}
      zurueck={PROFIL_ZURUECK}
      kinder={
        <>
          <Karte dicht>
            <div className="divide-y divide-rand">
              {optionen.map((option) => {
                const aktiv = aktuell === option.schluessel;
                return (
                  <button
                    key={option.schluessel ?? 'kein'}
                    type="button"
                    disabled={setzen.isPending}
                    onClick={() => {
                      if (!aktiv) {
                        setzen.mutate(option.schluessel);
                      }
                    }}
                    className="flex min-h-12 w-full items-center gap-3 px-4 text-left"
                  >
                    <span className={`min-w-0 flex-1 truncate text-sm font-medium ${aktiv ? 'text-akzent' : ''}`}>{option.name}</span>
                    {aktiv ? <Check className="size-4 shrink-0 text-akzent" /> : null}
                  </button>
                );
              })}
            </div>
          </Karte>
          <Fehlermeldung fehler={setzen.error} />
        </>
      }
    />
  );
}

export function MehrProfilSeite() {
  const { teil } = useParams();
  useHashWeiter(PROFIL_HASH);
  if (teil === 'name') {
    return <NameSeite />;
  }
  if (teil === 'titel') {
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
    return <BenutzerSeite />;
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
