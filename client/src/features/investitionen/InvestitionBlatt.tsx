import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Attribut, Investition, InvestitionAenderung, InvestitionDaten, InvestitionsZiel, Projekt, Vision } from '../../../../shared/api/index.ts';
import { ICONS, GRENZEN, NEUTRAL_FARBE, type IconName } from '../../../../shared/spiel/begriffe.ts';
import { istTypAktiv, type Funktionen } from '../../../../shared/spiel/funktionen.ts';
import type { Sichtbarkeit } from '../../../../shared/spiel/sichtbarkeit.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { IconAuswahl } from '../../components/IconAuswahl.tsx';
import { ZeilenGruppe } from '../../components/Zeile.tsx';
import { useSichtbarkeit } from '../../funktionen.ts';
import { attributName, tx } from '../../text.ts';
import { betragVorschlaege } from '../../../../shared/spiel/betragVorschlag.ts';
import { EINGABE_STIL, Fehlermeldung, Knopf } from '../../ui/index.ts';
import { BetragFeld, BonusSegment } from './betragFeld.tsx';
import { EinzelWahl, type WahlOption } from './EinzelWahl.tsx';
import { fassung, zielName } from './investitionFassung.ts';
import {
  betragAusText,
  betragProblem,
  bisherigerBetrag,
  kurveFuerTyp,
  verfuegbaresXp,
  zahlungVon,
} from './zahlungAnzeige.ts';

export function waehlbareAttribute(attribute: Attribut[], funktionen: Funktionen, aktuell?: number): Attribut[] {
  return attribute
    .filter((eintrag) => {
      const gewaehlt = eintrag.id === aktuell;
      return gewaehlt || (!eintrag.archiviert && istTypAktiv(funktionen, eintrag.typ));
    })
    .sort((a, b) => {
      if (a.kennung === 'ressourcen') {
        return -1;
      }
      if (b.kennung === 'ressourcen') {
        return 1;
      }
      return a.name.localeCompare(b.name, 'de');
    });
}

export function listenFuerZiel(
  ziel: InvestitionsZiel | null,
  sichtbarkeit: Sichtbarkeit,
  visionen: Vision[],
  projekte: Projekt[],
  attribute: Attribut[],
): { visionen: Vision[]; projekte: Projekt[]; attribute: Attribut[] } {
  return {
    visionen: visionen.filter((vision) => {
      const istZiel = ziel?.art === 'vision' && ziel.id === vision.id;
      return istZiel || (sichtbarkeit.ebenen.visionen && !vision.archiviert);
    }),
    projekte: projekte.filter((eintrag) => {
      const istZiel = ziel?.art === 'projekt' && ziel.id === eintrag.id;
      return istZiel || (sichtbarkeit.ebenen.projekte && eintrag.aktiv);
    }),
    attribute: attribute.filter((eintrag) => {
      const istZiel = ziel?.art === 'attribut' && ziel.id === eintrag.id;
      return istZiel || (!eintrag.archiviert && istTypAktiv(sichtbarkeit.funktionen, eintrag.typ));
    }),
  };
}

function gueltigesIcon(icon: string): IconName {
  return (ICONS as readonly string[]).includes(icon) ? (icon as IconName) : 'gem';
}

function zielWert(ziel: InvestitionsZiel | null): string {
  return ziel ? `${ziel.art}:${ziel.id}` : '';
}

function zielAusWert(wert: string): InvestitionsZiel | null {
  if (wert === '') {
    return null;
  }
  const trenn = wert.indexOf(':');
  const art = wert.slice(0, trenn);
  const id = Number(wert.slice(trenn + 1));
  if ((art === 'vision' || art === 'projekt' || art === 'attribut') && Number.isInteger(id)) {
    return { art, id };
  }
  return null;
}

function nameVonAttribut(id: number | null, attribute: Attribut[], leer: string): string {
  if (id === null) {
    return leer;
  }
  const eintrag = attribute.find((attribut) => attribut.id === id);
  return eintrag ? attributName(eintrag) : leer;
}

