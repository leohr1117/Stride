import { attributeApi, attributeSchluessel } from './attribute.ts';
import { basisApi, basisSchluessel } from './basis.ts';
import { bewertungApi, bewertungSchluessel } from './bewertung.ts';
import { EXPORT_ADRESSE, datenApi } from './daten.ts';
import { einstellungenApi, einstellungenSchluessel } from './einstellungen.ts';
import { eintraegeApi, eintraegeSchluessel } from './eintraege.ts';
import { erfolgeApi, erfolgeSchluessel } from './erfolge.ts';
import { faehigkeitenApi, faehigkeitenSchluessel } from './faehigkeiten.ts';
import { investitionenApi, investitionenSchluessel } from './investitionen.ts';
import { hinweiseApi, hinweiseSchluessel } from './hinweise.ts';
import { kalenderApi } from './kalender.ts';
import { ketteApi, ketteSchluessel } from './kette.ts';
import { ApiFehler, beobachteAnmeldung, meldeAnmeldungAbgelaufen } from './kern.ts';
import { rueckblickApi, rueckblickSchluessel } from './rueckblick.ts';
import { statistikenApi, statistikenSchluessel } from './statistiken.ts';
import { taetigkeitenApi, taetigkeitenSchluessel } from './taetigkeiten.ts';
import { todoistApi } from './todoist.ts';
import { uebersichtApi, uebersichtSchluessel } from './uebersicht.ts';
import { verbindungenApi, verbindungenSchluessel } from './verbindungen.ts';
import { zieleApi, zieleSchluessel } from './ziele.ts';
import { zugangApi, zugangSchluessel } from './zugang.ts';

export { ApiFehler, beobachteAnmeldung, meldeAnmeldungAbgelaufen, EXPORT_ADRESSE };

export const api = {
  ...zugangApi,
  ...uebersichtApi,
  ...attributeApi,
  ...taetigkeitenApi,
  ...zieleApi,
  ...investitionenApi,
  ...eintraegeApi,
  ...faehigkeitenApi,
  ...basisApi,
  ...bewertungApi,
  ...erfolgeApi,
  ...rueckblickApi,
  ...statistikenApi,
  ...einstellungenApi,
  ...datenApi,
  ...verbindungenApi,
  ...todoistApi,
  ...kalenderApi,
  ...ketteApi,
  ...hinweiseApi,
};

export const SCHLUESSEL = {
  ...uebersichtSchluessel,
  ...attributeSchluessel,
  ...taetigkeitenSchluessel,
  ...zieleSchluessel,
  ...investitionenSchluessel,
  ...eintraegeSchluessel,
  ...faehigkeitenSchluessel,
  ...basisSchluessel,
  ...bewertungSchluessel,
  ...erfolgeSchluessel,
  ...rueckblickSchluessel,
  ...statistikenSchluessel,
  ...einstellungenSchluessel,
  ...verbindungenSchluessel,
  ...zugangSchluessel,
  ...ketteSchluessel,
  ...hinweiseSchluessel,
} as const;
