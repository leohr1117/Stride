import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router';
import { EXPORT_ADRESSE, api, SCHLUESSEL } from '../../api/index.ts';
import { useBestaetigung } from '../../components/Bestaetigung.tsx';
import { Fehlermeldung } from '../../ui/index.ts';
import { Zeile, ZeilenGruppe } from '../../components/Zeile.tsx';
import { zahl } from '../../format.ts';
import { tx, txMenge } from '../../text.ts';
import { Bereich } from './rahmen.tsx';

export function MehrDatenSeite() {
  return (
    <Bereich
      titel={tx("Daten")}
      kinder={
        <div className="space-y-4">
          <DatenKarte />
          <div className="pt-8">
            <Gefahrenbereich />
          </div>
        </div>
      }
    />
  );
}

function Gefahrenbereich() {
  const queryClient = useQueryClient();
  const navigiere = useNavigate();
  const bestaetigen = useBestaetigung();
  const zuruecksetzen = useMutation({
    mutationFn: () => api.setzeProfilZurueck(),
    onSuccess: (neu) => {
      queryClient.setQueryData(SCHLUESSEL.einstellungen, neu);
      void queryClient.invalidateQueries();
      void navigiere('/', { replace: true });
    },
  });
  const profilZuruecksetzen = async () => {
    if (
      await bestaetigen({
        titel: tx("Profil zurücksetzen?"),
        text: tx("Einträge, Ziele und Tätigkeiten dieses Accounts werden gelöscht, dein Login bleibt."),
        knopf: tx("Zurücksetzen"),
        gefahr: true,
        eingabe: { hinweis: tx("Tippe ZURÜCKSETZEN, um fortzufahren."), wert: tx('ZURÜCKSETZEN') },
      })
    ) {
      zuruecksetzen.mutate();
    }
  };

  return (
    <>
      <ZeilenGruppe titel={tx("Gefahrenbereich")}>
        <Zeile titel={tx("Profil zurücksetzen")} gefahr pfeil={false} onKlick={() => void profilZuruecksetzen()} />
      </ZeilenGruppe>
      {zuruecksetzen.isPending || zuruecksetzen.error ? (
        <div className="mt-3">
          <Fehlermeldung fehler={zuruecksetzen.error} />
        </div>
      ) : null}
    </>
  );
}

function DatenKarte() {
  const bestaetigen = useBestaetigung();
  const queryClient = useQueryClient();
  const dateiEingabe = useRef<HTMLInputElement>(null);
  const [lesefehler, setLesefehler] = useState<Error | null>(null);
  const importieren = useMutation({
    mutationFn: (daten: unknown) => api.importiere(daten),
    onSuccess: () => void queryClient.invalidateQueries(),
  });

  const dateiGewaehlt = async (ereignis: ChangeEvent<HTMLInputElement>) => {
    const datei = ereignis.target.files?.[0];
    ereignis.target.value = '';
    if (!datei) {
      return;
    }
    setLesefehler(null);
    importieren.reset();
    let daten: unknown;
    try {
      daten = JSON.parse(await datei.text());
    } catch {
      setLesefehler(new Error(tx("Die Datei ist keine gültige Stride-Sicherung.")));
      return;
    }
    if (
      await bestaetigen({
        titel: tx("Sicherung importieren?"),
        text: tx("Der jetzige Stand wird ersetzt."),
        knopf: tx("Importieren"),
        gefahr: true,
      })
    ) {
      importieren.mutate(daten);
    }
  };

  return (
    <>
      <ZeilenGruppe>
        <Zeile titel={tx("Exportieren")} href={EXPORT_ADRESSE} download pfeil={false} symbol={<Download aria-hidden="true" />} />
        <Zeile
          titel={tx("Importieren")}
          pfeil={false}
          onKlick={() => {
            if (!importieren.isPending) {
              dateiEingabe.current?.click();
            }
          }}
        />
      </ZeilenGruppe>
      <input
        ref={dateiEingabe}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(ereignis) => void dateiGewaehlt(ereignis)}
      />
      {importieren.isSuccess && (
        <p className="mt-3 text-sm break-words text-leise">{txMenge(importieren.data.zeilen, '{anzahl} Datensätze importiert.', { anzahl: zahl(importieren.data.zeilen) })}</p>
      )}
      <div className="mt-3">
        <Fehlermeldung fehler={lesefehler ?? importieren.error} />
      </div>
    </>
  );
}