export function InvestitionFormular({
  investition,
  attribute,
  onFertig,
}: {
  investition: Investition | null;
  attribute: Attribut[];
  onFertig: () => void;
}) {
  const queryClient = useQueryClient();
  const sichtbarkeit = useSichtbarkeit();
  const { data: ziele } = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele });
  const { data: rhythmus } = useQuery({ queryKey: SCHLUESSEL.investitionsRhythmus, queryFn: api.investitionsRhythmus });
  const ressourcen = attribute.find((eintrag) => eintrag.kennung === 'ressourcen' && !eintrag.archiviert);
  const [name, setName] = useState(investition?.name ?? '');
  const [icon, setIcon] = useState<IconName>(gueltigesIcon(investition?.icon ?? 'gem'));
  const [groesse, setGroesse] = useState(investition?.groesse ?? 1);
  const [bezahltId, setBezahltId] = useState<number | null>(investition ? investition.bezahltAttributId : (ressourcen?.id ?? null));
  const [betragText, setBetragText] = useState(investition && investition.betrag > 0 ? String(investition.betrag) : '');
  const [betragGeprueft, setBetragGeprueft] = useState(false);
  const [zielGeprueft, setZielGeprueft] = useState(false);
  const [attributId, setAttributId] = useState<number | null>(
    investition ? investition.attributId : (ressourcen?.id ?? attribute[0]?.id ?? null),
  );
  const [projektZiel, setProjektZiel] = useState<InvestitionsZiel | null>(
    investition?.ziel && investition.ziel.art !== 'attribut' ? investition.ziel : null,
  );
  const [serverFehler, setServerFehler] = useState<unknown>(null);
  const betragRef = useRef<HTMLInputElement>(null);
  const wahlRef = useRef<HTMLInputElement>(null);
  const attributAnker = useRef<HTMLDivElement>(null);
  const basisId = useId();
  const altAttributZiel = investition?.ziel?.art === 'attribut' ? investition.ziel : null;
  const listen = listenFuerZiel(projektZiel, sichtbarkeit, ziele?.visionen ?? [], ziele?.projekte ?? [], attribute);
  const bonusListe = waehlbareAttribute(attribute, sichtbarkeit.funktionen, attributId ?? undefined);
  const zahlungsListe = waehlbareAttribute(attribute, sichtbarkeit.funktionen, bezahltId ?? undefined);
  const zahlAttribut = attribute.find((eintrag) => eintrag.id === bezahltId) ?? null;
  const bonusAttribut = attribute.find((eintrag) => eintrag.id === attributId) ?? null;
  const zurueck = bisherigerBetrag(investition?.bezahltAttributId ?? null, investition?.betrag ?? 0, bezahltId);
  const verfuegbar = zahlAttribut ? verfuegbaresXp(zahlAttribut.level.xpGesamt, zurueck) : 0;
  const problem = betragProblem(bezahltId !== null, betragText, verfuegbar);
  const betragZahl = betragAusText(betragText);
  const vorschlagZiel = projektZiel ?? altAttributZiel;
  const vorschlaege = useMemo(
    () => (rhythmus ? betragVorschlaege(rhythmus.posten, attributId, vorschlagZiel, rhythmus.wochenMitEintraegen) : []),
    [rhythmus, attributId, vorschlagZiel],
  );
  const attributText = bonusAttribut ? attributName(bonusAttribut) : null;
  const zahlText = nameVonAttribut(bezahltId, attribute, tx('Nichts'));
  const projektText = projektZiel ? zielName(projektZiel, listen.visionen, listen.projekte, listen.attribute) : null;
  const zielFehlt = attributId === null && projektZiel === null;
  const feldId = `${basisId}-betrag`;
  const fehlerId = `${basisId}-fehler`;
  const hinweisId = `${basisId}-hinweis`;

  const merkeWahl = (bezahlt: number | null, bonus: number | null, naechstesZiel: InvestitionsZiel | null) => {
    const feld = wahlRef.current;
    if (!feld) {
      return;
    }
    feld.value = `${bezahlt ?? ''}|${bonus ?? ''}|${zielWert(naechstesZiel)}`;
    feld.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const speichern = useMutation({
    mutationFn: async () => {
      const daten: InvestitionDaten = {
        name: name.trim(),
        icon,
        groesse,
        attributId,
        ...zahlungVon(bezahltId, betragText),
      };
      if (!(altAttributZiel && projektZiel === null)) {
        daten.ziel = projektZiel;
      }
      if (investition) {
        const aenderung: InvestitionAenderung = daten;
        return api.aendereInvestition(investition.id, aenderung);
      }
      return api.erstelleInvestition(daten);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onFertig();
    },
    onError: (grund) => setServerFehler(grund),
  });

  const laeuft = useRef(false);
  const senden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (laeuft.current || speichern.isPending) {
      return;
    }
    setServerFehler(null);
    if (problem) {
      setBetragGeprueft(true);
      betragRef.current?.focus();
      return;
    }
    if (attributId === null && projektZiel === null) {
      setZielGeprueft(true);
      attributAnker.current?.querySelector('button')?.focus();
      return;
    }
    laeuft.current = true;
    speichern.mutate(undefined, {
      onSettled: () => {
        laeuft.current = false;
      },
    });
  };

  const zusammenfassung = fassung({
    bezahltId,
    betragZahl,
    zahlText,
    attributText,
    projektText,
    xpNeu: zahlAttribut && betragZahl !== null && betragZahl > 0 ? zahlAttribut.level.xpGesamt + zurueck - betragZahl : null,
    xpJetzt: zahlAttribut?.level.xpGesamt ?? 0,
    kurve: zahlAttribut ? kurveFuerTyp(zahlAttribut.typ) : kurveFuerTyp('attribut'),
  });

  const zahlOptionen: WahlOption[] = [
    { wert: '', name: tx('Nichts') },
    ...zahlungsListe.map((eintrag) => ({ wert: String(eintrag.id), name: attributName(eintrag) })),
  ];
  const bonusOptionen: WahlOption[] = [
    { wert: '', name: tx('Keins') },
    ...bonusListe.map((eintrag) => ({ wert: String(eintrag.id), name: attributName(eintrag) })),
  ];
  const projektOptionen: WahlOption[] = [
    { wert: '', name: tx('Keins') },
    ...listen.visionen.map((vision) => ({ wert: `vision:${vision.id}`, name: vision.titel, gruppe: 'Vision' })),
    ...listen.projekte.map((eintrag) => ({ wert: `projekt:${eintrag.id}`, name: eintrag.name, gruppe: 'Projekt' })),
  ];

  return (
    <form onSubmit={senden} className="formular min-h-0">
      <div className="formular-felder min-h-0 space-y-4">
        <div className="feld block space-y-2">
          <label htmlFor={`${basisId}-name`} className="feld-label block text-sm leading-5 font-semibold">
            {tx('Name')}
          </label>
          <input
            id={`${basisId}-name`}
            className={EINGABE_STIL}
            value={name}
            maxLength={GRENZEN.nameMax}
            onChange={(ereignis) => setName(ereignis.target.value)}
          />
        </div>
        <ZeilenGruppe titel="Kosten">
          <EinzelWahl
            feld="Bezahlt mit"
            wertName={zahlText}
            optionen={zahlOptionen}
            wert={bezahltId === null ? '' : String(bezahltId)}
            onWaehlen={(wert) => {
              const id = wert === '' ? null : Number(wert);
              setBezahltId(id);
              if (id === null) {
                setBetragGeprueft(false);
              }
              merkeWahl(id, attributId, projektZiel);
            }}
          />
        </ZeilenGruppe>
        {bezahltId !== null ? (
          <BetragFeld
            text={betragText}
            onText={setBetragText}
            geprueft={betragGeprueft}
            onGeprueft={setBetragGeprueft}
            problem={problem}
            verfuegbar={verfuegbar}
            vorschlaege={vorschlaege}
            eingabeRef={betragRef}
            feldId={feldId}
            fehlerId={fehlerId}
            hinweisId={hinweisId}
          />
        ) : null}
        <ZeilenGruppe titel="Wirkung" zwischen={<BonusSegment wert={groesse} onAendern={setGroesse} />}>
          <div ref={attributAnker} data-feld="attribut">
            <EinzelWahl
              feld="Attribut"
              wertName={attributText ?? tx('Keins')}
              optionen={bonusOptionen}
              wert={attributId === null ? '' : String(attributId)}
              onWaehlen={(wert) => {
                const id = wert === '' ? null : Number(wert);
                setAttributId(id);
                merkeWahl(bezahltId, id, projektZiel);
              }}
            />
            {zielGeprueft && zielFehlt ? (
              <p id={`${basisId}-ziel`} role="alert" className="feld-fehler px-4 pb-3 text-[13px] leading-[18px] break-words text-gefahr">
                {tx('Wähle ein Attribut oder ein Projekt.')}
              </p>
            ) : null}
          </div>
          <EinzelWahl
            feld="Projekt"
            wertName={projektText ?? tx('Keins')}
            optionen={projektOptionen}
            wert={zielWert(projektZiel)}
            onWaehlen={(wert) => {
              const naechstes = projektAusWert(wert);
              setProjektZiel(naechstes);
              merkeWahl(bezahltId, attributId, naechstes);
            }}
          />
        </ZeilenGruppe>
        {altAttributZiel && projektZiel === null ? (
          <p className="text-[13px] leading-[18px] text-leise">
            {tx('Wirkt auch auf {name}', { name: nameVonAttribut(altAttributZiel.id, attribute, tx('Attribut')) })}
          </p>
        ) : null}
        <IconAuswahl wert={icon} farbe={NEUTRAL_FARBE} onAendern={setIcon} />
        <input
          ref={wahlRef}
          disabled
          tabIndex={-1}
          aria-hidden="true"
          defaultValue={`${bezahltId ?? ''}|${attributId ?? ''}|${zielWert(projektZiel)}`}
          className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
        />
        <Fehlermeldung fehler={serverFehler} />
        {zusammenfassung ? <p className="text-[13px] leading-[18px] text-leise">{zusammenfassung}</p> : null}
        <Knopf type="submit" variante="primaer" className="w-full">
          {tx('Speichern')}
        </Knopf>
      </div>
    </form>
  );
}

function projektAusWert(wert: string): InvestitionsZiel | null {
  const ziel = zielAusWert(wert);
  if (!ziel || ziel.art === 'attribut') {
    return null;
  }
  return ziel;
}

