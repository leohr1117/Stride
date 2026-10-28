import { tx } from '../../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleX, Pencil, Plus, RotateCcw, Swords, Wind, Wrench } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'react-router';
import type { BasisAufgabe, Projekt, Vorlage, Vorhaben } from '../../../../shared/api/index.ts';
import { GRENZEN, NEUTRAL_FARBE, VORHABEN_STATUS_LABEL } from '../../../../shared/spiel/begriffe.ts';
import { zielTitel } from '../../../../shared/spiel/ebenen.ts';
import { BOSS_DATUM_INFO, NEUER_ANLAUF } from '../../../../shared/spiel/xp.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { BasisFormular, BasisListe, useBasisAufgaben } from '../basis/Basis.tsx';
import { useFeiern } from '../../components/Belohnung.tsx';
import { Abschnitt, EinklappKopf } from '../../components/Ausklappbar.tsx';
import { useBestaetigung, useEingabe } from '../../components/Bestaetigung.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { SchnellZeile } from '../../components/SchnellAktion.tsx';
import { Icon } from '../../components/Icons.tsx';
import { KettenAnzeige } from '../../components/KettenAnzeige.tsx';
import { ProjektInvestition } from '../investitionen/Investitionen.tsx';
import { useEintragOeffnen } from '../../components/Layout.tsx';
import { BossRing } from '../bosse/BossRing.tsx';
import {
  EINGABE_STIL,
  Fehlermeldung,
  Formular,
  InfoHinweis,
  Karte,
  Knopf,
  Ladeanzeige,
  LevelRing,
} from '../../ui/index.ts';
import { bossZeile, VorhabenKennzahlen } from '../../components/VorhabenInfo.tsx';
import { TaetigkeitFormular } from '../taetigkeiten/TaetigkeitFormular.tsx';
import { ZielDialog, type ZielBearbeitung } from './ZielDialoge.tsx';
import { ZielMarke } from '../../components/ZielMarke.tsx';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { bonusProzent, kurzesDatum, lokalesDatum, stunden as stundenText, zahl } from '../../format.ts';
import { useSichtbarkeit } from '../../funktionen.ts';

function AbschlussMarke() {
  return (
    <span
      role="img"
      aria-label={tx('abgeschlossen')}
      title={tx('abgeschlossen')}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-flaeche-2 text-leise"
    >
      <CircleCheck className="size-3.5" aria-hidden="true" />
    </span>
  );
}

