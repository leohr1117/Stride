import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams } from 'react-router';
import type { Uebung } from '../../../../shared/api/training.ts';
import { trainingZurueck } from '../../../../shared/spiel/herkunft.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { SaeulenDiagramm } from '../../components/mitDiagramm.tsx';
import { ZurueckZumMehr } from '../../components/ZurueckZumMehr.tsx';
import { tx } from '../../text.ts';
import { Fehlermeldung, InfoHinweis, Karte, Ladeanzeige, Ueberschrift } from '../../ui/index.ts';
import { bestwertZeilen, schaetzPunkte, type BestwertZeile } from './bestwertAnzeige.ts';
import { useGewichtEinheit } from './kapsel.tsx';

const UEBUNG_INFO = 'Aufwärmen zählt nicht. Die Schätzung ist Gewicht mal (1 + Wiederholungen / 30).';

interface UebungWeg {
  einheit?: string;
  planName?: string;
  von?: '/';
}

function liesWeg(zustand: unknown): UebungWeg {
  if (typeof zustand !== 'object' || zustand === null) {
    return {};
  }
  const einheit = 'einheit' in zustand && typeof zustand.einheit === 'string' ? zustand.einheit : undefined;
  const planName = 'planName' in zustand && typeof zustand.planName === 'string' ? zustand.planName : undefined;
  const von = 'von' in zustand && zustand.von === '/' ? '/' : undefined;
  return { einheit, planName, von };
}

function useUebung(id: number, aktiv: boolean): { uebung: Uebung | null; wartet: boolean; fehler: unknown } {
  const offen = useQuery({
    queryKey: [...SCHLUESSEL.uebungen, false],
    queryFn: () => api.uebungen(false),
    enabled: aktiv,
  });
  const inOffen = offen.data?.find((eintrag) => eintrag.id === id) ?? null;
  const archiv = useQuery({
    queryKey: [...SCHLUESSEL.uebungen, true],
    queryFn: () => api.uebungen(true),
    enabled: aktiv && offen.isSuccess && inOffen === null,
  });
  const uebung = inOffen ?? archiv.data?.find((eintrag) => eintrag.id === id) ?? null;
  const wartet = aktiv && (offen.isPending || (offen.isSuccess && inOffen === null && archiv.isPending));
  return { uebung, wartet, fehler: offen.error ?? archiv.error ?? null };
}

function NichtDa({ fehler, pfad, label }: { fehler: unknown; pfad: string; label: string }) {
  return (
    <div className="space-y-6">
      <ZurueckZumMehr pfad={pfad} label={label} />
      <Fehlermeldung fehler={fehler ?? new Error('Die Übung wurde nicht gefunden.')} />
    </div>
  );
}

function WertZeile({ zeile }: { zeile: BestwertZeile }) {
  return (
    <li className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="zahl text-sm font-medium">{zeile.haupt}</p>
        {zeile.schaetzung ? (
          <p className="mt-0.5 text-xs text-leise">
            <span className="hidden md:inline">{zeile.datum} · </span>
            {zeile.schaetzung}
          </p>
        ) : (
          <p className="mt-0.5 hidden text-xs text-leise md:block">{zeile.datum}</p>
        )}
      </div>
      <span className="zahl shrink-0 text-xs text-leise md:hidden">{zeile.datum}</span>
    </li>
  );
}

export function UebungSeite() {
  const parameter = useParams();
  const id = Number(parameter.id);
  const gueltig = Number.isInteger(id) && id > 0;
  const ort = useLocation();
  const weg = liesWeg(ort.state);
  const { einheit: gewicht } = useGewichtEinheit();
  const ziel = trainingZurueck(ort.pathname, { einheit: weg.einheit, planName: weg.planName }) ?? {
    pfad: '/training',
    label: 'Training',
  };
  const zurueckZustand = ziel.pfad.startsWith('/training/einheiten/') && weg.von === '/' ? { von: '/' } : undefined;
  const werte = useQuery({
    queryKey: SCHLUESSEL.bestwerte(gueltig ? id : 0),
    queryFn: () => api.bestwerte(id),
    enabled: gueltig,
  });
  const uebung = useUebung(gueltig ? id : 0, gueltig);

  if (!gueltig) {
    return <NichtDa fehler={null} pfad="/training" label="Training" />;
  }
  if (werte.isPending || uebung.wartet) {
    return (
      <div className="space-y-6">
        <ZurueckZumMehr pfad={ziel.pfad} label={ziel.label} zustand={zurueckZustand} />
        <Ladeanzeige />
      </div>
    );
  }
  if (werte.isError || !uebung.uebung) {
    return <NichtDa fehler={werte.error ?? uebung.fehler} pfad={ziel.pfad} label={ziel.label} />;
  }

  const zeilen = bestwertZeilen(werte.data, gewicht);
  const punkte = schaetzPunkte(werte.data, gewicht);
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <ZurueckZumMehr pfad={ziel.pfad} label={ziel.label} zustand={zurueckZustand} />
        <header className="mt-2">
          <div className="flex min-w-0 items-center">
            <h1 className="min-w-0 text-2xl font-bold tracking-tight break-words md:text-3xl">{uebung.uebung.name}</h1>
            <InfoHinweis text={UEBUNG_INFO} />
          </div>
        </header>
        <p className="mt-2 text-sm text-leise">{gewicht === 'lb' ? tx('lb') : tx('kg')}</p>
      </div>
      {zeilen.length === 0 && punkte.length === 0 ? (
        <Karte className="py-10 text-center text-sm text-leise">{tx('Noch kein Bestwert.')}</Karte>
      ) : (
        <>
          {zeilen.length > 0 && (
            <Karte>
              <ul className="space-y-3">
                {zeilen.map((zeile) => (
                  <WertZeile key={zeile.id} zeile={zeile} />
                ))}
              </ul>
            </Karte>
          )}
          {punkte.length > 0 && (
            <Karte>
              <Ueberschrift titel={tx('Schätzung')} />
              <SaeulenDiagramm werte={punkte} einheit={gewicht === 'lb' ? tx('lb') : tx('kg')} />
            </Karte>
          )}
        </>
      )}
    </div>
  );
}
