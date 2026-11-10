import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SATZ_BETREIBER, SATZ_UNLESBAR } from '../../../shared/verbindungsFehler.ts';
import { mitWelt, mitWeltAsync, schliesseWelt } from '../../db.ts';
import { AppFehler } from '../../fehler.ts';
import { starteTodoistAttrappe, type TodoistAttrappe } from '../../integrationen/todoistAttrappe.ts';
import { verbindungsRouten } from '../../routes/verbindungen.ts';
import { leseWert, setzeWert } from './gemeinsam.ts';
import { verbindeTodoist } from './todoist.ts';
import {
  LOG_FEHLT,
  LOG_UNGUELTIG,
  entpackeToken,
  liesToken,
  meldeTokenSchluessel,
  packeToken,
  schluesselZustand,
  tokenFuerAufruf,
  verlangeSchluessel,
  verschluesseleVorhandeneTodoistTokens,
} from './tokenGeheim.ts';

const KLAR = 'geheim-token-xyz!';
const TEST_SCHLUESSEL = Buffer.from('stride-test-token-schluessel-v3!').toString('base64');
const ANDERER_SCHLUESSEL = Buffer.from('anderer-test-schluessel-nicht-v3').toString('base64');
const vorherStride = process.env.STRIDE_TOKEN_SCHLUESSEL;
const vorherAscend = process.env.ASCEND_TOKEN_SCHLUESSEL;
const basis = path.join('tmp-test', 'token-geheim');
mkdirSync(basis, { recursive: true });
const ordner = mkdtempSync(path.join(basis, 'lauf-'));
const offen: string[] = [];
const attrappen: TodoistAttrappe[] = [];
let nummer = 0;

function setzeTestschluessel(): void {
  process.env.STRIDE_TOKEN_SCHLUESSEL = TEST_SCHLUESSEL;
  delete process.env.ASCEND_TOKEN_SCHLUESSEL;
}

function ohneSchluessel(): void {
  delete process.env.STRIDE_TOKEN_SCHLUESSEL;
  delete process.env.ASCEND_TOKEN_SCHLUESSEL;
}

function stelleSchluesselHer(): void {
  if (vorherStride === undefined) {
    delete process.env.STRIDE_TOKEN_SCHLUESSEL;
  } else {
    process.env.STRIDE_TOKEN_SCHLUESSEL = vorherStride;
  }
  if (vorherAscend === undefined) {
    delete process.env.ASCEND_TOKEN_SCHLUESSEL;
  } else {
    process.env.ASCEND_TOKEN_SCHLUESSEL = vorherAscend;
  }
}

function welt(name?: string): string {
  nummer += 1;
  const datei = path.join(ordner, name ?? `${nummer}.db`);
  offen.push(datei);
  return datei;
}

function fangAusgabe(arbeit: () => void): string[] {
  const zeilen: string[] = [];
  const vorher = console.log;
  console.log = ((...teile: unknown[]) => {
    zeilen.push(teile.map((teil) => String(teil)).join(' '));
  }) as typeof console.log;
  try {
    arbeit();
    return zeilen;
  } finally {
    console.log = vorher;
  }
}

function wirf(): AppFehler {
  try {
    verlangeSchluessel();
  } catch (fehler) {
    expect(fehler).toBeInstanceOf(AppFehler);
    return fehler as AppFehler;
  }
  throw new Error('Erwarteter Fehler blieb aus.');
}

async function mitRouten(pfad: string): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setErrorHandler((fehler, _anfrage, antwort) => {
    if (fehler instanceof AppFehler) {
      return antwort.status(fehler.statusCode).send({ fehler: fehler.message });
    }
    return antwort.status(500).send({ fehler: 'Interner Fehler. Details stehen im Server-Log.' });
  });
  app.addHook('onRequest', (_anfrage, _antwort, fertig) => {
    mitWelt(pfad, () => {
      fertig();
    });
  });
  await app.register(verbindungsRouten, { prefix: '/api' });
  return app;
}

beforeEach(() => {
  setzeTestschluessel();
});

afterEach(async () => {
  stelleSchluesselHer();
  delete process.env.TODOIST_API;
  while (attrappen.length > 0) {
    await attrappen.pop()?.stop();
  }
  for (const datei of offen.splice(0)) {
    schliesseWelt(datei);
  }
});