export function ProjektSeite() {
  const projektId = Number(useParams().id);
  const { data, error, isPending } = useQuery({
    queryKey: SCHLUESSEL.projekt(projektId),
    queryFn: () => api.projekt(projektId),
    enabled: Number.isInteger(projektId),
  });
  const eintragOeffnen = useEintragOeffnen();
  const sichtbarkeit = useSichtbarkeit();
  const funktionen = sichtbarkeit.funktionen;
  const ebenen = sichtbarkeit.ebenen;
  const bosseAn = istAn('bossAngriffe', sichtbarkeit);
  const [bearbeitung, setBearbeitung] = useState<ZielBearbeitung>(null);
  const [bossVorhaben, setBossVorhaben] = useState<Vorhaben | null>(null);

  if (!Number.isInteger(projektId)) {
    return <Fehlermeldung fehler={new Error(tx("Ungültige Projekt-Adresse."))} />;
  }
  if (isPending) {
    return <Ladeanzeige />;
  }
  if (error) {
    return <Fehlermeldung fehler={error} />;
  }

  const { projekt, vorhaben } = data;
  const kontextFarbe = projekt.kontext?.farbe ?? NEUTRAL_FARBE;
  const offene = vorhaben.filter((eintrag) => eintrag.status === 'offen');
  const abgeschlossene = vorhaben.filter((eintrag) => eintrag.status !== 'offen');
  const investitionAn = istAn('ausruestung', sichtbarkeit);

  return (
    <div className="space-y-6">
      <Karte className="space-y-4">
        <div className="flex items-start gap-5">
          <LevelRing level={projekt.level.level} anteil={projekt.level.fortschritt} groesse={88} />
          <div className="min-w-0 flex-1">
            <SchnellZeile
              ziel={{ art: 'projekt', id: projekt.id, name: projekt.name, archiviert: projekt.archiviert, loeschbar: projekt.loeschbar }}
            >
              {(menue) => (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <ZielMarke ebene="projekte" />
                    <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
                      <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight">{projekt.name}</h1>
                      {projekt.geschafftAm ? <AbschlussMarke /> : null}
                    </div>
                    <p className="flex min-w-0 items-center gap-1.5 text-sm text-leise">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: kontextFarbe }} />
                      <span className="min-w-0 truncate">{projekt.kontext?.titel ?? tx("Ohne Zuordnung")}</span>
                      {projekt.archiviert ? <span className="shrink-0 whitespace-nowrap">{tx("· archiviert")}</span> : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-start">
                    {menue}
                    <Knopf
                      variante="leise"
                      className="p-2"
                      aria-label={tx("Projekt bearbeiten")}
                      onClick={() => setBearbeitung({ art: 'projekt', projekt, visionId: null, organisationId: null })}
                    >
                      <Pencil className="size-4" />
                    </Knopf>
                  </div>
                </div>
              )}
            </SchnellZeile>
            {projekt.beschreibung && <p className="mt-2 text-sm">{projekt.beschreibung}</p>}
          </div>
        </div>
        <div className="space-y-1 text-xs text-leise">
          <div className="flex items-center justify-between gap-3">
            <span className="zahl">
              {tx('Erfahrung {aktuell} / {gesamt} XP', {
                aktuell: zahl(projekt.level.xpImLevel),
                gesamt: zahl(projekt.level.xpFuerNaechstes),
              })}
            </span>
            <span className="flex shrink-0 items-center gap-3">
              {investitionAn && projekt.ausruestungBonus > 0 && (
                <span className="zahl flex items-center gap-1 font-medium text-xp">
                  <Wrench className="size-3.5" />
                  {bonusProzent(projekt.ausruestungBonus)}
                </span>
              )}
              <KettenAnzeige kette={projekt.kette} />
            </span>
          </div>
          <p className="zahl break-words">
            {tx('noch {rest} bis Level {level}', {
              rest: zahl(projekt.level.xpFuerNaechstes - projekt.level.xpImLevel),
              level: projekt.level.level + 1,
            })}
          </p>
        </div>
        <ProjektAbschluss projekt={projekt} />
        {projekt.aktiv && (
          <Knopf variante="primaer" className="w-full" onClick={() => eintragOeffnen({ projektId: projekt.id })}>
            <Plus className="size-4" />
            {tx("Eintrag")}
          </Knopf>
        )}
      </Karte>

      {ebenen.vorhaben && (
        <Abschnitt titel={zielTitel('vorhaben')} kennung="projekt-vorhaben">
          {projekt.aktiv && <VorhabenAnlegen projektId={projekt.id} />}
          <div className="space-y-2">
            {offene.map((eintrag) => (
              <OffenesVorhaben
                key={eintrag.id}
                vorhaben={eintrag}
                onWeiter={() => eintragOeffnen({ projektId: projekt.id, vorhabenId: eintrag.id })}
                onBoss={() => setBossVorhaben(eintrag)}
                bosseAn={bosseAn}
              />
            ))}
          </div>
          {abgeschlossene.length > 0 && (
            <AbgeschlosseneVorhaben vorhaben={abgeschlossene} aktiv={projekt.aktiv} bosseAn={bosseAn} />
          )}
        </Abschnitt>
      )}

      <ProjektTaetigkeiten projektId={projekt.id} projektName={projekt.name} aktiv={projekt.aktiv} />

      {funktionen.basis && <ProjektBasis projektId={projekt.id} aktiv={projekt.aktiv} />}

      {investitionAn && <ProjektInvestition projekt={projekt} />}

      <ZielDialog bearbeitung={bearbeitung} onSchliessen={() => setBearbeitung(null)} />
      {bosseAn && (
        <Dialog
          offen={bossVorhaben !== null}
          titel={bossVorhaben?.boss ? tx("Boss bearbeiten") : tx("Zum Boss machen")}
          onSchliessen={() => setBossVorhaben(null)}
        >
          {bossVorhaben && (
            <BossFormular key={bossVorhaben.id} vorhaben={bossVorhaben} onFertig={() => setBossVorhaben(null)} />
          )}
        </Dialog>
      )}
    </div>
  );
}

