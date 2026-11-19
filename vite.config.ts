import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { gitHead, leseCommit, lizenztextFuerRepo } from './skripte/lizenzliste.ts';

const SERVER_PORT = Number(process.env.PORT ?? 3000);
const CLIENT_ORDNER = path.resolve(import.meta.dirname, 'client');
const PUBLIC_ORDNER = path.join(CLIENT_ORDNER, 'public');
const SERVICE_WORKER_VORLAGE = path.join(CLIENT_ORDNER, 'service-worker.js');
const SERVICE_WORKER_DATEI = 'sw.js';
const VERSIONS_LAENGE = 12;
const NUR_BEI_BEDARF = [/\.woff2?$/, /^assets\/stil-[^/]+\.css$/, /^lizenzen\.txt$/];
const BAU_COMMIT = leseCommit(process.env, () => gitHead(import.meta.dirname));
const OFL_DATEI = path.join(import.meta.dirname, 'client/src/features/zugang/roboto-OFL.txt');
const ROBOTO_DATEI = path.join(import.meta.dirname, 'client/src/features/zugang/roboto-latin-500.woff2');
const ROBOTO_NAME = 'roboto-latin-500.woff2';

function wirdVorgeladen(name: string): boolean {
  return !NUR_BEI_BEDARF.some((muster) => muster.test(name));
}

function oeffentlicheDateien(ordner: string, praefix = ''): string[] {
  const dateien: string[] = [];
  for (const eintrag of fs.readdirSync(ordner, { withFileTypes: true })) {
    const relativ = `${praefix}/${eintrag.name}`;
    if (eintrag.isDirectory()) {
      dateien.push(...oeffentlicheDateien(path.join(ordner, eintrag.name), relativ));
    } else {
      dateien.push(relativ);
    }
  }
  return dateien;
}

function palettenModul(): Plugin {
  const konkret = path.resolve(import.meta.dirname, 'shared/features/darstellung/paletten.ts');
  const modulId = path.resolve(import.meta.dirname, 'shared/spiel/paletten.ts');
  const normal = (pfad: string) => pfad.replaceAll('\\', '/');
  const konkretNorm = normal(konkret);
  const modulNorm = normal(modulId);
  return {
    name: 'stride-paletten-modul',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!source.endsWith('paletten.ts')) return null;
      const basis = importer ? path.dirname(importer.split('?')[0] ?? importer) : import.meta.dirname;
      const aufgeloest = path.isAbsolute(source) ? source.split('?')[0] : path.resolve(basis, source);
      const ziel = normal(aufgeloest ?? '');
      if (ziel === konkretNorm || ziel === modulNorm) return modulId;
      return null;
    },
    load(id) {
      const pfad = id.split('?')[0]?.replaceAll('\\', '/') ?? '';
      if (pfad !== modulNorm && !pfad.endsWith('/shared/spiel/paletten.ts')) return null;
      return fs
        .readFileSync(konkret, 'utf8')
        .replaceAll("from '../../spiel/farben.ts'", "from './farben.ts'")
        .replaceAll("from './stile.ts'", "from '../features/darstellung/stile.ts'");
    },
  };
}

