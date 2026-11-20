export const APP_ADRESSE_STANDARD = 'https://stride.leohr.de';
export const APP_ADRESSE_META = 'wupo-app-adresse';

export function gueltigeAppAdresse(roh: string | null | undefined): string | null {
  if (typeof roh !== 'string') {
    return null;
  }
  const wert = roh.trim();
  if (wert.length === 0) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(wert);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') {
    return null;
  }
  if (url.username !== '' || url.password !== '') {
    return null;
  }
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    return null;
  }
  if (url.host.length === 0) {
    return null;
  }
  return url.origin;
}

export function appAdresse(roh: string | null | undefined): string {
  return gueltigeAppAdresse(roh) ?? APP_ADRESSE_STANDARD;
}

export function appHost(adresse: string): string {
  return new URL(adresse).host;
}