function useProjektAbschluss(projekt: Projekt): { knopf: ReactNode; fehler: ReactNode } {
  const bestaetigen = useBestaetigung();
  const feiern = useFeiern();
  const queryClient = useQueryClient();
  const abschliessen = useMutation({
    mutationFn: () => api.aendereProjekt(projekt.id, { geschafft: true }),
    onSuccess: (antwort) => {
      if (antwort.belohnung) {
        feiern(antwort.belohnung);
      }
      void queryClient.invalidateQueries();
    },
  });
  const oeffnen = useMutation({
    mutationFn: () => api.aendereProjekt(projekt.id, { geschafft: false }),
    onSuccess: () => void queryClient.invalidateQueries(),
  });

  const beimAbschliessen = async () => {
    if (
      await bestaetigen({
        titel: tx('"{name}" abschließen?', { name: projekt.name }),
        text: projekt.investition ? tx("Die Investition wird aktiv.") : tx("XP und Einträge bleiben."),
        knopf: tx("Abschließen"),
      })
    ) {
      abschliessen.mutate();
    }
  };
  const beimOeffnen = async () => {
    if (
      await bestaetigen({
        titel: tx("Projekt wieder öffnen?"),
        text: projekt.investition ? tx("Die Investition wird inaktiv.") : tx("Das Projekt ist wieder offen."),
        knopf: tx("Öffnen"),
        gefahr: true,
      })
    ) {
      oeffnen.mutate();
    }
  };

  const knopf = projekt.geschafftAm ? (
    <Knopf variante="leise" className="shrink-0 px-2 py-1 text-xs" onClick={beimOeffnen} disabled={oeffnen.isPending}>
      {tx("Öffnen")}
    </Knopf>
  ) : (
    <Knopf
      variante="primaer"
      className="shrink-0 px-3 py-1.5"
      onClick={beimAbschliessen}
      disabled={abschliessen.isPending || !projekt.aktiv}
    >
      {tx("Abschließen")}
    </Knopf>
  );

  return { knopf, fehler: <Fehlermeldung fehler={abschliessen.error ?? oeffnen.error} /> };
}

function ProjektAbschluss({ projekt }: { projekt: Projekt }) {
  const abschluss = useProjektAbschluss(projekt);
  const stand = projekt.geschafftAm ? projekt.abschluss : null;
  return (
    <div className="space-y-2">
      {abschluss.fehler}
      {stand && (
        <section aria-label={tx('Abschluss')} className="min-w-0 space-y-2">
          <div className="flex min-w-0 items-center">
            <h2 className="text-sm font-medium">{tx('Abschluss')}</h2>
            <InfoHinweis text="Einmalig Bonus-XP nach den Einträgen im Projekt. Wieder öffnen gibt den Bonus nicht noch einmal." />
          </div>
          <p className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-sm text-leise">
            <span className="zahl">{tx('{xp} XP', { xp: zahl(stand.xp) })}</span>
            <span>{tx('Level {level}', { level: stand.level })}</span>
            <span className="min-w-0 break-words">
              {tx('{von} bis {bis}', { von: kurzesDatum(stand.von), bis: kurzesDatum(stand.bis) })}
            </span>
            <span>{tx('{anzahl} Einträge', { anzahl: zahl(stand.eintraege) })}</span>
            <span className="zahl">{stundenText(stand.stunden)}</span>
          </p>
        </section>
      )}
      <div className="flex flex-wrap gap-2">{abschluss.knopf}</div>
    </div>
  );
}

function ProjektBasis({ projektId, aktiv }: { projektId: number; aktiv: boolean }) {
  const { data: aufgaben = [], error } = useBasisAufgaben();
  const [bearbeitung, setBearbeitung] = useState<{ aufgabe: BasisAufgabe | null } | null>(null);
  const eigene = aufgaben.filter((aufgabe) => aufgabe.projektId === projektId && !aufgabe.archiviert);

  if (!aktiv) {
    return null;
  }
  return (
    <Abschnitt
      titel={tx("Basis")}
      kennung="projekt-basis"
      aktion={
        <Knopf variante="leise" className="px-2 py-1" onClick={() => setBearbeitung({ aufgabe: null })}>
          <Plus className="size-4" />
          {tx("Aufgabe")}
        </Knopf>
      }
    >
      <Fehlermeldung fehler={error} />
      {eigene.length > 0 && (
        <Karte>
          <BasisListe aufgaben={eigene} mitProjekt={false} onBearbeiten={(aufgabe) => setBearbeitung({ aufgabe })} />
        </Karte>
      )}
      <Dialog
        offen={bearbeitung !== null}
        titel={bearbeitung?.aufgabe ? tx("Aufgabe bearbeiten") : tx("Neue Aufgabe")}
        onSchliessen={() => setBearbeitung(null)}
      >
        {bearbeitung && (
          <BasisFormular
            key={bearbeitung.aufgabe?.id ?? 'neu'}
            aufgabe={bearbeitung.aufgabe}
            projektVorgabe={projektId}
            onFertig={() => setBearbeitung(null)}
          />
        )}
      </Dialog>
    </Abschnitt>
  );
}

