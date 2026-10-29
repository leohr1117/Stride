import { attributName, tx } from '../../text.ts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type CSSProperties, type FormEvent } from 'react';
import type { AktivierungsModus, Attribut, Erschoepfung } from '../../../../shared/api/index.ts';
import { ATTRIBUT_KATALOG, type AttributVorlage } from '../../../../shared/features/attribute/attributKatalog.ts';
import { GRENZEN, type AttributKennung, type AttributTyp, type IconName } from '../../../../shared/spiel/begriffe.ts';
import { ERSCHOEPFUNG_SCHALTER, VERFALL_STUFE_LABEL, VERFALL_STUFEN, abzugNebenNamen, erschoepfungsBild, type VerfallStufe } from '../../../../shared/spiel/belastung.ts';
import { verfallFunktion } from '../../../../shared/spiel/funktionen.ts';
import { berechneLevel, LEVEL_KURVEN, verlustBalken } from '../../../../shared/spiel/level.ts';
import { MIN_RADAR_ACHSEN } from '../../../../shared/spiel/radar.ts';
import { zielXpNachAnteil } from '../../../../shared/spiel/umverteilung.ts';
import { api } from '../../api/index.ts';
import { zahl } from '../../format.ts';
import { useFunktionen } from '../../funktionen.ts';
import { SchnellNebenaktion, SchnellZeile } from '../../components/SchnellAktion.tsx';
import { AnlegeZeile, Liste, Zeile } from '../../components/Zeile.tsx';
import { Icon } from '../../components/Icons.tsx';
import { IconAuswahl } from '../../components/IconAuswahl.tsx';
import { AttributRadar } from '../../components/mitDiagramm.tsx';
import {
  AllgemeinerXpAbzug,
  EINGABE_STIL,
  Farbauswahl,
  Feld,
  Fehlermeldung,
  Formular,
  Fortschrittsbalken,
  Karte,
  Knopf,
  Schalter,
  Segmentauswahl,
  XpAbzug,
  ZuNiedrigHinweis,
} from '../../ui/index.ts';

const EINZUG = { '--liste-einzug': '48px' } as CSSProperties;

export function AttributBereich({
  typ,
  werte,
  erschoepfungen,
  onNeu,
  onBearbeiten,
}: {
  typ: AttributTyp;
  werte: Attribut[];
  erschoepfungen: Erschoepfung[];
  onNeu: () => void;
  onBearbeiten: (attribut: Attribut) => void;
}) {
  const bild = erschoepfungsBild(
    erschoepfungen.map((eintrag) => ({ quelleId: eintrag.attributId, zielId: eintrag.zielId, faktor: eintrag.faktor })),
  );
  return (
    <div className="space-y-4">
      {bild.allgemein !== null ? <AllgemeinerXpAbzug prozent={bild.allgemein} /> : null}
      {werte.length >= MIN_RADAR_ACHSEN ? (
        <Karte>
          <AttributRadar typ={typ} werte={werte} />
        </Karte>
      ) : null}
      <Liste>
        {werte.map((attribut) => {
          const name = attributName(attribut);
          const hoechstXp = Number.isFinite(attribut.hoechstXp) ? attribut.hoechstXp : attribut.level.xpGesamt;
          const balken = verlustBalken(attribut.level.xpGesamt, hoechstXp, LEVEL_KURVEN[attribut.typ]);
          const ursache = bild.ursachen.includes(attribut.id);
          const prozent = abzugNebenNamen(bild, attribut.id);
          const stufe = tx('Lvl {level}', { level: attribut.level.level });
          return (
            <div key={attribut.id} className="attributzeile" style={EINZUG}>
              <SchnellZeile
                ziel={{
                  art: 'attribut',
                  id: attribut.id,
                  name,
                  archiviert: attribut.archiviert,
                  loeschbar: attribut.loeschbar,
                  gesperrt: werte.length <= 1,
                }}
              >
                {(menue) => (
                  <Zeile
                    name={name}
                    onKlick={() => onBearbeiten(attribut)}
                    pfeil={false}
                    symbol={<Icon name={attribut.icon} style={{ color: attribut.farbe }} />}
                    titel={
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="min-w-0 break-words">{name}</span>
                        {prozent !== null ? <XpAbzug prozent={prozent} /> : null}
                      </span>
                    }
                    wert={<span className={ursache ? 'font-semibold text-gefahr' : undefined}>{stufe}</span>}
                    rechts={menue}
                  />
                )}
              </SchnellZeile>
              {ursache ? (
                <div className="relative z-10 -mt-1 ps-12 pb-1">
                  <ZuNiedrigHinweis />
                </div>
              ) : null}
              <div className="px-4 pb-3">
                <Fortschrittsbalken anteil={balken.stand} verlustBis={balken.verlustBis} farbe="var(--fortschritt)" hoehe="h-1.5" />
              </div>
            </div>
          );
        })}
        <AnlegeZeile text="Attribut hinzufügen" onKlick={onNeu} />
      </Liste>
    </div>
  );
}

