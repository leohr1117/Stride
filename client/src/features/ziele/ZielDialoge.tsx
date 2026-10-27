import { tx } from '../../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { Organisation, Projekt, Vision } from '../../../../shared/api/index.ts';
import { FARBEN, GRENZEN } from '../../../../shared/spiel/begriffe.ts';
import { VISION_BEISPIELE } from '../../../../shared/spiel/orientierung.ts';
import { fehlendeZuordnung, ZIEL_MARKE, zielTitel } from '../../../../shared/spiel/ebenen.ts';
import { taetigkeitenFuerProjekt } from '../../../../shared/spiel/taetigkeit.ts';
import { VISION, visionBeute } from '../../../../shared/spiel/xp.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { zahl } from '../../format.ts';
import { useEbenen } from '../../funktionen.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { SchnellNebenaktion } from '../../components/SchnellAktion.tsx';
import { LevelBeispiele } from '../../components/Orientierung.tsx';
import { NeueTaetigkeit } from '../taetigkeiten/TaetigkeitFormular.tsx';
import { EINGABE_STIL, Farbauswahl, Feld, Fehlermeldung, Formular as FormularKasten, InfoHinweis, Knopf } from '../../ui/index.ts';

export type ZielBearbeitung =
  | { art: 'vision'; vision: Vision | null }
  | { art: 'organisation'; organisation: Organisation | null }
  | { art: 'projekt'; projekt: Projekt | null; visionId: number | null; organisationId: number | null }
  | null;

function istBestehend(bearbeitung: NonNullable<ZielBearbeitung>): boolean {
  switch (bearbeitung.art) {
    case 'vision':
      return bearbeitung.vision !== null;
    case 'organisation':
      return bearbeitung.organisation !== null;
    case 'projekt':
      return bearbeitung.projekt !== null;
  }
}

function dialogTitel(bearbeitung: NonNullable<ZielBearbeitung>): string {
  const name = tx(
    bearbeitung.art === 'vision'
      ? ZIEL_MARKE.visionen.name
      : bearbeitung.art === 'organisation'
        ? ZIEL_MARKE.organisationen.name
        : ZIEL_MARKE.projekte.name,
  );
  if (!istBestehend(bearbeitung)) {
    return tx(bearbeitung.art === 'projekt' ? 'Neues {name}' : 'Neue {name}', { name });
  }
  return tx('{name} bearbeiten', { name });
}

export function ZielDialog({ bearbeitung, onSchliessen }: { bearbeitung: ZielBearbeitung; onSchliessen: () => void }) {
  const titel = bearbeitung ? dialogTitel(bearbeitung) : '';

  return (
    <Dialog offen={bearbeitung !== null} titel={titel} onSchliessen={onSchliessen}>
      {bearbeitung?.art === 'vision' && (
        <VisionFormular key={bearbeitung.vision?.id ?? 'neu'} vision={bearbeitung.vision} onFertig={onSchliessen} />
      )}
      {bearbeitung?.art === 'organisation' && (
        <OrganisationFormular
          key={bearbeitung.organisation?.id ?? 'neu'}
          organisation={bearbeitung.organisation}
          onFertig={onSchliessen}
        />
      )}
      {bearbeitung?.art === 'projekt' && (
        <ProjektFormular
          key={bearbeitung.projekt?.id ?? `neu-${bearbeitung.visionId}-${bearbeitung.organisationId}`}
          projekt={bearbeitung.projekt}
          visionId={bearbeitung.visionId}
          organisationId={bearbeitung.organisationId}
          onFertig={onSchliessen}
        />
      )}
    </Dialog>
  );
}

function useSpeichern<T>(speichern: () => Promise<T>, onFertig: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: speichern,
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onFertig();
    },
  });
}

