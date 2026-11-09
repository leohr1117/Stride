import { useQuery } from '@tanstack/react-query';
import { Share } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { SCHLUESSEL } from './api/index.ts';
import { Dialog } from './components/Dialog.tsx';
import { Zeile } from './components/Zeile.tsx';
import { angebotIstFaellig } from './features/uebersicht/angebotStand.ts';
import { bewertungIstFaellig } from './features/uebersicht/bewertungStand.ts';
import {
  abonniereInstallation,
  installationAnbieten,
  installAnzeige,
  installGeraet,
  installHinweisWeg,
  laeuftAlsApp,
  liesInstallStand,
  wegklickenInstallHinweis,
  type InstallAnzeige,
  type InstallFall,
  type InstallStand,
} from './pwa.ts';
import { tx } from './text.ts';
import { HinweisZeile } from './ui/index.ts';

function useStand(): InstallStand {
  return useSyncExternalStore(abonniereInstallation, liesInstallStand, liesInstallStand);
}

function anzeigeFuer(
  stand: InstallStand,
  weggeklickt: boolean,
  bewertungSichtbar: boolean,
  hinweisSichtbar: boolean,
): InstallAnzeige {
  const geraet = installGeraet(navigator.userAgent, navigator.maxTouchPoints);
  return installAnzeige({
    laeuftAlsApp: laeuftAlsApp(),
    installiert: stand.installiert,
    ereignis: stand.ereignis,
    ios: geraet.ios,
    mac: geraet.mac,
    weggeklickt,
    bewertungSichtbar,
    hinweisSichtbar,
  });
}

function hinweisSatz(fall: InstallFall): string | null {
  if (fall === 'ios') {
    return tx('Teilen → Zum Home-Bildschirm.');
  }
  if (fall === 'mac') {
    return tx('Ablage → Zum Dock hinzufügen.');
  }
  return null;
}

function InstallSchritte({ fall }: { fall: 'ios' | 'mac' }) {
  if (fall === 'ios') {
    return (
      <ol className="list-inside list-decimal space-y-1 text-sm">
        <li>
          {tx('Tippe auf Teilen.')} <Share className="inline size-4 align-text-bottom" aria-hidden="true" />
        </li>
        <li>{tx('Wähle „Zum Home-Bildschirm“.')}</li>
        <li>{tx('Tippe auf „Hinzufügen“.')}</li>
      </ol>
    );
  }
  return (
    <ol className="list-inside list-decimal space-y-1 text-sm">
      <li>{tx('Öffne in Safari das Menü Ablage.')}</li>
      <li>{tx('Wähle „Zum Dock hinzufügen“.')}</li>
      <li>{tx('Klicke auf „Hinzufügen“.')}</li>
    </ol>
  );
}

export function InstallBanner() {
  const stand = useStand();
  const [weg, setWeg] = useState(() => installHinweisWeg());
  const bewertung = useQuery({
    queryKey: SCHLUESSEL.bewertung,
    queryFn: bewertungIstFaellig,
    initialData: false,
    staleTime: Infinity,
  });
  const angebot = useQuery({
    queryKey: SCHLUESSEL.angebot,
    queryFn: angebotIstFaellig,
    initialData: angebotIstFaellig,
    staleTime: Infinity,
  });
  const bewertungSichtbar = bewertung.data === true;
  const hinweisSichtbar = angebot.data === true && !bewertungSichtbar;
  const anzeige = anzeigeFuer(stand, weg, bewertungSichtbar, hinweisSichtbar);
  if (!anzeige.banner || anzeige.fall === 'nichts') {
    return null;
  }

  const text = tx('Stride als App installieren');
  const weglegen = () => {
    wegklickenInstallHinweis();
    setWeg(true);
  };

  if (anzeige.fall === 'ereignis') {
    return (
      <HinweisZeile
        text={text}
        aktion={{ label: tx('Installieren'), onClick: () => void installationAnbieten() }}
        onSchliessen={weglegen}
      />
    );
  }

  return (
    <HinweisZeile
      text={text}
      detail={{ label: tx('So geht’s'), inhalt: <InstallSchritte fall={anzeige.fall} /> }}
      onSchliessen={weglegen}
    />
  );
}

export function InstallZeile() {
  const stand = useStand();
  const [offen, setOffen] = useState(false);
  const anzeige = anzeigeFuer(stand, false, false, false);
  if (!anzeige.zeile || anzeige.fall === 'nichts') {
    return null;
  }
  const satz = hinweisSatz(anzeige.fall);
  const klick = () => {
    if (anzeige.fall === 'ereignis') {
      void installationAnbieten();
      return;
    }
    setOffen(true);
  };
  return (
    <>
      <Zeile titel={tx('Als App installieren')} onKlick={klick} />
      {satz ? (
        <Dialog offen={offen} titel={tx('Als App installieren')} onSchliessen={() => setOffen(false)}>
          <p className="text-base">{satz}</p>
        </Dialog>
      ) : null}
    </>
  );
}