export function AttributFormular({
  attribut,
  archivierbar,
  andere,
  onFertig,
}: {
  attribut: Attribut;
  archivierbar: boolean;
  andere: Attribut[];
  onFertig: () => void;
}) {
  const queryClient = useQueryClient();
  const funktionen = useFunktionen();
  const [beschreibung, setBeschreibung] = useState(attribut.beschreibung);
  const [farbe, setFarbe] = useState(attribut.farbe);
  const [icon, setIcon] = useState<IconName>(attribut.icon as IconName);
  const [verfallBelastung, setVerfallBelastung] = useState<VerfallStufe>(attribut.verfallBelastung);
  const [verfallZeit, setVerfallZeit] = useState<VerfallStufe>(attribut.verfallZeit);
  const [erschoepfung, setErschoepfung] = useState(attribut.erschoepfung);
  const [erschoepfungZiel, setErschoepfungZiel] = useState<number | null>(attribut.erschoepfungZiel);
  const stufen = VERFALL_STUFEN.map((stufe) => ({ wert: stufe, label: tx(VERFALL_STUFE_LABEL[stufe]) }));

  const speichern = useMutation({
    mutationFn: () =>
      api.aendereAttribut(attribut.id, {
        beschreibung,
        farbe,
        icon,
        verfallBelastung,
        verfallZeit,
        erschoepfung,
        erschoepfungZiel,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onFertig();
    },
  });

  const absenden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    speichern.mutate();
  };

  return (
    <Formular onAbsenden={absenden}>
      <Feld label={tx("Name")}>
        <p className="break-words text-sm">{attributName(attribut)}</p>
      </Feld>
      <Feld label={tx("Beschreibung")}>
        <input
          className={EINGABE_STIL}
          value={beschreibung}
          maxLength={GRENZEN.beschreibungMax}
          onChange={(ereignis) => setBeschreibung(ereignis.target.value)}
        />
      </Feld>
      <Feld label={tx("Symbol")}>
        <IconAuswahl wert={icon} farbe={farbe} onAendern={setIcon} />
      </Feld>
      <Feld label={tx("Farbe")}>
        <Farbauswahl wert={farbe} onAendern={setFarbe} />
      </Feld>
      {funktionen[verfallFunktion(attribut.typ)] && (
        <>
          <Feld label={tx("Verlust bei Nichtnutzung")}>
            <Segmentauswahl<VerfallStufe> optionen={stufen} wert={verfallBelastung} onAendern={setVerfallBelastung} />
          </Feld>
          <Feld label={tx("Verlust über Zeit")}>
            <Segmentauswahl<VerfallStufe> optionen={stufen} wert={verfallZeit} onAendern={setVerfallZeit} />
          </Feld>
        </>
      )}
      <div className="space-y-3 rounded-xl bg-flaeche-2 p-3">
        <Schalter an={erschoepfung} onAendern={setErschoepfung} label={ERSCHOEPFUNG_SCHALTER} umbruch />
        {erschoepfung && (
          <select
            className={EINGABE_STIL}
            value={erschoepfungZiel ?? ''}
            onChange={(ereignis) => setErschoepfungZiel(ereignis.target.value ? Number(ereignis.target.value) : null)}
          >
            <option value="">{tx("Für alle XP")}</option>
            {andere.map((eintrag) => (
              <option key={eintrag.id} value={eintrag.id}>
                {tx('Nur für {name}', { name: attributName(eintrag) })}
              </option>
            ))}
          </select>
        )}
      </div>
      <Fehlermeldung fehler={speichern.error} />
      <div className="flex gap-2">
        <SchnellNebenaktion
          ziel={{
            art: 'attribut',
            id: attribut.id,
            name: attributName(attribut),
            archiviert: attribut.archiviert,
            loeschbar: attribut.loeschbar,
            gesperrt: !archivierbar,
          }}
          onErledigt={onFertig}
        />
        <Knopf type="submit" variante="primaer" className="flex-1" disabled={speichern.isPending}>
          {tx("Speichern")}
        </Knopf>
      </div>
    </Formular>
  );
}

function gesamtXp(attribute: Attribut[]): number {
  let summe = 0;
  for (const attribut of attribute) {
    summe += attribut.level.xpGesamt;
  }
  return summe;
}

