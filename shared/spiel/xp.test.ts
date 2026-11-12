import { describe, expect, it } from 'vitest';
import { standardFunktionen } from './funktionen.ts';
import {
  aktiveGewichte,
  basisXp,
  bestaendigkeitsBonus,
  eintragXp,
  investitionsBonus,
  INVESTITION_GROESSEN,
  BOSS,
  GEGNER,
  meilensteinBonus,
  projektAbschlussBonus,
  verteileNachGewichten,
  verteileTaetigkeit,
  vorschauXp,
} from './xp.ts';

describe('basisXp', () => {
  it('wertet keine Angabe wie eine halbe Stunde', () => {
    expect(basisXp(null)).toBe(basisXp(0.5));
    expect(basisXp(0)).toBe(basisXp(0.5));
  });

  it('liefert die geplanten Richtwerte', () => {
    expect(basisXp(0.5)).toBe(16);
    expect(basisXp(1)).toBe(25);
    expect(basisXp(2)).toBe(39);
    expect(basisXp(4)).toBe(62);
    expect(basisXp(8)).toBe(97);
  });

  it('hat abnehmenden Grenznutzen', () => {
    expect(basisXp(8)).toBeLessThan(basisXp(1) * 8);
    expect(basisXp(2) - basisXp(1)).toBeGreaterThan(basisXp(3) - basisXp(2));
  });
});

describe('eintragXp', () => {
  it('nimmt den Faktor', () => {
    expect(eintragXp(1)).toBe(25);
    expect(eintragXp(1, 1.2)).toBe(30);
  });
});

describe('investitionsBonus', () => {
  it('hat vier Größen von links nach rechts', () => {
    expect(INVESTITION_GROESSEN).toEqual([0.05, 0.1, 0.2, 0.3]);
    expect(investitionsBonus(0)).toBe(0.05);
    expect(investitionsBonus(1)).toBe(0.1);
    expect(investitionsBonus(3)).toBe(0.3);
    expect(investitionsBonus(-2)).toBe(0.05);
    expect(investitionsBonus(9)).toBe(0.3);
  });
});

describe('meilensteinBonus', () => {
  it('ist Basis plus Anteil der Vorhaben-XP', () => {
    expect(meilensteinBonus(0, false)).toBe(25);
    expect(meilensteinBonus(200, false)).toBe(65);
  });

  it('verstärkt Comebacks', () => {
    expect(meilensteinBonus(200, true)).toBe(Math.round(65 * 1.5));
  });

  it('ignoriert negative Vorhaben-XP', () => {
    expect(meilensteinBonus(-50, false)).toBe(25);
  });

  it('zahlt bei 25 XP dreißig, sechzig und fünfzehn', () => {
    const xp = 25;
    const meilenstein = meilensteinBonus(xp, false);
    const boss = meilensteinBonus(xp, false, true);
    const gegner = Math.round(meilenstein / GEGNER.belohnungTeiler);
    expect(GEGNER).toEqual({ belohnungTeiler: 2, angriffTeiler: 2 });
    expect(meilenstein).toBe(30);
    expect(boss).toBe(60);
    expect(gegner).toBe(15);
    expect(boss).toBe(meilenstein * BOSS.lootFaktor);
    expect(boss).toBe(gegner * GEGNER.belohnungTeiler * BOSS.lootFaktor);
    expect(Math.floor(BOSS.angriffXpProTag / GEGNER.angriffTeiler)).toBe(2);
  });
});

describe('projektAbschlussBonus', () => {
  it('liegt bis zum Knie über Meilenstein und Boss', () => {
    for (const xp of [0, 50, 100, 200, 400, 600]) {
      expect(projektAbschlussBonus(xp)).toBeGreaterThan(meilensteinBonus(xp, false));
      expect(projektAbschlussBonus(xp)).toBeGreaterThan(meilensteinBonus(xp, false, true));
    }
  });

  it('startet bei 60, flacht nach 600 ab und endet bei 480', () => {
    expect(projektAbschlussBonus(0)).toBe(60);
    expect(projektAbschlussBonus(200)).toBe(160);
    expect(projektAbschlussBonus(600)).toBe(360);
    expect(projektAbschlussBonus(1000)).toBe(392);
    expect(projektAbschlussBonus(10000)).toBe(480);
    expect(projektAbschlussBonus(-20)).toBe(60);
  });
});

describe('bestaendigkeitsBonus', () => {
  it('beginnt ab dem zweiten Kettentag und ist gedeckelt', () => {
    expect(bestaendigkeitsBonus(0)).toBe(0);
    expect(bestaendigkeitsBonus(1)).toBe(0);
    expect(bestaendigkeitsBonus(2)).toBe(3);
    expect(bestaendigkeitsBonus(5)).toBe(12);
    expect(bestaendigkeitsBonus(11)).toBe(30);
    expect(bestaendigkeitsBonus(50)).toBe(30);
  });
});

