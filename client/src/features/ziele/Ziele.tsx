import { tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { createPortal } from 'react-dom';
import type { Organisation, Projekt, Vision, VorhabenMitProjekt } from '../../../../shared/api/index.ts';
import { ZIEL_MARKE, zielTitel } from '../../../../shared/spiel/ebenen.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useFeiern } from '../../components/Belohnung.tsx';
import { KettenAnzeige } from '../../components/KettenAnzeige.tsx';
import { KopfAktion } from '../../components/Kopf.tsx';
import { SchnellMenueKnopf, SchnellZeile, useSchnellAktion } from '../../components/SchnellAktion.tsx';
import { useEintragOeffnen } from '../../components/Layout.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { Liste, Zeile } from '../../components/Zeile.tsx';
import { Abschnitt } from '../../components/Ausklappbar.tsx';
import { Farbpunkt, Fehlermeldung, Knopf, Ladeanzeige, Leer, Ueberschrift } from '../../ui/index.ts';
import { ZielDialog, type ZielBearbeitung } from './ZielDialoge.tsx';
import { ZielMarke } from '../../components/ZielMarke.tsx';
import { kurzesDatum, zahl } from '../../format.ts';
import { useEbenen } from '../../funktionen.ts';
import { gliedereProjekte } from '../../projektHierarchie.ts';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function ZieleSeite() {
  const ebenen = useEbenen();
  const { data: ziele, error, isPending } = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele });
  const laufend = useQuery({
    queryKey: SCHLUESSEL.laufendes,
    queryFn: api.laufendes,
    enabled: ebenen.vorhaben,
  });
  const [bearbeitung, setBearbeitung] = useState<ZielBearbeitung>(null);
  const [menue, setMenue] = useState<{ x: number; y: number } | null>(null);
  const ort = useLocation();
  const navigiere = useNavigate();
  const anlegen = (ort.state as { anlegen?: string } | null)?.anlegen;
  useEffect(() => {
    if (anlegen !== 'vision' && anlegen !== 'projekt') {
      return;
    }
    if (anlegen === 'vision' && ebenen.visionen) {
      setBearbeitung({ art: 'vision', vision: null });
    }
    if (anlegen === 'projekt' && ebenen.projekte) {
      setBearbeitung({ art: 'projekt', projekt: null, visionId: null, organisationId: null });
    }
    navigiere(ort.pathname, { replace: true, state: null });
  }, [anlegen, ebenen.projekte, ebenen.visionen, navigiere, ort.pathname]);
  const [detailId, setDetailId] = useState<number | null>(null);

  const neuPunkte = [
    ebenen.visionen ? { id: 'vision', label: tx('Vision') } : null,
    ebenen.organisationen ? { id: 'organisation', label: tx('Organisation') } : null,
    ebenen.projekte ? { id: 'projekt', label: tx('Projekt') } : null,
  ].filter((eintrag): eintrag is { id: string; label: string } => eintrag !== null);

  const oeffneMenue = (knopf: HTMLElement) => {
    const kasten = knopf.getBoundingClientRect();
    setMenue({ x: kasten.left, y: kasten.bottom });
  };
  const waehleNeu = (id: string) => {
    setMenue(null);
    if (id === 'vision') {
      setBearbeitung({ art: 'vision', vision: null });
    }
    if (id === 'organisation') {
      setBearbeitung({ art: 'organisation', organisation: null });
    }
    if (id === 'projekt') {
      setBearbeitung({ art: 'projekt', projekt: null, visionId: null, organisationId: null });
    }
  };

  if (isPending) {
    return <Ladeanzeige />;
  }
  if (error) {
    return <Fehlermeldung fehler={error} />;
  }

  const aktiv = <T extends { archiviert: boolean }>(liste: T[]) => liste.filter((eintrag) => !eintrag.archiviert);
  const aktiveVisionen = ebenen.visionen ? aktiv(ziele.visionen) : [];
  const aktiveOrganisationen = ebenen.organisationen ? aktiv(ziele.organisationen) : [];
  const aktiveProjekte = ebenen.projekte ? aktiv(ziele.projekte) : [];
  const gliederung = gliedereProjekte(aktiveProjekte, aktiveVisionen, aktiveOrganisationen, {
    leereVisionen: true,
    leereOrganisationen: true,
  });
  const archivVisionen = ebenen.visionen ? ziele.visionen.filter((vision) => vision.archiviert) : [];
  const archivOrganisationen = ebenen.organisationen ? ziele.organisationen.filter((organisation) => organisation.archiviert) : [];
  const archivProjekte = ebenen.projekte ? ziele.projekte.filter((projekt) => projekt.archiviert) : [];
  const archivZahl = archivVisionen.length + archivOrganisationen.length + archivProjekte.length;
  const ohneProjekt = ziele.vorhaben.filter((eintrag) => eintrag.projektId === null && eintrag.status === 'offen');
  const laufendZahl = (laufend.data?.bosse.length ?? 0) + (laufend.data?.vorhaben.length ?? 0);
  const allesAus = !ebenen.visionen && !ebenen.organisationen && !ebenen.projekte && !ebenen.vorhaben;
  const hatZiele =
    gliederung.visionen.length > 0 ||
    gliederung.freieOrganisationen.length > 0 ||
    gliederung.lose.length > 0 ||
    (ebenen.vorhaben && !ebenen.projekte && ziele.vorhaben.length > 0) ||
    ohneProjekt.length > 0 ||
    archivZahl > 0;
  const neuesProjekt = (visionId: number | null, organisationId: number | null) =>
    setBearbeitung({ art: 'projekt', projekt: null, visionId, organisationId });
  const detail = detailId === null ? null : (ziele.visionen.find((vision) => vision.id === detailId) ?? null);

  return (
    <div className="space-y-6">
      {neuPunkte.length > 0 && (
        <KopfAktion>
          <button
            type="button"
            className="inline-flex h-12 items-center px-3 text-base font-medium text-haupt"
            aria-haspopup="menu"
            aria-expanded={menue !== null}
            onClick={(ereignis) => oeffneMenue(ereignis.currentTarget)}
          >
            {tx('Neu')}
          </button>
        </KopfAktion>
      )}
      {menue && (
        <NeuMenue anker={menue} punkte={neuPunkte} onWahl={waehleNeu} onSchliessen={() => setMenue(null)} />
      )}

      {ebenen.vorhaben && (
        <Liste>
          <Zeile
            nach="/laufend"
            titel={tx('Laufend · {anzahl}', { anzahl: zahl(laufendZahl) })}
            name={tx('Laufend · {anzahl}', { anzahl: zahl(laufendZahl) })}
          />
        </Liste>
      )}

      {allesAus && <Leer text={tx('Alle Ziel-Stufen sind aus.')} />}
      {!allesAus && !hatZiele && (
        <Leer
          text={tx('Noch keine Ziele.')}
          aktion={
            neuPunkte.length > 0 ? (
              <Knopf variante="primaer" onClick={(ereignis) => oeffneMenue(ereignis.currentTarget)}>
                {tx('Ziel anlegen')}
              </Knopf>
            ) : undefined
          }
        />
      )}

      {gliederung.visionen.map((ast) => (
        <section key={ast.vision.id}>
          <Liste>
            <VisionKopf vision={ast.vision} onOeffnen={() => setDetailId(ast.vision.id)} />
            {ast.direkte.map((projekt) => (
              <div key={projekt.id} data-ast="vision">
                <ProjektZeile projekt={projekt} />
              </div>
            ))}
            {ast.organisationen.map((gruppe) => (
              <div key={gruppe.organisation.id} data-ast="organisation">
                <OrganisationsKopf
                  organisation={gruppe.organisation}
                  onBearbeiten={() => setBearbeitung({ art: 'organisation', organisation: gruppe.organisation })}
                />
                {gruppe.projekte.length > 0 && (
                  <div className="liste ps-4">
                    {gruppe.projekte.map((projekt) => (
                      <ProjektZeile key={projekt.id} projekt={projekt} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </Liste>
        </section>
      ))}

      {ebenen.visionen && gliederung.lose.length > 0 && (
        <section>
          <Ueberschrift titel={tx('Ohne {name}', { name: tx(ZIEL_MARKE.visionen.name) })} />
          <Liste>
            {gliederung.lose.map((projekt) => (
              <ProjektZeile key={projekt.id} projekt={projekt} />
            ))}
          </Liste>
        </section>
      )}

      {ebenen.visionen && ebenen.organisationen && gliederung.freieOrganisationen.length > 0 && (
        <section>
          <Ueberschrift
            titel={tx('{mehrzahl} ohne {name}', {
              mehrzahl: tx(ZIEL_MARKE.organisationen.mehrzahl),
              name: tx(ZIEL_MARKE.visionen.name),
            })}
          />
          <Liste>
            {gliederung.freieOrganisationen.map((gruppe) => (
              <div key={gruppe.organisation.id} data-ast="organisation">
                <OrganisationsKopf
                  organisation={gruppe.organisation}
                  onBearbeiten={() => setBearbeitung({ art: 'organisation', organisation: gruppe.organisation })}
                />
                {gruppe.projekte.length > 0 && (
                  <div className="liste ps-4">
                    {gruppe.projekte.map((projekt) => (
                      <ProjektZeile key={projekt.id} projekt={projekt} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </Liste>
        </section>
      )}

      {!ebenen.visionen && ebenen.organisationen && gliederung.freieOrganisationen.length > 0 && (
        <Liste>
          {gliederung.freieOrganisationen.map((gruppe) => (
            <div key={gruppe.organisation.id} data-ast="organisation">
              <OrganisationsKopf
                organisation={gruppe.organisation}
                onBearbeiten={() => setBearbeitung({ art: 'organisation', organisation: gruppe.organisation })}
              />
              {gruppe.projekte.length > 0 && (
                <div className="liste ps-4">
                  {gruppe.projekte.map((projekt) => (
                    <ProjektZeile key={projekt.id} projekt={projekt} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </Liste>
      )}

      {!ebenen.visionen && ebenen.projekte && gliederung.lose.length > 0 && (
        <Liste>
          {gliederung.lose.map((projekt) => (
            <ProjektZeile key={projekt.id} projekt={projekt} />
          ))}
        </Liste>
      )}

      {ebenen.vorhaben && !ebenen.projekte && <VorhabenBereich vorhaben={ziele.vorhaben} />}
      {ebenen.vorhaben && ebenen.projekte && ohneProjekt.length > 0 && <FreieVorhaben vorhaben={ohneProjekt} />}

      {archivZahl > 0 && (
        <Abschnitt titel="Archiv" zusatz={`(${zahl(archivZahl)})`} kennung="ziele-archiv" anfangEingeklappt>
          <Liste>
            {archivVisionen.map((vision) => (
              <ArchivVision key={vision.id} vision={vision} onOeffnen={() => setDetailId(vision.id)} onBearbeiten={() => setBearbeitung({ art: 'vision', vision })} />
            ))}
            {archivOrganisationen.map((organisation) => (
              <ArchivOrganisation
                key={organisation.id}
                organisation={organisation}
                onBearbeiten={() => setBearbeitung({ art: 'organisation', organisation })}
              />
            ))}
            {archivProjekte.map((projekt) => (
              <ProjektZeile key={projekt.id} projekt={projekt} />
            ))}
          </Liste>
        </Abschnitt>
      )}

      <ZielDialog bearbeitung={bearbeitung} onSchliessen={() => setBearbeitung(null)} />
      {detail && (
        <VisionDetail
          vision={detail}
          organisationen={
            ebenen.organisationen ? ziele.organisationen.filter((organisation) => organisation.visionId === detail.id && !organisation.archiviert) : []
          }
          projekteVonOrganisation={(id) =>
            ebenen.projekte ? aktiveProjekte.filter((projekt) => projekt.organisationId === id) : []
          }
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

function NeuMenue({
  anker,
  punkte,
  onWahl,
  onSchliessen,
}: {
  anker: { x: number; y: number };
  punkte: { id: string; label: string }[];
  onWahl: (id: string) => void;
  onSchliessen: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [stil, setStil] = useState({ top: anker.y, left: anker.x });
  useLayoutEffect(() => {
    const kasten = ref.current?.getBoundingClientRect();
    if (!kasten) {
      return;
    }
    let links = anker.x;
    let oben = anker.y;
    if (links + kasten.width > window.innerWidth - 8) {
      links = window.innerWidth - kasten.width - 8;
    }
    if (oben + kasten.height > window.innerHeight - 8) {
      oben = Math.max(8, anker.y - kasten.height);
    }
    setStil({ top: Math.max(8, oben), left: Math.max(8, links) });
  }, [anker]);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const beiTaste = (ereignis: KeyboardEvent) => {
      if (ereignis.key !== 'Escape') {
        return;
      }
      ereignis.preventDefault();
      onSchliessen();
    };
    const beiZeiger = (ereignis: PointerEvent) => {
      const ziel = ereignis.target;
      if (ziel instanceof Node && ref.current?.contains(ziel)) {
        return;
      }
      onSchliessen();
    };
    window.addEventListener('keydown', beiTaste, true);
    document.addEventListener('pointerdown', beiZeiger);
    return () => {
      window.removeEventListener('keydown', beiTaste, true);
      document.removeEventListener('pointerdown', beiZeiger);
    };
  }, [onSchliessen]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={tx('Neu')}
      style={stil}
      className="fixed z-[95] min-w-44 rounded-xl border border-rand bg-flaeche py-1 shadow-lg"
    >
      {punkte.map((punkt) => (
        <button
          key={punkt.id}
          type="button"
          role="menuitem"
          className="block w-full px-3 py-2.5 text-left text-sm hover:bg-flaeche-2"
          onClick={() => onWahl(punkt.id)}
        >
          {punkt.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

function VisionKopf({ vision, onOeffnen }: { vision: Vision; onOeffnen: () => void }) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-4 py-3">
      <button type="button" onClick={onOeffnen} className="flex min-w-0 flex-1 items-center text-left">
        <h2 className="min-w-0 flex-1 text-base leading-6 font-semibold">
          <Farbpunkt farbe={vision.farbe} className="me-2" />
          <span className="break-words">{vision.titel}</span>
        </h2>
      </button>
      {vision.level !== null ? (
        <span className="zahl shrink-0 text-sm font-semibold text-leise">{tx('Lvl {level}', { level: vision.level })}</span>
      ) : null}
    </div>
  );
}

function OrganisationsKopf({ organisation, onBearbeiten }: { organisation: Organisation; onBearbeiten: () => void }) {
  return (
    <SchnellZeile
      hintergrund="bg-flaeche"
      eintraege={[{ art: 'archivieren', id: 'bearbeiten', label: 'Bearbeiten' }]}
      onEintrag={() => onBearbeiten()}
      ziel={{
        art: 'organisation',
        id: organisation.id,
        name: organisation.name,
        archiviert: organisation.archiviert,
        loeschbar: organisation.loeschbar,
      }}
    >
      {(menue) => (
        <div className={`flex min-h-12 items-center gap-3 px-4 py-3 ${organisation.archiviert ? 'opacity-50' : ''}`}>
          <h3 className="min-w-0 flex-1 text-[13px] leading-[18px] font-semibold text-leise">
            <Farbpunkt farbe={organisation.farbe} className="me-2" />
            <span className="break-words align-middle">{organisation.name}</span>
          </h3>
          {menue}
        </div>
      )}
    </SchnellZeile>
  );
}

function ProjektZeile({ projekt }: { projekt: Projekt }) {
  const neben = `${tx('{anzahl} Einträge', { anzahl: zahl(projekt.anzahlEintraege) })} · ${tx('{anzahl} Vorhaben offen', { anzahl: zahl(projekt.offeneVorhaben) })}`;
  return (
    <SchnellZeile
      hintergrund="bg-flaeche"
      ziel={{ art: 'projekt', id: projekt.id, name: projekt.name, archiviert: projekt.archiviert, loeschbar: projekt.loeschbar }}
    >
      {(menue) => (
        <div className={`flex min-h-12 items-center ${projekt.archiviert ? 'opacity-50' : ''}`}>
          <Link to={`/projekte/${projekt.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-2 text-base leading-6">
                <span className="min-w-0 truncate">{projekt.name}</span>
                {projekt.geschafftAm ? (
                  <span className="shrink-0 text-xs font-normal whitespace-nowrap text-leise">{tx('abgeschlossen')}</span>
                ) : null}
              </span>
              <span className="block truncate text-[13px] leading-[18px] text-leise">{neben}</span>
            </span>
            <KettenAnzeige kette={projekt.kette} className="max-w-full min-w-0 shrink truncate" />
            <span className="zahl shrink-0 whitespace-nowrap text-sm font-semibold">
              {tx('Lvl {level}', { level: projekt.level.level })}
            </span>
          </Link>
          {menue}
        </div>
      )}
    </SchnellZeile>
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
  const davor = [
    { id: 'bearbeiten', label: 'Bearbeiten', onWahl: onBearbeiten },
    ...(abschluss.punkt ? [abschluss.punkt] : []),
  ];
  return (
    <Dialog
      offen
      titel={vision.titel}
      vorTitel={<Farbpunkt farbe={vision.farbe} className="me-2" />}
      onSchliessen={onSchliessen}
      menu={
        <SchnellMenue ziel={vision} davor={davor} />
      }
    >
      <div className="space-y-4">
        {abschluss.fehler}
        {vision.beschreibung ? <p className="text-sm">{vision.beschreibung}</p> : null}
        {vision.woopPlan ? (
          <div className="space-y-1">
            <p className="text-sm font-medium">{tx('Plan')}</p>
            <p className="text-sm leading-snug">{vision.woopPlan}</p>
          </div>
        ) : null}
        <p className="zahl text-sm text-leise">{visionStand(vision)}</p>
        {organisationen.map((organisation) => (
          <div key={organisation.id} className="space-y-2 border-t border-rand pt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <Farbpunkt farbe={organisation.farbe} />
                <span className="truncate">{organisation.name}</span>
              </span>
              <SchnellMenue
                ziel={organisation}
                davor={[{ id: 'bearbeiten', label: 'Bearbeiten', onWahl: () => onOrganisationBearbeiten(organisation) }]}
              />
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
        {mitProjekten && (
          <Knopf variante="leise" className="px-2 py-1" onClick={() => onProjektNeu(vision.id, null)}>
            <Plus className="size-4" />
            <ZielMarke ebene="projekte" />
          </Knopf>
        )}
      </div>
    </Dialog>
  );
}

function SchnellMenue({
  ziel,
  davor,
}: {
  ziel: Vision | Organisation;
  davor: { id: string; label: string; onWahl: () => void }[];
}) {
  const art = 'titel' in ziel ? 'vision' : 'organisation';
  const name = 'titel' in ziel ? ziel.titel : ziel.name;
  return (
    <SchnellMenueKnopf
      ziel={{ art, id: ziel.id, name, archiviert: ziel.archiviert, loeschbar: ziel.loeschbar }}
      davor={davor}
    />
  );
}

function useVisionAbschluss(vision: Vision): {
  punkt: { id: string; label: string; onWahl: () => void } | null;
  fehler: ReactNode;
} {
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

  const punkt =
    vision.level !== null && vision.erreichtAm
      ? {
          id: 'zuruecknehmen',
          label: 'Zurücknehmen',
          onWahl: () => {
            if (!zuruecknehmen.isPending) {
              zuruecknehmen.mutate();
            }
          },
        }
      : vision.level !== null && !vision.archiviert
        ? {
            id: 'erreicht',
            label: 'Erreicht',
            onWahl: () => {
              if (!erreichen.isPending) {
                erreichen.mutate();
              }
            },
          }
        : null;

  return { punkt, fehler: <Fehlermeldung fehler={erreichen.error ?? zuruecknehmen.error} /> };
}

function visionStand(vision: Vision): string {
  const teile: string[] = [];
  if (vision.level !== null) {
    teile.push(tx('Level {level}', { level: zahl(vision.level) }));
    teile.push(tx('Beute {xp} XP', { xp: zahl(vision.beute) }));
  }
  teile.push(`${zahl(vision.meilensteine)} ${vision.meilensteine === 1 ? tx('Meilenstein') : tx('Meilensteine')}`);
  teile.push(`${zahl(vision.xpGesamt)} XP`);
  if (vision.erreichtAm) {
    teile.push(tx('erreicht {datum}', { datum: kurzesDatum(vision.erreichtAm) }));
  }
  return teile.join(' · ');
}

function ProjektListe({ projekte }: { projekte: Projekt[] }) {
  if (projekte.length === 0) {
    return null;
  }
  return (
    <div className="space-y-2">
      {projekte.map((projekt) => (
        <ProjektZeile key={projekt.id} projekt={projekt} />
      ))}
    </div>
  );
}

function VorhabenBereich({ vorhaben }: { vorhaben: VorhabenMitProjekt[] }) {
  const eintragOeffnen = useEintragOeffnen();
  const offene = vorhaben.filter((eintrag) => eintrag.status === 'offen');
  const fertig = vorhaben.filter((eintrag) => eintrag.status !== 'offen');
  if (offene.length === 0 && fertig.length === 0) {
    return null;
  }
  return (
    <section className="space-y-3">
      <Ueberschrift titel={tx(zielTitel('vorhaben'))} />
      {offene.length > 0 && (
        <Liste>
          {offene.map((eintrag) => (
            <SchnellZeile
              key={eintrag.id}
              hintergrund="bg-flaeche"
              ziel={{ art: 'vorhaben', id: eintrag.id, name: eintrag.titel, loeschbar: eintrag.loeschbar }}
            >
              {(menue) => (
                <div className="flex min-h-12 items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 truncate text-base leading-6">{eintrag.titel}</span>
                  {menue}
                  <Knopf data-schnell-frei="" onClick={() => eintragOeffnen({ vorhabenId: eintrag.id })}>
                    {tx('Weiter')}
                  </Knopf>
                </div>
              )}
            </SchnellZeile>
          ))}
        </Liste>
      )}
      {fertig.length > 0 && (
        <Abschnitt titel="Abgeschlossen" zusatz={`(${zahl(fertig.length)})`} kennung="ziele-vorhaben-fertig" anfangEingeklappt>
          <Liste>
            {fertig.map((eintrag) => (
              <div key={eintrag.id} className="px-4 py-3 text-sm text-leise">
                {eintrag.titel}
              </div>
            ))}
          </Liste>
        </Abschnitt>
      )}
    </section>
  );
}

function FreieVorhaben({ vorhaben }: { vorhaben: VorhabenMitProjekt[] }) {
  const eintragOeffnen = useEintragOeffnen();
  return (
    <section className="space-y-2">
      <Ueberschrift titel={tx('Ohne Projekt')} />
      <Liste>
        {vorhaben.map((eintrag) => (
          <SchnellZeile
            key={eintrag.id}
            hintergrund="bg-flaeche"
            ziel={{ art: 'vorhaben', id: eintrag.id, name: eintrag.titel, loeschbar: eintrag.loeschbar }}
          >
            {(menue) => (
              <div className="flex min-h-12 items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1 truncate text-base leading-6">{eintrag.titel}</span>
                {menue}
                <Knopf data-schnell-frei="" onClick={() => eintragOeffnen({ vorhabenId: eintrag.id })}>
                  {tx('Weiter')}
                </Knopf>
              </div>
            )}
          </SchnellZeile>
        ))}
      </Liste>
    </section>
  );
}

function ArchivVision({
  vision,
  onOeffnen,
  onBearbeiten,
}: {
  vision: Vision;
  onOeffnen: () => void;
  onBearbeiten: () => void;
}) {
  return (
    <SchnellZeile
      hintergrund="bg-flaeche"
      eintraege={[{ art: 'archivieren', id: 'bearbeiten', label: 'Bearbeiten' }]}
      onEintrag={() => onBearbeiten()}
      ziel={{ art: 'vision', id: vision.id, name: vision.titel, archiviert: true, loeschbar: vision.loeschbar }}
    >
      {(menue) => (
        <div className="flex min-h-12 items-center opacity-50">
          <button type="button" onClick={onOeffnen} className="flex min-w-0 flex-1 items-center px-4 py-3 text-left">
            <span className="min-w-0 flex-1 text-base leading-6">
              <Farbpunkt farbe={vision.farbe} className="me-2" />
              <span className="break-words">{vision.titel}</span>
            </span>
          </button>
          {menue}
        </div>
      )}
    </SchnellZeile>
  );
}

function ArchivOrganisation({ organisation, onBearbeiten }: { organisation: Organisation; onBearbeiten: () => void }) {
  return (
    <SchnellZeile
      hintergrund="bg-flaeche"
      eintraege={[{ art: 'archivieren', id: 'bearbeiten', label: 'Bearbeiten' }]}
      onEintrag={() => onBearbeiten()}
      ziel={{
        art: 'organisation',
        id: organisation.id,
        name: organisation.name,
        archiviert: true,
        loeschbar: organisation.loeschbar,
      }}
    >
      {(menue) => (
        <div className="flex min-h-12 items-center gap-3 px-4 py-3 opacity-50">
          <span className="min-w-0 flex-1 text-[13px] leading-[18px] font-semibold text-leise">
            <Farbpunkt farbe={organisation.farbe} className="me-2" />
            <span className="break-words align-middle">{organisation.name}</span>
          </span>
          {menue}
        </div>
      )}
    </SchnellZeile>
  );
}
