import { ATTRIBUT_KATALOG } from '../../shared/features/attribute/attributKatalog.ts';
import { berechneLevel, LEVEL_KURVEN } from '../../shared/spiel/level.ts';
import { alle, ausfuehren, eine } from '../../server/db.ts';
import { aktiviereAttribut } from '../../server/features/attribute/attribute.ts';
import { erledigeBasisAufgabe } from '../../server/features/basis/basis.ts';
import { rechneBossangriffeAb } from '../../server/features/bosse/bossangriffe.ts';
import { erstelleEintrag } from '../../server/features/eintraege/eintraege.ts';
import { schalteErfolgeFrei } from '../../server/features/erfolge/erfolge.ts';
import { schalteSkillFrei } from '../../server/features/faehigkeiten/faehigkeiten.ts';
import { speichereRueckblick } from '../../server/features/rueckblick/rueckblick.ts';
import { aendereVorhaben, erstelleVorhaben, starteNeuenAnlauf } from '../../server/features/ziele/vorhaben.ts';
import { aendereProjekt } from '../../server/services/struktur.ts';
import { lokalesDatum, wochenbeginn } from '../../server/services/zeit.ts';
import {
  datumVor,
  JETZT,
  TAGE_VOLL,
  tagVor,
  versuche,
  vorlageId,
  waehle,
  zeitpunktVor,
  zufall,
} from './hilfe.ts';
import { legeTrainingsbankAn, type VollStand, type VollTaetigkeit } from './vollAufbau.ts';

