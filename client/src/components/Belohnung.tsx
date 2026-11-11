import { attributName, tx } from '../text.ts';
import { useQuery } from '@tanstack/react-query';
import { animate, AnimatePresence, motion, useMotionValue, type PanInfo } from 'framer-motion';
import { Award, ChevronUp, CircleCheck, Swords, Trophy, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import type { Belohnung, LevelAufstieg } from '../../../shared/api/index.ts';
import { istAn, type Sichtbarkeit } from '../../../shared/spiel/sichtbarkeit.ts';
import { api, SCHLUESSEL } from '../api/index.ts';
import { mitVorzeichen, multiplikatorText, zahl } from '../format.ts';
import { spieleLevelSound, spieleXpSound } from '../sound.ts';
import { Knopf } from '../ui/index.ts';
import { useDialogVerlauf, useFokusKreis } from './Dialog.tsx';

function istProjektAbschluss(belohnung: Belohnung): boolean {
  return belohnung.boni.some((bonus) => bonus.quelle === 'abschluss');
}

const MELDUNG_BASIS_MS = 3200;
const MELDUNG_PRO_BONUS_MS = 700;
const LEVEL_VERZOEGERUNG_MS = 900;
const STAPEL_SICHTBAR = 3;
const STAPEL_VERSATZ_PX = 10;
const STAPEL_VERKLEINERUNG = 0.05;
const WISCHEN_SCHWELLE_PX = 80;
const WISCHEN_TEMPO_SCHWELLE = 500;
const WISCHEN_WEG_PX = 420;

interface Meldung {
  id: number;
  belohnung: Belohnung;
}

const BelohnungKontext = createContext<((belohnung: Belohnung) => void) | null>(null);

function sichtbareBelohnung(belohnung: Belohnung, sichtbarkeit: Sichtbarkeit): Belohnung {
  const projektAn = istAn('projekte', sichtbarkeit);
  const faehigkeitenAn = istAn('faehigkeiten', sichtbarkeit);
  return {
    ...belohnung,
    projekt: projektAn ? belohnung.projekt : null,
    faehigkeit: faehigkeitenAn ? belohnung.faehigkeit : null,
    boss: istAn('bossAngriffe', sichtbarkeit) ? belohnung.boss : null,
    erfolge: sichtbarkeit.funktionen.erfolge ? belohnung.erfolge : [],
    aufstiege: belohnung.aufstiege.filter((aufstieg) => {
      if (aufstieg.art === 'projekt') {
        return projektAn;
      }
      if (aufstieg.art === 'organisation') {
        return istAn('organisationen', sichtbarkeit);
      }
      if (aufstieg.art === 'faehigkeit') {
        return faehigkeitenAn;
      }
      if (aufstieg.art === 'attribut') {
        return istAn('koennen', sichtbarkeit);
      }
      if (aufstieg.art === 'status') {
        return istAn('status', sichtbarkeit);
      }
      return true;
    }),
  };
}

export function useFeiern(): (belohnung: Belohnung) => void {
  const feiern = useContext(BelohnungKontext);
  if (!feiern) {
    throw new Error('useFeiern muss innerhalb von <BelohnungProvider> verwendet werden.');
  }
  return feiern;
}

export function BelohnungProvider({ children }: { children: ReactNode }) {
  const { data: einstellungen } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const [meldungen, setMeldungen] = useState<Meldung[]>([]);
  const [aufstiege, setAufstiege] = useState<LevelAufstieg[] | null>(null);
  const naechsteId = useRef(0);
  const timer = useRef<number[]>([]);
  const soundAn = einstellungen?.sound ?? true;

  useEffect(() => {
    const aktiveTimer = timer.current;
    return () => {
      for (const id of aktiveTimer) {
        window.clearTimeout(id);
      }
    };
  }, []);

  const planen = useCallback((aktion: () => void, verzoegerung: number) => {
    timer.current.push(window.setTimeout(aktion, verzoegerung));
  }, []);

  const entferne = useCallback((id: number) => {
    setMeldungen((aktuelle) => aktuelle.filter((meldung) => meldung.id !== id));
  }, []);

  const feiern = useCallback(
    (belohnung: Belohnung) => {
      const sichtbar = einstellungen ? sichtbareBelohnung(belohnung, einstellungen) : belohnung;
      const id = naechsteId.current++;
      const dauer = MELDUNG_BASIS_MS + sichtbar.boni.length * MELDUNG_PRO_BONUS_MS;
      setMeldungen((aktuelle) => [...aktuelle, { id, belohnung: sichtbar }]);
      planen(() => entferne(id), dauer);
      if (soundAn) {
        spieleXpSound(sichtbar.meilenstein || sichtbar.erfolge.length > 0 || istProjektAbschluss(sichtbar));
      }

      if (sichtbar.aufstiege.length > 0) {
        planen(() => {
          setAufstiege(sichtbar.aufstiege);
          if (soundAn) {
            spieleLevelSound();
          }
        }, LEVEL_VERZOEGERUNG_MS);
      }
    },
    [einstellungen, entferne, planen, soundAn],
  );

  return (
    <BelohnungKontext.Provider value={feiern}>
      {children}
      <XpMeldungen meldungen={meldungen} onEntfernen={entferne} />
      <LevelAufstiegAnzeige aufstiege={aufstiege} onSchliessen={() => setAufstiege(null)} />
    </BelohnungKontext.Provider>
  );
}

function XpMeldungen({ meldungen, onEntfernen }: { meldungen: Meldung[]; onEntfernen: (id: number) => void }) {
  const neuesteZuerst = [...meldungen].reverse();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      <div className="relative w-full max-w-sm">
        <AnimatePresence initial={false} mode="popLayout">
          {neuesteZuerst.map((meldung, index) => (
            <XpMeldung
              key={meldung.id}
              belohnung={meldung.belohnung}
              stapelPlatz={index}
              onEntfernen={() => onEntfernen(meldung.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function XpMeldung({
  ref,
  belohnung,
  stapelPlatz,
  onEntfernen,
}: {
  ref?: Ref<HTMLDivElement>;
  belohnung: Belohnung;
  stapelPlatz: number;
  onEntfernen: () => void;
}) {
  const x = useMotionValue(0);
  const vorne = stapelPlatz === 0;

  const beiWischEnde = (_ereignis: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const weggewischt =
      Math.abs(info.offset.x) > WISCHEN_SCHWELLE_PX || Math.abs(info.velocity.x) > WISCHEN_TEMPO_SCHWELLE;
    if (!weggewischt) {
      void animate(x, 0, { type: 'spring', stiffness: 500, damping: 35 });
      return;
    }
    const richtung = Math.sign(info.offset.x || info.velocity.x);
    void animate(x, richtung * WISCHEN_WEG_PX, { duration: 0.18 }).then(onEntfernen);
  };

  return (
    <motion.div
      ref={ref}
      className={`belohnung w-full rounded-2xl border bg-flaeche/95 shadow-xl backdrop-blur ${
        vorne ? 'pointer-events-auto relative' : 'pointer-events-none absolute inset-0 overflow-hidden'
      } ${belohnung.meilenstein || istProjektAbschluss(belohnung) ? 'border-xp/60' : 'border-rand'}`}
      style={{ x, zIndex: STAPEL_SICHTBAR - stapelPlatz, transformOrigin: 'bottom center' }}
      initial={{ opacity: 0, y: -24, scale: 0.9 }}
      animate={{
        opacity: stapelPlatz < STAPEL_SICHTBAR ? 1 : 0,
        y: stapelPlatz * STAPEL_VERSATZ_PX,
        scale: 1 - stapelPlatz * STAPEL_VERKLEINERUNG,
      }}
      exit={{ opacity: 0, y: -12, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      drag={vorne ? 'x' : false}
      dragMomentum={false}
      onDragEnd={beiWischEnde}
    >
      <motion.div animate={{ opacity: vorne ? 1 : 0 }} transition={{ duration: 0.15 }}>
        <MeldungInhalt belohnung={belohnung} />
      </motion.div>
      {vorne && (
        <button
          type="button"
          onClick={onEntfernen}
          aria-label={tx("Schließen")}
          className="absolute top-1 right-1 flex size-12 items-center justify-center rounded-full text-leise transition hover:bg-flaeche-2 hover:text-haupt"
        >
          <X className="size-4" />
        </button>
      )}
    </motion.div>
  );
}

function MeldungInhalt({ belohnung }: { belohnung: Belohnung }) {
  const boni = belohnung.boni.filter((bonus) => bonus.quelle !== 'beute');
  const hatZusatz = boni.length > 0 || belohnung.multiplikatoren.length > 0 || belohnung.projekt !== null || belohnung.faehigkeit !== null;
  return (
    <div className="px-5 py-3">
      {(belohnung.meilenstein || istProjektAbschluss(belohnung)) && (
        <p className="mb-1 flex items-center justify-center gap-1.5 text-xs font-semibold tracking-[0.15em] text-xp uppercase">
          {istProjektAbschluss(belohnung) ? <CircleCheck className="size-4" /> : <Trophy className="size-4" />}
          {istProjektAbschluss(belohnung) ? tx('Geschafft') : tx('Meilenstein')}
        </p>
      )}
      <div className="flex items-center justify-center gap-2">
        <motion.span
          className="zahl text-2xl font-bold text-xp"
          initial={{ scale: 0.6 }}
          animate={{ scale: [0.6, 1.25, 1] }}
          transition={{ duration: 0.45 }}
        >
          +{zahl(belohnung.xp > 0 ? belohnung.xp : (belohnung.faehigkeit?.xp ?? 0))} XP
        </motion.span>
      </div>

      <div className="mt-1.5 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-leise">
        {belohnung.anteile.map((anteil) => (
          <span key={anteil.attributId} className={`flex items-center gap-1 ${anteil.xp < 0 ? 'text-gefahr' : ''}`}>
            <span className="size-2 rounded-full" style={{ backgroundColor: anteil.farbe }} />
            {attributName({ name: anteil.name })} {mitVorzeichen(anteil.xp)}
          </span>
        ))}
        {belohnung.abzugBeiNull?.map((eintrag) => (
          <span key={`null-${eintrag.name}`} className="flex items-center gap-1 text-leise">
            <span className="size-2 rounded-full" style={{ backgroundColor: eintrag.farbe }} />
            {attributName({ name: eintrag.name })} {tx('schon bei 0')}
          </span>
        ))}
      </div>

      {belohnung.boss && <BossTreffer boss={belohnung.boss} />}

      {belohnung.erfolge.map((erfolg) => (
        <p
          key={erfolg}
          className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-xp/10 py-1 text-xs font-semibold text-xp"
        >
          <Award className="size-4" />
          {tx('Erfolg: {name}', { name: tx(erfolg) })}
        </p>
      ))}

      {hatZusatz && (
        <ul className="mt-2.5 space-y-1 border-t border-rand pt-2 text-xs">
          {belohnung.multiplikatoren.map((multiplikator, index) => {
            const text = multiplikatorText(multiplikator);
            return (
              <li key={`${multiplikator.art}-${index}`} className="flex justify-between gap-3">
                <span>{text.label}</span>
                <span className={`zahl font-semibold ${multiplikator.faktor < 1 ? 'text-gefahr' : 'text-xp'}`}>
                  {text.wert}
                </span>
              </li>
            );
          })}
          {boni.map((bonus, index) => (
            <motion.li
              key={`${bonus.quelle}-${index}`}
              className="flex justify-between gap-3"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + index * 0.15 }}
            >
              <span className="min-w-0 break-words">
                {bonus.quelle === 'abschluss' ? tx('Projekt abgeschlossen') : bonus.label}
              </span>
              <span className="zahl font-semibold text-xp">+{zahl(bonus.xp)}</span>
            </motion.li>
          ))}
          {belohnung.projekt && (
            <li className="flex justify-between gap-3 text-leise">
              <span className="min-w-0 break-words">{tx('Erfahrung in {name}', { name: belohnung.projekt.name })}</span>
              <span className="zahl">+{zahl(belohnung.projekt.xp)}</span>
            </li>
          )}
          {belohnung.faehigkeit && (
            <li className="flex justify-between gap-3 text-leise">
              <span>{belohnung.faehigkeit.name}</span>
              <span className="zahl">+{zahl(belohnung.faehigkeit.xp)}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function BossTreffer({ boss }: { boss: NonNullable<Belohnung['boss']> }) {
  return (
    <div className="mt-2.5 border-t border-rand pt-2 text-xs">
      <p className="flex min-w-0 items-center gap-1.5 font-medium">
        <Swords className="size-3.5 shrink-0 text-gefahr" />
        <span className="truncate">{boss.titel}</span>
      </p>
    </div>
  );
}

function aufstiegTitel(aufstieg: LevelAufstieg): string {
  switch (aufstieg.art) {
    case 'charakter':
      return tx("Du bist gewachsen");
    case 'projekt':
      return tx('Mehr Erfahrung in {name}', { name: aufstieg.name });
    case 'organisation':
      return tx('Mehr Ansehen bei {name}', { name: aufstieg.name });
    case 'faehigkeit':
      return tx('{name} sitzt besser', { name: aufstieg.name });
    default:
      return tx('{name} wird stärker', { name: aufstieg.name });
  }
}

function LevelAufstiegAnzeige({
  aufstiege,
  onSchliessen,
}: {
  aufstiege: LevelAufstieg[] | null;
  onSchliessen: () => void;
}) {
  const haupt = aufstiege?.find((aufstieg) => aufstieg.art === 'charakter') ?? aufstiege?.[0];
  const weitere = aufstiege?.filter((aufstieg) => aufstieg !== haupt) ?? [];
  const hauptFarbe = haupt?.farbe ?? 'var(--akzent)';
  const fensterRef = useRef<HTMLDivElement>(null);
  const aktiv = Boolean(aufstiege && haupt);
  const titel = haupt ? aufstiegTitel(haupt) : '';
  useDialogVerlauf(aktiv, onSchliessen);
  useFokusKreis(aktiv, fensterRef);

  return createPortal(
    <AnimatePresence>
      {aufstiege && haupt && (
        <motion.div
          className="dialog-scrim fixed inset-0 z-[70] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onSchliessen}
        >
          <motion.div
            ref={fensterRef}
            role="dialog"
            aria-modal="true"
            aria-label={titel}
            tabIndex={-1}
            className="w-full max-w-sm rounded-[12px] border border-rand bg-flaeche p-8 text-center shadow-2xl"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            onClick={(ereignis) => ereignis.stopPropagation()}
          >
            <motion.div
              className="mx-auto flex size-28 items-center justify-center rounded-full"
              style={{ background: `radial-gradient(circle, color-mix(in srgb, ${hauptFarbe} 35%, transparent) 0%, transparent 70%)` }}
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <motion.span
                className="zahl text-6xl font-black"
                style={{ color: hauptFarbe }}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 15 }}
              >
                {haupt.nachher}
              </motion.span>
            </motion.div>
            <p className="mt-4 flex items-center justify-center gap-1 text-xs font-semibold tracking-[0.2em] text-leise uppercase">
              <ChevronUp className="size-4" />
              {tx("Level aufgestiegen")}
            </p>
            <h2 className="mt-1 text-2xl font-bold">{aufstiegTitel(haupt)}</h2>
            {weitere.length > 0 && (
              <ul className="mt-5 space-y-2">
                {weitere.map((aufstieg) => (
                  <li
                    key={`${aufstieg.art}-${aufstieg.name}`}
                    className="flex items-center justify-between rounded-xl bg-flaeche-2 px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: aufstieg.farbe ?? 'var(--akzent)' }} />
                      {aufstieg.art === 'attribut' || aufstieg.art === 'status'
                        ? attributName({ name: aufstieg.name })
                        : aufstieg.name}
                    </span>
                    <span className="zahl font-semibold">
                      {aufstieg.vorher} → {aufstieg.nachher}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Knopf variante="primaer" className="mt-6 w-full" autoFocus onClick={onSchliessen}>
              {tx("Weiter")}
            </Knopf>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
