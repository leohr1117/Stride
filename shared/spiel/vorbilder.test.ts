import { describe, expect, it } from 'vitest';
import { ATTRIBUT_KENNUNGEN, KOENNEN_KENNUNGEN, type KoennenKennung } from './begriffe.ts';
import { berechneLevel, LEVEL_KURVEN, levelAusXpStetig, xpBisLevel, xpBisLevelStetig } from './level.ts';
import { achsenMaximum } from './radar.ts';
import {
  aehnlichkeit,
  beispielVorbilder,
  besteAehnlichkeit,
  BEISPIEL_SCHLUESSEL,
  BEWERTUNG,
  DURCHSCHNITT,
  durchschnittXpProTag,
  findeVorbild,
  klasseAus,
  levelAusRecherche,
  levelAusSchaetzung,
  levelBeiAnteil,
  RICHTUNGEN,
  uebereinstimmung,
  UNSICHER_GEWICHT,
  richtungenMitPersonen,
  vergleichspunkte,
  VORBILDER,
  type KennungsLevel,
} from '../features/vorbilder/vorbilder.ts';
import { bereinigeFavoriten } from '../features/vorbilder/favoriten.ts';

const ERLAUBTE_LEVEL_ABWEICHUNG = 0.01;

function charakterLevelAusProfil(profil: Record<string, number>): number {
  let xp = 0;
  for (const kennung of ATTRIBUT_KENNUNGEN) {
    const kurve = (KOENNEN_KENNUNGEN as readonly string[]).includes(kennung) ? LEVEL_KURVEN.attribut : LEVEL_KURVEN.status;
    xp += xpBisLevel(profil[kennung], kurve);
  }
  return berechneLevel(xp, LEVEL_KURVEN.charakter).level;
}

describe('xpBisLevelStetig', () => {
  it('stimmt bei ganzzahligen Leveln mit der Summe überein', () => {
    for (const level of [1, 2, 10, 500]) {
      expect(xpBisLevelStetig(level, LEVEL_KURVEN.charakter)).toBe(xpBisLevel(level, LEVEL_KURVEN.charakter));
      expect(xpBisLevelStetig(level, LEVEL_KURVEN.attribut)).toBe(xpBisLevel(level, LEVEL_KURVEN.attribut));
    }
  });
});

describe('levelAusXpStetig', () => {
  it('kehrt xpBisLevelStetig um', () => {
    for (const level of [1, 7.5, 120, 4000]) {
      expect(levelAusXpStetig(xpBisLevelStetig(level, LEVEL_KURVEN.attribut), LEVEL_KURVEN.attribut)).toBeCloseTo(level, 6);
    }
    expect(levelAusXpStetig(0, LEVEL_KURVEN.charakter)).toBe(1);
  });
});

function staerkstesKoennen(werte: Record<KoennenKennung, number>): KoennenKennung {
  return [...KOENNEN_KENNUNGEN].sort((a, b) => werte[b] - werte[a])[0];
}

describe('Vorbild-Profile', () => {
  it('haben nur Bewertungen zwischen 1 und 10', () => {
    for (const vorbild of VORBILDER) {
      for (const kennung of ATTRIBUT_KENNUNGEN) {
        expect(vorbild.bewertung[kennung]).toBeGreaterThanOrEqual(BEWERTUNG.min);
        expect(vorbild.bewertung[kennung]).toBeLessThanOrEqual(BEWERTUNG.max);
      }
    }
  });

  it('ergeben zusammen genau das Level der Person', () => {
    for (const vorbild of VORBILDER) {
      const level = charakterLevelAusProfil(vorbild.profil);
      expect(Math.abs(level - vorbild.level) / vorbild.level).toBeLessThan(ERLAUBTE_LEVEL_ABWEICHUNG);
    }
  });

  it('halten Schwächen nahe am Durchschnittsmenschen', () => {
    const durchschnitt = findeVorbild(DURCHSCHNITT);
    const king = findeVorbild('king');
    if (!durchschnitt || !king) {
      throw new Error('Vorbild fehlt');
    }
    expect(king.profil.koerper).toBeLessThan(durchschnitt.profil.koerper * 2);
    expect(king.profil.motorik).toBeLessThan(durchschnitt.profil.motorik * 2);
  });

  it('stecken das Außergewöhnliche in die stärkste Bewertung', () => {
    for (const vorbild of VORBILDER.filter((eintrag) => eintrag.schluessel !== DURCHSCHNITT)) {
      const hoechste = Math.max(...KOENNEN_KENNUNGEN.map((kennung) => vorbild.bewertung[kennung]));
      const maxima = KOENNEN_KENNUNGEN.filter((kennung) => vorbild.bewertung[kennung] === hoechste);
      expect(maxima).toContain(staerkstesKoennen(vorbild.profil));
    }
    const king = findeVorbild('king');
    expect(king && klasseAus(king.schaetzung)).toBe('Charismatischer Abenteurer');
  });
});

