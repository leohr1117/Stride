import { tx } from '../../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Swords, Trophy } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { EintragDaten, VorhabenMitProjekt, VorhabenWahl } from '../../../../shared/api/index.ts';
import { DAUER_OPTIONEN, GRENZEN } from '../../../../shared/spiel/begriffe.ts';
import { eintragTipp, standardEbenen, ZIEL_MARKE } from '../../../../shared/spiel/ebenen.ts';
import { taetigkeitPasst, taetigkeitenFuerProjekt } from '../../../../shared/spiel/taetigkeit.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { basisXp, MEILENSTEIN_INFO } from '../../../../shared/spiel/xp.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { lokalesDatum, tagesUeberschrift, zahl } from '../../format.ts';
import { useSichtbarkeit } from '../../funktionen.ts';
import { useFeiern } from '../../components/Belohnung.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { Icon } from '../../components/Icons.tsx';
import { NeueTaetigkeit } from '../taetigkeiten/TaetigkeitFormular.tsx';
import { Chip, EINGABE_STIL, Feld, Fehlermeldung, InfoHinweis, Knopf, SchalterBahn, Segmentauswahl } from '../../ui/index.ts';

export interface EintragVorgabe {
  projektId?: number;
  vorhabenId?: number;
  faehigkeitId?: number;
}

type Ergebnis = 'dran' | 'geschafft' | 'gescheitert';

interface Formular {
  projektId: number | null;
  vorlageId: number | null;
  vorhabenId: number | null;
  ergebnis: Ergebnis;
  erkenntnis: string;
  meilenstein: boolean;
  faehigkeitId: number | null;
  stunden: number | null;
  notiz: string;
  datum: string;
}

interface VorhabenChip {
  id: number;
  titel: string;
  anlauf: number;
  boss: boolean;
  projektId: number | null;
}

function DatumZeile({ wert, heute, onAendern }: { wert: string; heute: string; onAendern: (wert: string) => void }) {
  const abweichend = wert !== '' && wert !== heute;
  const text = abweichend ? tagesUeberschrift(wert) : tx("Heute");
  return (
    <label className="relative flex min-h-12 cursor-pointer items-center gap-3 overflow-hidden rounded-xl border border-rand px-3 focus-within:border-akzent">
      <span className="text-sm font-medium">{tx("Datum")}</span>
      <span className={`ml-auto text-sm ${abweichend ? 'font-medium' : 'text-leise'}`}>{text}</span>
      <input
        type="date"
        aria-label={abweichend ? tx('Datum, {text}', { text }) : tx('Datum, Heute')}
        max={heute}
        value={wert}
        onChange={(ereignis) => onAendern(ereignis.target.value)}
        className="absolute inset-0 h-full w-full min-w-0 cursor-pointer opacity-0"
      />
    </label>
  );
}

function eintragAktion(nachtragen: boolean, xp: string, meilenstein: boolean): string {
  const aktion = tx(nachtragen ? 'Nachtragen' : 'Eintragen');
  return tx(meilenstein ? '{aktion} · ca. +{xp} XP + Meilenstein' : '{aktion} · ca. +{xp} XP', { aktion, xp });
}

function leeresFormular(): Formular {
  return {
    projektId: null,
    vorlageId: null,
    vorhabenId: null,
    ergebnis: 'dran',
    erkenntnis: '',
    meilenstein: false,
    faehigkeitId: null,
    stunden: null,
    notiz: '',
    datum: lokalesDatum(new Date()),
  };
}

interface VorlageKurz {
  id: number;
  archiviert: boolean;
  projektId: number | null;
}

function ersteVorlage(vorlagen: VorlageKurz[], projektId: number | null): number | null {
  return vorlagen.find((vorlage) => !vorlage.archiviert && taetigkeitPasst(vorlage.projektId, projektId))?.id ?? null;
}

function vorlageFuerProjekt(vorlagen: VorlageKurz[], aktuelleId: number | null, projektId: number | null): number | null {
  const aktuelle = vorlagen.find((vorlage) => vorlage.id === aktuelleId);
  if (aktuelle && !aktuelle.archiviert && taetigkeitPasst(aktuelle.projektId, projektId)) {
    return aktuelle.id;
  }
  return ersteVorlage(vorlagen, projektId);
}