describe('Todoist-Token packen', () => {
  it('packt den Klartext und liefert ihn beim Entpacken zurück', () => {
    const paket = packeToken(KLAR);
    expect(paket.startsWith('v1.')).toBe(true);
    expect(paket).not.toContain(KLAR);
    expect(entpackeToken(paket)).toBe(KLAR);
  });

  it('lässt einen zweiten Lauf die gespeicherten Bytes unverändert', () => {
    const pfad = welt();
    mitWelt(pfad, () => setzeWert('todoistToken', KLAR));
    const erster = verschluesseleVorhandeneTodoistTokens(() => [pfad], () => undefined);
    expect(erster).toEqual({ tokens: 1, welten: 1 });
    const gespeichert = mitWelt(pfad, () => leseWert('todoistToken'));
    expect(gespeichert?.startsWith('v1.')).toBe(true);
    expect(entpackeToken(gespeichert ?? '')).toBe(KLAR);
    const zeilen = fangAusgabe(() => {
      const zweiter = verschluesseleVorhandeneTodoistTokens(() => [pfad], () => undefined);
      expect(zweiter).toEqual({ tokens: 0, welten: 1 });
    });
    expect(mitWelt(pfad, () => leseWert('todoistToken'))).toBe(gespeichert);
    expect(zeilen).toEqual(['Todoist-Tokens verschlüsselt: 0 (Welten: 1)']);
  });

  it('packt zwei Weltdateien und zählt eine gescheiterte Welt mit', () => {
    const eins = welt('eins.db');
    const zwei = welt('zwei.db');
    mitWelt(eins, () => setzeWert('todoistToken', 'klartext-welt-eins'));
    mitWelt(zwei, () => setzeWert('todoistToken', 'klartext-welt-zwei'));
    const sperre = path.join(ordner, 'sperre');
    writeFileSync(sperre, 'x');
    const schlecht = path.join(sperre, '9.db');
    const warnungen: string[] = [];
    const zeilen = fangAusgabe(() => {
      const ergebnis = verschluesseleVorhandeneTodoistTokens(
        () => [eins, zwei, schlecht],
        (text) => warnungen.push(text),
      );
      expect(ergebnis).toEqual({ tokens: 2, welten: 3 });
    });
    expect(warnungen).toEqual(['Todoist-Token der Welt 9 konnte nicht verschlüsselt werden.']);
    expect(zeilen).toEqual(['Todoist-Tokens verschlüsselt: 2 (Welten: 3)']);
    for (const [pfad, klar] of [
      [eins, 'klartext-welt-eins'],
      [zwei, 'klartext-welt-zwei'],
    ] as const) {
      const gespeichert = mitWelt(pfad, () => leseWert('todoistToken'));
      expect(gespeichert?.startsWith('v1.')).toBe(true);
      expect(entpackeToken(gespeichert ?? '')).toBe(klar);
    }
  });

  it('wirft beim Entpacken mit einem anderen Schlüssel', () => {
    const paket = packeToken(KLAR);
    process.env.STRIDE_TOKEN_SCHLUESSEL = ANDERER_SCHLUESSEL;
    expect(() => entpackeToken(paket)).toThrow('Paket ungueltig');
    expect(liesToken(paket)).toEqual({ art: 'unlesbar', grund: 'falsch' });
  });

  it('speichert beim Verbinden nur das Paket', async () => {
    const attrappe = await starteTodoistAttrappe({ nutzer: 'Ada' });
    attrappen.push(attrappe);
    process.env.TODOIST_API = attrappe.basis;
    await mitWeltAsync(welt(), async () => {
      await verbindeTodoist('test-token-1234');
      const gespeichert = leseWert('todoistToken');
      expect(gespeichert?.startsWith('v1.')).toBe(true);
      expect(gespeichert).not.toContain('test-token-1234');
      expect(entpackeToken(gespeichert ?? '')).toBe('test-token-1234');
    });
  });
});

