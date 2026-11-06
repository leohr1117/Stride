import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import type { HinweisStand } from '../../../../shared/api/hinweise.ts';
import { UHRZEIT_FORMAT, UHRZEIT_MUSTER } from '../../../../shared/spiel/aufgabe.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import type { HinweisAboKoerper, HinweisWahl } from '../../api/hinweise.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { Zeile, ZeileSchalter, ZeilenGruppe } from '../../components/Zeile.tsx';
import { useSichtbarkeit } from '../../funktionen.ts';
import { tx } from '../../text.ts';
import { EINGABE_STIL, Fehlermeldung, Feld, Formular, Knopf, Ladeanzeige } from '../../ui/index.ts';
import { einschaltKlick, iosOhneApp, schluesselBytes, type HinweisBerechtigung, type HinweisGeraet } from './hinweisGeraet.ts';
import { Bereich } from './rahmen.tsx';

/** Abbrechen geht denselben Weg wie Esc, damit ein geändertes Blatt nachfragt. */
function schliessenWieEsc(): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
}

function leseGeraet(): HinweisGeraet {
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
  const berechtigung: HinweisBerechtigung = typeof Notification === 'undefined' ? 'fehlt' : Notification.permission;
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone,
    berechtigung,
  };
}

function uhr(wert: string): string | null {
  const kurz = wert.trim().slice(0, 5);
  return UHRZEIT_MUSTER.test(kurz) ? kurz : null;
}

async function leseAbo(schluessel: string): Promise<HinweisAboKoerper> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Etwas ist schiefgelaufen.');
  }
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    throw new Error('Etwas ist schiefgelaufen.');
  }
  const vorhanden = await registration.pushManager.getSubscription();
  const abo = vorhanden ?? (await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: schluesselBytes(schluessel),
  }));
  const schluesselPaar = abo.toJSON().keys;
  if (!schluesselPaar?.p256dh || !schluesselPaar.auth) {
    throw new Error('Etwas ist schiefgelaufen.');
  }
  return { endpoint: abo.endpoint, p256dh: schluesselPaar.p256dh, auth: schluesselPaar.auth };
}

export function MehrBenachrichtigungenSeite() {
  const abfrage = useQuery({ queryKey: SCHLUESSEL.hinweise, queryFn: api.hinweise });
  if (abfrage.isPending) {
    return <Bereich titel="Benachrichtigungen" kinder={<Ladeanzeige />} />;
  }
  if (abfrage.error || !abfrage.data) {
    return <Bereich titel="Benachrichtigungen" kinder={<Fehlermeldung fehler={abfrage.error} />} />;
  }
  return <Inhalt stand={abfrage.data} />;
}

