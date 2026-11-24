import { TEST_VERSION, TEST_VERSIONEN_META } from '../e2e/versionsquelle.ts';
import { strideVariable } from './umgebung.ts';

export function testversionEinblendung(env: NodeJS.ProcessEnv): string | null {
  if (strideVariable('TEST', env) !== '1') {
    return null;
  }
  return TEST_VERSION;
}

export function fuegeTestVersionEin(html: string, version: string): string {
  const marker = `name="${TEST_VERSIONEN_META}"`;
  if (html.includes(marker)) {
    return html;
  }
  const kopf = html.indexOf('</head>');
  if (kopf < 0) {
    return html;
  }
  const inhalt = version.replace(/["<>&]/g, '');
  const meta = `<meta name="${TEST_VERSIONEN_META}" content="${inhalt}">`;
  return `${html.slice(0, kopf)}${meta}${html.slice(kopf)}`;
}
