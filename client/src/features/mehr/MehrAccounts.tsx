import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate } from 'react-router';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { SchnellZeile } from '../../components/SchnellAktion.tsx';
import { EINGABE_STIL, Feld, Fehlermeldung, Formular, Karte, Knopf, Ladeanzeige, PasswortFeld } from '../../ui/index.ts';
import { Zeile, ZeilenGruppe } from '../../components/Zeile.tsx';
import { tx } from '../../text.ts';
import { Bereich, PROFIL_ZURUECK } from './rahmen.tsx';

export function AccountsBereich() {
  const queryClient = useQueryClient();
  const { data: zugang, isPending: zugangLaedt, error: zugangFehler } = useQuery({
    queryKey: SCHLUESSEL.zugang,
    queryFn: api.zugang,
  });
  const inhaber = zugang?.rolle === 'inhaber';
  const { data: konten = [] } = useQuery({ queryKey: SCHLUESSEL.konten, queryFn: api.konten, enabled: inhaber });
  const [kontoName, setKontoName] = useState('');
  const [kontoPasswort, setKontoPasswort] = useState('');
  const [kontoProfil, setKontoProfil] = useState('');
  const [profilGeaendert, setProfilGeaendert] = useState(false);
  const [fehler, setFehler] = useState<unknown>(null);
  const anlegen = useMutation({
    mutationFn: () =>
      api.erstelleKonto({
        benutzername: kontoName.trim(),
        passwort: kontoPasswort,
        profilname: (profilGeaendert ? kontoProfil : kontoName).trim(),
      }),
    onSuccess: () => {
      setKontoName('');
      setKontoPasswort('');
      setKontoProfil('');
      setProfilGeaendert(false);
      setFehler(null);
      void queryClient.invalidateQueries({ queryKey: SCHLUESSEL.konten });
    },
    onError: setFehler,
  });

  if (zugangLaedt) {
    return <Bereich titel={tx("Accounts")} zurueck={PROFIL_ZURUECK} kinder={<Ladeanzeige />} />;
  }
  if (zugangFehler || !zugang) {
    return <Bereich titel={tx("Accounts")} zurueck={PROFIL_ZURUECK} kinder={<Fehlermeldung fehler={zugangFehler} />} />;
  }
  if (!inhaber) {
    return <Navigate to="/mehr/profil" replace />;
  }

  return (
    <Bereich
      titel={tx("Accounts")}
      zurueck={PROFIL_ZURUECK}
      kinder={
        <div className="space-y-8">
          <ZeilenGruppe>
            {konten.map((konto) => (
              <SchnellZeile
                key={konto.id}
                ziel={{
                  art: 'konto',
                  id: konto.id,
                  name: konto.benutzername,
                  gesperrt: konto.rolle === 'inhaber',
                }}
              >
                {(menue) => (
                  <Zeile
                    titel={konto.benutzername}
                    wert={konto.rolle === 'inhaber' ? tx("Inhaber") : tx("Mitglied")}
                    pfeil={false}
                    rechts={menue}
                  />
                )}
              </SchnellZeile>
            ))}
          </ZeilenGruppe>
          <Karte>
            <Formular
              onAbsenden={(ereignis) => {
                ereignis.preventDefault();
                anlegen.mutate();
              }}
              abstand="space-y-3"
            >
              <Feld label={tx("Benutzername")}>
                <input
                  className={EINGABE_STIL}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={kontoName}
                  onChange={(ereignis) => {
                    const wert = ereignis.target.value;
                    setKontoName(wert);
                    if (!profilGeaendert) {
                      setKontoProfil(wert);
                    }
                  }}
                />
              </Feld>
              <Feld label={tx("Profilname")}>
                <input
                  className={EINGABE_STIL}
                  value={kontoProfil}
                  onChange={(ereignis) => {
                    setProfilGeaendert(true);
                    setKontoProfil(ereignis.target.value);
                  }}
                />
              </Feld>
              <PasswortFeld
                label={tx("Passwort")}
                hinweis={tx("Mindestens 10 Zeichen.")}
                autoComplete="new-password"
                value={kontoPasswort}
                onChange={(ereignis) => setKontoPasswort(ereignis.target.value)}
              />
              <Knopf type="submit" variante="primaer" className="w-full" disabled={anlegen.isPending || kontoName.trim() === '' || kontoPasswort === ''}>
                {tx("Account anlegen")}
              </Knopf>
            </Formular>
            <Fehlermeldung fehler={fehler ?? anlegen.error} />
          </Karte>
        </div>
      }
    />
  );
}