function ProjektTaetigkeiten({
  projektId,
  projektName,
  aktiv,
}: {
  projektId: number;
  projektName: string;
  aktiv: boolean;
}) {
  const { data: vorlagen = [], error } = useQuery({ queryKey: SCHLUESSEL.vorlagen, queryFn: api.vorlagen });
  const [bearbeitung, setBearbeitung] = useState<{ vorlage: Vorlage | null } | null>(null);
  const eigene = vorlagen.filter((vorlage) => vorlage.projektId === projektId && !vorlage.archiviert);

  if (!aktiv) {
    return null;
  }
  return (
    <Abschnitt
      titel={tx("Tätigkeiten")}
      kennung="projekt-taetigkeiten"
      info="Diese Tätigkeiten gelten nur für dieses Projekt."
      aktion={
        <Knopf variante="leise" className="px-2 py-1" onClick={() => setBearbeitung({ vorlage: null })}>
          <Plus className="size-4" />
          {tx("Tätigkeit")}
        </Knopf>
      }
    >
      <Fehlermeldung fehler={error} />
      {eigene.length > 0 && (
        <Karte dicht className="divide-y divide-rand">
          {eigene.map((vorlage) => (
            <SchnellZeile
              key={vorlage.id}
              ziel={{ art: 'vorlage', id: vorlage.id, name: vorlage.name, archiviert: vorlage.archiviert, loeschbar: vorlage.loeschbar }}
            >
              {(menue) => (
                <div className="flex items-center gap-1 py-1 pr-1 pl-3">
                  <Icon name={vorlage.icon} className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{vorlage.name}</span>
                    <span className="block truncate text-xs text-leise">{tx('Nur für {name}', { name: projektName })}</span>
                  </span>
                  {menue}
                  <Knopf
                    variante="leise"
                    className="shrink-0 p-2"
                    aria-label={tx('{name} bearbeiten', { name: vorlage.name })}
                    onClick={() => setBearbeitung({ vorlage })}
                  >
                    <Pencil className="size-4" />
                  </Knopf>
                </div>
              )}
            </SchnellZeile>
          ))}
        </Karte>
      )}
      <Dialog
        offen={bearbeitung !== null}
        titel={
          bearbeitung?.vorlage
            ? tx("Tätigkeit bearbeiten")
            : tx('Tätigkeit für {name}', { name: projektName })
        }
        onSchliessen={() => setBearbeitung(null)}
      >
        {bearbeitung && (
          <TaetigkeitFormular
            key={bearbeitung.vorlage?.id ?? 'neu'}
            vorlage={bearbeitung.vorlage}
            projektId={bearbeitung.vorlage ? null : projektId}
            projektName={bearbeitung.vorlage ? bearbeitung.vorlage.projektName ?? projektName : projektName}
            onFertig={() => setBearbeitung(null)}
          />
        )}
      </Dialog>
    </Abschnitt>
  );
}

function VorhabenAnlegen({ projektId }: { projektId: number }) {
  const queryClient = useQueryClient();
  const [titel, setTitel] = useState('');
  const anlegen = useMutation({
    mutationFn: () => api.erstelleVorhaben(projektId, titel.trim()),
    onSuccess: () => {
      setTitel('');
      void queryClient.invalidateQueries();
    },
  });

  const absenden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (titel.trim()) {
      anlegen.mutate();
    }
  };

  return (
    <form onSubmit={absenden} className="space-y-2">
      <div className="flex gap-2">
        <input
          className={EINGABE_STIL}
          placeholder={tx("Neues Vorhaben")}
          maxLength={GRENZEN.nameMax}
          value={titel}
          onChange={(ereignis) => setTitel(ereignis.target.value)}
        />
        <Knopf type="submit" disabled={!titel.trim() || anlegen.isPending} aria-label={tx("Vorhaben anlegen")}>
          <Plus className="size-4" />
        </Knopf>
      </div>
      <Fehlermeldung fehler={anlegen.error} />
    </form>
  );
}

