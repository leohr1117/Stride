import { helligkeit, istHexFarbe, kontrast, lesbareFarbe, lesbareSchrift, MINDEST_KONTRAST, mische, normaleHex, schriftAuf } from '../../spiel/farben.ts';
import { STILE, STIL_INFO, type Stil } from './stile.ts';

export interface Farbtrio {
  primaer: string;
  akzent: string;
  hintergrund: string;
}

export interface Flaechen {
  flaeche: string;
  flaeche2: string;
  rand: string;
  haupt: string;
  leise: string;
  gefahr: string;
  diagramm: string;
  schema: 'light' | 'dark';
}

export interface Vorlage extends Farbtrio {
  name: string;
  text: string;
  flaechen: Flaechen;
}

export interface Erscheinung extends Farbtrio {
  text: string;
  flaechen: Flaechen;
}

const STANDARD_HELL: Vorlage = {
  name: 'Hell',
  primaer: '#141414',
  akzent: '#707070',
  hintergrund: '#f2f2f2',
  text: '#f2f2f2',
  flaechen: {
    flaeche: '#ffffff',
    flaeche2: '#ebebeb',
    rand: '#e0e0e0',
    haupt: '#141414',
    leise: '#666666',
    gefahr: '#e5484d',
    diagramm: '#707070',
    schema: 'light',
  },
};

/** Logo-Grau #707070 ist nur Deko. Text ist #949494, weil #8a8a8a auf #262626 unter 4,5 liegt. */
const STANDARD_DUNKEL: Vorlage = {
  name: 'Dunkel',
  primaer: '#f2f2f2',
  akzent: '#8a8a8a',
  hintergrund: '#141414',
  text: '#141414',
  flaechen: {
    flaeche: '#1c1c1c',
    flaeche2: '#262626',
    rand: '#2e2e2e',
    haupt: '#f2f2f2',
    leise: '#949494',
    gefahr: '#f2555a',
    diagramm: '#8a8a8a',
    schema: 'dark',
  },
};

const STANDARD_NEBEL: Vorlage = {
  name: 'Nebel',
  primaer: '#f2f2f2',
  akzent: '#8a8a8a',
  hintergrund: '#101010',
  text: '#141414',
  flaechen: {
    flaeche: '#1a1a1a',
    flaeche2: '#242424',
    rand: '#333333',
    haupt: '#f2f2f2',
    leise: '#8a8a8a',
    gefahr: '#f2555a',
    diagramm: '#8a8a8a',
    schema: 'dark',
  },
};

const MINIMAL_HELL: Vorlage = {
  name: 'Hell',
  primaer: '#6d5efc',
  akzent: '#d99a16',
  hintergrund: '#f7f7f8',
  text: '#ffffff',
  flaechen: {
    flaeche: '#ffffff',
    flaeche2: '#f0f0f3',
    rand: '#e4e4e9',
    haupt: '#17171c',
    leise: '#6b6b78',
    gefahr: '#e5484d',
    diagramm: '#b07a10',
    schema: 'light',
  },
};

const MINIMAL_DUNKEL: Vorlage = {
  name: 'Dunkel',
  primaer: '#8b7dff',
  akzent: '#f5b942',
  hintergrund: '#0e0e12',
  text: '#ffffff',
  flaechen: {
    flaeche: '#16161c',
    flaeche2: '#1f1f27',
    rand: '#2a2a34',
    haupt: '#ececf1',
    leise: '#8b8b99',
    gefahr: '#f2555a',
    diagramm: '#b8841f',
    schema: 'dark',
  },
};

const SYSTEM_HELL: Partial<Record<Stil, Vorlage>> = {
  minimal: MINIMAL_HELL,
  standard: STANDARD_HELL,
};

const SYSTEM_DUNKEL: Partial<Record<Stil, Vorlage>> = {
  minimal: MINIMAL_DUNKEL,
  standard: STANDARD_DUNKEL,
};

