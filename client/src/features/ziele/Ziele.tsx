import { katalogName, tx } from '../../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ChevronRight, Landmark, Pencil, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { merkeStand } from '../../herkunftLauf.ts';
import type { Organisation, Projekt, Vision, VorhabenMitProjekt } from '../../../../shared/api/index.ts';
import { ZIEL_MARKE, zielTitel } from '../../../../shared/spiel/ebenen.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useFeiern } from '../../components/Belohnung.tsx';
import { KettenAnzeige } from '../../components/KettenAnzeige.tsx';
import { useSchnellAktion } from '../../components/SchnellAktion.tsx';
import { useEintragOeffnen } from '../../components/Layout.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { SchnellZeile } from '../../components/SchnellAktion.tsx';
import { archivBeschriftung, Farbpunkt, Fehlermeldung, Karte, Knopf, Ladeanzeige, Leer, Ueberschrift } from '../../ui/index.ts';
import { ZielDialog, type ZielBearbeitung } from './ZielDialoge.tsx';
import { ZielMarke } from '../../components/ZielMarke.tsx';
import { kurzesDatum, zahl } from '../../format.ts';
import { useEbenen } from '../../funktionen.ts';
import { gliedereProjekte } from '../../projektHierarchie.ts';

export function ZieleSeite() {
  const ebenen = useEbenen();
  const { data: ziele, error, isPending } = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele });
  const [bearbeitung, setBearbeitung] = useState<ZielBearbeitung>(null);
  const ort = useLocation();
  const [archivAnzeigen, setArchivAnzeigen] = useState(() => Boolean((ort.state as { archiv?: boolean } | null)?.archiv));
  const [detailId, setDetailId] = useState<number | null>(null);

  if (isPending) {
    return <Ladeanzeige />;
  }
  if (error) {
    return <Fehlermeldung fehler={error} />;
  }

  const sichtbar = <T extends { archiviert: boolean }>(liste: T[]) =>
    liste.filter((eintrag) => archivAnzeigen || !eintrag.archiviert);
  const projekteVon = (filter: (projekt: Projekt) => boolean) => sichtbar(ziele.projekte.filter(filter));
  const aktiveVisionen = ziele.visionen.filter((vision) => !vision.archiviert);
  const freieOrganisationen = sichtbar(ziele.organisationen.filter((organisation) => organisation.visionId === null));
  const archivierteVisionen = ziele.visionen.filter((vision) => vision.archiviert);
  const ohneEltern = projekteVon((projekt) => projekt.visionId === null && projekt.organisationId === null);
  const flacheProjekte = ebenen.organisationen
    ? projekteVon((projekt) => projekt.organisationId === null)
    : sichtbar(ziele.projekte);

  const neuesProjekt = (visionId: number | null, organisationId: number | null) =>
    setBearbeitung({ art: 'projekt', projekt: null, visionId, organisationId });
  const detail = detailId === null ? null : (ziele.visionen.find((vision) => vision.id === detailId) ?? null);
  const leer =
    (!ebenen.visionen || aktiveVisionen.length === 0) &&
    (!ebenen.projekte || sichtbar(ziele.projekte).length === 0) &&
    (!ebenen.vorhaben || ziele.vorhaben.length === 0) &&
    (!ebenen.organisationen || freieOrganisationen.length === 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-end gap-4">
        <div className="flex flex-wrap gap-2">
          {ebenen.organisationen && (
            <Knopf onClick={() => setBearbeitung({ art: 'organisation', organisation: null })}>
              <Plus className="size-4" />
              <ZielMarke ebene="organisationen" />
            </Knopf>
          )}
          {ebenen.projekte && (
            <Knopf onClick={() => neuesProjekt(null, null)}>
              <Plus className="size-4" />
              <ZielMarke ebene="projekte" />
            </Knopf>
          )}
          {ebenen.visionen && (
            <Knopf variante="primaer" onClick={() => setBearbeitung({ art: 'vision', vision: null })}>
              <Plus className="size-4" />
              <ZielMarke ebene="visionen" />
            </Knopf>
          )}
        </div>
      </header>

      {!ebenen.visionen && !ebenen.projekte && !ebenen.vorhaben && !ebenen.organisationen && (
        <Leer text={tx("Alle Ziel-Stufen sind aus.")} />
      )}

      {ebenen.visionen &&
        aktiveVisionen.length === 0 &&
        freieOrganisationen.length === 0 &&
        ohneEltern.length === 0 &&
        !(ebenen.vorhaben && !ebenen.projekte && ziele.vorhaben.length > 0) && (
          <Leer text={tx(ZIEL_MARKE.visionen.leer)} />
        )}

      {ebenen.visionen &&
        aktiveVisionen.map((vision) => {
          const organisationen = ebenen.organisationen
            ? sichtbar(ziele.organisationen.filter((organisation) => organisation.visionId === vision.id))
            : [];
          const vonOrganisation = (id: number) =>
            ebenen.projekte ? projekteVon((projekt) => projekt.organisationId === id) : [];
          return (
            <VisionKarte
              key={vision.id}
              vision={vision}
              projekte={ebenen.projekte ? projekteVon((projekt) => projekt.visionId === vision.id) : []}
              organisationen={organisationen}
              projekteVonOrganisation={vonOrganisation}
              onOeffnen={() => setDetailId(vision.id)}
            />
          );
        })}

      {ebenen.visionen && ebenen.projekte && ohneEltern.length > 0 && (
        <section>
          <Ueberschrift titel={tx('Ohne {name}', { name: tx(ZIEL_MARKE.visionen.name) })} />
          <ProjektListe projekte={ohneEltern} />
        </section>
      )}

      {ebenen.organisationen && !ebenen.visionen && !ebenen.projekte && freieOrganisationen.length === 0 && (
        <Leer text={tx(ZIEL_MARKE.organisationen.leer)} />
      )}

      {ebenen.organisationen && !ebenen.visionen && freieOrganisationen.length > 0 && (
        <section className="space-y-4">
          {freieOrganisationen.map((organisation) => (
            <Karte key={organisation.id}>
              <OrganisationBlock
                organisation={organisation}
                projekte={projekteVon((projekt) => projekt.organisationId === organisation.id)}
                mitProjekten={ebenen.projekte}
                onBearbeiten={() => setBearbeitung({ art: 'organisation', organisation })}
                onProjektNeu={() => neuesProjekt(null, organisation.id)}
              />
            </Karte>
          ))}
        </section>
      )}

      {ebenen.organisationen && ebenen.visionen && freieOrganisationen.length > 0 && (
        <section>
          <Ueberschrift
            titel={tx('{mehrzahl} ohne {name}', {
              mehrzahl: tx(ZIEL_MARKE.organisationen.mehrzahl),
              name: tx(ZIEL_MARKE.visionen.name),
            })}
          />
          <div className="space-y-4">
            {freieOrganisationen.map((organisation) => (
              <Karte key={organisation.id}>
                <OrganisationBlock
                  organisation={organisation}
                  projekte={projekteVon((projekt) => projekt.organisationId === organisation.id)}
                  mitProjekten={ebenen.projekte}
                  onBearbeiten={() => setBearbeitung({ art: 'organisation', organisation })}
                  onProjektNeu={() => neuesProjekt(null, organisation.id)}
                />
              </Karte>
            ))}
          </div>
        </section>
      )}

      {ebenen.projekte && !ebenen.visionen && (
        <section>
          {flacheProjekte.length === 0 && freieOrganisationen.length === 0 && (
            <Leer text={tx(ZIEL_MARKE.projekte.leer)} />
          )}
          <ProjektListe projekte={flacheProjekte} />
        </section>
      )}

      {ebenen.vorhaben && !ebenen.projekte && <VorhabenBereich vorhaben={ziele.vorhaben} leer={leer} />}
      {ebenen.vorhaben && ebenen.projekte && (
        <FreieVorhaben
        vorhaben={ziele.vorhaben.filter((eintrag) => eintrag.projektId === null && eintrag.status === 'offen')}
      />
      )}

      <div className="flex justify-center">
        <Knopf
          variante="leise"
          onClick={() => {
            const neu = !archivAnzeigen;
            setArchivAnzeigen(neu);
            merkeStand({ archiv: neu, strideScroll: window.scrollY });
          }}
        >
          <Archive className="size-4" />
          {archivBeschriftung(archivAnzeigen)}
        </Knopf>
      </div>

      {archivAnzeigen && archivierteVisionen.length > 0 && (
        <section className="space-y-3">
          <Ueberschrift titel={tx('Archivierte {mehrzahl}', { mehrzahl: tx(ZIEL_MARKE.visionen.mehrzahl) })} />
          {archivierteVisionen.map((vision) => (
            <ArchivierteVision key={vision.id} vision={vision} />
          ))}
        </section>
      )}

      <ZielDialog bearbeitung={bearbeitung} onSchliessen={() => setBearbeitung(null)} />
      {detail && (
        <VisionDetail
          vision={detail}
          organisationen={
            ebenen.organisationen
              ? sichtbar(ziele.organisationen.filter((organisation) => organisation.visionId === detail.id))
              : []
          }
          projekteVonOrganisation={(id) => (ebenen.projekte ? projekteVon((projekt) => projekt.organisationId === id) : [])}
          mitProjekten={ebenen.projekte}
          onSchliessen={() => setDetailId(null)}
          onBearbeiten={() => {
            setDetailId(null);
            setBearbeitung({ art: 'vision', vision: detail });
          }}
          onOrganisationBearbeiten={(organisation) => {
            setDetailId(null);
            setBearbeitung({ art: 'organisation', organisation });
          }}
          onProjektNeu={(visionId, organisationId) => {
            setDetailId(null);
            neuesProjekt(visionId, organisationId);
          }}
        />
      )}
    </div>
  );
}

