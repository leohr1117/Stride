import { feldLeer, tx } from '../../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Organisation, Projekt, Vision, Vorlage } from '../../../../shared/api/index.ts';
import { FARBEN, GRENZEN } from '../../../../shared/spiel/begriffe.ts';
import { VISION_STUFEN } from '../../../../shared/spiel/orientierung.ts';
import { fehlendeZuordnung, ZIEL_MARKE, zielTitel } from '../../../../shared/spiel/ebenen.ts';
import { taetigkeitenFuerProjekt } from '../../../../shared/spiel/taetigkeit.ts';
import { VISION, visionBeute } from '../../../../shared/spiel/xp.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { zahl } from '../../format.ts';
import { useEbenen } from '../../funktionen.ts';
import { AuswahlBlatt, type AuswahlOption } from '../../components/AuswahlBlatt.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { SchnellMenueKnopf } from '../../components/SchnellAktion.tsx';
import { NeueTaetigkeit } from '../taetigkeiten/TaetigkeitFormular.tsx';
import { EINGABE_STIL, Farbauswahl, Feld, Fehlermeldung, Formular as FormularKasten, Knopf, VorschlagFeld } from '../../ui/index.ts';

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
  return tx(
    bearbeitung.art === 'vision'
      ? ZIEL_MARKE.visionen.name
      : bearbeitung.art === 'organisation'
        ? ZIEL_MARKE.organisationen.name
        : ZIEL_MARKE.projekte.name,
  );
}

function ZielMenue({ bearbeitung, onErledigt }: { bearbeitung: NonNullable<ZielBearbeitung>; onErledigt: () => void }) {
  if (bearbeitung.art === 'vision' && bearbeitung.vision) {
    const vision = bearbeitung.vision;
    return (
      <SchnellMenueKnopf
        ziel={{ art: 'vision', id: vision.id, name: vision.titel, archiviert: vision.archiviert, loeschbar: vision.loeschbar }}
        onErledigt={onErledigt}
      />
    );
  }
  if (bearbeitung.art === 'organisation' && bearbeitung.organisation) {
    const organisation = bearbeitung.organisation;
    return (
      <SchnellMenueKnopf
        ziel={{
          art: 'organisation',
          id: organisation.id,
          name: organisation.name,
          archiviert: organisation.archiviert,
          loeschbar: organisation.loeschbar,
        }}
        onErledigt={onErledigt}
      />
    );
  }
  if (bearbeitung.art === 'projekt' && bearbeitung.projekt) {
    const projekt = bearbeitung.projekt;
    return (
      <SchnellMenueKnopf
        ziel={{ art: 'projekt', id: projekt.id, name: projekt.name, archiviert: projekt.archiviert, loeschbar: projekt.loeschbar }}
        onErledigt={onErledigt}
      />
    );
  }
  return null;
}

function spurSetzen(feld: RefObject<HTMLInputElement | null>, wert: string, onAendern: (wert: string) => void): void {
  if (feld.current) {
    feld.current.value = wert;
  }
  feld.current?.dispatchEvent(new Event('input', { bubbles: true }));
  onAendern(wert);
}

function Spur({ feld, wert }: { feld: RefObject<HTMLInputElement | null>; wert: string }) {
  return (
    <input
      ref={feld}
      readOnly
      tabIndex={-1}
      aria-hidden="true"
      value={wert}
      className="pointer-events-none absolute h-px w-px opacity-0"
      onChange={() => undefined}
    />
  );
}

function vorlageOptionen(liste: readonly Vorlage[]): AuswahlOption[] {
  const allgemein = liste.filter((vorlage) => vorlage.projektId === null);
  const eigen = liste.filter((vorlage) => vorlage.projektId !== null);
  const optionen: AuswahlOption[] = [];
  if (allgemein.length > 0) {
    optionen.push({ wert: 'gruppe-alle', name: tx('Für alle Projekte'), waehlbar: false });
    for (const vorlage of allgemein) {
      optionen.push({ wert: String(vorlage.id), name: vorlage.name, ebene: 1 });
    }
  }
  if (eigen.length > 0) {
    optionen.push({ wert: 'gruppe-nur', name: tx('Nur dieses Projekt'), waehlbar: false });
    for (const vorlage of eigen) {
      optionen.push({ wert: String(vorlage.id), name: vorlage.name, ebene: 1 });
    }
  }
  return optionen;
}

