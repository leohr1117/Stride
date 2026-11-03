import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate } from 'react-router';
import type { Rolle } from '../../../../shared/api/zugang.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { SchnellZeile } from '../../components/SchnellAktion.tsx';
import { DichteZeilen, Zeile, ZeilenGruppe } from '../../components/Zeile.tsx';
import { AbschnittKopf, EINGABE_STIL, Feld, Fehlermeldung, Flaeche, Formular, Knopf, Ladeanzeige, PasswortFeld } from '../../ui/index.ts';
import { tx } from '../../text.ts';
import { BenutzernameDialog, type BenutzernameZiel } from './MehrBenutzerAdmin.tsx';
import { Bereich, PROFIL_ZURUECK } from './rahmen.tsx';

interface AccountZeile {
  id: number;
  benutzername: string;
  rolle?: Rolle;
}

function nebenzeile(konto: AccountZeile): string | undefined {
  if (!konto.rolle) {
    return undefined;
  }
  const rolle = konto.rolle === 'inhaber' ? tx('Inhaber') : tx('Mitglied');
  return `${konto.benutzername} · ${rolle}`;
}

export function AccountsBereich() {
  const queryClient = useQueryClient();
  const { data: zugang, isPending: zugangLaedt, error: zugangFehler } = useQuery({
    queryKey: SCHLUESSEL.zugang,
    queryFn: api.zugang,
  });
  const inhaber = zugang?.rolle === 'inhaber';
  const admin = zugang?.admin === true;
  const kontenQuery = useQuery({ queryKey: SCHLUESSEL.konten, queryFn: api.konten, enabled: inhaber });
  const adminQuery = useQuery({ queryKey: SCHLUESSEL.adminKonten, queryFn: api.adminKonten, enabled: admin && !inhaber });
  const [ziel, setZiel] = useState<BenutzernameZiel | null>(null);
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
    return <Bereich titel={tx('Accounts')} zurueck={PROFIL_ZURUECK} kinder={<Ladeanzeige />} />;
  }
  if (zugangFehler || !zugang) {
    return <Bereich titel={tx('Accounts')} zurueck={PROFIL_ZURUECK} kinder={<Fehlermeldung fehler={zugangFehler} />} />;
  }
  if (!inhaber && !admin) {
    return <Navigate to="/mehr/profil" replace />;
  }

  const listeLaedt = inhaber ? kontenQuery.isPending : adminQuery.isPending;
  const listeFehler = inhaber ? kontenQuery.error : adminQuery.error;
  if (listeLaedt) {
    return <Bereich titel={tx('Accounts')} zurueck={PROFIL_ZURUECK} kinder={<Ladeanzeige />} />;
  }
  if (listeFehler) {
    return <Bereich titel={tx('Accounts')} zurueck={PROFIL_ZURUECK} kinder={<Fehlermeldung fehler={listeFehler} />} />;
  }

  const konten: AccountZeile[] = inhaber
    ? (kontenQuery.data ?? []).map((konto) => ({ id: konto.id, benutzername: konto.benutzername, rolle: konto.rolle }))
    : (adminQuery.data ?? []).map((konto) => ({ id: konto.id, benutzername: konto.benutzername }));

  return (
    <Bereich
      titel={tx('Accounts')}
      zurueck={PROFIL_ZURUECK}
      kinder={
        <DichteZeilen>
        <>
          <ZeilenGruppe>
            {konten.map((konto) => (
              <SchnellZeile
                key={konto.id}
                eintraege={admin ? [{ art: 'archivieren', id: 'benutzername', label: 'Benutzername ändern' }] : undefined}
                onEintrag={() => setZiel({ id: konto.id, benutzername: konto.benutzername })}
                ziel={{
                  art: 'konto',
                  id: konto.id,
                  name: konto.benutzername,
                  gesperrt: konto.rolle === undefined || konto.rolle === 'inhaber',
                }}
              >
                {(menue) => (
                  <Zeile
                    titel={konto.benutzername}
                    neben={nebenzeile(konto)}
                    pfeil={false}
                    menue={menue}
                  />
                )}
              </SchnellZeile>
            ))}
          </ZeilenGruppe>
          {inhaber ? (
            <section>
              <AbschnittKopf titel={tx('Neuer Account')} />
              <Flaeche>
                <div className="p-4">
                <Formular
                  onAbsenden={(ereignis) => {
                    ereignis.preventDefault();
                    anlegen.mutate();
                  }}
                  abstand="space-y-3"
                >
                  <Feld label={tx('Benutzername')}>
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
                  <Feld label={tx('Profilname')}>
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
                    label={tx('Passwort')}
                    hinweis={tx('Mindestens 10 Zeichen.')}
                    autoComplete="new-password"
                    value={kontoPasswort}
                    onChange={(ereignis) => setKontoPasswort(ereignis.target.value)}
                  />
                  <Knopf type="submit" variante="primaer" className="w-full" disabled={anlegen.isPending || kontoName.trim() === '' || kontoPasswort === ''}>
                    {tx('Account anlegen')}
                  </Knopf>
                </Formular>
                <Fehlermeldung fehler={fehler ?? anlegen.error} />
                </div>
              </Flaeche>
            </section>
          ) : null}
          <BenutzernameDialog konto={ziel} onSchliessen={() => setZiel(null)} />
        </>
        </DichteZeilen>
      }
    />
  );
}
