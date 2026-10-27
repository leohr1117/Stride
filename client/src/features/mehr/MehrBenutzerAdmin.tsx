import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate } from 'react-router';
import type { AdminKonto } from '../../../../shared/api/zugang.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { Zeile, ZeilenGruppe } from '../../components/Zeile.tsx';
import { EINGABE_STIL, Feld, Fehlermeldung, Formular, Knopf, Ladeanzeige } from '../../ui/index.ts';
import { tx } from '../../text.ts';
import { Bereich, FormularSeite, PROFIL_ZURUECK } from './rahmen.tsx';

const ADMIN_INFO = 'Jeder Name ist nur einmal vergeben. Ist er schon vergeben, bleibt der bisherige.';
const LISTE_ZURUECK = { pfad: '/mehr/profil/benutzernamen', label: 'Benutzernamen' };

export function BenutzerAdminListe() {
  const { data: zugang, error, isPending } = useQuery({ queryKey: SCHLUESSEL.zugang, queryFn: api.zugang });
  const admin = zugang?.admin === true;
  const konten = useQuery({ queryKey: SCHLUESSEL.adminKonten, queryFn: api.adminKonten, enabled: admin });
  if (isPending) {
    return <Bereich titel={tx("Benutzernamen")} info={ADMIN_INFO} zurueck={PROFIL_ZURUECK} kinder={<Ladeanzeige />} />;
  }
  if (error || !zugang) {
    return <Bereich titel={tx("Benutzernamen")} info={ADMIN_INFO} zurueck={PROFIL_ZURUECK} kinder={<Fehlermeldung fehler={error} />} />;
  }
  if (!admin) {
    return <Navigate to="/mehr/profil" replace />;
  }
  if (konten.isPending) {
    return <Bereich titel={tx("Benutzernamen")} info={ADMIN_INFO} zurueck={PROFIL_ZURUECK} kinder={<Ladeanzeige />} />;
  }
  if (konten.error || !konten.data) {
    return <Bereich titel={tx("Benutzernamen")} info={ADMIN_INFO} zurueck={PROFIL_ZURUECK} kinder={<Fehlermeldung fehler={konten.error} />} />;
  }
  return (
    <Bereich
      titel={tx("Benutzernamen")}
      info={ADMIN_INFO}
      zurueck={PROFIL_ZURUECK}
      kinder={
        <ZeilenGruppe>
          {konten.data.map((konto) => (
            <Zeile key={konto.id} titel={konto.benutzername} nach={`/mehr/profil/benutzernamen/${konto.id}`} />
          ))}
        </ZeilenGruppe>
      }
    />
  );
}

export function BenutzerAdminBearbeiten({ kontoId }: { kontoId: string }) {
  const id = Number(kontoId);
  const gueltig = Number.isInteger(id) && id > 0;
  const queryClient = useQueryClient();
  const { data: zugang, error: zugangFehler, isPending: zugangLaedt } = useQuery({
    queryKey: SCHLUESSEL.zugang,
    queryFn: api.zugang,
  });
  const admin = zugang?.admin === true;
  const konten = useQuery({ queryKey: SCHLUESSEL.adminKonten, queryFn: api.adminKonten, enabled: admin && gueltig });
  const konto = konten.data?.find((eintrag) => eintrag.id === id);
  const [entwurf, setEntwurf] = useState<{ id: number; name: string } | null>(null);
  const [fehler, setFehler] = useState<unknown>(null);
  const benutzername = entwurf?.id === id ? entwurf.name : (konto?.benutzername ?? '');
  const speichern = useMutation({
    mutationFn: () => api.aendereAdminBenutzername(id, benutzername.trim()),
    onSuccess: (gespeichert) => {
      setEntwurf(null);
      setFehler(null);
      queryClient.setQueryData<AdminKonto[]>(SCHLUESSEL.adminKonten, (bisher) =>
        bisher?.map((eintrag) => (eintrag.id === gespeichert.id ? gespeichert : eintrag)),
      );
      void queryClient.invalidateQueries({ queryKey: SCHLUESSEL.zugang });
    },
    onError: setFehler,
  });
  if (!gueltig) {
    return <Navigate to="/mehr/profil/benutzernamen" replace />;
  }
  if (zugangLaedt || (admin && konten.isPending)) {
    return <FormularSeite titel={tx("Benutzername")} info={ADMIN_INFO} zurueck={LISTE_ZURUECK} kinder={<Ladeanzeige />} />;
  }
  if (zugangFehler || !zugang) {
    return <FormularSeite titel={tx("Benutzername")} info={ADMIN_INFO} zurueck={LISTE_ZURUECK} kinder={<Fehlermeldung fehler={zugangFehler} />} />;
  }
  if (!admin) {
    return <Navigate to="/mehr/profil" replace />;
  }
  if (konten.error) {
    return <FormularSeite titel={tx("Benutzername")} info={ADMIN_INFO} zurueck={LISTE_ZURUECK} kinder={<Fehlermeldung fehler={konten.error} />} />;
  }
  if (!konto) {
    return (
      <FormularSeite
        titel={tx("Benutzername")}
        info={ADMIN_INFO}
        zurueck={LISTE_ZURUECK}
        kinder={<Fehlermeldung fehler={new Error('Der Account existiert nicht.')} />}
      />
    );
  }
  const unveraendert = benutzername.trim() === '' || benutzername.trim() === konto.benutzername;
  return (
    <FormularSeite
      titel={tx("Benutzername")}
      info={ADMIN_INFO}
      zurueck={LISTE_ZURUECK}
      kinder={
        <Formular
          onAbsenden={(ereignis) => {
            ereignis.preventDefault();
            if (!unveraendert) {
              speichern.mutate();
            }
          }}
        >
          <Feld label={tx("Benutzername")}>
            <input
              className={EINGABE_STIL}
              name="benutzername"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={benutzername}
              onChange={(ereignis) => setEntwurf({ id, name: ereignis.target.value })}
            />
          </Feld>
          <Knopf type="submit" variante="primaer" className="w-full" disabled={speichern.isPending || unveraendert}>
            {tx("Speichern")}
          </Knopf>
          <Fehlermeldung fehler={fehler ?? speichern.error} />
        </Formular>
      }
    />
  );
}
