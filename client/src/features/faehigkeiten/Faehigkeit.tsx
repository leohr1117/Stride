import { tx, txMenge } from '../../text.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Sparkles } from 'lucide-react';
import { useState, type CSSProperties, type FormEvent } from 'react';
import { useParams } from 'react-router';
import type { Faehigkeit, SkillKnoten } from '../../../../shared/api/index.ts';
import { DREYFUS_STUFEN, GRENZEN } from '../../../../shared/spiel/begriffe.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useFeiern } from '../../components/Belohnung.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { FaehigkeitFormular } from '../../components/FaehigkeitFormular.tsx';
import { SchnellMenueKnopf, useSchnellAktion } from '../../components/SchnellAktion.tsx';
import { Icon } from '../../components/Icons.tsx';
import { SkillBaum, skillSchein } from './SkillBaum.tsx';
import { KopfAktion, useKopf } from '../../components/Kopf.tsx';
import {
  EINGABE_STIL,
  Feld,
  Fehlermeldung,
  Formular,
  Fortschrittsbalken,
  Karte,
  Knopf,
  Leer,
  Ladeanzeige,
  Ueberschrift,
} from '../../ui/index.ts';
import { kurzesDatum, zahl } from '../../format.ts';

type KnotenBearbeitung = { knoten: SkillKnoten | null; elternId: number | null } | null;

const RING_RADIUS = 44;
const RING_UMFANG = 2 * Math.PI * RING_RADIUS;