const VORLAGEN: Record<Stil, readonly Vorlage[]> = {
  standard: [STANDARD_HELL, STANDARD_DUNKEL, STANDARD_NEBEL],
  minimal: [
    MINIMAL_HELL,
    MINIMAL_DUNKEL,
    {
      name: 'Tinte',
      primaer: '#8eabff',
      akzent: '#f0c14a',
      hintergrund: '#10141c',
      text: '#07101f',
      flaechen: {
        flaeche: '#181d28',
        flaeche2: '#222838',
        rand: '#343b4e',
        haupt: '#e7eaf2',
        leise: '#939bb0',
        gefahr: '#f2555a',
        diagramm: '#f0c14a',
        schema: 'dark',
      },
    },
  ],
  jade: [
    {
      name: 'Jade',
      primaer: '#3dd68c',
      akzent: '#c4b5fd',
      hintergrund: '#0c0d0f',
      text: '#03140b',
      flaechen: {
        flaeche: '#141518',
        flaeche2: '#1b1d21',
        rand: '#282b30',
        haupt: '#eceef1',
        leise: '#979ba3',
        gefahr: '#ff6b81',
        diagramm: '#c4b5fd',
        schema: 'dark',
      },
    },
    {
      name: 'Smaragd',
      primaer: '#3dce86',
      akzent: '#f0d48a',
      hintergrund: '#08110d',
      text: '#03140b',
      flaechen: {
        flaeche: '#101a15',
        flaeche2: '#18241d',
        rand: '#2c4036',
        haupt: '#e7f3ec',
        leise: '#8eaa9b',
        gefahr: '#ff6b81',
        diagramm: '#f0d48a',
        schema: 'dark',
      },
    },
    {
      name: 'Moor',
      primaer: '#9be7c4',
      akzent: '#d7c4ff',
      hintergrund: '#121614',
      text: '#03140b',
      flaechen: {
        flaeche: '#1a201d',
        flaeche2: '#242c28',
        rand: '#3a4640',
        haupt: '#e8efe9',
        leise: '#96a69c',
        gefahr: '#ff6b81',
        diagramm: '#d7c4ff',
        schema: 'dark',
      },
    },
  ],
  holo: [
    {
      name: 'Hologramm',
      primaer: '#3ea8ff',
      akzent: '#b38cff',
      hintergrund: '#050914',
      text: '#031020',
      flaechen: {
        flaeche: '#0a1224',
        flaeche2: '#111c36',
        rand: '#1d3563',
        haupt: '#e8f1ff',
        leise: '#849bc6',
        gefahr: '#ff5c7a',
        diagramm: '#b38cff',
        schema: 'dark',
      },
    },
    {
      name: 'Plasma',
      primaer: '#b69cff',
      akzent: '#5ce1ff',
      hintergrund: '#070612',
      text: '#100818',
      flaechen: {
        flaeche: '#120e22',
        flaeche2: '#1b1533',
        rand: '#3a2d66',
        haupt: '#f3eeff',
        leise: '#a394c9',
        gefahr: '#ff5c7a',
        diagramm: '#5ce1ff',
        schema: 'dark',
      },
    },
    {
      name: 'Eis',
      primaer: '#4ad4f0',
      akzent: '#8eb6ff',
      hintergrund: '#041016',
      text: '#031018',
      flaechen: {
        flaeche: '#0a1c24',
        flaeche2: '#102833',
        rand: '#1c4a5c',
        haupt: '#e7f7fb',
        leise: '#86b4c4',
        gefahr: '#ff5c7a',
        diagramm: '#8eb6ff',
        schema: 'dark',
      },
    },
  ],
  antik: [
    {
      name: 'Antik',
      primaer: '#d6c79c',
      akzent: '#c9a24d',
      hintergrund: '#0d0c0a',
      text: '#15130f',
      flaechen: {
        flaeche: '#161512',
        flaeche2: '#211f1b',
        rand: '#3a362f',
        haupt: '#ece6d6',
        leise: '#a49d8e',
        gefahr: '#c75d43',
        diagramm: '#8fa8bf',
        schema: 'dark',
      },
    },
    {
      name: 'Bronze',
      primaer: '#e2a45c',
      akzent: '#d4874e',
      hintergrund: '#140e0a',
      text: '#15130f',
      flaechen: {
        flaeche: '#1f1611',
        flaeche2: '#2b2018',
        rand: '#4d3c2c',
        haupt: '#f6e7d4',
        leise: '#b7a08c',
        gefahr: '#c75d43',
        diagramm: '#d4874e',
        schema: 'dark',
      },
    },
    {
      name: 'Purpur',
      primaer: '#e8c99a',
      akzent: '#e08aaa',
      hintergrund: '#120c10',
      text: '#15130f',
      flaechen: {
        flaeche: '#1c1419',
        flaeche2: '#291c22',
        rand: '#4a3540',
        haupt: '#f6ebdf',
        leise: '#b7a399',
        gefahr: '#c75d43',
        diagramm: '#e08aaa',
        schema: 'dark',
      },
    },
  ],
};

