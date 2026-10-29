import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import type { HinweisStand } from '../../../../shared/api/hinweise.ts';
import { UHRZEIT_MUSTER } from '../../../../shared/spiel/aufgabe.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import type { HinweisAboKoerper, HinweisWahl } from '../../api/hinweise.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { ZeileSchalter, ZeilenGruppe } from '../../components/Zeile.tsx';
import { tx } from '../../text.ts';
import { EINGABE_STIL, Fehlermeldung, Feld, Formular, InfoHinweis, Karte, Knopf, Ladeanzeige } from '../../ui/index.ts';
import { einschaltKlick, iosOhneApp, schluesselBytes, type HinweisBerechtigung, type HinweisGeraet } from './hinweisGeraet.ts';
import { Bereich } from './rahmen.tsx';

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
  const [geraet, setGeraet] = useState(leseGeraet);
  const [laeuft, setLaeuft] = useState(false);
  const [aktionFehler, setAktionFehler] = useState<unknown>(null);
  const [ruheOffen, setRuheOffen] = useState(false);
  const [von, setVon] = useState(stand.ruheVon);
  const [bis, setBis] = useState(stand.ruheBis);
  const [formFehler, setFormFehler] = useState(false);
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
      setFormFehler(false);
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
    setFormFehler(false);
    ruhe.reset();
    setRuheOffen(true);
  }

  function speichereRuhe(ereignis: FormEvent<HTMLFormElement>): void {
    ereignis.preventDefault();
    const ruheVon = uhr(von);
    const ruheBis = uhr(bis);
    if (!ruheVon || !ruheBis) {
      setFormFehler(true);
      return;
    }
    setFormFehler(false);
    ruhe.mutate({ ruheVon, ruheBis });
  }

  const zuerst = tx('Zuerst einschalten.');

  return (
    <Bereich
      titel="Benachrichtigungen"
      kinder={
        <>
          <Fehlermeldung fehler={aktionFehler || wahl.error} />
          <div>
            <div data-hinweis-knopf className="flex items-center">
              <Knopf
                variante={angemeldet ? 'sekundaer' : 'primaer'}
                className="min-h-11 max-w-full"
                disabled={knopfAus || laeuft}
                onClick={() => void (angemeldet ? ausschalten() : einschalten())}
              >
                {angemeldet ? tx('Benachrichtigungen ausschalten') : tx('Benachrichtigungen einschalten')}
              </Knopf>
              {iosHinweis ? (
                <InfoHinweis text={tx('Auf dem iPhone nur aus der App auf dem Home-Bildschirm. Im Safari-Tab bleibt der Knopf aus.')} />
              ) : null}
            </div>
            {zeile ? <p className="mt-2 text-sm break-words text-leise">{zeile}</p> : null}
          </div>
          <ZeilenGruppe titel={tx('Arten')}>
            <ZeileSchalter
              id="hinweis-streak"
              titel={tx('Streak in Gefahr')}
              info={angemeldet ? tx('Am angeschlagenen Tag, einmal. Der Text bittet um einen Eintrag.') : zuerst}
              an={stand.streak}
              deaktiviert={!angemeldet || wahl.isPending}
              onAendern={(an) => wahl.mutate({ streak: an })}
            />
            <ZeileSchalter
              id="hinweis-boss"
              titel={tx('Boss-Datum')}
              info={angemeldet ? tx('Einen Tag vorher, nur wenn Bosse an sind. Der Sieg bleibt in der App.') : zuerst}
              an={stand.boss}
              deaktiviert={!angemeldet || wahl.isPending}
              onAendern={(an) => wahl.mutate({ boss: an })}
            />
            <ZeileSchalter
              id="hinweis-rueckkehr"
              titel={tx('Rückkehr')}
              info={angemeldet ? tx('Einmal, wenn die Rückkehr aufgeht.') : zuerst}
              an={stand.rueckkehr}
              deaktiviert={!angemeldet || wahl.isPending}
              onAendern={(an) => wahl.mutate({ rueckkehr: an })}
            />
          </ZeilenGruppe>
          <section>
            <div className="mb-2 flex min-w-0 items-center">
              <h2 className="min-w-0 text-sm font-medium break-words text-leise">{tx('Ruhezeit')}</h2>
              <InfoHinweis text={tx('In dieser Zeit geht nichts raus. Danach höchstens eine Benachrichtigung, wenn sie noch stimmt.')} />
            </div>
            <Karte dicht>
              <div className={`flex min-h-12 items-center gap-3 px-4 ${angemeldet ? '' : 'opacity-60'}`}>
                <span className="zahl min-w-0 flex-1 text-sm">
                  {stand.ruheVon} – {stand.ruheBis}
                </span>
                {angemeldet ? (
                  <button type="button" className="min-h-11 shrink-0 px-1 text-sm text-leise" onClick={oeffneRuhe}>
                    {tx('Bearbeiten')}
                  </button>
                ) : null}
              </div>
            </Karte>
          </section>
          <Dialog offen={ruheOffen} titel={tx('Ruhezeit')} onSchliessen={() => setRuheOffen(false)}>
            <Formular onAbsenden={speichereRuhe}>
              <Feld label={tx('Von')}>
                <input
                  type="time"
                  name="von"
                  value={von}
                  step={60}
                  onChange={(ereignis) => {
                    setVon(ereignis.target.value);
                    setFormFehler(false);
                  }}
                  className={`${EINGABE_STIL} min-h-11`}
                />
              </Feld>
              <Feld label={tx('Bis')}>
                <input
                  type="time"
                  name="bis"
                  value={bis}
                  step={60}
                  onChange={(ereignis) => {
                    setBis(ereignis.target.value);
                    setFormFehler(false);
                  }}
                  className={`${EINGABE_STIL} min-h-11`}
                />
              </Feld>
              <Fehlermeldung fehler={formFehler || ruhe.error} />
              <Knopf type="submit" variante="primaer" className="w-full" disabled={ruhe.isPending}>
                {tx('Speichern')}
              </Knopf>
            </Formular>
          </Dialog>
        </>
      }
    />
  );
}