export function FaehigkeitSeite() {
  const faehigkeitId = Number(useParams().id);
  const { data: faehigkeit, error, isPending } = useQuery({
    queryKey: SCHLUESSEL.faehigkeit(faehigkeitId),
    queryFn: () => api.faehigkeit(faehigkeitId),
    enabled: Number.isInteger(faehigkeitId),
  });
  const [bearbeiten, setBearbeiten] = useState(false);
  const [knotenBearbeitung, setKnotenBearbeitung] = useState<KnotenBearbeitung>(null);
  const [ausgewaehlt, setAusgewaehlt] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const schnell = useSchnellAktion();
  const feiern = useFeiern();
  const freischalten = useMutation({
    mutationFn: (id: number) => api.schalteSkillFrei(id),
    onSuccess: (ergebnis) => {
      void queryClient.invalidateQueries();
      feiern(ergebnis.belohnung);
      setAusgewaehlt(null);
    },
  });
  const zuruecknehmen = useMutation({
    mutationFn: (id: number) => api.sperreSkill(id),
    onSuccess: (_daten, id) => {
      void queryClient.invalidateQueries();
      setAusgewaehlt(null);
      schnell.melde(tx('Gesperrt'), () => {
        freischalten.mutate(id);
      });
    },
  });
  useKopf(faehigkeit ? { titel: faehigkeit.name, roh: true } : null);

  if (!Number.isInteger(faehigkeitId)) {
    return <Fehlermeldung fehler={new Error(tx("Ungültige Adresse."))} />;
  }
  if (isPending) {
    return <Ladeanzeige />;
  }
  if (error) {
    return <Fehlermeldung fehler={error} />;
  }

  const frei = faehigkeit.knoten.filter((knoten) => knoten.freigeschaltetAm !== null).length;
  const gesamt = faehigkeit.knoten.length;
  const auswahl = faehigkeit.knoten.find((knoten) => knoten.id === ausgewaehlt) ?? null;
  const farbStil = { '--skillfarbe': faehigkeit.farbe } as CSSProperties;

  return (
    <div className="space-y-6" style={farbStil}>
      <KopfAktion>
        <SchnellMenueKnopf
          ziel={{
            art: 'faehigkeit',
            id: faehigkeit.id,
            name: faehigkeit.name,
            archiviert: faehigkeit.archiviert,
            loeschbar: faehigkeit.loeschbar,
          }}
          davor={[{ id: 'bearbeiten', label: 'Bearbeiten', onWahl: () => setBearbeiten(true) }]}
        />
      </KopfAktion>
      <Karte className="relative space-y-5 overflow-hidden">
        <div
          className="glimm-fleck pointer-events-none absolute -top-24 -right-24 size-64 rounded-full opacity-25 blur-3xl"
          style={{ backgroundColor: faehigkeit.farbe }}
        />
        <div className="relative flex items-center gap-5">
          <SkillRing frei={frei} gesamt={gesamt} farbe={faehigkeit.farbe} icon={faehigkeit.icon} />
          <div className="min-w-0 flex-1">
            <p className="zahl text-sm text-leise break-words">
              {txMenge(faehigkeit.anzahlEintraege, 'Level {level} · {anzahl} Einträge', {
                level: faehigkeit.level.level,
                anzahl: zahl(faehigkeit.anzahlEintraege),
              })}
              {faehigkeit.archiviert && ` ${tx('· archiviert')}`}
            </p>
            <div className="mt-3">
              <Fortschrittsbalken anteil={faehigkeit.level.fortschritt} farbe={faehigkeit.farbe} />
              <p className="zahl mt-1 text-right text-xs text-leise">
                {zahl(faehigkeit.level.xpImLevel)} / {zahl(faehigkeit.level.xpFuerNaechstes)} XP
              </p>
            </div>
          </div>
        </div>
        <Rangleiste level={faehigkeit.level.level} farbe={faehigkeit.farbe} />
      </Karte>

      <section className="min-w-0">
        <Ueberschrift
          titel={tx("Baum")}
          aktion={
            !faehigkeit.archiviert && (
              <Knopf variante="leise" className="px-2 py-1" onClick={() => setKnotenBearbeitung({ knoten: null, elternId: null })}>
                <Plus className="size-4" />
                {tx("Neu")}
              </Knopf>
            )
          }
        />
        {gesamt === 0 ? (
          <Leer text={tx("Noch nichts.")} />
        ) : (
          <div
            className="baum-karte karte w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-2xl border border-rand bg-flaeche"
            style={skillSchein(faehigkeit.farbe)}
          >
            <div className="baum-flaeche mx-auto w-fit px-4 py-6">
              <SkillBaum faehigkeit={faehigkeit} onWaehlen={setAusgewaehlt} />
            </div>
          </div>
        )}
      </section>

      <Dialog
        offen={auswahl !== null}
        titel={auswahl?.titel ?? ''}
        menu={
          auswahl && !faehigkeit.archiviert ? (
            <SchnellMenueKnopf
              ziel={{
                art: 'knoten',
                id: auswahl.id,
                name: auswahl.titel,
                loeschbar: auswahl.freigeschaltetAm === null && auswahl.loeschbar,
                hinweis: tx('Alle Skills darunter werden ebenfalls gelöscht.'),
              }}
              davor={[
                {
                  id: 'bearbeiten',
                  label: 'Bearbeiten',
                  onWahl: () => {
                    setAusgewaehlt(null);
                    setKnotenBearbeitung({ knoten: auswahl, elternId: auswahl.elternId });
                  },
                },
                ...(auswahl.freigeschaltetAm !== null
                  ? [
                      {
                        id: 'zurueck',
                        label: 'Zurücknehmen',
                        onWahl: () => zuruecknehmen.mutate(auswahl.id),
                      },
                    ]
                  : []),
              ]}
              onErledigt={() => setAusgewaehlt(null)}
            />
          ) : undefined
        }
        onSchliessen={() => setAusgewaehlt(null)}
      >
        {auswahl && (
          <SkillAktionen
            knoten={auswahl}
            faehigkeit={faehigkeit}
            laeuft={freischalten.isPending || zuruecknehmen.isPending}
            fehler={freischalten.error ?? zuruecknehmen.error}
            onFreischalten={() => freischalten.mutate(auswahl.id)}
            onKind={() => {
              setAusgewaehlt(null);
              setKnotenBearbeitung({ knoten: null, elternId: auswahl.id });
            }}
          />
        )}
      </Dialog>
      <Dialog offen={bearbeiten} titel={tx("Fähigkeit")} onSchliessen={() => setBearbeiten(false)}>
        {bearbeiten && <FaehigkeitFormular faehigkeit={faehigkeit} onFertig={() => setBearbeiten(false)} />}
      </Dialog>
      <Dialog offen={knotenBearbeitung !== null} titel={tx("Knoten")} onSchliessen={() => setKnotenBearbeitung(null)}>
        {knotenBearbeitung && (
          <KnotenFormular
            key={knotenBearbeitung.knoten?.id ?? `neu-${knotenBearbeitung.elternId}`}
            faehigkeitId={faehigkeit.id}
            bearbeitung={knotenBearbeitung}
            onFertig={() => setKnotenBearbeitung(null)}
          />
        )}
      </Dialog>
    </div>
  );
}

