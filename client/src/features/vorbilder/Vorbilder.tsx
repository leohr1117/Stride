import { klassenText, tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { auswahlAus, gespeicherteRichtung, speichereRichtung, type VorbildAuswahl } from './vorbilderAuswahl.ts';
import {
  aehnlichkeit,
  besteAehnlichkeit,
  DURCHSCHNITT,
  klasseAus,
  RICHTUNGEN,
  VORBILDER,
  type Vorbild,
} from '../../../../shared/features/vorbilder/index.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { KlassenBild } from '../../components/KlassenBild.tsx';
import { Chip, Fehlermeldung, Ladeanzeige } from '../../ui/index.ts';
import { prozentText, zahl } from '../../format.ts';
import { useFunktionen } from '../../funktionen.ts';
import { eigenesProfil, type EigenesProfil } from '../../pages/eigenesProfil.ts';
import { WerteHinweis } from './vorbildTeile.tsx';

const ALLE = 'alle';

interface VorbildAuswertung {
  vorbild: Vorbild;
  klasse: string;
  aehnlichkeit: number | null;
}

function auswerten(profil: EigenesProfil): VorbildAuswertung[] {
  return VORBILDER.map((vorbild) => ({
    vorbild,
    klasse: klasseAus(vorbild.schaetzung),
    aehnlichkeit: aehnlichkeit(profil.level, vorbild.profil, vorbild.unsicher),
  })).sort((a, b) => (b.aehnlichkeit ?? -1) - (a.aehnlichkeit ?? -1));
}

export function VorbilderSeite() {
  const funktionen = useFunktionen();
  const [params, setParams] = useSearchParams();
  const auswahl = auswahlAus(params.get('richtung'), gespeicherteRichtung());
  const setzeAuswahl = (naechste: VorbildAuswahl) => {
    speichereRichtung(naechste);
    const naechsteParams = new URLSearchParams(params);
    if (naechste === ALLE) {
      naechsteParams.delete('richtung');
    } else {
      naechsteParams.set('richtung', naechste);
    }
    setParams(naechsteParams, { replace: true });
  };
  useEffect(() => {
    speichereRichtung(auswahl);
    const parameter = params.get('richtung');
    const soll = auswahl === ALLE ? null : auswahl;
    if (parameter === soll) {
      return;
    }
    const naechste = new URLSearchParams(params);
    if (soll) {
      naechste.set('richtung', soll);
    } else {
      naechste.delete('richtung');
    }
    setParams(naechste, { replace: true });
  }, [auswahl, params, setParams]);
  const { data: attribute, error, isPending } = useQuery({ queryKey: SCHLUESSEL.attribute, queryFn: api.attribute });
  const { data: uebersicht } = useQuery({ queryKey: SCHLUESSEL.uebersicht, queryFn: api.uebersicht });
  const profil = useMemo(
    () => eigenesProfil(attribute ?? [], { koennen: funktionen.koennen, status: funktionen.status }),
    [attribute, funktionen.koennen, funktionen.status],
  );
  const auswertungen = useMemo(() => auswerten(profil), [profil]);
  const massstab = auswertungen.find((eintrag) => eintrag.vorbild.schluessel === DURCHSCHNITT);
  const personen = auswertungen.filter((eintrag) => eintrag.vorbild.schluessel !== DURCHSCHNITT);
  const sichtbar = personen.filter((eintrag) => auswahl === ALLE || eintrag.vorbild.richtung === auswahl);

  if (isPending) {
    return <Ladeanzeige />;
  }
  if (error) {
    return <Fehlermeldung fehler={error} />;
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex min-w-0 items-center">
          <h1 className="min-w-0 text-2xl font-bold tracking-tight break-words md:text-3xl">{tx("Vorbilder")}</h1>
          <WerteHinweis />
        </div>
        {uebersicht && (
          <p className="zahl text-sm text-leise">
            <span className="inline-flex items-center gap-1.5">
              {funktionen.koennen && <KlassenBild klasse={uebersicht.klasse} groesse="size-4" rahmen={false} />}
              {tx('Du · Level {level}', { level: zahl(uebersicht.level.level) })}
              {funktionen.koennen && ` · ${klassenText(uebersicht.klasse)}`}
            </span>
          </p>
        )}
      </header>
      {massstab && <VorbildKarte auswertung={massstab} />}
      <div className="flex flex-wrap gap-1.5">
        <RichtungsChip
          label={tx("Alle")}
          aktiv={auswahl === ALLE}
          prozent={besteAehnlichkeit(personen.map((eintrag) => eintrag.aehnlichkeit))}
          onClick={() => setzeAuswahl(ALLE)}
        />
        {RICHTUNGEN.map((richtung) => {
          const gruppe = personen.filter((eintrag) => eintrag.vorbild.richtung === richtung);
          return (
            <RichtungsChip
              key={richtung}
              label={richtung}
              aktiv={auswahl === richtung}
              prozent={besteAehnlichkeit(gruppe.map((eintrag) => eintrag.aehnlichkeit))}
              onClick={() => setzeAuswahl(richtung)}
            />
          );
        })}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {sichtbar.map((auswertung) => (
          <VorbildKarte key={auswertung.vorbild.schluessel} auswertung={auswertung} />
        ))}
      </div>
    </div>
  );
}

function chipText(label: string) {
  const teile = tx(label).split('/');
  return teile.map((teil, index) => (index === 0 ? teil : <span key={teil}>/<wbr />{teil}</span>));
}

function RichtungsChip({
  label,
  aktiv,
  prozent,
  onClick,
}: {
  label: string;
  aktiv: boolean;
  prozent: number | null;
  onClick: () => void;
}) {
  return (
    <Chip aktiv={aktiv} onClick={onClick} umbruch>
      {chipText(label)}
      {prozent !== null && <span className="zahl whitespace-nowrap"> {prozentText(prozent)}</span>}
    </Chip>
  );
}

function VorbildKarte({ auswertung }: { auswertung: VorbildAuswertung }) {
  const { vorbild } = auswertung;
  return (
    <Link
      to={`/vorbilder/${vorbild.schluessel}`}
      className="block space-y-3 rounded-2xl border border-rand bg-flaeche p-4 transition hover:border-leise/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{tx(vorbild.name)}</h2>
          <p className="text-xs text-leise break-words">{tx(vorbild.bekanntFuer)}</p>
        </div>
        <p className="shrink-0 whitespace-nowrap text-xl leading-tight font-bold">{tx('Lvl {level}', { level: zahl(vorbild.level) })}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="inline-flex min-w-0 items-center gap-1.5 text-xs text-leise">
          <KlassenBild klasse={auswertung.klasse} groesse="size-4" rahmen={false} />
          <span className="break-words">{klassenText(auswertung.klasse)}</span>
        </p>
        {auswertung.aehnlichkeit !== null && (
          <span className="zahl shrink-0 text-sm font-medium whitespace-nowrap text-haupt">
            {tx('{prozent} ähnlich', { prozent: prozentText(auswertung.aehnlichkeit) })}
          </span>
        )}
      </div>
    </Link>
  );
}