export function ZielDialog({ bearbeitung, onSchliessen }: { bearbeitung: ZielBearbeitung; onSchliessen: () => void }) {
  const titel = bearbeitung ? dialogTitel(bearbeitung) : '';

  return (
    <Dialog
      offen={bearbeitung !== null}
      titel={titel}
      menu={bearbeitung && istBestehend(bearbeitung) ? <ZielMenue bearbeitung={bearbeitung} onErledigt={onSchliessen} /> : undefined}
      onSchliessen={onSchliessen}
    >
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

function Aktionen({ laeuft }: { laeuft: boolean }) {
  return (
    <div className="flex gap-2">
      <Knopf type="submit" variante="primaer" className="flex-1" aria-busy={laeuft || undefined}>
        {tx("Speichern")}
      </Knopf>
    </div>
  );
}

(Aktionen as typeof Aktionen & { fuss: boolean }).fuss = true;

function Formular({ onAbsenden, children }: { onAbsenden: (form: HTMLFormElement) => void; children: ReactNode }) {
  return (
    <FormularKasten
      onAbsenden={(ereignis) => {
        ereignis.preventDefault();
        onAbsenden(ereignis.currentTarget);
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
  const [titelFehler, setTitelFehler] = useState<string | null>(null);
  const levelWert = /^\d+$/.test(level) ? Number(level) : Number.NaN;
  const levelGueltig = Number.isInteger(levelWert) && levelWert >= VISION.minLevel && levelWert <= GRENZEN.visionLevelMax;
  const visionStufen = VISION_STUFEN.map((beispiel) => ({
    id: String(beispiel.level),
    wert: String(beispiel.level),
    zeile: zahl(beispiel.level),
    neben: tx(beispiel.titel),
    name: `${tx(beispiel.titel)}, ${zahl(beispiel.level)}`,
  }));

  const speichern = useSpeichern(() => {
    const daten = { titel, beschreibung, farbe, woopErgebnis, woopHindernis, woopPlan, level: levelWert };
    if (!vision) {
      return api.erstelleVision(daten);
    }
    return api.aendereVision(vision.id, daten);
  }, onFertig);

  return (
    <Formular onAbsenden={(form) => {
      const nameLeer = titel.trim() === '';
      setTitelFehler(nameLeer ? feldLeer('Wunsch') : null);
      if (!levelGueltig) {
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      }
      if (nameLeer || !levelGueltig || speichern.isPending) {
        return;
      }
      speichern.mutate();
    }}>
      <Feld label={tx("Wunsch")} fehler={titelFehler}>
        <input
          className={EINGABE_STIL}
          value={titel}
          maxLength={GRENZEN.nameMax}
          onChange={(ereignis) => {
            setTitel(ereignis.target.value);
            setTitelFehler(null);
          }}
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
      <VorschlagFeld
        label="Level"
        text={level}
        onText={setLevel}
        optionen={visionStufen}
        hinweis={tx('XP beim Erreichen: {xp}', { xp: zahl(visionBeute(levelGueltig ? levelWert : null)) })}
        hinweisSchnitt={false}
        fehler={
          levelGueltig
            ? null
            : levelWert < VISION.minLevel || !Number.isInteger(levelWert)
              ? tx('Eine Vision braucht mindestens Level {level}.', { level: zahl(VISION.minLevel) })
              : tx('Das Level darf höchstens {max} sein.', { max: zahl(GRENZEN.visionLevelMax) })
        }
        bereinige={(roh) => roh.replace(/\D/g, '').slice(0, 5)}
      />
      <TextFeld label={tx("Ergebnis")} wert={woopErgebnis} onAendern={setWoopErgebnis} />
      <TextFeld label={tx("Hindernis")} wert={woopHindernis} onAendern={setWoopHindernis} />
      <TextFeld label={tx('Wenn-dann-Plan')} wert={woopPlan} onAendern={setWoopPlan} />
      <Feld label={tx("Farbe")}>
        <Farbauswahl wert={farbe} onAendern={setFarbe} />
      </Feld>
      <Fehlermeldung fehler={speichern.error} />
      <Aktionen laeuft={speichern.isPending} />
    </Formular>
  );
}

function OrganisationFormular({ organisation, onFertig }: { organisation: Organisation | null; onFertig: () => void }) {
  const ebenen = useEbenen();
  const visionFeld = useRef<HTMLInputElement>(null);
  const { data: ziele } = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele });
  const [name, setName] = useState(organisation?.name ?? '');
  const [beschreibung, setBeschreibung] = useState(organisation?.beschreibung ?? '');
  const [farbe, setFarbe] = useState(organisation?.farbe ?? FARBEN[5]);
  const [visionId, setVisionId] = useState<number | null>(organisation?.visionId ?? null);
  const [nameFehler, setNameFehler] = useState<string | null>(null);
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
    <Formular onAbsenden={() => {
      if (name.trim() === '') {
        setNameFehler('Der Name darf nicht leer sein.');
        return;
      }
      if (speichern.isPending) {
        return;
      }
      setNameFehler(null);
      speichern.mutate();
    }}>
      <Feld label={tx("Name")} fehler={nameFehler}>
        <input
          className={EINGABE_STIL}
          value={name}
          maxLength={GRENZEN.nameMax}
          onChange={(ereignis) => {
            setName(ereignis.target.value);
            setNameFehler(null);
          }}
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
          <div className="relative">
            <Spur feld={visionFeld} wert={visionId === null ? '' : String(visionId)} />
            <AuswahlBlatt
              label={tx(zielTitel('visionen', false))}
              modus="einzeln"
              wert={visionId === null ? '' : String(visionId)}
              optionen={[
                { wert: '', name: tx('Keine Vision') },
                ...visionen.map((vision) => ({ wert: String(vision.id), name: vision.titel })),
              ]}
              onAendern={(wert) => spurSetzen(visionFeld, wert, (neu) => setVisionId(neu ? Number(neu) : null))}
            />
          </div>
        </Feld>
      )}
      <Feld label={tx("Farbe")}>
        <Farbauswahl wert={farbe} onAendern={setFarbe} />
      </Feld>
      <Fehlermeldung fehler={speichern.error} />
      <Aktionen laeuft={speichern.isPending} />
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
  const zuordnungFeld = useRef<HTMLInputElement>(null);
  const vorlageFeld = useRef<HTMLInputElement>(null);
  const abschlussFeld = useRef<HTMLInputElement>(null);
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
  const [nameFehler, setNameFehler] = useState<string | null>(null);
  const [vorlageFehler, setVorlageFehler] = useState<string | null>(null);

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

  const gehoertZu: AuswahlOption[] = [{ wert: '', name: tx('Keins') }];
  if (ebenen.visionen) {
    const visionen = ziele?.visionen.filter((vision) => !vision.archiviert) ?? [];
    if (visionen.length > 0) {
      gehoertZu.push({ wert: 'gruppe-visionen', name: tx(zielTitel('visionen')), waehlbar: false });
      for (const vision of visionen) {
        gehoertZu.push({ wert: `vision:${vision.id}`, name: vision.titel, ebene: 1 });
      }
    }
  }
  if (ebenen.organisationen) {
    const organisationen = ziele?.organisationen.filter((organisation) => !organisation.archiviert) ?? [];
    if (organisationen.length > 0) {
      gehoertZu.push({ wert: 'gruppe-organisationen', name: tx(zielTitel('organisationen')), waehlbar: false });
      for (const organisation of organisationen) {
        gehoertZu.push({ wert: `organisation:${organisation.id}`, name: organisation.name, ebene: 1 });
      }
    }
  }
  const standardOptionen = vorlageOptionen(aktiveVorlagen);
  const abschlussOptionen: AuswahlOption[] = [
    { wert: '', name: tx('Keine · Bonus gibt es trotzdem') },
    ...vorlageOptionen(abschlussVorlagen),
  ];

  return (
    <>
      <Formular onAbsenden={() => {
        const nameLeer = name.trim() === '';
        const ohneVorlage = gewaehlteVorlage === null;
        setNameFehler(nameLeer ? 'Der Name darf nicht leer sein.' : null);
        setVorlageFehler(ohneVorlage ? 'Für ein Projekt braucht es eine Tätigkeit.' : null);
        if (nameLeer || ohneVorlage || speichern.isPending) {
          return;
        }
        speichern.mutate();
      }}>
        <Feld label={tx("Name")} fehler={nameFehler}>
          <input
            className={EINGABE_STIL}
            value={name}
            maxLength={GRENZEN.nameMax}
            onChange={(ereignis) => {
              setName(ereignis.target.value);
              setNameFehler(null);
            }}
            autoFocus
          />
        </Feld>
        {zuordnungSichtbar && (
          <Feld label="Gehört zu">
            <div className="relative">
              <Spur feld={zuordnungFeld} wert={zuordnung} />
              <AuswahlBlatt
                label={tx('Gehört zu')}
                modus="einzeln"
                wert={zuordnung}
                optionen={gehoertZu}
                onAendern={(wert) => spurSetzen(zuordnungFeld, wert, setZuordnung)}
              />
            </div>
            {zuordnungHinweis && <p className="text-xs text-leise">{zuordnungHinweis}</p>}
          </Feld>
        )}
        <Feld label="Vorauswahl beim Eintragen" fehler={vorlageFehler}>
          {aktiveVorlagen.length === 0 ? (
            <Knopf className="w-full" onClick={() => setNeueTaetigkeit(true)}>
              <Plus className="size-4" />
              {tx("Tätigkeit anlegen")}
            </Knopf>
          ) : (
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Spur feld={vorlageFeld} wert={gewaehlteVorlage === null ? '' : String(gewaehlteVorlage)} />
                <AuswahlBlatt
                  label={tx('Vorauswahl beim Eintragen')}
                  modus="einzeln"
                  wert={gewaehlteVorlage === null ? '' : String(gewaehlteVorlage)}
                  optionen={standardOptionen}
                  onAendern={(wert) => {
                    setVorlageFehler(null);
                    spurSetzen(vorlageFeld, wert, (neu) => setVorlageId(Number(neu)));
                  }}
                />
              </div>
              <Knopf className="shrink-0 px-3" aria-label={tx("Tätigkeit anlegen")} onClick={() => setNeueTaetigkeit(true)}>
                <Plus className="size-4" />
              </Knopf>
            </div>
          )}
        </Feld>
        <Feld label="Tätigkeit beim Abschluss">
          <div className="relative">
            <Spur feld={abschlussFeld} wert={abschlussId === null ? '' : String(abschlussId)} />
            <AuswahlBlatt
              label={tx('Tätigkeit beim Abschluss')}
              modus="einzeln"
              wert={abschlussId === null ? '' : String(abschlussId)}
              optionen={abschlussOptionen}
              onAendern={(wert) => spurSetzen(abschlussFeld, wert, (neu) => setAbschlussId(neu === '' ? null : Number(neu)))}
            />
          </div>
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
        <Aktionen laeuft={speichern.isPending} />
      </Formular>
      <NeueTaetigkeit
        offen={neueTaetigkeit}
        projektId={projekt?.id ?? null}
        projektName={projekt?.name ?? null}
        onSchliessen={() => setNeueTaetigkeit(false)}
        onAngelegt={(gespeichert) => {
          setVorlageFehler(null);
          setVorlageId(gespeichert.id);
        }}
      />
    </>
  );
}