describe('Schlüsselzustand', () => {
  it('wertet fehlende, leere und falsch lange Werte', () => {
    expect(schluesselZustand({})).toBe('fehlt');
    expect(schluesselZustand({ STRIDE_TOKEN_SCHLUESSEL: '' })).toBe('ungueltig');
    expect(schluesselZustand({ STRIDE_TOKEN_SCHLUESSEL: '   ' })).toBe('ungueltig');
    expect(schluesselZustand({ STRIDE_TOKEN_SCHLUESSEL: 'kurz' })).toBe('ungueltig');
    expect(schluesselZustand({ STRIDE_TOKEN_SCHLUESSEL: '%%%' })).toBe('ungueltig');
    expect(schluesselZustand({ STRIDE_TOKEN_SCHLUESSEL: Buffer.alloc(16, 1).toString('base64') })).toBe('ungueltig');
    expect(schluesselZustand({ STRIDE_TOKEN_SCHLUESSEL: ` ${TEST_SCHLUESSEL} ` })).toBe('gesetzt');
    expect(schluesselZustand({ ASCEND_TOKEN_SCHLUESSEL: TEST_SCHLUESSEL })).toBe('gesetzt');
    expect(schluesselZustand({ STRIDE_TOKEN_SCHLUESSEL: '', ASCEND_TOKEN_SCHLUESSEL: TEST_SCHLUESSEL })).toBe(
      'ungueltig',
    );
  });

  it('warnt beim Start passend und verschlüsselt nur mit brauchbarem Schlüssel', () => {
    ohneSchluessel();
    const fehlt: string[] = [];
    meldeTokenSchluessel((text) => fehlt.push(text));
    expect(fehlt).toEqual([LOG_FEHLT]);
    const pfad = welt();
    mitWelt(pfad, () => setzeWert('todoistToken', KLAR));
    let aufgerufen = false;
    const ohne = fangAusgabe(() => {
      const ergebnis = verschluesseleVorhandeneTodoistTokens(
        () => {
          aufgerufen = true;
          return [pfad];
        },
        () => undefined,
      );
      expect(ergebnis).toEqual({ tokens: 0, welten: 0 });
    });
    expect(aufgerufen).toBe(false);
    expect(ohne).toEqual([]);
    expect(mitWelt(pfad, () => leseWert('todoistToken'))).toBe(KLAR);

    process.env.STRIDE_TOKEN_SCHLUESSEL = 'kurz';
    const ungueltig: string[] = [];
    meldeTokenSchluessel((text) => ungueltig.push(text));
    expect(ungueltig).toEqual([LOG_UNGUELTIG]);
    const beiUngueltig = fangAusgabe(() => {
      expect(verschluesseleVorhandeneTodoistTokens(() => [pfad], () => undefined)).toEqual({ tokens: 0, welten: 0 });
    });
    expect(beiUngueltig).toEqual([]);

    setzeTestschluessel();
    const still: string[] = [];
    meldeTokenSchluessel((text) => still.push(text));
    expect(still).toEqual([]);
    const liste: string[] = [];
    const zeilen = fangAusgabe(() => {
      const ergebnis = verschluesseleVorhandeneTodoistTokens(
        () => {
          throw new Error('Liste GEHEIMWERT');
        },
        (text) => liste.push(text),
      );
      expect(ergebnis).toEqual({ tokens: 0, welten: 0 });
    });
    expect(liste).toEqual(['Die Todoist-Tokens konnten nicht verschlüsselt werden.']);
    expect(liste.join(' ')).not.toContain('GEHEIMWERT');
    expect(zeilen).toEqual(['Todoist-Tokens verschlüsselt: 0 (Welten: 0)']);
  });

  it('verweigert neues Verbinden ohne brauchbaren Schlüssel', () => {
    ohneSchluessel();
    const fehler = wirf();
    expect(fehler.statusCode).toBe(404);
    expect(fehler.message).toBe(SATZ_BETREIBER);
    process.env.STRIDE_TOKEN_SCHLUESSEL = 'kurz';
    expect(wirf().message).toBe(SATZ_BETREIBER);
    setzeTestschluessel();
    expect(() => verlangeSchluessel()).not.toThrow();
  });

  it('liest Klartext weiter und meldet ein unlesbares Paket', () => {
    ohneSchluessel();
    expect(tokenFuerAufruf(KLAR)).toBe(KLAR);
    expect(liesToken(null)).toEqual({ art: 'keiner' });
    expect(liesToken(KLAR)).toEqual({ art: 'klar' });
    const paket = `v1.${Buffer.from('kaputt').toString('base64')}`;
    expect(liesToken(paket)).toEqual({ art: 'unlesbar', grund: 'kein-schluessel' });
    try {
      tokenFuerAufruf(paket);
      throw new Error('Erwarteter Fehler blieb aus.');
    } catch (fehler) {
      expect(fehler).toBeInstanceOf(AppFehler);
      const appFehler = fehler as AppFehler;
      expect(appFehler.statusCode).toBe(400);
      expect(appFehler.art).toBe('schluessel');
      expect(appFehler.message).toBe(SATZ_BETREIBER);
    }
    setzeTestschluessel();
    try {
      tokenFuerAufruf(paket);
      throw new Error('Erwarteter Fehler blieb aus.');
    } catch (fehler) {
      expect(fehler).toBeInstanceOf(AppFehler);
      const appFehler = fehler as AppFehler;
      expect(appFehler.statusCode).toBe(400);
      expect(appFehler.art).toBe('schluessel');
      expect(appFehler.message).toBe(SATZ_UNLESBAR);
    }
  });
});