function Aktionen({
  neben,
  kannSpeichern,
  laeuft,
}: {
  neben?: ReactNode;
  kannSpeichern: boolean;
  laeuft: boolean;
}) {
  return (
    <div className="flex gap-2">
      {neben}
      <Knopf type="submit" variante="primaer" className="flex-1" disabled={!kannSpeichern || laeuft}>
        {tx("Speichern")}
      </Knopf>
    </div>
  );
}

(Aktionen as typeof Aktionen & { fuss: boolean }).fuss = true;

function Formular({ onAbsenden, children }: { onAbsenden: () => void; children: ReactNode }) {
  return (
    <FormularKasten
      onAbsenden={(ereignis) => {
        ereignis.preventDefault();
        onAbsenden();
      }}
    >
      {children}
    </FormularKasten>
  );
}

function TextFeld({ label, wert, onAendern }: { label: string; wert: string; onAendern: (wert: string) => void }) {
  return (
    <Feld label={label}>
      <textarea
        className={`${EINGABE_STIL} min-h-12`}
        rows={2}
        value={wert}
        maxLength={GRENZEN.beschreibungMax}
        onChange={(ereignis) => onAendern(ereignis.target.value)}
      />
    </Feld>
  );
}

function VisionFormular({ vision, onFertig }: { vision: Vision | null; onFertig: () => void }) {
  const [titel, setTitel] = useState(vision?.titel ?? '');
  const [beschreibung, setBeschreibung] = useState(vision?.beschreibung ?? '');
  const [farbe, setFarbe] = useState(vision?.farbe ?? FARBEN[6]);
  const [woopErgebnis, setWoopErgebnis] = useState(vision?.woopErgebnis ?? '');
  const [woopHindernis, setWoopHindernis] = useState(vision?.woopHindernis ?? '');
  const [woopPlan, setWoopPlan] = useState(vision?.woopPlan ?? '');
  const [level, setLevel] = useState(String(vision?.level ?? VISION.standardLevel));
  const levelZahl = Number(level);
  const levelGueltig = Number.isInteger(levelZahl) && levelZahl >= VISION.minLevel && levelZahl <= GRENZEN.visionLevelMax;

  const speichern = useSpeichern(() => {
    const daten = { titel, beschreibung, farbe, woopErgebnis, woopHindernis, woopPlan, level: levelZahl };
    if (!vision) {
      return api.erstelleVision(daten);
    }
    return api.aendereVision(vision.id, daten);
  }, onFertig);

  return (
    <Formular onAbsenden={() => speichern.mutate()}>
      <Feld label={tx("Wunsch")}>
        <input
          className={EINGABE_STIL}
          value={titel}
          maxLength={GRENZEN.nameMax}
          onChange={(ereignis) => setTitel(ereignis.target.value)}
          autoFocus
        />
      </Feld>
      <Feld label={tx("Beschreibung")}>
        <textarea
          className={`${EINGABE_STIL} min-h-16`}
          value={beschreibung}
          maxLength={GRENZEN.beschreibungMax}
          onChange={(ereignis) => setBeschreibung(ereignis.target.value)}
        />
      </Feld>
      <div className="space-y-2">
        <Feld label={`Level · Beute ${zahl(visionBeute(levelGueltig ? levelZahl : null))} XP`}>
          <input
            className={EINGABE_STIL}
            type="number"
            inputMode="numeric"
            min={VISION.minLevel}
            max={GRENZEN.visionLevelMax}
            value={level}
            onChange={(ereignis) => setLevel(ereignis.target.value)}
          />
        </Feld>
        <LevelBeispiele
          beispiele={VISION_BEISPIELE}
          empfohlenAb={VISION.empfohlenAb}
          onWaehlen={(wert) => setLevel(String(wert))}
        />
      </div>
      <TextFeld label={tx("Ergebnis")} wert={woopErgebnis} onAendern={setWoopErgebnis} />
      <TextFeld label={tx("Hindernis")} wert={woopHindernis} onAendern={setWoopHindernis} />
      <TextFeld label={tx('Wenn-dann-Plan')} wert={woopPlan} onAendern={setWoopPlan} />
      <Feld label={tx("Farbe")}>
        <Farbauswahl wert={farbe} onAendern={setFarbe} />
      </Feld>
      <Fehlermeldung fehler={speichern.error} />
      <Aktionen
        neben={
          vision ? (
            <SchnellNebenaktion
              ziel={{ art: 'vision', id: vision.id, name: vision.titel, archiviert: vision.archiviert, loeschbar: vision.loeschbar }}
              onErledigt={onFertig}
            />
          ) : null
        }
        kannSpeichern={titel.trim() !== '' && levelGueltig}
        laeuft={speichern.isPending}
      />
    </Formular>
  );
}

