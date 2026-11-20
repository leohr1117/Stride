import { APP_ADRESSE_META, APP_ADRESSE_STANDARD, appAdresse } from '../../../../shared/appAdresse.ts';

export function liesAppAdresse(): string {
  if (typeof document === 'undefined') {
    return APP_ADRESSE_STANDARD;
  }
  const inhalt = document.querySelector(`meta[name="${APP_ADRESSE_META}"]`)?.getAttribute('content');
  return appAdresse(inhalt);
}