function chipAusVorhaben(vorhaben: VorhabenMitProjekt): VorhabenChip {
  return {
    id: vorhaben.id,
    titel: vorhaben.titel,
    anlauf: vorhaben.anlauf,
    boss: vorhaben.boss !== null,
    projektId: vorhaben.projektId,
  };
}

export function EintragDialog({
  offen,
  vorgabe,
  onSchliessen,
}: {
  offen: boolean;
  vorgabe: EintragVorgabe;
  onSchliessen: () => void;
}) {
  const queryClient = useQueryClient();
  const feiern = useFeiern();
  const sichtbarkeit = useSichtbarkeit();
  const funktionen = sichtbarkeit.funktionen;
  const bosseAn = istAn('bossAngriffe', sichtbarkeit);
  const { data: einstellungen, isPending: einstellungenLaden } = useQuery({
    queryKey: SCHLUESSEL.einstellungen,
    queryFn: api.einstellungen,
  });
  const ebenen = einstellungen?.ebenen ?? standardEbenen();
  const { data: projekte = [], isPending: projekteLaden } = useQuery({
    queryKey: SCHLUESSEL.projektauswahl,
    queryFn: api.projektauswahl,
    enabled: offen,
  });
  const { data: vorlagen = [], isPending: vorlagenLaden } = useQuery({
    queryKey: SCHLUESSEL.vorlagen,
    queryFn: api.vorlagen,
    enabled: offen,
  });
  const { data: faehigkeiten = [] } = useQuery({
    queryKey: SCHLUESSEL.faehigkeiten,
    queryFn: api.faehigkeiten,
    enabled: offen,
  });
  const vorhabenNoetig = offen && ebenen.vorhaben;
  const { data: laufendes, isPending: laufendPending } = useQuery({
    queryKey: SCHLUESSEL.laufendes,
    queryFn: api.laufendes,
    enabled: vorhabenNoetig,
  });

  const [formular, setFormular] = useState<Formular>(leeresFormular);
  const [neuesVorhaben, setNeuesVorhaben] = useState('');
  const [neueTaetigkeit, setNeueTaetigkeit] = useState(false);
  const initialisiert = useRef(false);

  const offeneZiele = [...(laufendes?.bosse ?? []), ...(laufendes?.vorhaben ?? [])];

  useEffect(() => {
    if (!offen) {
      initialisiert.current = false;
      setNeueTaetigkeit(false);
      return;
    }
    if (initialisiert.current || einstellungenLaden || projekteLaden || vorlagenLaden) {
      return;
    }
    if (vorhabenNoetig && laufendPending) {
      return;
    }
    initialisiert.current = true;
    const basis = leeresFormular();
    const liste = [...(laufendes?.bosse ?? []), ...(laufendes?.vorhaben ?? [])];
    const vorhaben = ebenen.vorhaben ? liste.find((eintrag) => eintrag.id === vorgabe.vorhabenId) : undefined;
    const projekt = ebenen.projekte ? projekte.find((eintrag) => eintrag.id === vorgabe.projektId) : undefined;
    const faehigkeitId = funktionen.faehigkeiten && vorgabe.faehigkeitId ? vorgabe.faehigkeitId : null;
    const startProjektId = ebenen.projekte ? (vorhaben?.projektId ?? projekt?.id ?? null) : null;
    const standardId =
      startProjektId != null ? (projekte.find((eintrag) => eintrag.id === startProjektId)?.vorlageId ?? null) : null;
    setFormular({
      ...basis,
      projektId: startProjektId,
      vorhabenId: vorhaben?.id ?? null,
      vorlageId: vorlageFuerProjekt(vorlagen, standardId, startProjektId),
      faehigkeitId,
    });
    setNeuesVorhaben('');
  }, [
    offen,
    einstellungenLaden,
    projekteLaden,
    vorlagenLaden,
    vorhabenNoetig,
    laufendPending,
    projekte,
    vorlagen,
    laufendes,
    ebenen,
    vorgabe,
    funktionen.faehigkeiten,
  ]);

  const eintragen = useMutation({
    mutationFn: (daten: EintragDaten) => api.erstelleEintrag(daten),
    onSuccess: (ergebnis) => {
      void queryClient.invalidateQueries();
      onSchliessen();
      feiern(ergebnis.belohnung);
    },
  });

  const vorhabenAnlegen = useMutation({
    mutationFn: ({ projektId, titel }: { projektId: number; titel: string }) => api.erstelleVorhaben(projektId, titel),
    onSuccess: async (vorhaben) => {
      setNeuesVorhaben('');
      await queryClient.invalidateQueries({ queryKey: SCHLUESSEL.projektauswahl });
      setFormular((aktuell) => ({
        ...aktuell,
        vorhabenId: vorhaben.id,
        projektId: ebenen.projekte ? vorhaben.projektId : null,
        ergebnis: 'dran',
      }));
      void queryClient.invalidateQueries();
    },
  });

  const aendern = (aenderung: Partial<Formular>) => setFormular((aktuell) => ({ ...aktuell, ...aenderung }));

  const ausstehenderTitel = neuesVorhaben.trim();
  const geerbteProjektId = ebenen.projekte ? (vorgabe.projektId ?? null) : null;
  const gewaehltesProjektId = !ebenen.projekte
    ? null
    : formular.vorhabenId !== null
      ? formular.projektId
      : ausstehenderTitel
        ? geerbteProjektId
        : formular.projektId;
  const aktiveVorlagen = taetigkeitenFuerProjekt(vorlagen, gewaehltesProjektId);
  const vorlage = aktiveVorlagen.find((eintrag) => eintrag.id === formular.vorlageId);
  const aktiveFaehigkeiten = faehigkeiten.filter((faehigkeit) => !faehigkeit.archiviert);
  const faehigkeit = aktiveFaehigkeiten.find((eintrag) => eintrag.id === formular.faehigkeitId);
  const mitVorhaben = formular.vorhabenId !== null;
  const istMeilenstein = mitVorhaben ? formular.ergebnis === 'geschafft' : formular.meilenstein;
  const kannSpeichern = vorlage !== undefined && !eintragen.isPending;
  const heute = lokalesDatum(new Date());
  const nachtragen = formular.datum !== '' && formular.datum !== heute;

  const vorhabenChips: VorhabenChip[] = offeneZiele
    .filter((eintrag) => vorgabe.projektId === undefined || eintrag.projektId === vorgabe.projektId)
    .map(chipAusVorhaben);
  const zeigtVorhaben = ebenen.vorhaben;
  const zeigtFaehigkeit = funktionen.faehigkeiten && aktiveFaehigkeiten.length > 0;
  const zeigtWofuer = zeigtVorhaben || zeigtFaehigkeit;
  const zuordnungsTipp = eintragTipp({
    vorhabenSichtbar: zeigtVorhaben,
    faehigkeitSichtbar: zeigtFaehigkeit,
    vorhabenGewaehlt: mitVorhaben || ausstehenderTitel !== '',
    faehigkeitGewaehlt: formular.faehigkeitId !== null,
  });

  const vorhabenUebernehmen = () => {
    if (!ebenen.vorhaben || geerbteProjektId === null || !ausstehenderTitel || vorhabenAnlegen.isPending) {
      return;
    }
    vorhabenAnlegen.mutate({ projektId: geerbteProjektId, titel: ausstehenderTitel });
  };

  const absenden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (!vorlage) {
      return;
    }
    let vorhaben: VorhabenWahl = null;
    if (ebenen.vorhaben && formular.vorhabenId !== null) {
      vorhaben = { art: 'bestehend', id: formular.vorhabenId };
    } else if (ebenen.vorhaben && ausstehenderTitel && geerbteProjektId !== null) {
      vorhaben = { art: 'neu', titel: ausstehenderTitel };
    }
    const abschluss = formular.vorhabenId !== null && formular.ergebnis !== 'dran' ? formular.ergebnis : null;

    eintragen.mutate({
      projektId: ebenen.projekte ? gewaehltesProjektId : null,
      vorlageId: vorlage.id,
      vorhaben,
      abschluss,
      erkenntnis: abschluss === 'gescheitert' ? formular.erkenntnis : '',
      stunden: formular.stunden,
      notiz: formular.notiz,
      meilenstein: vorhaben === null && formular.meilenstein,
      faehigkeitId: funktionen.faehigkeiten ? (faehigkeit?.id ?? null) : null,
      datum: formular.datum || null,
    });
  };

  return (
    <>
    <Dialog offen={offen} titel={tx("Was hast du getan?")} onSchliessen={onSchliessen}>
      <form onSubmit={absenden} className="space-y-5">
        <Feld label={tx("Tätigkeit")}>
          <div className="chip-reihe -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {aktiveVorlagen.map((eintrag) => (
              <Chip key={eintrag.id} aktiv={eintrag.id === formular.vorlageId} onClick={() => aendern({ vorlageId: eintrag.id })}>
                <Icon name={eintrag.icon} className="size-4" />
                {eintrag.name}
              </Chip>
            ))}
          </div>
          <Knopf className="mt-2" onClick={() => setNeueTaetigkeit(true)}>
            <Plus className="size-4" />
            {tx("Neue Tätigkeit")}
          </Knopf>
        </Feld>

        {zeigtWofuer && (
          <div className="space-y-3 rounded-2xl border border-rand bg-flaeche-2/50 p-3">
            <p className="text-sm font-medium">{tx("Wofür?")}</p>
            {zuordnungsTipp ? <p className="text-xs text-leise">{zuordnungsTipp}</p> : null}
            {zeigtVorhaben && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-leise">{tx(ZIEL_MARKE.vorhaben.name)}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Chip
                    aktiv={formular.vorhabenId === null && ausstehenderTitel === ''}
                    onClick={() => {
                      setNeuesVorhaben('');
                      aendern({
                        vorhabenId: null,
                        projektId: geerbteProjektId,
                        ergebnis: 'dran',
                        vorlageId: vorlageFuerProjekt(vorlagen, formular.vorlageId, geerbteProjektId),
                      });
                    }}
                  >
                    {tx("Keins")}
                  </Chip>
                  {vorhabenChips.map((eintrag) => (
                    <Chip
                      key={eintrag.id}
                      aktiv={formular.vorhabenId === eintrag.id}
                      onClick={() => {
                        setNeuesVorhaben('');
                        const naechstesProjekt = ebenen.projekte ? eintrag.projektId : null;
                        aendern({
                          vorhabenId: eintrag.id,
                          projektId: naechstesProjekt,
                          ergebnis: 'dran',
                          vorlageId: vorlageFuerProjekt(vorlagen, formular.vorlageId, naechstesProjekt),
                        });
                      }}
                    >
                      {bosseAn && eintrag.boss && <Swords className="size-3.5 text-gefahr" />}
                      {eintrag.titel}
                      {eintrag.anlauf > 1 && <span className="text-xs text-leise">{eintrag.anlauf}. Anlauf</span>}
                    </Chip>
                  ))}
                </div>
                {geerbteProjektId !== null && (
                <div className="flex gap-2">
                  <input
                    className={EINGABE_STIL}
                    placeholder={tx("Neues Vorhaben")}
                    maxLength={GRENZEN.nameMax}
                    value={neuesVorhaben}
                    onChange={(ereignis) => {
                      setNeuesVorhaben(ereignis.target.value);
                      if (ereignis.target.value.trim() !== '') {
                        aendern({
                          vorhabenId: null,
                          projektId: geerbteProjektId,
                          ergebnis: 'dran',
                          vorlageId: vorlageFuerProjekt(vorlagen, formular.vorlageId, geerbteProjektId),
                        });
                      }
                    }}
                    onKeyDown={(ereignis) => {
                      if (ereignis.key === 'Enter') {
                        ereignis.preventDefault();
                        vorhabenUebernehmen();
                      }
                    }}
                  />
                  <Knopf
                    onClick={vorhabenUebernehmen}
                    disabled={!ausstehenderTitel || vorhabenAnlegen.isPending}
                    aria-label={tx("Vorhaben anlegen")}
                  >
                    <Plus className="size-4" />
                  </Knopf>
                </div>
                )}
                <Fehlermeldung fehler={vorhabenAnlegen.error} />
              </div>
            )}
            {zeigtFaehigkeit && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-leise">{tx("Fähigkeit")}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Chip aktiv={formular.faehigkeitId === null} onClick={() => aendern({ faehigkeitId: null })}>
                    {tx("Keine")}
                  </Chip>
                  {aktiveFaehigkeiten.map((eintrag) => (
                    <Chip
                      key={eintrag.id}
                      aktiv={formular.faehigkeitId === eintrag.id}
                      farbe={eintrag.farbe}
                      onClick={() => aendern({ faehigkeitId: eintrag.id })}
                    >
                      <Icon name={eintrag.icon} className="size-3.5" style={{ color: eintrag.farbe }} />
                      {eintrag.name}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {mitVorhaben ? (
          <Feld label={tx("Stand")}>
            <Segmentauswahl<Ergebnis>
              optionen={[
                { wert: 'dran', label: tx("Dran geblieben") },
                { wert: 'geschafft', label: tx("Geschafft") },
                { wert: 'gescheitert', label: tx("Gescheitert") },
              ]}
              wert={formular.ergebnis}
              onAendern={(ergebnis) => aendern({ ergebnis })}
            />
            {formular.ergebnis === 'gescheitert' && (
              <textarea
                className={`${EINGABE_STIL} mt-3 min-h-16`}
                placeholder={tx("Was nimmst du mit?")}
                maxLength={GRENZEN.notizMax}
                value={formular.erkenntnis}
                onChange={(ereignis) => aendern({ erkenntnis: ereignis.target.value })}
              />
            )}
          </Feld>
        ) : (
          <div className="relative flex min-h-12 items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={formular.meilenstein}
              aria-label={tx("Meilenstein")}
              onClick={() => aendern({ meilenstein: !formular.meilenstein })}
              className="absolute inset-0 z-0"
            />
            <Trophy className={`pointer-events-none size-5 shrink-0 ${formular.meilenstein ? 'text-xp' : 'text-leise'}`} />
            <span className="pointer-events-none flex min-w-0 flex-1 items-center">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{tx("Meilenstein")}</span>
              </span>
              <span className="pointer-events-auto">
                <InfoHinweis text={MEILENSTEIN_INFO} />
              </span>
            </span>
            <span className="pointer-events-none flex shrink-0 items-center">
              <SchalterBahn an={formular.meilenstein} />
            </span>
          </div>
        )}

        <Feld label={tx("Dauer")}>
          <div className="flex flex-wrap gap-1.5">
            <Chip aktiv={formular.stunden === null} onClick={() => aendern({ stunden: null })}>
              {tx("Keine Angabe")}
            </Chip>
            {DAUER_OPTIONEN.map((option) => (
              <Chip
                key={option.stunden}
                aktiv={formular.stunden === option.stunden}
                onClick={() => aendern({ stunden: option.stunden })}
              >
                {tx(option.label)}
              </Chip>
            ))}
          </div>
        </Feld>

        <Feld label={tx("Notiz")}>
          <textarea
            className={`${EINGABE_STIL} min-h-16 resize-y`}
            maxLength={GRENZEN.notizMax}
            value={formular.notiz}
            onChange={(ereignis) => aendern({ notiz: ereignis.target.value })}
          />
        </Feld>

        <DatumZeile wert={formular.datum} heute={heute} onAendern={(datum) => aendern({ datum })} />

        <Fehlermeldung fehler={eintragen.error} />

        <Knopf type="submit" variante="primaer" className="w-full py-3 text-base" disabled={!kannSpeichern}>
          {eintragen.isPending ? tx("Wird eingetragen …") : eintragAktion(nachtragen, zahl(basisXp(formular.stunden)), istMeilenstein)}
        </Knopf>
      </form>
    </Dialog>
    <NeueTaetigkeit
      offen={neueTaetigkeit}
      projektId={gewaehltesProjektId}
      projektName={
        gewaehltesProjektId === null ? null : (projekte.find((eintrag) => eintrag.id === gewaehltesProjektId)?.name ?? null)
      }
      onSchliessen={() => setNeueTaetigkeit(false)}
      onAngelegt={(vorlage) => aendern({ vorlageId: vorlage.id })}
    />
    </>
  );
}