describe('Lebensweg', () => {
  it('steigt mit dem Alter und endet beim Level der Person', () => {
    for (const vorbild of VORBILDER) {
      for (let index = 1; index < vorbild.verlauf.length; index++) {
        expect(vorbild.verlauf[index].alter).toBeGreaterThan(vorbild.verlauf[index - 1].alter);
        expect(vorbild.verlauf[index].level).toBeGreaterThanOrEqual(vorbild.verlauf[index - 1].level);
      }
      if (vorbild.schluessel !== DURCHSCHNITT) {
        expect(vorbild.verlauf[vorbild.verlauf.length - 1].level).toBe(vorbild.level);
      }
    }
  });

  it('rechnet den XP-Anteil in ein Level um', () => {
    expect(levelBeiAnteil(800, 1)).toBe(800);
    expect(levelBeiAnteil(10000, 0.25)).toBeGreaterThan(4900);
    expect(levelBeiAnteil(10000, 0.25)).toBeLessThan(5100);
  });

  it('führt den Durchschnittsmenschen mit 40 auf seinem Level', () => {
    const durchschnitt = findeVorbild(DURCHSCHNITT);
    expect(durchschnitt?.level).toBe(800);
    expect(durchschnitt?.verlauf.find((station) => station.alter === 40)?.level).toBe(800);
    expect(durchschnitt?.bekanntFuer).toBe('Weltweit, etwa 40 Jahre');
    expect(durchschnitt?.beschreibung).toBe(
      'Ein durchschnittlicher Erwachsener weltweit: Ausbildung, Beruf, Familie und Freizeit.',
    );
  });

  it('rechnet das Level aus der Schätzung und bleibt unter der Obergrenze', () => {
    expect(findeVorbild(DURCHSCHNITT)?.level).toBe(800);
    for (const schluessel of ['bezos', 'trump', 'winfrey', 'schwarzenegger', 'federer', 'graf', 'serena', 'sulek', 'haaland', 'mbappe', 'kehl', 'ronaldo']) {
      expect(findeVorbild(schluessel)).toBeUndefined();
    }
    expect(findeVorbild('einstein')?.gestorben).toBe(1955);
    for (const vorbild of VORBILDER) {
      expect(vorbild.level).toBeLessThanOrEqual(10000);
      if (vorbild.schluessel === DURCHSCHNITT) {
        continue;
      }
      expect(vorbild.level).toBe(levelAusSchaetzung(vorbild.schaetzung));
      expect(vorbild.level).toBeLessThan(10000);
    }
  });

  it('nennt im Handbuch je Richtung höchstens zwei Beispiele', () => {
    const mitPerson = new Set(richtungenMitPersonen());
    let anzahl = 0;
    for (const richtung of RICHTUNGEN) {
      const schluessel = BEISPIEL_SCHLUESSEL[richtung];
      if (mitPerson.has(richtung)) {
        expect(schluessel.length).toBeGreaterThanOrEqual(1);
        expect(schluessel.length).toBeLessThanOrEqual(2);
      } else {
        expect(schluessel).toHaveLength(0);
      }
      anzahl += schluessel.length;
      for (const schluesselEintrag of schluessel) {
        expect(findeVorbild(schluesselEintrag)?.richtung).toBe(richtung);
      }
    }
    const zeilen = beispielVorbilder();
    expect(zeilen[0]?.schluessel).toBe(DURCHSCHNITT);
    expect(zeilen).toHaveLength(anzahl + 1);
    expect(zeilen.some((vorbild) => vorbild.schluessel === 'donk')).toBe(false);
    expect(zeilen.some((vorbild) => vorbild.schluessel === 'einstein')).toBe(true);
    expect(zeilen.some((vorbild) => vorbild.schluessel === 'ali')).toBe(true);
  });

  it('ändert die Ähnlichkeit, sobald abweichende Werte dazukommen', () => {
    const ali = findeVorbild('ali');
    if (!ali) {
      throw new Error('Ali fehlt');
    }
    expect(aehnlichkeit(ali.schaetzung, ali.schaetzung)).toBeCloseTo(1);
    const sichtbar: Partial<KennungsLevel> = {
      koerper: ali.schaetzung.koerper,
      geist: ali.schaetzung.geist,
      disziplin: ali.schaetzung.disziplin,
      intellekt: ali.schaetzung.intellekt,
      soziales: ali.schaetzung.soziales,
    };
    const voll = { ...ali.schaetzung };
    for (const kennung of ATTRIBUT_KENNUNGEN) {
      if (sichtbar[kennung] !== undefined) {
        continue;
      }
      voll[kennung] = 100 - ali.schaetzung[kennung];
    }
    const nurSichtbar = aehnlichkeit(sichtbar, ali.schaetzung, ali.unsicher);
    const mitAbweichung = aehnlichkeit(voll, ali.schaetzung, ali.unsicher);
    expect(nurSichtbar).toBeCloseTo(1);
    expect(mitAbweichung).not.toBeNull();
    expect(mitAbweichung ?? 1).toBeLessThan(nurSichtbar ?? 0);
  });

  it('gewichtet unsichere Werte nur halb und lässt sie mitzählen', () => {
    const basis = {} as KennungsLevel;
    for (const [index, kennung] of ATTRIBUT_KENNUNGEN.entries()) {
      basis[kennung] = 12 + index * 4;
    }
    const koerperAnders = { ...basis, koerper: basis.koerper + 55 };
    const voll = aehnlichkeit(koerperAnders, basis);
    const halb = aehnlichkeit(koerperAnders, basis, { koerper: true });
    expect(UNSICHER_GEWICHT).toBe(0.5);
    expect(voll).not.toBeNull();
    expect(halb).not.toBeNull();
    expect(halb ?? 0).toBeGreaterThan(voll ?? 1);
    expect(aehnlichkeit(koerperAnders, basis, {})).toBeCloseTo(voll ?? 0);
    const statusAnders = { ...koerperAnders, ressourcen: 5 };
    const mitStatus = aehnlichkeit(statusAnders, basis, { koerper: true, ressourcen: true });
    expect(mitStatus).not.toBeNull();
    expect(mitStatus ?? 0).not.toBeCloseTo(halb ?? 0);
    const ali = findeVorbild('ali');
    expect(ali && aehnlichkeit(ali.schaetzung, ali.schaetzung, ali.unsicher)).toBeCloseTo(1);
    const sicher = aehnlichkeit(ali?.schaetzung ?? basis, ali?.schaetzung ?? basis);
    expect(sicher).toBeCloseTo(1);
  });

  it('nimmt für die Richtung die beste Ähnlichkeit', () => {
    expect(besteAehnlichkeit([])).toBeNull();
    expect(besteAehnlichkeit([null, null])).toBeNull();
    expect(besteAehnlichkeit([0.2, null, 0.8, 0.4])).toBe(0.8);
  });

  it('nimmt die Tages-XP so an, dass dieses Level etwa 40 Jahre braucht', () => {
    const xpAmTag = durchschnittXpProTag();
    const xp = xpBisLevel(800, LEVEL_KURVEN.charakter);
    expect(xpAmTag).toBe(49);
    expect(Math.round(xp / xpAmTag / 365)).toBe(40);
    const level = berechneLevel(xpAmTag * 40 * 365, LEVEL_KURVEN.charakter).level;
    expect(Math.abs(level - 800)).toBeLessThan(15);
  });
});

