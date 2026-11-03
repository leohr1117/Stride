import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useId, useRef, useState, type FormEvent } from 'react';
import type { Attribut, Investition, InvestitionAenderung, InvestitionDaten, InvestitionsZiel, Projekt, Vision } from '../../../../shared/api/index.ts';
import { ICONS, GRENZEN, NEUTRAL_FARBE, type IconName } from '../../../../shared/spiel/begriffe.ts';
import { istTypAktiv, type Funktionen } from '../../../../shared/spiel/funktionen.ts';
import type { Sichtbarkeit } from '../../../../shared/spiel/sichtbarkeit.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { IconAuswahl } from '../../components/IconAuswahl.tsx';
import { ZeilenGruppe } from '../../components/Zeile.tsx';
import { levelZahl, zahl } from '../../format.ts';
import { useSichtbarkeit } from '../../funktionen.ts';
import { attributName, tx } from '../../text.ts';
import { EINGABE_STIL, Fehlermeldung, Knopf } from '../../ui/index.ts';
import { EinzelWahl, type WahlOption } from './EinzelWahl.tsx';
import { GroessenRegler } from './groesse.tsx';
import {
  betragAusText,
  betragProblem,
  bisherigerBetrag,
  kurveFuerTyp,
  levelDanach,
  verfuegbaresXp,
  zahlungVon,
  type BetragProblem,
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

function fehlerSatz(problem: BetragProblem, verfuegbar: number): string {
  if (problem === 'leer') {
    return tx('Betrag eingeben oder „Nichts“ wählen');
  }
  return tx('Nur {xp} XP verfügbar', { xp: zahl(verfuegbar) });
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
  const ressourcen = attribute.find((eintrag) => eintrag.kennung === 'ressourcen' && !eintrag.archiviert);
  const [name, setName] = useState(investition?.name ?? '');
  const [icon, setIcon] = useState<IconName>(gueltigesIcon(investition?.icon ?? 'gem'));
  const [groesse, setGroesse] = useState(investition?.groesse ?? 1);
  const [bezahltId, setBezahltId] = useState<number | null>(investition ? investition.bezahltAttributId : (ressourcen?.id ?? null));
  const [betragText, setBetragText] = useState(investition && investition.betrag > 0 ? String(investition.betrag) : '');
  const [betragGeprueft, setBetragGeprueft] = useState(false);
  const [attributId, setAttributId] = useState<number | null>(investition?.attributId ?? ressourcen?.id ?? attribute[0]?.id ?? null);
  const [ziel, setZiel] = useState<InvestitionsZiel | null>(investition?.ziel ?? null);
  const [serverFehler, setServerFehler] = useState<unknown>(null);
  const betragRef = useRef<HTMLInputElement>(null);
  const wahlRef = useRef<HTMLInputElement>(null);
  const basisId = useId();
  const listen = listenFuerZiel(ziel, sichtbarkeit, ziele?.visionen ?? [], ziele?.projekte ?? [], attribute);
  const bonusListe = waehlbareAttribute(attribute, sichtbarkeit.funktionen, attributId ?? undefined);
  const zahlungsListe = waehlbareAttribute(attribute, sichtbarkeit.funktionen, bezahltId ?? undefined);
  const zahlAttribut = attribute.find((eintrag) => eintrag.id === bezahltId) ?? null;
  const bonusAttribut = attribute.find((eintrag) => eintrag.id === attributId) ?? null;
  const zurueck = bisherigerBetrag(investition?.bezahltAttributId ?? null, investition?.betrag ?? 0, bezahltId);
  const verfuegbar = zahlAttribut ? verfuegbaresXp(zahlAttribut.level.xpGesamt, zurueck) : 0;
  const problem = betragProblem(bezahltId !== null, betragText, verfuegbar);
  const zeigeFehler = betragGeprueft && problem !== null;
  const betragZahl = betragAusText(betragText);
  const bonusText = bonusAttribut ? attributName(bonusAttribut) : tx('Wähle ein Attribut.');
  const zahlText = nameVonAttribut(bezahltId, attribute, tx('Nichts'));
  const zielText = zielName(ziel, listen.visionen, listen.projekte, listen.attribute);
  const feldId = `${basisId}-betrag`;
  const fehlerId = `${basisId}-fehler`;
  const hinweisId = `${basisId}-hinweis`;
  const beschrieben = [zeigeFehler ? fehlerId : '', hinweisId].filter(Boolean).join(' ');

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
      if (attributId === null) {
        throw new Error(tx('Wähle ein Attribut.'));
      }
      const daten: InvestitionDaten = {
        name: name.trim(),
        icon,
        groesse,
        attributId,
        ziel,
        ...zahlungVon(bezahltId, betragText),
      };
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
    if (attributId === null) {
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
    bonusText,
    xpNeu: zahlAttribut && betragZahl !== null && betragZahl > 0 ? zahlAttribut.level.xpGesamt + zurueck - betragZahl : null,
    xpJetzt: zahlAttribut?.level.xpGesamt ?? 0,
    kurve: zahlAttribut ? kurveFuerTyp(zahlAttribut.typ) : kurveFuerTyp('attribut'),
  });

  const zahlOptionen: WahlOption[] = [
    { wert: '', name: tx('Nichts') },
    ...zahlungsListe.map((eintrag) => ({ wert: String(eintrag.id), name: attributName(eintrag) })),
  ];
  const bonusOptionen: WahlOption[] = bonusListe.map((eintrag) => ({ wert: String(eintrag.id), name: attributName(eintrag) }));
  const zielOptionen: WahlOption[] = [
    { wert: '', name: tx('Keins') },
    ...listen.visionen.map((vision) => ({ wert: `vision:${vision.id}`, name: vision.titel, gruppe: 'Vision' })),
    ...listen.projekte.map((eintrag) => ({ wert: `projekt:${eintrag.id}`, name: eintrag.name, gruppe: 'Projekt' })),
    ...listen.attribute.map((eintrag) => ({ wert: `attribut:${eintrag.id}`, name: attributName(eintrag), gruppe: 'Attribut' })),
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
        <GroessenRegler wert={groesse} onAendern={setGroesse} className="" />
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
              merkeWahl(id, attributId, ziel);
            }}
          />
        </ZeilenGruppe>
        {bezahltId !== null ? (
          <div className="feld block min-w-0 space-y-2" data-feld-fehler={zeigeFehler ? '' : undefined}>
            <label htmlFor={feldId} className="feld-label block text-sm leading-5 font-semibold">
              {tx('Betrag')}
            </label>
            <div className="relative min-w-0">
              <input
                ref={betragRef}
                id={feldId}
                className={`${EINGABE_STIL} pr-14 tabular-nums`}
                inputMode="numeric"
                autoComplete="off"
                value={betragText}
                aria-invalid={zeigeFehler || undefined}
                aria-describedby={beschrieben}
                onChange={(ereignis) => setBetragText(ereignis.target.value.replace(/\D/g, '').slice(0, 15))}
                onBlur={() => setBetragGeprueft(true)}
              />
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-leise">
                {tx('XP')}
              </span>
            </div>
            {zeigeFehler && problem ? (
              <p id={fehlerId} className="feld-fehler text-[13px] leading-[18px] break-words text-gefahr" role="alert">
                <span aria-hidden="true">⚠ </span>
                {fehlerSatz(problem, verfuegbar)}
              </p>
            ) : null}
            <p id={hinweisId} className="feld-hilfe truncate text-[13px] leading-[18px] text-leise">
              {tx('Verfügbar: {xp} XP', { xp: zahl(verfuegbar) })}
            </p>
          </div>
        ) : null}
        <ZeilenGruppe titel="Wirkung">
          <EinzelWahl
            feld="Bonus für"
            wertName={bonusText}
            optionen={bonusOptionen}
            wert={attributId === null ? '' : String(attributId)}
            onWaehlen={(wert) => {
              const id = Number(wert);
              setAttributId(id);
              merkeWahl(bezahltId, id, ziel);
            }}
          />
          <EinzelWahl
            feld="Auch für"
            wertName={zielText}
            optionen={zielOptionen}
            wert={zielWert(ziel)}
            onWaehlen={(wert) => {
              const naechstes = zielAusWert(wert);
              setZiel(naechstes);
              merkeWahl(bezahltId, attributId, naechstes);
            }}
          />
        </ZeilenGruppe>
        <div className="feld block space-y-2">
          <span className="feld-label block text-sm leading-5 font-semibold">{tx('Symbol')}</span>
          <IconAuswahl wert={icon} farbe={NEUTRAL_FARBE} onAendern={setIcon} />
        </div>
        <input
          ref={wahlRef}
          disabled
          tabIndex={-1}
          aria-hidden="true"
          defaultValue={`${bezahltId ?? ''}|${attributId ?? ''}|${zielWert(ziel)}`}
          className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
        />
        <Fehlermeldung fehler={serverFehler} />
        <p className="text-[13px] leading-[18px] text-leise">{zusammenfassung}</p>
        <Knopf type="submit" variante="primaer" className="w-full">
          {tx('Speichern')}
        </Knopf>
      </div>
    </form>
  );
}

