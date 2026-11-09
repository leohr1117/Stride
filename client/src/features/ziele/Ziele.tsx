import { tx, txMenge } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
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
import { DichteZeilen, Liste, Zeile } from '../../components/Zeile.tsx';
import { Abschnitt } from '../../components/Ausklappbar.tsx';
import { AbschnittKopf, Farbpunkt, Fehlermeldung, Knopf, Ladeanzeige, Leer } from '../../ui/index.ts';
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
    <DichteZeilen>
    <div className="space-y-6">
      {neuPunkte.length > 0 && (
        <KopfAktion>
          <Knopf
            variante="primaer"
            className="h-[36px]! min-h-[36px]! rounded-full! py-0! text-[14px]! whitespace-nowrap"
            aria-haspopup="menu"
            aria-expanded={menue !== null}
            onClick={(ereignis) => oeffneMenue(ereignis.currentTarget)}
          >
            <Plus className="size-4! shrink-0" aria-hidden="true" />
            {tx('Neu')}
          </Knopf>
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
          <Liste className={ast.vision.level !== null ? 'menue-spalte' : ''}>
            <VisionKopf vision={ast.vision} onOeffnen={() => setDetailId(ast.vision.id)} />
            {ast.direkte.map((projekt) => (
              <div key={projekt.id} data-ast="vision">
                <ProjektZeile projekt={projekt} namensEinzug={16} />
              </div>
            ))}
            {ast.organisationen.map((gruppe) => (
              <div key={gruppe.organisation.id} data-ast="organisation">
                <OrganisationsKopf
                  organisation={gruppe.organisation}
                  namensEinzug={16}
                  onBearbeiten={() => setBearbeitung({ art: 'organisation', organisation: gruppe.organisation })}
                />
                {gruppe.projekte.length > 0 && (
                  <div className="liste">
                    {gruppe.projekte.map((projekt) => (
                      <ProjektZeile key={projekt.id} projekt={projekt} namensEinzug={32} />
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
          <AbschnittKopf titel={tx('Ohne {name}', { name: tx(ZIEL_MARKE.visionen.name) })} />
          <Liste>
            {gliederung.lose.map((projekt) => (
              <ProjektZeile key={projekt.id} projekt={projekt} />
            ))}
          </Liste>
        </section>
      )}

      {ebenen.visionen && ebenen.organisationen && gliederung.freieOrganisationen.length > 0 && (
        <section>
          <AbschnittKopf
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
                  <div className="liste organisation-einzug">
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
                <div className="liste organisation-einzug">
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
    </DichteZeilen>
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

function visionTitel(vision: Vision, onOeffnen: () => void) {
  return (
    <button type="button" onClick={onOeffnen} className="pointer-events-auto block w-full min-w-0 text-left">
      <h2 className="pointer-events-auto flex min-w-0 items-center text-base font-semibold leading-[22px]">
        <Farbpunkt farbe={vision.farbe} className="me-2" />
        <span className="min-w-0 truncate break-words">{vision.titel}</span>
      </h2>
    </button>
  );
}

function organisationsTitel(organisation: Organisation) {
  return (
    <h3 className="flex min-w-0 items-center text-[13px] font-semibold leading-[18px] text-leise">
      <Farbpunkt farbe={organisation.farbe} groesse={8} className="me-2" />
      <span className="min-w-0 truncate">{organisation.name}</span>
    </h3>
  );
}

function VisionKopf({ vision, onOeffnen }: { vision: Vision; onOeffnen: () => void }) {
  return (
    <Zeile
      typ="lesen"
      name={vision.titel}
      titel={visionTitel(vision, onOeffnen)}
      wert={vision.level !== null ? tx('Lvl {level}', { level: vision.level }) : undefined}
    />
  );
}

function namensEinzugKlasse(einzug: 0 | 16 | 32): string {
  if (einzug === 16) {
    return '[&_.zeilen-text]:ps-[16px]';
  }
  if (einzug === 32) {
    return '[&_.zeilen-text]:ps-[32px]';
  }
  return '';
}

function OrganisationsKopf({
  organisation,
  onBearbeiten,
  namensEinzug = 0,
}: {
  organisation: Organisation;
  onBearbeiten: () => void;
  namensEinzug?: 0 | 16;
}) {
  const einzug = namensEinzugKlasse(namensEinzug);
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
        <Zeile
          typ="lesen"
          className={`organisation-kopf${organisation.archiviert ? ' opacity-50' : ''}${einzug ? ` ${einzug}` : ''}`}
          name={organisation.name}
          titel={organisationsTitel(organisation)}
          menue={menue}
        />
      )}
    </SchnellZeile>
  );
}

function ProjektZeile({ projekt, namensEinzug = 0 }: { projekt: Projekt; namensEinzug?: 0 | 16 | 32 }) {
  const einzug = namensEinzugKlasse(namensEinzug);
  const zaehlung = `${txMenge(projekt.anzahlEintraege, '{anzahl} Einträge', { anzahl: zahl(projekt.anzahlEintraege) })} · ${txMenge(projekt.offeneVorhaben, '{anzahl} Vorhaben offen', { anzahl: zahl(projekt.offeneVorhaben) })}`;
  const neben = projekt.geschafftAm ? `${tx('Abgeschlossen')} · ${zaehlung}` : zaehlung;
  const mitKette = projekt.kette.laenge >= 2;
  return (
    <SchnellZeile
      hintergrund="bg-flaeche"
      ziel={{ art: 'projekt', id: projekt.id, name: projekt.name, archiviert: projekt.archiviert, loeschbar: projekt.loeschbar }}
    >
      {(menue) => (
        <Zeile
          typ="lesen"
          nach={`/projekte/${projekt.id}`}
          name={projekt.name}
          className={`${projekt.archiviert ? 'opacity-50' : ''}${einzug ? ` ${einzug}` : ''}`}
          neben={
            mitKette ? (
              <span className="flex min-w-0 items-center">
                <span className="inline-flex shrink-0 items-center [&_svg]:size-3!">
                  <KettenAnzeige kette={projekt.kette} />
                </span>
                <span className="min-w-0 truncate">{` · ${neben}`}</span>
              </span>
            ) : (
              neben
            )
          }
          menue={menue}
          titel={projekt.name}
          rechts={
            <span className="flex min-w-0 items-center gap-3">
              <span data-zeile-wert="" className="zeile-wert zahl shrink-0">
                {tx('Lvl {level}', { level: projekt.level.level })}
              </span>
            </span>
          }
        />
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
    <section>
      <AbschnittKopf titel={tx(zielTitel('vorhaben'))} />
      {offene.length > 0 && (
        <Liste>
          {offene.map((eintrag) => (
            <SchnellZeile
              key={eintrag.id}
              hintergrund="bg-flaeche"
              ziel={{ art: 'vorhaben', id: eintrag.id, name: eintrag.titel, loeschbar: eintrag.loeschbar }}
            >
              {(menue) => (
                <Zeile
                  typ="lesen"
                  titel={eintrag.titel}
                  menue={menue}
                  rechts={
                    <Knopf variante="text" className="-my-1 shrink-0" data-schnell-frei="" onClick={() => eintragOeffnen({ vorhabenId: eintrag.id })}>
                      {tx('Weiter')}
                    </Knopf>
                  }
                />
              )}
            </SchnellZeile>
          ))}
        </Liste>
      )}
      {fertig.length > 0 && (
        <Abschnitt titel="Abgeschlossen" zusatz={`(${zahl(fertig.length)})`} kennung="ziele-vorhaben-fertig" anfangEingeklappt>
          <Liste>
            {fertig.map((eintrag) => (
              <Zeile key={eintrag.id} typ="lesen" className="text-leise" titel={eintrag.titel} />
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
    <section>
      <AbschnittKopf titel={tx('Ohne Projekt')} />
      <Liste>
        {vorhaben.map((eintrag) => (
          <SchnellZeile
            key={eintrag.id}
            hintergrund="bg-flaeche"
            ziel={{ art: 'vorhaben', id: eintrag.id, name: eintrag.titel, loeschbar: eintrag.loeschbar }}
          >
            {(menue) => (
              <Zeile
                typ="lesen"
                titel={eintrag.titel}
                menue={menue}
                rechts={
                  <Knopf variante="text" className="-my-1 shrink-0" data-schnell-frei="" onClick={() => eintragOeffnen({ vorhabenId: eintrag.id })}>
                    {tx('Weiter')}
                  </Knopf>
                }
              />
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
        <Zeile typ="lesen" className="opacity-50" name={vision.titel} titel={visionTitel(vision, onOeffnen)} menue={menue} />
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
        <Zeile
          typ="lesen"
          className="organisation-kopf opacity-50"
          name={organisation.name}
          titel={organisationsTitel(organisation)}
          menue={menue}
        />
      )}
    </SchnellZeile>
  );
}