describe('Katalog ohne lebende Personen', () => {
  it('behält genau die Personen, die seit mindestens zehn Jahren tot sind', () => {
    const grenze = new Date().getFullYear() - 10;
    const personen = VORBILDER.filter((vorbild) => vorbild.schluessel !== DURCHSCHNITT);
    expect(personen.map((vorbild) => vorbild.schluessel)).toEqual([
      'lee',
      'ali',
      'mozart',
      'jobs',
      'davinci',
      'newton',
      'einstein',
      'tesla',
      'curie',
      'aurelius',
      'gandhi',
      'king',
      'mandela',
    ]);
    for (const vorbild of personen) {
      expect(vorbild.gestorben).not.toBeNull();
      expect(vorbild.gestorben ?? grenze + 1).toBeLessThanOrEqual(grenze);
    }
    for (const schluessel of Object.values(BEISPIEL_SCHLUESSEL).flat()) {
      expect(findeVorbild(schluessel)?.schluessel).toBe(schluessel);
    }
    expect(richtungenMitPersonen()).toEqual([
      'Körper',
      'Wettkampf',
      'Kunst',
      'Innovation/Technik',
      'Wissenschaft/Genies',
      'Führung/Wandel',
    ]);
    expect(bereinigeFavoriten(['einstein', 'ronaldo', 'einstein'])).toEqual(['einstein']);
  });
});