function serviceWorker(): Plugin {
  return {
    name: 'stride-service-worker',
    apply: 'build',
    // Vite löscht reine CSS-JS-Platzhalter erst am Ende von generateBundle. Die Liste muss danach entstehen, sonst schlägt cache.addAll fehl und push kommt nie an.
    writeBundle(optionen, bundle) {
      const pruefsumme = createHash('sha256');
      const dateien: string[] = [];
      for (const [name, datei] of Object.entries(bundle)) {
        if (wirdVorgeladen(name)) {
          dateien.push(`/${name}`);
        }
        pruefsumme.update(name);
        pruefsumme.update(datei.type === 'chunk' ? datei.code : datei.source);
      }
      for (const datei of oeffentlicheDateien(PUBLIC_ORDNER)) {
        if (/(?:^|\/)lizenzen\.txt$/.test(datei)) {
          continue;
        }
        dateien.push(datei);
        pruefsumme.update(datei);
        pruefsumme.update(fs.readFileSync(path.join(PUBLIC_ORDNER, datei)));
      }
      const vorlage = fs.readFileSync(SERVICE_WORKER_VORLAGE, 'utf8');
      const quelle = vorlage
        .replace('__VERSION__', pruefsumme.digest('hex').slice(0, VERSIONS_LAENGE))
        .replace(`['__DATEIEN__']`, JSON.stringify(dateien.sort()));
      const ausgabe = optionen.dir ?? path.join(CLIENT_ORDNER, 'dist');
      fs.writeFileSync(path.join(ausgabe, SERVICE_WORKER_DATEI), quelle);
    },
  };
}

function robotoSchrift(): Plugin {
  return {
    name: 'stride-roboto',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: ROBOTO_NAME, source: fs.readFileSync(ROBOTO_DATEI) });
    },
    configureServer(server) {
      server.middlewares.use((anfrage, antwort, weiter) => {
        const url = anfrage.url?.split('?')[0];
        if (url !== `/${ROBOTO_NAME}`) {
          weiter();
          return;
        }
        antwort.statusCode = 200;
        antwort.setHeader('Content-Type', 'font/woff2');
        antwort.end(fs.readFileSync(ROBOTO_DATEI));
      });
    },
  };
}

function lizenzliste(): Plugin {
  let gemerkt: string | undefined;
  const inhalt = (): string => {
    gemerkt ??= lizenztextFuerRepo(import.meta.dirname, BAU_COMMIT, OFL_DATEI);
    return gemerkt;
  };
  return {
    name: 'stride-lizenzliste',
    buildStart() {
      // Vite kopiert client/public nach dem Bundle und würde sonst die alte Liste darüberlegen.
      fs.writeFileSync(path.join(PUBLIC_ORDNER, 'lizenzen.txt'), inhalt());
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'lizenzen.txt', source: inhalt() });
    },
    configureServer(server) {
      server.middlewares.use((anfrage, antwort, weiter) => {
        const url = anfrage.url?.split('?')[0];
        if (url !== '/lizenzen.txt') {
          weiter();
          return;
        }
        antwort.statusCode = 200;
        antwort.setHeader('Content-Type', 'text/plain; charset=utf-8');
        antwort.end(inhalt());
      });
    },
  };
}

function strideVersion(): Plugin {
  return {
    name: 'stride-version',
    transformIndexHtml(html) {
      const datei = path.resolve(import.meta.dirname, 'package.json');
      let paket: { version?: unknown };
      try {
        paket = JSON.parse(fs.readFileSync(datei, 'utf8')) as { version?: unknown };
      } catch (fehler) {
        const grund = fehler instanceof Error ? fehler.message : String(fehler);
        throw new Error(
          `stride-version: package.json ließ sich nicht lesen (${grund}). Der Platzhalter __STRIDE_VERSION__ wird nicht ausgeliefert.`,
        );
      }
      const version = paket.version;
      if (typeof version !== 'string' || version.trim() === '') {
        throw new Error(
          'stride-version: package.json enthält keine version. Der Platzhalter __STRIDE_VERSION__ wird nicht ausgeliefert.',
        );
      }
      return html.replaceAll('__STRIDE_VERSION__', version);
    },
  };
}

export default defineConfig({
  root: 'client',
  define: {
    'import.meta.env.VITE_STRIDE_COMMIT': JSON.stringify(BAU_COMMIT),
  },
  plugins: [palettenModul(), react(), tailwindcss(), lizenzliste(), robotoSchrift(), serviceWorker(), strideVersion()],
  server: {
    host: 'localhost',
    proxy: {
      '/api': `http://127.0.0.1:${SERVER_PORT}`,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