function Inhalt({ stand }: { stand: HinweisStand }) {
  const queryClient = useQueryClient();
  const bosseAn = istAn('bossAngriffe', useSichtbarkeit());
  const [geraet, setGeraet] = useState(leseGeraet);
  const [laeuft, setLaeuft] = useState(false);
  const [aktionFehler, setAktionFehler] = useState<unknown>(null);
  const [ruheOffen, setRuheOffen] = useState(false);
  const [von, setVon] = useState(stand.ruheVon);
  const [bis, setBis] = useState(stand.ruheBis);
  const [feldFehler, setFeldFehler] = useState<{ von?: string; bis?: string }>({});
  const eigenes = useRef<string | null>(null);
  const angemeldet = stand.angemeldet;
  const schluessel = stand.oeffentlicherSchluessel;
  const entscheidung = einschaltKlick(geraet, schluessel);
  const knopfAus = !angemeldet && entscheidung === 'gesperrt';
  const iosHinweis = !angemeldet && Boolean(schluessel) && iosOhneApp(geraet);
  const zeile = angemeldet
    ? tx('Eingeschaltet. Eine Benachrichtigung am Tag.')
    : !schluessel
      ? tx('Benachrichtigungen sind auf diesem Server nicht eingerichtet.')
      : geraet.berechtigung === 'denied'
        ? tx('Aus. Die Erlaubnis ist abgelehnt. Heute bleibt nutzbar.')
        : null;

  const wahl = useMutation({
    mutationFn: (teil: HinweisWahl) => api.hinweisWahl(teil),
    onMutate: async (teil) => {
      await queryClient.cancelQueries({ queryKey: SCHLUESSEL.hinweise });
      const bisher = queryClient.getQueryData<HinweisStand>(SCHLUESSEL.hinweise);
      if (bisher) {
        queryClient.setQueryData<HinweisStand>(SCHLUESSEL.hinweise, { ...bisher, ...teil });
      }
      return { bisher };
    },
    onError: (_fehler, _teil, kontext) => {
      if (kontext?.bisher) {
        queryClient.setQueryData(SCHLUESSEL.hinweise, kontext.bisher);
      }
    },
    onSuccess: (neu) => {
      queryClient.setQueryData(SCHLUESSEL.hinweise, neu);
    },
  });

  const ruhe = useMutation({
    mutationFn: (zeiten: { ruheVon: string; ruheBis: string }) => api.hinweisWahl(zeiten),
    onSuccess: (neu) => {
      queryClient.setQueryData(SCHLUESSEL.hinweise, neu);
      setFeldFehler({});
      setRuheOffen(false);
    },
  });

  async function einschalten(): Promise<void> {
    const klick = einschaltKlick(geraet, schluessel);
    if (klick === 'gesperrt' || klick === 'still' || !schluessel) {
      return;
    }
    setAktionFehler(null);
    setLaeuft(true);
    try {
      if (klick === 'fragen') {
        const erlaubnis = await Notification.requestPermission();
        setGeraet((bisher) => ({ ...bisher, berechtigung: erlaubnis }));
        if (erlaubnis !== 'granted') {
          return;
        }
      }
      const koerper = await leseAbo(schluessel);
      eigenes.current = koerper.endpoint;
      queryClient.setQueryData(SCHLUESSEL.hinweise, await api.hinweisAbo(koerper));
    } catch (fehler) {
      setAktionFehler(fehler);
    } finally {
      setLaeuft(false);
    }
  }

  async function ausschalten(): Promise<void> {
    setAktionFehler(null);
    setLaeuft(true);
    try {
      let endpoint = eigenes.current;
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        const abo = await registration?.pushManager.getSubscription();
        if (abo) {
          endpoint = abo.endpoint;
          eigenes.current = endpoint;
          await abo.unsubscribe();
        }
      }
      if (!endpoint) {
        return;
      }
      queryClient.setQueryData(SCHLUESSEL.hinweise, await api.hinweisAboWeg(endpoint));
      eigenes.current = null;
    } catch (fehler) {
      setAktionFehler(fehler);
    } finally {
      setLaeuft(false);
    }
  }

  function oeffneRuhe(): void {
    setVon(stand.ruheVon);
    setBis(stand.ruheBis);
    setFeldFehler({});
    ruhe.reset();
    setRuheOffen(true);
  }

  function speichereRuhe(ereignis: FormEvent<HTMLFormElement>): void {
    ereignis.preventDefault();
    const ruheVon = uhr(von);
    const ruheBis = uhr(bis);
    const naechster = {
      von: ruheVon ? undefined : UHRZEIT_FORMAT,
      bis: ruheBis ? undefined : UHRZEIT_FORMAT,
    };
    if (!ruheVon || !ruheBis) {
      setFeldFehler(naechster);
      return;
    }
    setFeldFehler({});
    ruhe.mutate({ ruheVon, ruheBis });
  }

  return (
    <Bereich
      titel="Benachrichtigungen"
      kinder={
        <>
          <Fehlermeldung fehler={aktionFehler || wahl.error} />
          <ZeilenGruppe>
            <ZeileSchalter
              id="hinweis-geraet"
              titel={tx('Auf diesem Gerät')}
              an={angemeldet}
              deaktiviert={knopfAus || laeuft}
              onAendern={(an) => void (an ? einschalten() : ausschalten())}
            />
          </ZeilenGruppe>
          {iosHinweis || zeile ? (
            <div className="space-y-1">
              {iosHinweis ? (
                <p className="text-[13px] leading-[18px] text-leise">
                  {tx('Auf dem iPhone nur aus der App auf dem Home-Bildschirm.')}
                </p>
              ) : null}
              {zeile ? <p className="text-sm break-words text-leise">{zeile}</p> : null}
            </div>
          ) : null}
          <ZeilenGruppe titel={tx('Arten')}>
            <ZeileSchalter
              id="hinweis-streak"
              titel={tx('Streak in Gefahr')}
              an={stand.streak}
              deaktiviert={!angemeldet || wahl.isPending}
              onAendern={(an) => wahl.mutate({ streak: an })}
            />
            {bosseAn ? (
              <ZeileSchalter
                id="hinweis-boss"
                titel={tx('Boss einen Tag vorher')}
                an={stand.boss}
                deaktiviert={!angemeldet || wahl.isPending}
                onAendern={(an) => wahl.mutate({ boss: an })}
              />
            ) : null}
            <ZeileSchalter
              id="hinweis-rueckkehr"
              titel={tx('Rückkehr geht auf')}
              an={stand.rueckkehr}
              deaktiviert={!angemeldet || wahl.isPending}
              onAendern={(an) => wahl.mutate({ rueckkehr: an })}
            />
          </ZeilenGruppe>
          <ZeilenGruppe>
            <Zeile
              titel={tx('Ruhezeit')}
              wert={`${stand.ruheVon}–${stand.ruheBis}`}
              onKlick={angemeldet ? oeffneRuhe : undefined}
              pfeil={angemeldet ? undefined : false}
              deaktiviert={!angemeldet}
            />
          </ZeilenGruppe>
          <Dialog offen={ruheOffen} titel={tx('Ruhezeit')} onSchliessen={() => setRuheOffen(false)}>
            <Formular onAbsenden={speichereRuhe}>
              <Feld label={tx('Ruhe von')} fehler={feldFehler.von}>
                <input
                  type="time"
                  name="von"
                  value={von}
                  step={60}
                  onChange={(ereignis) => {
                    setVon(ereignis.target.value);
                    setFeldFehler((bisher) => ({ ...bisher, von: undefined }));
                  }}
                  className={EINGABE_STIL}
                />
              </Feld>
              <Feld label={tx('Ruhe bis')} fehler={feldFehler.bis}>
                <input
                  type="time"
                  name="bis"
                  value={bis}
                  step={60}
                  onChange={(ereignis) => {
                    setBis(ereignis.target.value);
                    setFeldFehler((bisher) => ({ ...bisher, bis: undefined }));
                  }}
                  className={EINGABE_STIL}
                />
              </Feld>
              <Fehlermeldung fehler={ruhe.error} />
              <div className="dialog-aktionen">
                <Knopf type="button" onClick={schliessenWieEsc}>
                  {tx('Abbrechen')}
                </Knopf>
                <Knopf type="submit" variante="primaer" aria-busy={ruhe.isPending || undefined}>
                  {tx('Speichern')}
                </Knopf>
              </div>
            </Formular>
          </Dialog>
        </>
      }
    />
  );
}