describe('verteileNachGewichten', () => {
  it('verteilt verlustfrei nach Gewicht', () => {
    const anteile = verteileNachGewichten(25, [
      { attributId: 1, gewicht: 60 },
      { attributId: 2, gewicht: 40 },
    ]);
    expect(anteile).toEqual([
      { attributId: 1, xp: 15 },
      { attributId: 2, xp: 10 },
    ]);
  });

  it('vergibt Rundungsreste nach größtem Rest', () => {
    const anteile = verteileNachGewichten(10, [
      { attributId: 1, gewicht: 1 },
      { attributId: 2, gewicht: 1 },
      { attributId: 3, gewicht: 1 },
    ]);
    expect(anteile.reduce((summe, anteil) => summe + anteil.xp, 0)).toBe(10);
  });

  it('ignoriert Gewicht 0 und liefert ohne Gewichte nichts', () => {
    expect(verteileNachGewichten(10, [{ attributId: 1, gewicht: 0 }])).toEqual([]);
    expect(verteileNachGewichten(10, [])).toEqual([]);
  });

  it('lässt Attribute ohne XP weg', () => {
    expect(
      verteileNachGewichten(1, [
        { attributId: 1, gewicht: 90 },
        { attributId: 2, gewicht: 10 },
      ]),
    ).toEqual([{ attributId: 1, xp: 1 }]);
  });
});

describe('verteileTaetigkeit', () => {
  it('gibt bei festen 40 Prozent von 25 XP zehn Punkte', () => {
    expect(verteileTaetigkeit(25, [{ attributId: 1, gewicht: 40 }], true)).toEqual([{ attributId: 1, xp: 10 }]);
  });

  it('verteilt bei Summe 100 wie das Verhältnis', () => {
    const gewichte = [
      { attributId: 1, gewicht: 40 },
      { attributId: 2, gewicht: 30 },
      { attributId: 3, gewicht: 30 },
    ];
    expect(verteileTaetigkeit(25, gewichte, true)).toEqual(verteileNachGewichten(25, gewichte));
  });

  it('lässt den Verhältnis-Modus auch bei Summe 130 unverändert', () => {
    const gewichte = [
      { attributId: 1, gewicht: 80 },
      { attributId: 2, gewicht: 50 },
    ];
    const anteile = verteileTaetigkeit(25, gewichte, false);
    expect(anteile).toEqual(verteileNachGewichten(25, gewichte));
    expect(anteile.reduce((summe, anteil) => summe + anteil.xp, 0)).toBe(25);
  });

  it('rundet drei feste Anteile und lässt den Rest liegen', () => {
    const anteile = verteileTaetigkeit(10, [
      { attributId: 1, gewicht: 30 },
      { attributId: 2, gewicht: 30 },
      { attributId: 3, gewicht: 30 },
    ], true);
    expect(anteile).toEqual([
      { attributId: 1, xp: 3 },
      { attributId: 2, xp: 3 },
      { attributId: 3, xp: 3 },
    ]);
    expect(anteile.reduce((summe, anteil) => summe + anteil.xp, 0)).toBe(9);
  });
});

describe('vorschauXp', () => {
  it('rechnet eine halbe Stunde nach den festen Prozenten', () => {
    expect(vorschauXp(0.5, [{ attributId: 1, gewicht: 50 }], true)).toBe(8);
    expect(vorschauXp(0.5, [{ attributId: 1, gewicht: 100 }], true)).toBe(16);
    expect(
      vorschauXp(
        0.5,
        [
          { attributId: 1, gewicht: 30 },
          { attributId: 2, gewicht: 30 },
        ],
        true,
      ),
    ).toBe(10);
    expect(vorschauXp(0.5, [{ attributId: 1, gewicht: 50 }], false)).toBe(16);
  });
});

describe('aktiveGewichte', () => {
  it('lässt das Gewicht eines ausgeschalteten Typs weg', () => {
    const funktionen = standardFunktionen();
    funktionen.status = false;
    const attribute = [
      { id: 1, archiviert: false, typ: 'attribut' as const },
      { id: 2, archiviert: false, typ: 'status' as const },
      { id: 3, archiviert: true, typ: 'attribut' as const },
    ];
    const gewichte = [
      { attributId: 1, gewicht: 40 },
      { attributId: 2, gewicht: 30 },
      { attributId: 3, gewicht: 20 },
      { attributId: 1, gewicht: 0 },
    ];
    expect(aktiveGewichte(gewichte, attribute, funktionen)).toEqual([{ attributId: 1, gewicht: 40 }]);
  });
});
