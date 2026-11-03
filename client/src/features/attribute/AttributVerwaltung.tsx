import { attributName, tx } from '../../text.ts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type CSSProperties, type FormEvent } from 'react';
import type { Attribut, Erschoepfung } from '../../../../shared/api/index.ts';
import { ATTRIBUT_KATALOG } from '../../../../shared/features/attribute/attributKatalog.ts';
import { GRENZEN, type AttributKennung, type AttributTyp, type IconName } from '../../../../shared/spiel/begriffe.ts';
import {
  ERSCHOEPFUNG_SCHALTER,
  VERFALL_STUFE_LABEL,
  VERFALL_STUFEN,
  abzugNebenNamen,
  erschoepfungsBild,
  verfallAlsText,
  verfallAusText,
  verfallProzent,
  type VerfallArt,
} from '../../../../shared/spiel/belastung.ts';
import { verfallFunktion } from '../../../../shared/spiel/funktionen.ts';
import { LEVEL_KURVEN, verlustBalken } from '../../../../shared/spiel/level.ts';
import { MIN_RADAR_ACHSEN } from '../../../../shared/spiel/radar.ts';
import { api } from '../../api/index.ts';
import { prozentPunkte } from '../../format.ts';
import { useFunktionen } from '../../funktionen.ts';
import { SchnellZeile } from '../../components/SchnellAktion.tsx';
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
  VorschlagFeld,
  XpAbzug,
  type VorschlagOption,
  ZuNiedrigHinweis,
} from '../../ui/index.ts';
import { Aktivierung, ziffern } from './Aktivierung.tsx';

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
                eintraege={[{ art: 'archivieren', id: 'bearbeiten', label: 'Bearbeiten' }]}
                onEintrag={() => onBearbeiten(attribut)}
              >
                {(menue) => (
                  <Zeile
                    name={name}
                    onKlick={() => onBearbeiten(attribut)}
                    pfeil={false}
                    symbol={<Icon name={attribut.icon} style={{ color: attribut.farbe }} />}
                    titel={
                      <span className="flex min-w-0 flex-nowrap items-center gap-1">
                        <span className="min-w-0 truncate">{name}</span>
                        {ursache ? <ZuNiedrigHinweis /> : null}
                        {prozent !== null ? <XpAbzug prozent={prozent} /> : null}
                      </span>
                    }
                    wert={<span className={ursache ? 'font-semibold text-gefahr' : undefined}>{stufe}</span>}
                    rechts={menue}
                  />
                )}
              </SchnellZeile>
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

const ABSCHNITT = 'ueberschrift abschnittskopf text-[13px] font-semibold leading-[18px] tracking-normal text-leise normal-case';

function verfallOptionen(art: VerfallArt): VorschlagOption[] {
  return VERFALL_STUFEN.map((stufe) => {
    const name = tx(VERFALL_STUFE_LABEL[stufe]);
    const prozent = stufe === 'aus' ? '' : prozentPunkte(verfallProzent(art, stufe));
    return {
      id: `${art}-${stufe}`,
      wert: verfallAlsText(art, stufe),
      zeile: name,
      neben: prozent || undefined,
      name: prozent ? `${name}, ${prozent}` : name,
    };
  });
}

export function AttributFormular({
  attribut,
  andere,
  onFertig,
}: {
  attribut: Attribut;
  andere: Attribut[];
  onFertig: () => void;
}) {
  const queryClient = useQueryClient();
  const funktionen = useFunktionen();
  const [beschreibung, setBeschreibung] = useState(attribut.beschreibung);
  const [farbe, setFarbe] = useState(attribut.farbe);
  const [icon, setIcon] = useState<IconName>(attribut.icon as IconName);
  const [belastungText, setBelastungText] = useState(verfallAlsText('belastung', attribut.verfallBelastung));
  const [zeitText, setZeitText] = useState(verfallAlsText('zeit', attribut.verfallZeit));
  const [erschoepfung, setErschoepfung] = useState(attribut.erschoepfung);
  const [erschoepfungZiel, setErschoepfungZiel] = useState<number | null>(attribut.erschoepfungZiel);
  const verfallAn = Boolean(funktionen[verfallFunktion(attribut.typ)]);
  const belastungStufe = verfallAusText('belastung', belastungText);
  const zeitStufe = verfallAusText('zeit', zeitText);
  const verfallOk = !verfallAn || (belastungStufe !== null && zeitStufe !== null);

  const speichern = useMutation({
    mutationFn: () =>
      api.aendereAttribut(attribut.id, {
        beschreibung,
        farbe,
        icon,
        verfallBelastung: belastungStufe ?? attribut.verfallBelastung,
        verfallZeit: zeitStufe ?? attribut.verfallZeit,
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
      {verfallAn && (
        <section className="space-y-4">
          <h3 className={ABSCHNITT}>{tx('Verfall')}</h3>
          <VorschlagFeld
            label="Verlust bei Nichtnutzung"
            text={belastungText}
            onText={setBelastungText}
            optionen={verfallOptionen('belastung')}
            eigenName={`${tx('Verlust bei Nichtnutzung')}, ${tx('Eigener')}`}
            einheit="%"
            fehler={belastungStufe === null ? tx('Nur Aus, Leicht, Mittel oder Stark.') : null}
            bereinige={ziffern(3)}
          />
          <VorschlagFeld
            label="Verlust über Zeit"
            text={zeitText}
            onText={setZeitText}
            optionen={verfallOptionen('zeit')}
            eigenName={`${tx('Verlust über Zeit')}, ${tx('Eigener')}`}
            einheit="%"
            fehler={zeitStufe === null ? tx('Nur Aus, Leicht, Mittel oder Stark.') : null}
            bereinige={ziffern(3)}
          />
        </section>
      )}
      <div className="space-y-3 rounded-xl bg-flaeche-2 p-3">
        <Schalter an={erschoepfung} onAendern={setErschoepfung} label={ERSCHOEPFUNG_SCHALTER} umbruch />
        {erschoepfung && (
          <Feld label={tx("Ziel")}>
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
          </Feld>
        )}
      </div>
      <Fehlermeldung fehler={speichern.error} />
      <Knopf type="submit" variante="primaer" className="w-full" disabled={!verfallOk || speichern.isPending}>
        {tx("Speichern")}
      </Knopf>
    </Formular>
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
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-expanded={offen}
                onClick={() => setGewaehlt(offen ? null : vorlage.kennung)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
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
              {!offen ? (
                <Knopf className="shrink-0" onClick={() => setGewaehlt(vorlage.kennung)}>
                  {tx('Hinzufügen')}
                </Knopf>
              ) : null}
            </div>
            {offen && <Aktivierung vorlage={vorlage} archiviert={archiviert} attribute={attribute} onFertig={onFertig} />}
          </div>
        );
      })}
    </div>
  );
}