export function spieleVoll(stand: VollStand): void {
  const P = stand.projekte;
  const offene = new Map<number, number[]>();
  const V: Record<string, number> = {};

  function waehleTaetigkeit(): VollTaetigkeit {
    let summe = 0;
    for (const taetigkeit of stand.taetigkeiten) {
      summe += taetigkeit.gewicht;
    }
    let wurf = zufall() * summe;
    for (const taetigkeit of stand.taetigkeiten) {
      wurf -= taetigkeit.gewicht;
      if (wurf <= 0) {
        return taetigkeit;
      }
    }
    return stand.taetigkeiten[0] as VollTaetigkeit;
  }

  function legeVorhabenAn(projektId: number, titel: string, tage: number, boss?: { deadlineIn: number }): number {
    const zeitpunkt = zeitpunktVor(tage, 8);
    const id = erstelleVorhaben(projektId, titel, zeitpunkt).id;
    if (boss) {
      aendereVorhaben(id, { boss: { deadline: tagVor(tage - boss.deadlineIn) } }, zeitpunkt);
    }
    offene.set(projektId, [...(offene.get(projektId) ?? []), id]);
    return id;
  }

  function schliesseVorhaben(projektId: number, vorhabenId: number): void {
    offene.set(
      projektId,
      (offene.get(projektId) ?? []).filter((id) => id !== vorhabenId),
    );
  }

  function trageEin(
    tage: number,
    taetigkeit: { projektId: number; vorlage: string; faehigkeitId?: number },
    stunden: number | null,
    notiz: string,
    extra: {
      vorhabenId?: number;
      abschluss?: 'geschafft' | 'gescheitert';
      erkenntnis?: string;
      meilenstein?: boolean;
    } = {},
  ): void {
    const kandidaten = offene.get(taetigkeit.projektId) ?? [];
    const vorhabenId = extra.vorhabenId ?? (kandidaten.length > 0 && zufall() < 0.55 ? waehle(kandidaten) : undefined);
    erstelleEintrag(
      {
        projektId: taetigkeit.projektId,
        vorlageId: vorlageId(taetigkeit.vorlage),
        vorhaben: vorhabenId === undefined ? null : { art: 'bestehend', id: vorhabenId },
        abschluss: extra.abschluss ?? null,
        erkenntnis: extra.erkenntnis ?? '',
        stunden,
        notiz,
        meilenstein: extra.meilenstein ?? false,
        faehigkeitId: taetigkeit.faehigkeitId ?? null,
        datum: datumVor(tage),
      },
      JETZT,
    );
    if (extra.abschluss !== undefined && vorhabenId !== undefined) {
      schliesseVorhaben(taetigkeit.projektId, vorhabenId);
    }
  }

  const ereignisse = new Map<number, (() => void)[]>();
  function amTag(tage: number, aktion: () => void): void {
    ereignisse.set(tage, [...(ereignisse.get(tage) ?? []), aktion]);
  }

  amTag(34, () => {
    V.kniebeuge = legeVorhabenAn(P.kraft, 'Kniebeuge-Technik', 34);
    V.login = legeVorhabenAn(P.app, 'Anmeldung bauen', 34);
    V.ticket = legeVorhabenAn(P.job, 'Erstes Ticket der Woche', 34);
  });
  amTag(32, () => schalteSkillFrei(stand.kraftSkills.get('Kniebeuge sauber') ?? 0, zeitpunktVor(32, 19)));
  amTag(30, () => schalteSkillFrei(stand.codeSkills.get('TypeScript Alltag') ?? 0, zeitpunktVor(30, 20)));
  amTag(28, () => {
    V.kueche = legeVorhabenAn(P.haushalt, 'Küche komplett', 28);
    V.react = legeVorhabenAn(P.lernen, 'React-Grundlagen', 28);
  });
  amTag(26, () =>
    trageEin(26, { projektId: P.job, vorlage: 'Liefern' }, 4, 'Ticket geschlossen und Review drin', {
      vorhabenId: V.ticket,
      abschluss: 'geschafft',
    }),
  );
  amTag(25, () => schalteSkillFrei(stand.codeSkills.get('React-Komponenten') ?? 0, zeitpunktVor(25, 20)));
  amTag(24, () =>
    trageEin(24, { projektId: P.app, vorlage: 'Erschaffen', faehigkeitId: stand.codeId }, 3, 'Login mit Speichern fertig', {
      vorhabenId: V.login,
      abschluss: 'geschafft',
    }),
  );
  amTag(23, () => {
    V.release = legeVorhabenAn(P.app, 'Erste Version raus', 23, { deadlineIn: 10 });
    V.bank = legeVorhabenAn(P.kraft, 'Bankdrücken 60 Kilo', 23);
  });
  amTag(22, () => schalteSkillFrei(stand.kraftSkills.get('Bankdrücken') ?? 0, zeitpunktVor(22, 19)));
  amTag(20, () =>
    trageEin(20, { projektId: P.haushalt, vorlage: 'Aufräumen' }, 2, 'Küche leer und Schränke sortiert', {
      vorhabenId: V.kueche,
      abschluss: 'geschafft',
    }),
  );
  amTag(19, () => {
    aendereProjekt(
      P.kraft,
      {
        investition: true,
        investitionZiel: { art: 'vision', id: stand.fitId },
        investitionRessourcen: true,
        geschafft: true,
      },
      zeitpunktVor(19, 8),
    );
  });
  amTag(18, () => trageEin(18, { projektId: P.laufen, vorlage: 'Laufen' }, 1, 'Fünf Kilometer ohne Pause', { meilenstein: true }));
  amTag(17, () => schalteSkillFrei(stand.codeSkills.get('Tests schreiben') ?? 0, zeitpunktVor(17, 21)));
  amTag(16, () =>
    trageEin(16, { projektId: P.kraft, vorlage: 'Training', faehigkeitId: stand.kraftId }, 1.5, 'Kniebeuge sitzt, Gewicht erhöht', {
      vorhabenId: V.kniebeuge,
      abschluss: 'geschafft',
    }),
  );
  amTag(15, () => {
    V.gruppenlauf = legeVorhabenAn(P.treff, 'Samstagslauf organisieren', 15);
    V.kreuz = legeVorhabenAn(P.kraft, 'Kreuzheben 100 Kilo', 15, { deadlineIn: 18 });
    schalteSkillFrei(stand.kraftSkills.get('Kreuzheben') ?? 0, zeitpunktVor(15, 19));
  });
  amTag(14, () =>
    trageEin(14, { projektId: P.lernen, vorlage: 'Lernen', faehigkeitId: stand.codeId }, 2, 'Erste eigene Komponente ohne Vorlage', {
      vorhabenId: V.react,
      abschluss: 'geschafft',
    }),
  );
  amTag(13, () => {
    V.liste = legeVorhabenAn(P.app, 'Einträge filtern', 13);
    schalteSkillFrei(stand.codeSkills.get('API anbinden') ?? 0, zeitpunktVor(13, 20));
  });
  amTag(12, () =>
    trageEin(12, { projektId: P.kraft, vorlage: 'Training', faehigkeitId: stand.kraftId }, 1, '60 Kilo Bankdrücken geschafft', {
      vorhabenId: V.bank,
      abschluss: 'geschafft',
      meilenstein: true,
    }),
  );
  amTag(11, () =>
    trageEin(11, { projektId: P.kraft, vorlage: 'Training', faehigkeitId: stand.kraftId }, 1.5, 'Kreuzheben abgebrochen, Rücken zu müde', {
      vorhabenId: V.kreuz,
      abschluss: 'gescheitert',
      erkenntnis: 'Weniger Sätze, Form zuerst.',
    }),
  );
  amTag(10, () => {
    aendereProjekt(
      P.haushalt,
      {
        investition: true,
        investitionZiel: { art: 'vision', id: stand.fitId },
      },
      zeitpunktVor(10, 9),
    );
  });
  amTag(9, () => {
    V.kreuz2 = starteNeuenAnlauf(V.kreuz ?? 0, zeitpunktVor(9, 8)).vorhaben.id;
    offene.set(P.kraft, [...(offene.get(P.kraft) ?? []), V.kreuz2]);
  });
  amTag(8, () =>
    trageEin(8, { projektId: P.treff, vorlage: 'Laufen' }, 1, 'Treffpunkt und Runde stehen', {
      vorhabenId: V.gruppenlauf,
      abschluss: 'geschafft',
    }),
  );
  amTag(7, () =>
    trageEin(7, { projektId: P.app, vorlage: 'Erschaffen', faehigkeitId: stand.codeId }, 3, 'Filter und Suche funktionieren', {
      vorhabenId: V.liste,
      abschluss: 'geschafft',
    }),
  );
  amTag(6, () => {
    V.sparplan = legeVorhabenAn(P.job, 'Monatsbericht', 6);
    schalteSkillFrei(stand.kraftSkills.get('80 Kilo Kniebeuge') ?? 0, zeitpunktVor(6, 19));
  });
  amTag(4, () =>
    trageEin(4, { projektId: P.kraft, vorlage: 'Training', faehigkeitId: stand.kraftId }, 2, 'Kniebeuge 80 Kilo, drei Sätze', {
      meilenstein: true,
    }),
  );
  amTag(3, () => schalteSkillFrei(stand.kraftSkills.get('Hantelreihe') ?? 0, zeitpunktVor(3, 19)));
  amTag(2, () => {
    V.demo = legeVorhabenAn(P.job, 'Kundendemo', 2, { deadlineIn: 10 });
  });
  amTag(1, () =>
    trageEin(1, { projektId: P.app, vorlage: 'Erschaffen', faehigkeitId: stand.codeId }, 4, 'Erste Version intern lauffähig', {
      meilenstein: true,
    }),
  );

  const pausen = new Set([29, 21, 14]);

  for (let tage = TAGE_VOLL; tage >= 0; tage--) {
    for (const aktion of ereignisse.get(tage) ?? []) {
      aktion();
    }
    if (pausen.has(tage)) {
      continue;
    }
    const anzahl = tage === 0 ? 1 : 1 + Math.floor(zufall() * 3);
    for (let index = 0; index < anzahl; index++) {
      const taetigkeit = waehleTaetigkeit();
      trageEin(tage, taetigkeit, waehle(taetigkeit.stunden), waehle(taetigkeit.notizen));
    }
    for (let index = 0; index < stand.basisAufgaben.length; index++) {
      const chance = stand.basisChance[index] ?? 0;
      const aufgabe = stand.basisAufgaben[index];
      if (tage > 0 && aufgabe !== undefined && zufall() < chance) {
        versuche(() => erledigeBasisAufgabe(aufgabe, JETZT, datumVor(tage)));
      }
    }
  }

  const alterBoss = legeVorhabenAn(P.job, 'Altes Ticket schließen', 27, { deadlineIn: 5 });
  trageEin(27, { projektId: P.job, vorlage: 'Liefern' }, 2, 'Ticket zu Ende gebracht', {
    vorhabenId: alterBoss,
    abschluss: 'geschafft',
  });
  legeVorhabenAn(P.app, 'Veröffentlichungsplan der ersten Version', 0);

  for (let woche = 4; woche >= 1; woche--) {
    const texte = [
      {
        gut: 'Training lag die Woche über fast immer vor der Couch.',
        lernen: 'Abends noch ein Ticket aufzureißen kostet den nächsten Morgen.',
        fokus: 'Kraft zuerst, danach die App.',
      },
      {
        gut: 'Die Anmeldung der App steht und ich habe sie selbst benutzt.',
        lernen: 'Zu große Vorhaben bleiben liegen. Kleiner schneiden.',
        fokus: 'Ein Filter, der wirklich hilft.',
      },
      {
        gut: 'Lauftreff hat stattgefunden, ohne dass ich alles allein organisiert habe.',
        lernen: 'Kreuzheben mit müdem Rücken war dumm.',
        fokus: 'Form vor Kilo.',
      },
      {
        gut: 'Küche bleibt zwei Tage hintereinander leer.',
        lernen: 'Wenn die Spüle morgens voll ist, rutscht der Tag.',
        fokus: 'Spüle leer, bevor der Rechner aufgeht.',
      },
    ][woche - 1];
    if (texte) {
      speichereRueckblick(lokalesDatum(wochenbeginn(JETZT, woche)), texte, JETZT);
    }
  }

  legeTrainingsbankAn(stand.fitId);
  rechneBossangriffeAb(JETZT);
  schalteErfolgeFrei();
  richteLeiste();
  loescheSchutzProtokoll();
}