function OffenesVorhaben({
  vorhaben,
  onWeiter,
  onBoss,
  bosseAn,
}: {
  vorhaben: Vorhaben;
  onWeiter: () => void;
  onBoss: () => void;
  bosseAn: boolean;
}) {
  const bestaetigen = useBestaetigung();
  const eingeben = useEingabe();
  const queryClient = useQueryClient();
  const aktualisieren = () => void queryClient.invalidateQueries();
  const loslassen = useMutation({ mutationFn: () => api.lasseVorhabenLos(vorhaben.id), onSuccess: aktualisieren });
  const umbenennen = useMutation({
    mutationFn: (titel: string) => api.aendereVorhaben(vorhaben.id, { titel }),
    onSuccess: aktualisieren,
  });
  const boss = bosseAn ? vorhaben.boss : null;

  const beimUmbenennen = async () => {
    const titel = await eingeben({
      titel: tx("Titel ändern"),
      wert: vorhaben.titel,
      maxLaenge: GRENZEN.nameMax,
      label: tx("Titel"),
    });
    if (titel && titel !== vorhaben.titel) {
      umbenennen.mutate(titel);
    }
  };

  const beimLoslassen = async () => {
    if (await bestaetigen({ titel: tx("Vorhaben loslassen?"), text: tx("Die bisherigen XP bleiben."), knopf: tx("Loslassen") })) {
      loslassen.mutate();
    }
  };

  return (
    <SchnellZeile
      className={`rounded-2xl border ${boss ? 'border-gefahr/40' : 'border-rand'}`}
      ziel={{ art: 'vorhaben', id: vorhaben.id, name: vorhaben.titel, loeschbar: vorhaben.loeschbar }}
    >
      {(menue) => (
    <div className="bg-flaeche px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 basis-full items-center gap-3 sm:basis-auto sm:flex-1">
          {boss && <BossRing ring={boss.ring} erwacht={boss.phase === 'erwacht'} />}
          <div className="min-w-0 flex-1">
            <button type="button" onClick={beimUmbenennen} className="group flex min-w-0 items-center gap-1.5 text-left">
              {boss && <Swords className="size-4 shrink-0 text-gefahr" />}
              <span className="truncate text-sm font-medium">{vorhaben.titel}</span>
              <Pencil className="size-3 shrink-0 text-leise opacity-0 transition group-hover:opacity-100" />
            </button>
            {boss && <p className="text-xs text-leise">{bossZeile(boss)}</p>}
            <VorhabenKennzahlen vorhaben={vorhaben} ohneXp={boss !== null} />
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {menue}
          {bosseAn && (
            <Knopf
              variante="leise"
              className={`px-2 py-1.5 ${boss ? 'text-gefahr' : ''}`}
              onClick={onBoss}
              title={boss ? tx("Boss bearbeiten") : tx("Zum Boss machen")}
            >
              <Swords className="size-4" />
            </Knopf>
          )}
          <Knopf variante="leise" className="px-2 py-1.5" onClick={beimLoslassen} title={tx("Loslassen")}>
            <Wind className="size-4" />
          </Knopf>
          <Knopf className="px-3 py-1.5" onClick={onWeiter}>
            {tx("Weiter")}
          </Knopf>
        </div>
      </div>
      <Fehlermeldung fehler={loslassen.error ?? umbenennen.error} />
    </div>
      )}
    </SchnellZeile>
  );
}

function BossFormular({ vorhaben, onFertig }: { vorhaben: Vorhaben; onFertig: () => void }) {
  const queryClient = useQueryClient();
  const heute = lokalesDatum(new Date());
  const [deadline, setDeadline] = useState(vorhaben.boss?.deadline ?? '');
  const deadlineGueltig = /^\d{4}-\d{2}-\d{2}$/.test(deadline);
  const minDatum = deadlineGueltig && deadline < heute ? deadline : heute;

  const speichern = useMutation({
    mutationFn: (beenden: boolean) =>
      api.aendereVorhaben(vorhaben.id, {
        boss: beenden ? null : { deadline },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onFertig();
    },
  });

  const absenden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (deadlineGueltig) {
      speichern.mutate(false);
    }
  };

  return (
    <Formular onAbsenden={absenden}>
      <p className="font-medium">{vorhaben.titel}</p>
      <div className="space-y-1.5">
        <span className="flex items-center text-sm font-medium">
          {tx("Deadline")}
          <InfoHinweis text={BOSS_DATUM_INFO} />
        </span>
        <input
          type="date"
          required
          min={minDatum}
          className={EINGABE_STIL}
          value={deadline}
          onChange={(ereignis) => setDeadline(ereignis.target.value)}
          autoFocus
        />
      </div>
      <Fehlermeldung fehler={speichern.error} />
      <div className="flex gap-2">
        {vorhaben.boss && (
          <Knopf variante="gefahr" onClick={() => speichern.mutate(true)} disabled={speichern.isPending}>
            {tx("Kein Boss mehr")}
          </Knopf>
        )}
        <Knopf type="submit" variante="primaer" className="flex-1" disabled={!deadlineGueltig || speichern.isPending}>
          {tx("Speichern")}
        </Knopf>
      </div>
    </Formular>
  );
}