describe('Todoist über die Verbindungsschnittstelle', () => {
  it('antwortet ohne Schlüssel mit 404 und ohne Token nicht verfügbar', async () => {
    ohneSchluessel();
    const app = await mitRouten(welt());
    try {
      const put = await app.inject({
        method: 'PUT',
        url: '/api/verbindungen/todoist',
        payload: { token: 'test-token-1234' },
      });
      expect(put.statusCode).toBe(404);
      expect(put.json()).toEqual({ fehler: SATZ_BETREIBER });
      const lesen = await app.inject({ method: 'GET', url: '/api/verbindungen' });
      expect(lesen.statusCode).toBe(200);
      const koerper = lesen.json() as { todoist: { verfuegbar: boolean; verbunden: boolean } };
      expect(koerper.todoist.verfuegbar).toBe(false);
      expect(koerper.todoist.verbunden).toBe(false);
    } finally {
      await app.close();
    }
  });

  it('lässt vorhandenen Klartext verfügbar und unverändert', async () => {
    ohneSchluessel();
    const pfad = welt();
    mitWelt(pfad, () => setzeWert('todoistToken', KLAR));
    const app = await mitRouten(pfad);
    try {
      const lesen = await app.inject({ method: 'GET', url: '/api/verbindungen' });
      expect(lesen.statusCode).toBe(200);
      const koerper = lesen.json() as { todoist: { verfuegbar: boolean; verbunden: boolean; fehler: string | null } };
      expect(koerper.todoist.verfuegbar).toBe(true);
      expect(koerper.todoist.verbunden).toBe(true);
      expect(koerper.todoist.fehler).toBeNull();
      expect(mitWelt(pfad, () => leseWert('todoistToken'))).toBe(KLAR);
    } finally {
      await app.close();
    }
  });

  it('gleicht ein unlesbares Paket ab, ohne Todoist zu rufen', async () => {
    const paket = packeToken(KLAR);
    process.env.STRIDE_TOKEN_SCHLUESSEL = ANDERER_SCHLUESSEL;
    const attrappe = await starteTodoistAttrappe({ nutzer: 'Ada' });
    attrappen.push(attrappe);
    process.env.TODOIST_API = attrappe.basis;
    const pfad = welt();
    mitWelt(pfad, () => setzeWert('todoistToken', paket));
    const app = await mitRouten(pfad);
    try {
      const antwort = await app.inject({ method: 'POST', url: '/api/verbindungen/abgleichen' });
      expect(antwort.statusCode).toBe(200);
      const koerper = antwort.json() as { fehler: string[] };
      expect(koerper.fehler).toEqual([SATZ_UNLESBAR]);
      expect(attrappe.anfragen).toEqual([]);
      expect(mitWelt(pfad, () => leseWert('todoistFehlerArt'))).toBe('schluessel');
      expect(mitWelt(pfad, () => leseWert('todoistFehler'))).toBe(SATZ_UNLESBAR);
    } finally {
      await app.close();
    }
  });
});