function OrganisationFormular({ organisation, onFertig }: { organisation: Organisation | null; onFertig: () => void }) {
  const ebenen = useEbenen();
  const { data: ziele } = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele });
  const [name, setName] = useState(organisation?.name ?? '');
  const [beschreibung, setBeschreibung] = useState(organisation?.beschreibung ?? '');
  const [farbe, setFarbe] = useState(organisation?.farbe ?? FARBEN[5]);
  const [visionId, setVisionId] = useState<number | null>(organisation?.visionId ?? null);
  const visionen = ziele?.visionen.filter((vision) => !vision.archiviert || vision.id === visionId) ?? [];

  const speichern = useSpeichern(() => {
    if (!organisation) {
      return api.erstelleOrganisation({
        name,
        beschreibung,
        farbe,
        visionId: ebenen.visionen ? visionId : null,
      });
    }
    return api.aendereOrganisation(
      organisation.id,
      ebenen.visionen ? { name, beschreibung, farbe, visionId } : { name, beschreibung, farbe },
    );
  }, onFertig);

  return (
    <Formular onAbsenden={() => speichern.mutate()}>
      <Feld label={tx("Name")}>
        <input
          className={EINGABE_STIL}
          value={name}
          maxLength={GRENZEN.nameMax}
          onChange={(ereignis) => setName(ereignis.target.value)}
          autoFocus
        />
      </Feld>
      <Feld label={tx("Beschreibung")}>
        <textarea
          className={`${EINGABE_STIL} min-h-16`}
          value={beschreibung}
          maxLength={GRENZEN.beschreibungMax}
          onChange={(ereignis) => setBeschreibung(ereignis.target.value)}
        />
      </Feld>
      {ebenen.visionen && (
        <Feld label={zielTitel('visionen', false)}>
          <select
            className={EINGABE_STIL}
            value={visionId ?? ''}
            onChange={(ereignis) => setVisionId(ereignis.target.value ? Number(ereignis.target.value) : null)}
          >
            <option value="">{tx("Keine Vision")}</option>
            {visionen.map((vision) => (
              <option key={vision.id} value={vision.id}>
                {vision.titel}
              </option>
            ))}
          </select>
        </Feld>
      )}
      <Feld label={tx("Farbe")}>
        <Farbauswahl wert={farbe} onAendern={setFarbe} />
      </Feld>
      <Fehlermeldung fehler={speichern.error} />
      <Aktionen
        neben={
          organisation ? (
            <SchnellNebenaktion
              ziel={{
                art: 'organisation',
                id: organisation.id,
                name: organisation.name,
                archiviert: organisation.archiviert,
                loeschbar: organisation.loeschbar,
              }}
              onErledigt={onFertig}
            />
          ) : null
        }
        kannSpeichern={name.trim() !== ''}
        laeuft={speichern.isPending}
      />
    </Formular>
  );
}

function mitIds<T extends { id: number }>(gruppen: readonly (readonly T[])[]): T[] {
  const gesehen = new Set<number>();
  const ergebnis: T[] = [];
  for (const gruppe of gruppen) {
    for (const eintrag of gruppe) {
      if (!gesehen.has(eintrag.id)) {
        gesehen.add(eintrag.id);
        ergebnis.push(eintrag);
      }
    }
  }
  return ergebnis;
}