function Aktivierung({
  vorlage,
  archiviert,
  attribute,
  onFertig,
}: {
  vorlage: AttributVorlage;
  archiviert: Attribut | undefined;
  attribute: Attribut[];
  onFertig: () => void;
}) {
  const queryClient = useQueryClient();
  const [modus, setModus] = useState<AktivierungsModus>('behalten');
  const [level, setLevel] = useState('');
  const levelZahl = Number(level);
  const levelGueltig = Number.isInteger(levelZahl) && levelZahl >= 1 && levelZahl <= GRENZEN.visionLevelMax;
  const anteilLevel =
    archiviert?.archivAnteil != null
      ? berechneLevel(zielXpNachAnteil(archiviert.archivAnteil, gesamtXp(attribute)), LEVEL_KURVEN[vorlage.typ]).level
      : null;

  const optionen: { wert: AktivierungsModus; label: string }[] = archiviert
    ? [
        { wert: 'behalten', label: tx('Level {level} behalten', { level: zahl(archiviert.level.level) }) },
        ...(anteilLevel !== null
          ? [{ wert: 'anteil' as const, label: tx('Neu berechnen · Level {level}', { level: zahl(anteilLevel) }) }]
          : []),
        { wert: 'level', label: tx("Selbst schätzen") },
      ]
    : [
        { wert: 'behalten', label: tx("Bei Level 1 starten") },
        { wert: 'level', label: tx("Selbst schätzen") },
      ];

  const aktivieren = useMutation({
    mutationFn: () => api.aktiviereAttribut(vorlage.kennung, modus, modus === 'level' ? levelZahl : null),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onFertig();
    },
  });

  return (
    <div className="space-y-3 border-t border-rand pt-3">
      <div className="space-y-1.5">
        {optionen.map((option) => (
          <label key={option.wert} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name={`modus-${vorlage.kennung}`}
              checked={modus === option.wert}
              onChange={() => setModus(option.wert)}
              className="accent-[var(--akzent)]"
            />
            {option.label}
          </label>
        ))}
      </div>
      {modus === 'level' && (
        <input
          className={EINGABE_STIL}
          type="number"
          inputMode="numeric"
          min={1}
          value={level}
          onChange={(ereignis) => setLevel(ereignis.target.value)}
          aria-label={tx("Level")}
          autoFocus
        />
      )}
      <Fehlermeldung fehler={aktivieren.error} />
      <Knopf
        variante="primaer"
        className="w-full"
        onClick={() => aktivieren.mutate()}
        disabled={aktivieren.isPending || (modus === 'level' && !levelGueltig)}
      >
        {archiviert ? tx("Wiederherstellen") : tx("Aktivieren")}
      </Knopf>
    </div>
  );
}

export function AttributKatalog({
  typ,
  attribute,
  vorauswahl,
  onFertig,
}: {
  typ: AttributTyp;
  attribute: Attribut[];
  vorauswahl?: AttributKennung;
  onFertig: () => void;
}) {
  const [gewaehlt, setGewaehlt] = useState<AttributKennung | null>(vorauswahl ?? null);
  const nachKennung = new Map<AttributKennung, Attribut>();
  for (const attribut of attribute) {
    if (attribut.kennung !== null) {
      nachKennung.set(attribut.kennung, attribut);
    }
  }
  const verfuegbar = ATTRIBUT_KATALOG.filter(
    (vorlage) => vorlage.typ === typ && nachKennung.get(vorlage.kennung)?.archiviert !== false,
  );

  if (verfuegbar.length === 0) {
    return <p className="text-sm text-leise">{tx("Alle Werte aus dem Katalog sind bereits aktiv.")}</p>;
  }
  return (
    <div className="space-y-2">
      {verfuegbar.map((vorlage) => {
        const archiviert = nachKennung.get(vorlage.kennung);
        const offen = gewaehlt === vorlage.kennung;
        return (
          <div key={vorlage.kennung} className="rounded-xl border border-rand px-3 py-2.5">
            <button
              type="button"
              onClick={() => setGewaehlt(offen ? null : vorlage.kennung)}
              className="flex w-full items-center gap-3 text-left"
            >
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${vorlage.farbe}22`, color: vorlage.farbe }}
              >
                <Icon name={vorlage.icon} className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {attributName({ kennung: vorlage.kennung, name: archiviert?.name ?? vorlage.name })}
                </p>
                <p className="text-xs text-leise break-words">
                  {archiviert
                    ? tx('Archiviert · Lvl {level}', { level: archiviert.level.level })
                    : tx(vorlage.beschreibung)}
                </p>
              </div>
            </button>
            {offen && <Aktivierung vorlage={vorlage} archiviert={archiviert} attribute={attribute} onFertig={onFertig} />}
          </div>
        );
      })}
    </div>
  );
}