describe('Level-Vergleich', () => {
  it('rechnet die Recherche in Attribut-Level um, die Karte bleibt das Charakter-Level', () => {
    const davinci = findeVorbild('davinci');
    if (!davinci) {
      throw new Error('da Vinci fehlt');
    }
    expect(davinci.level).toBe(7917);
    expect(new Intl.NumberFormat('de-DE').format(davinci.level)).toBe('7.917');
    expect(davinci.level).toBe(levelAusSchaetzung(davinci.schaetzung));
    expect(levelAusRecherche(davinci, 'intellekt')).toBe(davinci.profil.intellekt);
    expect(levelAusRecherche(davinci, 'intellekt')).toBeGreaterThan(davinci.schaetzung.intellekt);
    expect(levelAusRecherche(davinci, 'koerper')).not.toBe(davinci.schaetzung.koerper / 100);
    const ausProfil = charakterLevelAusProfil(davinci.profil);
    expect(Math.abs(ausProfil - davinci.level) / davinci.level).toBeLessThan(ERLAUBTE_LEVEL_ABWEICHUNG);
  });

  it('misst die Form und bleibt bei kleiner gleicher Form bei eins', () => {
    const davinci = findeVorbild('davinci');
    if (!davinci) {
      throw new Error('da Vinci fehlt');
    }
    const klein: Partial<KennungsLevel> = {};
    const flach: Partial<KennungsLevel> = {};
    for (const kennung of ATTRIBUT_KENNUNGEN) {
      klein[kennung] = davinci.profil[kennung] / 100;
      flach[kennung] = 1;
    }
    expect(aehnlichkeit(klein, davinci.profil, davinci.unsicher)).toBeCloseTo(1);
    const wert = aehnlichkeit(flach, davinci.profil, davinci.unsicher);
    expect(wert).not.toBeNull();
    expect(wert ?? 1).toBeLessThan(1);
    expect(wert ?? 0).toBeGreaterThan(0.2);
    expect(aehnlichkeit({}, davinci.profil)).toBeNull();
    const nurZwei = { intellekt: davinci.profil.intellekt, kreativitaet: 1 };
    expect(aehnlichkeit(nurZwei, davinci.profil) ?? 0).toBeGreaterThan(0.4);

    const punkte = vergleichspunkte({ intellekt: 1, koerper: 10 }, davinci, ['intellekt', 'koerper', 'geist']);
    expect(punkte.map((punkt) => punkt.kennung)).toEqual(['intellekt', 'koerper']);
    expect(punkte[0]?.vorbild).toBe(davinci.profil.intellekt);
    expect(punkte[1]?.du).toBe(10);
    const achse = achsenMaximum(punkte.flatMap((punkt) => [punkt.du, punkt.vorbild]));
    expect(achse).toBe(Math.max(punkte[0]?.vorbild ?? 0, punkte[1]?.vorbild ?? 0, 1, 10));
    expect(10 / achse).toBeLessThan(0.05);
    expect(punkte[0]?.anteil).toBeCloseTo(1 / (punkte[0]?.vorbild ?? 1));
  });

  it('streckt niemanden auf das eigene Maximum', () => {
    expect(uebereinstimmung(5, 5)).toBe(1);
    expect(uebereinstimmung(2, 40)).toBeCloseTo(0.05);
    expect(uebereinstimmung(40, 2)).toBeCloseTo(0.05);
    expect(uebereinstimmung(0, 0)).toBe(1);
    const achse = achsenMaximum([2, 40]);
    expect(achse).toBe(40);
    expect(2 / achse).toBe(0.05);
  });
});