export function vorlagen(stil: Stil): readonly Vorlage[] {
  return VORLAGEN[stil];
}

export interface PalettenGruppe {
  stil: Stil;
  label: string;
  vorlagen: readonly Vorlage[];
}

/** Aktives Design zuerst, danach die übrigen. Die Vorauswahl bleibt die eigene Standardpalette. */
export function palettenNachDesign(aktiv: Stil): readonly PalettenGruppe[] {
  const reihe = [aktiv, ...STILE.filter((stil) => stil !== aktiv)];
  return reihe.map((stil) => ({ stil, label: STIL_INFO[stil].label, vorlagen: VORLAGEN[stil] }));
}

export function standardVorlage(stil: Stil, dunkel: boolean): Vorlage {
  return (dunkel ? SYSTEM_DUNKEL[stil] : SYSTEM_HELL[stil]) ?? VORLAGEN[stil][0];
}

function normalisiere(trio: Farbtrio): Farbtrio {
  const basis = MINIMAL_HELL;
  return {
    primaer: istHexFarbe(trio.primaer) ? normaleHex(trio.primaer) : basis.primaer,
    akzent: istHexFarbe(trio.akzent) ? normaleHex(trio.akzent) : basis.akzent,
    hintergrund: istHexFarbe(trio.hintergrund) ? normaleHex(trio.hintergrund) : basis.hintergrund,
  };
}

function findeVorlage(trio: Farbtrio): Vorlage | undefined {
  for (const stil of STILE) {
    for (const vorlage of VORLAGEN[stil]) {
      if (vorlage.primaer === trio.primaer && vorlage.akzent === trio.akzent && vorlage.hintergrund === trio.hintergrund) {
        return vorlage;
      }
    }
  }
  return undefined;
}

function flaechenZuHintergrund(hintergrund: string): Flaechen | undefined {
  for (const stil of STILE) {
    for (const vorlage of VORLAGEN[stil]) {
      if (vorlage.hintergrund === hintergrund) {
        return vorlage.flaechen;
      }
    }
  }
  return undefined;
}

function ableiten(hintergrund: string): Flaechen {
  const hell = helligkeit(hintergrund) >= 0.4;
  const flaeche = hell ? mische(hintergrund, '#ffffff', 0.62) : mische(hintergrund, '#ffffff', 0.07);
  const flaeche2 = hell ? mische(hintergrund, '#000000', 0.045) : mische(hintergrund, '#ffffff', 0.13);
  const rand = hell ? mische(hintergrund, '#000000', 0.14) : mische(hintergrund, '#ffffff', 0.22);
  const haupt = lesbareSchrift([flaeche, hintergrund]);
  const leise = lesbareFarbe(mische(haupt, flaeche, 0.38), [flaeche]);
  return {
    flaeche,
    flaeche2,
    rand,
    haupt,
    leise,
    gefahr: hell ? '#e5484d' : '#f2555a',
    diagramm: haupt,
    schema: helligkeit(haupt) > 0.5 ? 'dark' : 'light',
  };
}

function textAuf(primaer: string, bevorzugt: string): string {
  return kontrast(bevorzugt, primaer) >= MINDEST_KONTRAST ? bevorzugt : schriftAuf(primaer);
}

export function erscheinungAus(trio: Farbtrio): Erscheinung {
  const normal = normalisiere(trio);
  const treffer = findeVorlage(normal);
  if (treffer) {
    return {
      primaer: treffer.primaer,
      akzent: treffer.akzent,
      hintergrund: treffer.hintergrund,
      text: textAuf(treffer.primaer, treffer.text),
      flaechen: treffer.flaechen,
    };
  }
  const bekannt = flaechenZuHintergrund(normal.hintergrund);
  const basis = bekannt === undefined ? ableiten(normal.hintergrund) : { ...bekannt };
  const hintergruende = [normal.hintergrund, basis.flaeche];
  const primaer = lesbareFarbe(normal.primaer, hintergruende);
  const akzent = lesbareFarbe(normal.akzent, hintergruende);
  return {
    primaer,
    akzent,
    hintergrund: normal.hintergrund,
    text: schriftAuf(primaer),
    flaechen: { ...basis, diagramm: akzent },
  };
}
