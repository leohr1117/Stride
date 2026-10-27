export const TASTATUR_SCHWELLE = 120;

export interface SichtMasse {
  oben: number;
  hoehe: number;
  /** Überdeckung durch die Tastatur. Browser-Leisten unter der Schwelle zählen nicht. */
  tastatur: number;
}

/** Layout-Höhe minus sichtbares Fenster. Desktop und ein schrumpfendes Layout ergeben 0. */
export function sichtMasse(layoutHoehe: number, offsetOben: number, sichtHoehe: number): SichtMasse {
  const oben = Math.max(0, Math.round(offsetOben));
  const hoehe = Math.max(0, Math.round(sichtHoehe));
  const roh = Math.max(0, Math.round(layoutHoehe) - hoehe - oben);
  return { oben, hoehe, tastatur: roh > TASTATUR_SCHWELLE ? roh : 0 };
}

declare global {
  interface Window {
    /** Playwright hat keine Bildschirmtastatur. Der Test setzt die Maße, der Beobachter liest sie. */
    __strideSicht?: SichtMasse | null;
  }
}

function wende(masse: SichtMasse): void {
  const wurzel = document.documentElement;
  wurzel.style.setProperty('--sicht-oben', `${masse.oben}px`);
  wurzel.style.setProperty('--sicht-hoehe', `${masse.hoehe}px`);
  wurzel.style.setProperty('--tastatur', `${masse.tastatur}px`);
  if (masse.tastatur > 0) {
    wurzel.dataset.tastatur = 'an';
  } else {
    delete wurzel.dataset.tastatur;
  }
}

function lies(): SichtMasse {
  const vorgabe = window.__strideSicht;
  if (vorgabe) {
    return sichtMasse(vorgabe.oben + vorgabe.hoehe + vorgabe.tastatur, vorgabe.oben, vorgabe.hoehe);
  }
  const sicht = window.visualViewport;
  if (!sicht) {
    return sichtMasse(window.innerHeight, 0, window.innerHeight);
  }
  return sichtMasse(window.innerHeight, sicht.offsetTop, sicht.height);
}

let aktiv = false;
let rahmen = 0;

/** Hält Dialoge und Speicher-Zeilen im sichtbaren Bereich, auch bei offener Tastatur. */
export function beobachteSichtfeld(): void {
  if (aktiv) {
    return;
  }
  aktiv = true;
  const setzen = () => wende(lies());
  const planen = () => {
    if (rahmen !== 0) {
      return;
    }
    rahmen = window.requestAnimationFrame(() => {
      rahmen = 0;
      setzen();
    });
  };
  setzen();
  window.visualViewport?.addEventListener('resize', planen);
  window.visualViewport?.addEventListener('scroll', planen);
  window.addEventListener('resize', planen);
}