function SkillRing({ frei, gesamt, farbe, icon }: { frei: number; gesamt: number; farbe: string; icon: string }) {
  const anteil = gesamt === 0 ? 0 : frei / gesamt;
  return (
    <div className="relative size-24 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={RING_RADIUS} fill="none" stroke="var(--flaeche-2)" strokeWidth="7" />
        <motion.circle
          cx="50"
          cy="50"
          r={RING_RADIUS}
          fill="none"
          stroke={farbe}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={RING_UMFANG}
          initial={false}
          animate={{ strokeDashoffset: RING_UMFANG * (1 - anteil) }}
          transition={{ type: 'spring', stiffness: 70, damping: 16 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Icon name={icon} className="size-6" style={{ color: farbe }} />
        <span className="zahl mt-0.5 text-xs font-semibold">
          {frei}/{gesamt}
        </span>
      </div>
    </div>
  );
}

function Rangleiste({ level, farbe }: { level: number; farbe: string }) {
  let aktuell = 0;
  DREYFUS_STUFEN.forEach((stufe, index) => {
    if (level >= stufe.abLevel) {
      aktuell = index;
    }
  });
  const naechste = DREYFUS_STUFEN[aktuell + 1];

  return (
    <div className="relative">
      <div className="flex items-center">
        {DREYFUS_STUFEN.map((stufe, index) => (
          <div key={stufe.name} className="flex flex-1 items-center last:flex-none">
            <div
              className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold transition ${
                index <= aktuell ? 'text-white' : 'border-rand text-leise'
              } ${index === aktuell ? 'skill-leuchten' : ''}`}
              style={index <= aktuell ? { backgroundColor: farbe, borderColor: farbe } : undefined}
              title={tx('{name} ab Level {level}', { name: tx(stufe.name), level: stufe.abLevel })}
            >
              {index + 1}
            </div>
            {index < DREYFUS_STUFEN.length - 1 && (
              <div className="mx-1 h-0.5 flex-1 rounded-full" style={{ backgroundColor: index < aktuell ? farbe : 'var(--rand)' }} />
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 font-semibold break-words" style={{ color: farbe }}>
          {tx(DREYFUS_STUFEN[aktuell].name)}
        </span>
        {naechste && (
          <span className="zahl min-w-0 text-right text-xs text-leise break-words">
            {tx('{name} ab Level {level}', { name: tx(naechste.name), level: naechste.abLevel })}
          </span>
        )}
      </div>
    </div>
  );
}

function SkillAktionen({
  knoten,
  faehigkeit,
  laeuft,
  fehler,
  onFreischalten,
  onKind,
}: {
  knoten: SkillKnoten;
  faehigkeit: Faehigkeit;
  laeuft: boolean;
  fehler: unknown;
  onFreischalten: () => void;
  onKind: () => void;
}) {
  const frei = knoten.freigeschaltetAm !== null;
  const aenderbar = !faehigkeit.archiviert;

  return (
    <div className="space-y-4">
      {knoten.beschreibung && <p className="text-sm">{knoten.beschreibung}</p>}
      <p className="zahl text-sm text-leise">
        {frei && knoten.freigeschaltetAm
          ? `${tx('Freigeschaltet am {datum}', { datum: kurzesDatum(knoten.freigeschaltetAm) })} · `
          : ''}
        {zahl(knoten.xp)} XP
      </p>

      {aenderbar && !frei && (
        <button
          type="button"
          onClick={onFreischalten}
          disabled={laeuft}
          className="skill-leuchten flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          style={{ backgroundColor: faehigkeit.farbe }}
        >
          <Sparkles className="size-5" />
          {tx('Freischalten · +{xp} XP', { xp: zahl(knoten.xp) })}
        </button>
      )}

      {aenderbar && (
        <Knopf onClick={onKind} disabled={laeuft}>
          <Plus className="size-4" />
          {tx('Darunter anlegen')}
        </Knopf>
      )}
      <Fehlermeldung fehler={fehler} />
    </div>
  );
}

function KnotenFormular({
  faehigkeitId,
  bearbeitung,
  onFertig,
}: {
  faehigkeitId: number;
  bearbeitung: NonNullable<KnotenBearbeitung>;
  onFertig: () => void;
}) {
  const queryClient = useQueryClient();
  const [titel, setTitel] = useState(bearbeitung.knoten?.titel ?? '');
  const [beschreibung, setBeschreibung] = useState(bearbeitung.knoten?.beschreibung ?? '');
  const [titelFehler, setTitelFehler] = useState<string | null>(null);

  const speichern = useMutation({
    mutationFn: () =>
      bearbeitung.knoten
        ? api.aendereKnoten(bearbeitung.knoten.id, { titel, beschreibung })
        : api.erstelleKnoten(faehigkeitId, { titel, beschreibung, elternId: bearbeitung.elternId }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onFertig();
    },
  });

  const absenden = (ereignis: FormEvent) => {
    ereignis.preventDefault();
    if (titel.trim() === '') {
      setTitelFehler('Der Name darf nicht leer sein.');
      return;
    }
    if (speichern.isPending) {
      return;
    }
    setTitelFehler(null);
    speichern.mutate();
  };

  return (
    <Formular onAbsenden={absenden}>
      <Feld label={tx("Titel")} fehler={titelFehler}>
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
        <input
          className={EINGABE_STIL}
          value={beschreibung}
          maxLength={GRENZEN.beschreibungMax}
          onChange={(ereignis) => setBeschreibung(ereignis.target.value)}
        />
      </Feld>
      <Fehlermeldung fehler={speichern.error} />
      <Knopf type="submit" variante="primaer" className="w-full" aria-busy={speichern.isPending || undefined}>
        {tx("Speichern")}
      </Knopf>
    </Formular>
  );
}