function ProjektFormular({
  projekt,
  visionId: startVisionId,
  organisationId: startOrganisationId,
  onFertig,
}: {
  projekt: Projekt | null;
  visionId: number | null;
  organisationId: number | null;
  onFertig: () => void;
}) {
  const ebenen = useEbenen();
  const { data: ziele } = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele });
  const { data: vorlagen = [] } = useQuery({ queryKey: SCHLUESSEL.vorlagen, queryFn: api.vorlagen });
  const [name, setName] = useState(projekt?.name ?? '');
  const [beschreibung, setBeschreibung] = useState(projekt?.beschreibung ?? '');
  const [zuordnung, setZuordnung] = useState(() => {
    const visionId = projekt?.visionId ?? startVisionId;
    const organisationId = projekt?.organisationId ?? startOrganisationId;
    if (visionId !== null && ebenen.visionen) {
      return `vision:${visionId}`;
    }
    if (organisationId !== null && ebenen.organisationen) {
      return `organisation:${organisationId}`;
    }
    return '';
  });
  const [vorlageId, setVorlageId] = useState<number | null>(projekt?.standardVorlageId ?? null);
  const [abschlussId, setAbschlussId] = useState<number | null>(projekt?.abschlussVorlageId ?? null);
  const [neueTaetigkeit, setNeueTaetigkeit] = useState(false);

  const zielProjektId = projekt?.id ?? null;
  const aktiveVorlagen = taetigkeitenFuerProjekt(vorlagen, zielProjektId, vorlageId);
  const abschlussVorlagen = mitIds([
    aktiveVorlagen,
    taetigkeitenFuerProjekt(vorlagen, zielProjektId, abschlussId),
  ]);
  const gewaehlteVorlage = vorlageId ?? aktiveVorlagen[0]?.id ?? null;
  const [zuordnungArt, zuordnungId] = zuordnung.split(':');

  const elternAusgeblendet =
    projekt !== null &&
    ((projekt.visionId !== null && !ebenen.visionen) || (projekt.organisationId !== null && !ebenen.organisationen));
  const zuordnungSichtbar = ebenen.visionen || ebenen.organisationen;
  const visionGewaehlt = zuordnungArt === 'vision' && zuordnungId ? Number(zuordnungId) : null;
  const organisationGewaehlt = zuordnungArt === 'organisation' && zuordnungId ? Number(zuordnungId) : null;
  const zuordnungHinweis = fehlendeZuordnung({
    ebene: 'projekt',
    ebenen,
    visionId: visionGewaehlt,
    organisationId: organisationGewaehlt,
  });

  const speichern = useSpeichern(() => {
    const basis = {
      name,
      beschreibung,
      standardVorlageId: gewaehlteVorlage ?? 0,
      abschlussVorlageId: abschlussId,
    };
    const elternBehalten = !zuordnungSichtbar || (zuordnung === '' && elternAusgeblendet);
    if (projekt) {
      return api.aendereProjekt(
        projekt.id,
        elternBehalten ? basis : { ...basis, visionId: visionGewaehlt, organisationId: organisationGewaehlt },
      );
    }
    return api.erstelleProjekt({
      ...basis,
      visionId: elternBehalten ? null : visionGewaehlt,
      organisationId: elternBehalten ? null : organisationGewaehlt,
    });
  }, onFertig);

  return (
    <>
      <Formular onAbsenden={() => speichern.mutate()}>
        <Feld label={tx("Name")}>
          <input
            className={EINGABE_STIL}
            value={name}
            maxLength={GRENZEN.nameMax}
            onChange={(ereignis) => setName(ereignis.target.value)}
            autoFocus
          />
        </Feld>
        {zuordnungSichtbar && (
          <Feld label={tx("Gehört zu")}>
            <select className={EINGABE_STIL} value={zuordnung} onChange={(ereignis) => setZuordnung(ereignis.target.value)}>
              <option value="">{tx("Keins")}</option>
              {ebenen.visionen && (
                <optgroup label={tx(zielTitel('visionen'))}>
                  {ziele?.visionen
                    .filter((vision) => !vision.archiviert)
                    .map((vision) => (
                      <option key={vision.id} value={`vision:${vision.id}`}>
                        {vision.titel}
                      </option>
                    ))}
                </optgroup>
              )}
              {ebenen.organisationen && (
                <optgroup label={tx(zielTitel('organisationen'))}>
                  {ziele?.organisationen
                    .filter((organisation) => !organisation.archiviert)
                    .map((organisation) => (
                      <option key={organisation.id} value={`organisation:${organisation.id}`}>
                        {organisation.name}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
            {zuordnungHinweis && <p className="text-xs text-leise">{zuordnungHinweis}</p>}
          </Feld>
        )}
        <Feld label={tx("Standard-Tätigkeit")}>
          {aktiveVorlagen.length === 0 ? (
            <Knopf className="w-full" onClick={() => setNeueTaetigkeit(true)}>
              <Plus className="size-4" />
              {tx("Tätigkeit anlegen")}
            </Knopf>
          ) : (
            <div className="flex gap-2">
              <select
                className={EINGABE_STIL}
                value={gewaehlteVorlage ?? ''}
                onChange={(ereignis) => setVorlageId(Number(ereignis.target.value))}
              >
                {aktiveVorlagen.map((vorlage) => (
                  <option key={vorlage.id} value={vorlage.id}>
                    {vorlage.name}
                  </option>
                ))}
              </select>
              <Knopf className="shrink-0 px-3" aria-label={tx("Tätigkeit anlegen")} onClick={() => setNeueTaetigkeit(true)}>
                <Plus className="size-4" />
              </Knopf>
            </div>
          )}
        </Feld>
        <Feld
          label={
            <span className="inline-flex min-w-0 items-center">
              {tx('Abschlusstätigkeit')}
              <InfoHinweis text="Beim Abschließen läuft der Bonus über diese Tätigkeit. Ohne Tätigkeit gibt es den Bonus trotzdem." />
            </span>
          }
        >
          <select
            className={EINGABE_STIL}
            value={abschlussId ?? ''}
            onChange={(ereignis) => setAbschlussId(ereignis.target.value === '' ? null : Number(ereignis.target.value))}
          >
            <option value="">{tx('Keine')}</option>
            {abschlussVorlagen.map((vorlage) => (
              <option key={vorlage.id} value={vorlage.id}>
                {vorlage.name}
              </option>
            ))}
          </select>
        </Feld>
        <Feld label={tx("Beschreibung")}>
          <textarea
            className={`${EINGABE_STIL} min-h-16`}
            value={beschreibung}
            maxLength={GRENZEN.beschreibungMax}
            onChange={(ereignis) => setBeschreibung(ereignis.target.value)}
          />
        </Feld>
        <Fehlermeldung fehler={speichern.error} />
        <Aktionen
          neben={
            projekt ? (
              <SchnellNebenaktion
                ziel={{ art: 'projekt', id: projekt.id, name: projekt.name, archiviert: projekt.archiviert, loeschbar: projekt.loeschbar }}
                onErledigt={onFertig}
              />
            ) : null
          }
          kannSpeichern={name.trim() !== '' && gewaehlteVorlage !== null}
          laeuft={speichern.isPending}
        />
      </Formular>
      <NeueTaetigkeit
        offen={neueTaetigkeit}
        projektId={projekt?.id ?? null}
        projektName={projekt?.name ?? null}
        onSchliessen={() => setNeueTaetigkeit(false)}
        onAngelegt={(gespeichert) => setVorlageId(gespeichert.id)}
      />
    </>
  );
}