function projekteDerKarte(
  projekte: Projekt[],
  organisationen: Organisation[],
  projekteVonOrganisation: (organisationId: number) => Projekt[],
): Projekt[] {
  const gesehen = new Set<number>();
  const alle: Projekt[] = [];
  for (const projekt of [...projekte, ...organisationen.flatMap((organisation) => projekteVonOrganisation(organisation.id))]) {
    if (gesehen.has(projekt.id)) {
      continue;
    }
    gesehen.add(projekt.id);
    alle.push(projekt);
  }
  return alle;
}

function VisionKarte({
  vision,
  projekte,
  organisationen,
  projekteVonOrganisation,
  onOeffnen,
}: {
  vision: Vision;
  projekte: Projekt[];
  organisationen: Organisation[];
  projekteVonOrganisation: (organisationId: number) => Projekt[];
  onOeffnen: () => void;
}) {
  const ast = gliedereProjekte(projekteDerKarte(projekte, organisationen, projekteVonOrganisation), [vision], organisationen, {
    leereOrganisationen: true,
    leereVisionen: true,
  }).visionen[0];
  const direkte = ast?.direkte ?? [];
  const gruppen = ast?.organisationen ?? [];
  const hatKinder = direkte.length > 0 || gruppen.length > 0;
  return (
    <Karte className="overflow-hidden p-0">
      <SchnellZeile
        ziel={{ art: 'vision', id: vision.id, name: vision.titel, archiviert: vision.archiviert, loeschbar: vision.loeschbar }}
      >
        {(menue) => (
          <div className="flex items-start">
            <button
              type="button"
              onClick={onOeffnen}
              className={`flex min-w-0 flex-1 items-center gap-2 px-4 text-left ${hatKinder ? 'pt-3 pb-2' : 'py-4'}`}
            >
              <h2 className="min-w-0 flex-1 text-lg leading-snug font-semibold">
                <Farbpunkt farbe={vision.farbe} className="me-2" />
                <span className="break-words">{vision.titel}</span>
              </h2>
              <ChevronRight className="size-4 shrink-0 text-leise" />
            </button>
            {menue}
          </div>
        )}
      </SchnellZeile>
      {hatKinder && (
        <div className="space-y-3 px-4 pb-4">
          {direkte.length > 0 && (
            <div data-ast="vision" className="ps-3">
              <ProjektListe projekte={direkte} />
            </div>
          )}
          {gruppen.map((gruppe) => (
            <div key={gruppe.organisation.id} data-ast="organisation" className="space-y-2">
              <h3 className="min-w-0 text-sm leading-snug font-medium">
                <Farbpunkt farbe={gruppe.organisation.farbe} className="me-2" />
                <Landmark className="me-2 inline-block size-4 align-middle text-leise" />
                <span className="align-middle">{gruppe.organisation.name}</span>
              </h3>
              {gruppe.projekte.length > 0 && (
                <div className="ps-3">
                  <ProjektListe projekte={gruppe.projekte} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Karte>
  );
}

function VisionDetail({
  vision,
  organisationen,
  projekteVonOrganisation,
  mitProjekten,
  onSchliessen,
  onBearbeiten,
  onOrganisationBearbeiten,
  onProjektNeu,
}: {
  vision: Vision;
  organisationen: Organisation[];
  projekteVonOrganisation: (organisationId: number) => Projekt[];
  mitProjekten: boolean;
  onSchliessen: () => void;
  onBearbeiten: () => void;
  onOrganisationBearbeiten: (organisation: Organisation) => void;
  onProjektNeu: (visionId: number | null, organisationId: number | null) => void;
}) {
  const abschluss = useVisionAbschluss(vision);
  return (
    <Dialog offen titel={vision.titel} vorTitel={<Farbpunkt farbe={vision.farbe} className="me-2" />} onSchliessen={onSchliessen}>
      <div className="space-y-4">
        {vision.beschreibung ? <p className="text-sm">{vision.beschreibung}</p> : null}
        {vision.woopPlan ? (
          <p className="text-sm leading-snug">
            <span className="font-medium">{tx("Plan ·")} </span>
            {vision.woopPlan}
          </p>
        ) : null}
        <p className="zahl text-sm text-leise">{visionStand(vision)}</p>
        {abschluss.fehler}
        <div className="flex flex-wrap gap-2">
          {abschluss.knopf}
          <Knopf onClick={onBearbeiten} aria-label={tx("Vision bearbeiten")}>
            <Pencil className="size-4" />
            {tx("Bearbeiten")}
          </Knopf>
        </div>
        {mitProjekten && (
          <Knopf variante="leise" className="px-2 py-1" onClick={() => onProjektNeu(vision.id, null)}>
            <Plus className="size-4" />
            <ZielMarke ebene="projekte" />
          </Knopf>
        )}
        {organisationen.map((organisation) => (
          <div key={organisation.id} className="space-y-2 border-t border-rand pt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <Farbpunkt farbe={organisation.farbe} />
                <Landmark className="size-4 shrink-0 text-leise" />
                <span className="truncate">{organisation.name}</span>
              </span>
              <Knopf
                variante="leise"
                className="p-2"
                aria-label={tx("Organisation bearbeiten")}
                onClick={() => onOrganisationBearbeiten(organisation)}
              >
                <Pencil className="size-4" />
              </Knopf>
            </div>
            <ProjektListe projekte={projekteVonOrganisation(organisation.id)} />
            {mitProjekten && (
              <Knopf variante="leise" className="px-2 py-1" onClick={() => onProjektNeu(null, organisation.id)}>
                <Plus className="size-4" />
                <ZielMarke ebene="projekte" />
              </Knopf>
            )}
          </div>
        ))}
      </div>
    </Dialog>
  );
}

function useVisionAbschluss(vision: Vision): { knopf: ReactNode; fehler: ReactNode } {
  const schnell = useSchnellAktion();
  const queryClient = useQueryClient();
  const feiern = useFeiern();
  const erreichen = useMutation({
    mutationFn: () => api.erreicheVision(vision.id),
    onSuccess: (ergebnis) => {
      void queryClient.invalidateQueries();
      feiern(ergebnis.belohnung);
    },
  });
  const zuruecknehmen = useMutation({
    mutationFn: () => api.nimmVisionZurueck(vision.id),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      schnell.melde(tx('Zurückgenommen'), () => {
        erreichen.mutate();
      });
    },
  });

  const knopf =
    vision.level !== null && vision.erreichtAm ? (
      <Knopf variante="leise" className="shrink-0 px-2 py-1 text-xs" onClick={() => zuruecknehmen.mutate()} disabled={zuruecknehmen.isPending}>
        {tx("Zurücknehmen")}
      </Knopf>
    ) : vision.level !== null ? (
      <Knopf variante="primaer" className="shrink-0 px-3 py-1.5" onClick={() => erreichen.mutate()} disabled={erreichen.isPending || vision.archiviert}>
        {tx("Erreicht")}
      </Knopf>
    ) : null;

  return { knopf, fehler: <Fehlermeldung fehler={erreichen.error ?? zuruecknehmen.error} /> };
}

function visionStand(vision: Vision): string {
  const teile: string[] = [];
  if (vision.level !== null) {
    teile.push(tx('Level {level}', { level: zahl(vision.level) }));
    teile.push(tx('Beute {xp} XP', { xp: zahl(vision.beute) }));
  }
  teile.push(`${zahl(vision.meilensteine)} ${vision.meilensteine === 1 ? tx("Meilenstein") : tx("Meilensteine")}`);
  teile.push(`${zahl(vision.xpGesamt)} XP`);
  if (vision.erreichtAm) {
    teile.push(tx('erreicht {datum}', { datum: kurzesDatum(vision.erreichtAm) }));
  }
  return teile.join(' · ');
}

function OrganisationBlock({
  organisation,
  projekte,
  mitProjekten,
  onBearbeiten,
  onProjektNeu,
}: {
  organisation: Organisation;
  projekte: Projekt[];
  mitProjekten: boolean;
  onBearbeiten: () => void;
  onProjektNeu: () => void;
}) {
  return (
    <div className={`space-y-3 ${organisation.archiviert ? 'opacity-50' : ''}`}>
      <SchnellZeile
        ziel={{
          art: 'organisation',
          id: organisation.id,
          name: organisation.name,
          archiviert: organisation.archiviert,
          loeschbar: organisation.loeschbar,
        }}
      >
        {(menue) => (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Farbpunkt farbe={organisation.farbe} />
              <Landmark className="size-4 shrink-0 text-leise" />
              <span className="truncate font-medium">{organisation.name}</span>
              {organisation.archiviert && <span className="text-xs text-leise">{tx('archiviert')}</span>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="zahl mr-2 text-xs text-leise" title={katalogName('Ansehen')}>
                {tx('Ansehen Lvl {level}', { level: organisation.ansehen.level })}
              </span>
              {menue}
              <Knopf variante="leise" className="p-2" aria-label={tx("Organisation bearbeiten")} onClick={onBearbeiten}>
                <Pencil className="size-4" />
              </Knopf>
            </div>
          </div>
        )}
      </SchnellZeile>
      {projekte.length > 0 && (
        <div className="ps-3">
          <ProjektListe projekte={projekte} />
        </div>
      )}
      {mitProjekten && (
        <Knopf variante="leise" className="px-2 py-1" onClick={onProjektNeu}>
          <Plus className="size-4" />
          {tx('{name} in {organisation}', { name: tx(ZIEL_MARKE.projekte.name), organisation: organisation.name })}
        </Knopf>
      )}
    </div>
  );
}

function ProjektListe({ projekte }: { projekte: Projekt[] }) {
  if (projekte.length === 0) {
    return null;
  }
  return (
    <ul className="space-y-2">
      {projekte.map((projekt) => (
        <li key={projekt.id}>
          <SchnellZeile
            hintergrund="bg-flaeche-2"
            className="rounded-xl"
            ziel={{ art: 'projekt', id: projekt.id, name: projekt.name, archiviert: projekt.archiviert, loeschbar: projekt.loeschbar }}
          >
            {(menue) => (
              <div className={`flex items-center ${projekt.archiviert ? 'opacity-50' : ''}`}>
                <Link
                  to={`/projekte/${projekt.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 transition hover:brightness-95 dark:hover:brightness-125"
                >
                  <div className="min-w-36 flex-1">
                    <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <span className="min-w-0 flex-1 truncate">{projekt.name}</span>
                      {projekt.geschafftAm ? (
                        <span className="shrink-0 text-xs font-normal whitespace-nowrap text-leise">{tx('abgeschlossen')}</span>
                      ) : null}
                      {projekt.archiviert ? (
                        <span className="shrink-0 text-xs font-normal whitespace-nowrap text-leise">{tx('archiviert')}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-leise break-words">
                      {tx('{anzahl} Einträge', { anzahl: zahl(projekt.anzahlEintraege) })}
                      {projekt.offeneVorhaben > 0 &&
                        ` · ${tx('{anzahl} Vorhaben offen', { anzahl: zahl(projekt.offeneVorhaben) })}`}
                    </p>
                  </div>
                  <KettenAnzeige kette={projekt.kette} className="max-w-full min-w-0 shrink truncate" />
                  <span className="zahl shrink-0 whitespace-nowrap text-right text-sm font-semibold">{tx('Lvl {level}', { level: projekt.level.level })}</span>
                </Link>
                {menue}
              </div>
            )}
          </SchnellZeile>
        </li>
      ))}
    </ul>
  );
}

function VorhabenBereich({ vorhaben, leer }: { vorhaben: VorhabenMitProjekt[]; leer: boolean }) {
  const eintragOeffnen = useEintragOeffnen();
  const offene = vorhaben.filter((eintrag) => eintrag.status === 'offen');
  const fertig = vorhaben.filter((eintrag) => eintrag.status !== 'offen');

  return (
    <section className="space-y-3">
      <Ueberschrift titel={tx(zielTitel('vorhaben'))} />
      {offene.length === 0 && fertig.length === 0 && leer && (
        <Leer text={tx(ZIEL_MARKE.vorhaben.leer)} />
      )}
      <ul className="space-y-2">
        {offene.map((eintrag) => (
          <li key={eintrag.id}>
            <SchnellZeile
              className="rounded-xl"
              ziel={{ art: 'vorhaben', id: eintrag.id, name: eintrag.titel, loeschbar: eintrag.loeschbar }}
            >
              {(menue) => (
                <div className="flex items-center gap-1 bg-flaeche py-1 pr-1 pl-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{eintrag.titel}</span>
                  {menue}
                  <Knopf className="px-3 py-1.5" onClick={() => eintragOeffnen({ vorhabenId: eintrag.id })}>
                    {tx("Weiter")}
                  </Knopf>
                </div>
              )}
            </SchnellZeile>
          </li>
        ))}
      </ul>
      {fertig.length > 0 && (
        <div className="space-y-2">
          <Ueberschrift titel={tx("Abgeschlossen")} />
          <ul className="space-y-2">
            {fertig.map((eintrag) => (
              <li key={eintrag.id} className="rounded-xl bg-flaeche-2 px-3 py-2 text-sm text-leise">
                {eintrag.titel}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function FreieVorhaben({ vorhaben }: { vorhaben: VorhabenMitProjekt[] }) {
  const eintragOeffnen = useEintragOeffnen();
  if (vorhaben.length === 0) {
    return null;
  }
  return (
    <section className="space-y-2">
      <Ueberschrift titel={tx("Ohne Projekt")} />
      <ul className="space-y-2">
        {vorhaben.map((eintrag) => (
          <li key={eintrag.id}>
            <SchnellZeile
              className="rounded-xl"
              ziel={{ art: 'vorhaben', id: eintrag.id, name: eintrag.titel, loeschbar: eintrag.loeschbar }}
            >
              {(menue) => (
                <div className="flex items-center gap-1 bg-flaeche py-1 pr-1 pl-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{eintrag.titel}</span>
                  {menue}
                  <Knopf className="px-3 py-1.5" onClick={() => eintragOeffnen({ vorhabenId: eintrag.id })}>
                    {tx("Weiter")}
                  </Knopf>
                </div>
              )}
            </SchnellZeile>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ArchivierteVision({ vision }: { vision: Vision }) {
  return (
    <SchnellZeile
      className="rounded-xl border border-rand"
      ziel={{ art: 'vision', id: vision.id, name: vision.titel, archiviert: true, loeschbar: vision.loeschbar }}
    >
      {(menue) => (
        <div className="flex items-center justify-between gap-2 py-1 pr-1 pl-4">
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <Farbpunkt farbe={vision.farbe} />
            <span className="truncate">{vision.titel}</span>
          </span>
          {menue}
        </div>
      )}
    </SchnellZeile>
  );
}
