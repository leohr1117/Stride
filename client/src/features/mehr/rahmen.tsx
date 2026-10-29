import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { Einstellungen, EinstellungenAenderung } from '../../../../shared/api/index.ts';
import { standardVorlage } from '../../../../shared/features/darstellung/paletten.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useKopf } from '../../components/Kopf.tsx';

const DARSTELLUNGS_FELDER = new Set<keyof Einstellungen>([
  'stil',
  'primaer',
  'akzent',
  'hintergrund',
  'glimmen',
  'sound',
  'mobilLeiste',
  'geburtsjahr',
  'sprache',
]);

function nurDarstellung(aenderung: EinstellungenAenderung): boolean {
  const felder = (Object.keys(aenderung) as (keyof EinstellungenAenderung)[]).filter((feld) => feld !== 'farbenZuruecksetzen');
  return (felder.length > 0 || aenderung.farbenZuruecksetzen === true) && felder.every((feld) => DARSTELLUNGS_FELDER.has(feld as keyof Einstellungen));
}

export function useEinstellungen() {
  const queryClient = useQueryClient();
  const abfrage = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const speichern = useMutation({
    mutationFn: (aenderung: EinstellungenAenderung) => api.aendereEinstellungen(aenderung),
    onMutate: async (aenderung) => {
      if (!nurDarstellung(aenderung)) {
        return;
      }
      await queryClient.cancelQueries({ queryKey: SCHLUESSEL.einstellungen });
      const bisher = queryClient.getQueryData<Einstellungen>(SCHLUESSEL.einstellungen);
      if (!bisher) {
        return { bisher };
      }
      const stil = aenderung.stil ?? bisher.stil;
      const farbenDabei = aenderung.primaer !== undefined || aenderung.akzent !== undefined || aenderung.hintergrund !== undefined;
      const ansichtFarben = { ...bisher.ansichtFarben };
      let primaer = bisher.primaer;
      let akzent = bisher.akzent;
      let hintergrund = bisher.hintergrund;
      let eigeneFarben = bisher.eigeneFarben;
      if (aenderung.farbenZuruecksetzen === true) {
        delete ansichtFarben[stil];
        const vorlage = standardVorlage(stil, false);
        primaer = vorlage.primaer;
        akzent = vorlage.akzent;
        hintergrund = vorlage.hintergrund;
        eigeneFarben = false;
      } else if (farbenDabei) {
        primaer = aenderung.primaer ?? primaer;
        akzent = aenderung.akzent ?? akzent;
        hintergrund = aenderung.hintergrund ?? hintergrund;
        ansichtFarben[stil] = { primaer, akzent, hintergrund };
        eigeneFarben = true;
      } else if (aenderung.stil !== undefined) {
        const gemerkt = ansichtFarben[aenderung.stil];
        if (gemerkt) {
          primaer = gemerkt.primaer;
          akzent = gemerkt.akzent;
          hintergrund = gemerkt.hintergrund;
          eigeneFarben = true;
        } else {
          const vorlage = standardVorlage(aenderung.stil, false);
          primaer = vorlage.primaer;
          akzent = vorlage.akzent;
          hintergrund = vorlage.hintergrund;
          eigeneFarben = false;
        }
      }
      const sichtbar: EinstellungenAenderung = { ...aenderung };
      delete sichtbar.farbenZuruecksetzen;
      queryClient.setQueryData<Einstellungen>(SCHLUESSEL.einstellungen, {
        ...bisher,
        ...sichtbar,
        stil,
        primaer,
        akzent,
        hintergrund,
        eigeneFarben,
        ansichtFarben,
      });
      return { bisher };
    },
    onError: (_fehler, _aenderung, kontext) => {
      if (kontext?.bisher) {
        queryClient.setQueryData(SCHLUESSEL.einstellungen, kontext.bisher);
      }
    },
    onSuccess: (neu, aenderung) => {
      queryClient.setQueryData(SCHLUESSEL.einstellungen, neu);
      if (!nurDarstellung(aenderung)) {
        void queryClient.invalidateQueries();
      }
    },
  });
  return { ...abfrage, speichern };
}

export const PROFIL_ZURUECK = { pfad: '/mehr/profil', label: 'Profil' };
export const INHALTE_ZURUECK = { pfad: '/mehr/inhalte', label: 'Tätigkeiten' };
export const FUNKTIONEN_ZURUECK = { pfad: '/mehr/funktionen', label: 'Bereiche' };
export const DARSTELLUNG_ZURUECK = { pfad: '/mehr/darstellung', label: 'Darstellung' };
export const PROFIL_HASH: Record<string, string> = { '#accounts': '/mehr/profil/accounts' };
export const INHALTE_HASH: Record<string, string> = {
  '#verbindungen': '/mehr/inhalte/verbindungen',
};
export const DARSTELLUNG_HASH: Record<string, string> = { '#leiste': '/mehr/darstellung/leiste' };

export function useHashWeiter(ziele: Record<string, string>) {
  const ort = useLocation();
  const navigiere = useNavigate();
  useEffect(() => {
    const ziel = ziele[ort.hash];
    if (ziel) {
      navigiere(ziel, { replace: true });
    }
  }, [navigiere, ort.hash, ziele]);
}

export function useSprungmarke(bereit: boolean) {
  const ort = useLocation();
  useEffect(() => {
    if (!bereit || !ort.hash) {
      return;
    }
    document.getElementById(ort.hash.slice(1))?.scrollIntoView({ block: 'center' });
  }, [bereit, ort.hash]);
}

export function Bereich({
  titel,
  info,
  kinder,
}: {
  titel: string;
  info?: string;
  kinder: ReactNode;
  zurueck?: { pfad: string; label: string };
}) {
  useKopf({ titel, info });
  return <div className="space-y-6">{kinder}</div>;
}

export function FormularSeite({
  titel,
  info,
  zurueck,
  kinder,
}: {
  titel: string;
  info?: string;
  zurueck: { pfad: string; label: string };
  kinder: ReactNode;
}) {
  return <Bereich titel={titel} info={info} zurueck={zurueck} kinder={<div className="space-y-4">{kinder}</div>} />;
}