/** Fehlende Katalog-Attribute anlegen. Führung bleibt bei 0 XP und steht als leerer Balken in der Leiste. */
function richteLeiste(): void {
  const vorhanden = new Set(
    alle<{ kennung: string }>('SELECT kennung FROM attribute WHERE kennung IS NOT NULL').map((zeile) => zeile.kennung),
  );
  for (const vorlage of ATTRIBUT_KATALOG) {
    if (vorlage.typ !== 'attribut' || vorhanden.has(vorlage.kennung)) {
      continue;
    }
    const angelegt = aktiviereAttribut(vorlage.kennung, 'behalten', null, JETZT);
    if (vorlage.kennung !== 'mut') {
      ausfuehren('UPDATE attribute SET archiviert = 1 WHERE id = ?', angelegt.id);
    }
  }
  ausfuehren(`UPDATE attribute SET sortierung = 5, archiviert = 0 WHERE kennung = 'fuehrung'`);
  const erster = alle<{ id: number }>(
    `SELECT id FROM attribute WHERE typ = 'attribut' AND archiviert = 0 ORDER BY sortierung, id LIMIT 1`,
  )[0];
  if (erster === undefined) {
    return;
  }
  bucheXp(erster.id, 1);
  if (xpStand(erster.id).xpImLevel === 0) {
    bucheXp(erster.id, 1);
  }
}

function xpStand(attributId: number): ReturnType<typeof berechneLevel> {
  const xp =
    eine<{ xp: number }>('SELECT COALESCE(SUM(xp), 0) AS xp FROM xp_ereignisse WHERE attribut_id = ?', attributId)?.xp ??
    0;
  return berechneLevel(xp, LEVEL_KURVEN.attribut);
}

function bucheXp(attributId: number, xp: number): void {
  ausfuehren(
    `INSERT INTO xp_ereignisse (quelle, attribut_id, xp, erstellt_am) VALUES ('umverteilung', ?, ?, ?)`,
    attributId,
    xp,
    JETZT.toISOString(),
  );
}

function loescheSchutzProtokoll(): void {
  ausfuehren(`DELETE FROM protokoll WHERE art IN ('schutz_verdient', 'schutz_eingesetzt')`);
}
