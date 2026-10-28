import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { bedeutungsfarben } from '../../../../shared/features/darstellung/bedeutung.ts';
import { istHexFarbe, normaleHex } from '../../../../shared/spiel/farben.ts';
import { erscheinungAus, standardVorlage, type Farbtrio } from '../../../../shared/features/darstellung/paletten.ts';
import { gelesenerStil, STANDARD_STIL, type Stil } from '../../../../shared/features/darstellung/stile.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { leseText, merkeText } from '../../speicher.ts';

const SPEICHER_SCHLUESSEL = 'ascend.stil';
const PRIMAER_SCHLUESSEL = 'ascend.primaer';
const AKZENT_SCHLUESSEL = 'ascend.akzent';
const HINTERGRUND_SCHLUESSEL = 'ascend.hintergrund';
const GLIMM_SCHLUESSEL = 'ascend.glimmen';
const THEME_FARBE = 'meta[name="theme-color"]';

export interface Farbwahl extends Farbtrio {
  glimmen?: boolean;
}

const LADER: Record<Stil, () => Promise<unknown>> = {
  standard: () => import('./stil-standard.css'),
  minimal: () => import('./stil-minimal.css'),
  jade: () => import('./stil-jade.css'),
  holo: () => import('./stil-holo.css'),
  antik: () => import('./stil-antik.css'),
};

let angewendet: Stil | null = null;
let letzteAnfrage = 0;

export function gespeicherterStil(): Stil {
  return gelesenerStil(leseText(SPEICHER_SCHLUESSEL)) ?? STANDARD_STIL;
}

export function gespeichertesGlimmen(): boolean {
  return leseText(GLIMM_SCHLUESSEL) !== 'aus';
}

export function gespeicherteFarben(): Farbtrio | null {
  const primaer = leseText(PRIMAER_SCHLUESSEL);
  const akzent = leseText(AKZENT_SCHLUESSEL);
  const hintergrund = leseText(HINTERGRUND_SCHLUESSEL);
  if (!istHexFarbe(primaer) || !istHexFarbe(akzent) || !istHexFarbe(hintergrund)) {
    return null;
  }
  return { primaer: normaleHex(primaer), akzent: normaleHex(akzent), hintergrund: normaleHex(hintergrund) };
}

function systemDunkel(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function setzeThemeFarbe(): void {
  const farbe = getComputedStyle(document.documentElement).getPropertyValue('--grund').trim();
  if (farbe === '') {
    return;
  }
  for (const meta of document.querySelectorAll<HTMLMetaElement>(THEME_FARBE)) {
    const dunkel = meta.media.includes('dark');
    if (dunkel === systemDunkel()) {
      meta.content = farbe;
    }
  }
}

export function wendeErscheinung(wahl: Farbwahl): void {
  const bild = erscheinungAus(wahl);
  const wurzel = document.documentElement;
  const flaechen = bild.flaechen;
  wurzel.style.setProperty('--grund', bild.hintergrund);
  wurzel.style.setProperty('--flaeche', flaechen.flaeche);
  wurzel.style.setProperty('--flaeche-2', flaechen.flaeche2);
  wurzel.style.setProperty('--rand', flaechen.rand);
  wurzel.style.setProperty('--haupt', flaechen.haupt);
  wurzel.style.setProperty('--leise', flaechen.leise);
  wurzel.style.setProperty('--akzent', bild.primaer);
  wurzel.style.setProperty('--akzent-text', bild.text);
  // --xp bleibt die Farbe der Ansicht, nicht der gewählte Akzent.
  wurzel.style.removeProperty('--xp');
  const bedeutung = bedeutungsfarben(flaechen.schema);
  wurzel.style.setProperty('--fortschritt', bedeutung.fortschritt);
  wurzel.style.setProperty('--streak', bedeutung.streak);
  wurzel.style.setProperty('--gefahr', bedeutung.gefahr);
  wurzel.style.setProperty('--gefahr-text', bedeutung.gefahrText);
  wurzel.style.setProperty('--erfolg', bedeutung.erfolg);
  wurzel.style.setProperty('--fokus', bedeutung.fokus);
  wurzel.style.setProperty('--schalter-an', bedeutung.schalterAn);
  wurzel.style.setProperty('--schalter-knopf-an', bedeutung.schalterKnopfAn);
  wurzel.style.setProperty('--schalter-aus', bedeutung.schalterAus);
  wurzel.style.setProperty('--schalter-knopf-aus', bedeutung.schalterKnopfAus);
  wurzel.style.setProperty('--diagramm-vorbild', flaechen.diagramm);
  wurzel.style.colorScheme = flaechen.schema;
  wurzel.dataset.schema = flaechen.schema;
  const glimmen = wahl.glimmen ?? wurzel.dataset.glimmen !== 'aus';
  if (glimmen) {
    delete wurzel.dataset.glimmen;
  } else {
    wurzel.dataset.glimmen = 'aus';
  }
  merkeText(PRIMAER_SCHLUESSEL, istHexFarbe(wahl.primaer) ? normaleHex(wahl.primaer) : bild.primaer);
  merkeText(AKZENT_SCHLUESSEL, istHexFarbe(wahl.akzent) ? normaleHex(wahl.akzent) : bild.akzent);
  merkeText(HINTERGRUND_SCHLUESSEL, istHexFarbe(wahl.hintergrund) ? normaleHex(wahl.hintergrund) : bild.hintergrund);
  merkeText(GLIMM_SCHLUESSEL, glimmen ? 'an' : 'aus');
  setzeThemeFarbe();
}

export async function wendeStilAn(stil: Stil): Promise<boolean> {
  if (stil === angewendet) {
    return true;
  }
  const anfrage = ++letzteAnfrage;
  let ziel = stil;
  try {
    await LADER[ziel]();
  } catch (fehler) {
    console.error(`Der Stil "${stil}" konnte nicht geladen werden.`, fehler);
    ziel = STANDARD_STIL;
    await LADER[STANDARD_STIL]();
  }
  if (anfrage !== letzteAnfrage) {
    return false;
  }
  document.documentElement.dataset.stil = ziel;
  angewendet = ziel;
  merkeText(SPEICHER_SCHLUESSEL, ziel);
  setzeThemeFarbe();
  return true;
}

export function useStilAbgleich(): void {
  const { data: einstellungen } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const stil = einstellungen?.stil;
  const primaer = einstellungen?.primaer;
  const akzent = einstellungen?.akzent;
  const hintergrund = einstellungen?.hintergrund;
  const glimmen = einstellungen?.glimmen;
  const eigeneFarben = einstellungen?.eigeneFarben;

  useEffect(() => {
    if (!stil || primaer === undefined || akzent === undefined || hintergrund === undefined || glimmen === undefined) {
      return;
    }
    const farben = eigeneFarben ? { primaer, akzent, hintergrund } : standardVorlage(stil, systemDunkel());
    void wendeStilAn(stil).then((bereit) => {
      if (bereit) {
        wendeErscheinung({ ...farben, glimmen });
      }
    });
  }, [stil, primaer, akzent, hintergrund, glimmen, eigeneFarben]);
}