const STATUS_ICON = {
  geschafft: <CircleCheck className="size-4 text-xp" />,
  gescheitert: <CircleX className="size-4 text-leise" />,
  losgelassen: <Wind className="size-4 text-leise" />,
} as const;

function AbgeschlosseneVorhaben({
  vorhaben,
  aktiv,
  bosseAn,
}: {
  vorhaben: Vorhaben[];
  aktiv: boolean;
  bosseAn: boolean;
}) {
  const queryClient = useQueryClient();
  const feiern = useFeiern();
  const [offen, setOffen] = useState(false);
  const anlauf = useMutation({
    mutationFn: (id: number) => api.starteNeuenAnlauf(id),
    onSuccess: (ergebnis) => {
      void queryClient.invalidateQueries();
      feiern(ergebnis.belohnung);
    },
  });

  return (
    <div className="mt-4">
      <EinklappKopf
        element="span"
        titel={`Abgeschlossen (${vorhaben.length})`}
        titelStil="text-sm font-normal tracking-normal text-leise normal-case"
        offen={offen}
        onToggle={() => setOffen(!offen)}
      />
      {offen && (
        <div className="mt-2 space-y-2">
          {vorhaben.map((eintrag) => (
            <div key={eintrag.id} className="rounded-2xl border border-rand bg-flaeche px-4 py-3">
              <div className="flex items-center gap-3">
                {eintrag.status !== 'offen' && STATUS_ICON[eintrag.status]}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    {bosseAn && eintrag.boss && <Swords className="size-3.5 text-gefahr" />}
                    {eintrag.titel}
                  </p>
                  <p className="text-xs text-leise">
                    {bosseAn &&
                    eintrag.boss &&
                    eintrag.status === 'geschafft' &&
                    eintrag.boss.level !== null &&
                    eintrag.boss.kampfXp !== null
                      ? tx('Boss besiegt · Level {level} · {xp} XP', {
                          level: zahl(eintrag.boss.level),
                          xp: zahl(eintrag.boss.kampfXp),
                        })
                      : tx(VORHABEN_STATUS_LABEL[eintrag.status])}
                    {eintrag.abgeschlossenAm && ` · ${kurzesDatum(eintrag.abgeschlossenAm)}`}
                  </p>
                  <VorhabenKennzahlen
                    vorhaben={eintrag}
                    ohneXp={
                      bosseAn &&
                      eintrag.boss !== null &&
                      eintrag.status === 'geschafft' &&
                      eintrag.boss.level !== null &&
                      eintrag.boss.kampfXp !== null
                    }
                  />
                </div>
                {aktiv && eintrag.status === 'gescheitert' && !eintrag.hatNachfolger && (
                  <Knopf
                    className="shrink-0 px-3 py-1.5"
                    onClick={() => anlauf.mutate(eintrag.id)}
                    disabled={anlauf.isPending}
                  >
                    <RotateCcw className="size-4" />
                    {tx('Neuer Anlauf · +{xp}', { xp: NEUER_ANLAUF.disziplin + NEUER_ANLAUF.geist })}
                  </Knopf>
                )}
              </div>
              {eintrag.erkenntnis && (
                <p className="mt-2 rounded-xl bg-flaeche-2 px-3 py-2 text-sm">
                  <span className="text-leise">{tx('Mitgenommen:')} </span>
                  {eintrag.erkenntnis}
                </p>
              )}
            </div>
          ))}
          <Fehlermeldung fehler={anlauf.error} />
        </div>
      )}
    </div>
  );
}