function zielName(ziel: InvestitionsZiel | null, visionen: Vision[], projekte: Projekt[], attribute: Attribut[]): string {
  if (!ziel) {
    return tx('Keins');
  }
  if (ziel.art === 'vision') {
    return visionen.find((vision) => vision.id === ziel.id)?.titel ?? tx('Keins');
  }
  if (ziel.art === 'projekt') {
    return projekte.find((eintrag) => eintrag.id === ziel.id)?.name ?? tx('Keins');
  }
  return nameVonAttribut(ziel.id, attribute, tx('Keins'));
}

function fassung(angaben: {
  bezahltId: number | null;
  betragZahl: number | null;
  zahlText: string;
  bonusText: string;
  xpNeu: number | null;
  xpJetzt: number;
  kurve: ReturnType<typeof kurveFuerTyp>;
}): string {
  const kostenlos = angaben.bezahltId === null || angaben.betragZahl === 0;
  const basis = kostenlos
    ? tx('Kostenlos · Bonus für {name}', { name: angaben.bonusText })
    : angaben.betragZahl !== null && angaben.betragZahl > 0
      ? tx('Kostet {xp} XP aus {name} · Bonus für {bonus}', {
          xp: zahl(angaben.betragZahl),
          name: angaben.zahlText,
          bonus: angaben.bonusText,
        })
      : tx('Bonus für {name}', { name: angaben.bonusText });
  if (angaben.xpNeu === null || angaben.betragZahl === null || angaben.betragZahl <= 0) {
    return basis;
  }
  const fall = levelDanach(angaben.xpJetzt, angaben.xpNeu, angaben.kurve);
  if (fall === null) {
    return basis;
  }
  return `${basis} · ${tx('{name} fällt auf Level {level}', { name: angaben.zahlText, level: levelZahl(fall) })}`;
}
