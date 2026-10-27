import { z } from 'zod';
import { AKTIVIERUNGS_MODI, INVESTITIONS_ARTEN, SICHERUNG_APP, ZEITRAEUME } from '../shared/api/index.ts';
import { ABSCHLUESSE, ATTRIBUT_KENNUNGEN, FARBE, GRENZEN, ICONS } from '../shared/spiel/begriffe.ts';
import { VERFALL_STUFEN } from '../shared/spiel/belastung.ts';
import { PRIORITAET_FORMAT, WIEDERHOLUNGEN, WOCHENTAG_FORMAT } from '../shared/spiel/aufgabe.ts';
import { DATUM_HINWEIS } from '../shared/spiel/datum.ts';
import { EBENEN } from '../shared/spiel/ebenen.ts';
import { FUNKTIONEN } from '../shared/spiel/funktionen.ts';
import { istLeiste, LEISTEN_SEITEN } from '../shared/spiel/leiste.ts';
import { FOKUS_IDS, FOKUS_PFLICHT, GEBURTSJAHR_MIN, PROFILNAME_MAX, ZIELSTREBIGKEITEN } from '../shared/spiel/profil.ts';
import { istHexFarbe } from '../shared/spiel/farben.ts';
import { STILE } from '../shared/features/darstellung/stile.ts';
import { SPRACHEN } from '../shared/sprache/kern.ts';
import {
  GEWICHT_EINHEITEN,
  GEWICHT_MINDEST,
  SAETZE_BIS,
  SAETZE_HINWEIS,
  SEKUNDEN_MINDEST,
  UEBUNGS_ARTEN,
  WIEDERHOLUNGEN_MINDEST,
} from '../shared/spiel/training.ts';
import { VISION } from '../shared/spiel/xp.ts';

z.config(z.locales.de());

const SEITE_STANDARD = 30;
const SEITE_MAX = 100;

const pflichtText = (feld: string, max: number) =>
  z.string().trim().min(1, `${feld} darf nicht leer sein.`).max(max, `${feld} darf höchstens ${max} Zeichen haben.`);
const freiText = (feld: string, max: number) =>
  z.string().trim().max(max, `${feld} darf höchstens ${max} Zeichen haben.`);
const id = z.coerce.number().int().positive();
const optionaleId = z.number().int().positive().nullable();
const farbe = z.string().refine(istHexFarbe, `Die Farbe muss als Hex-Wert angegeben werden, z. B. ${FARBE.gruen}.`);
const archiviert = { archiviert: z.boolean().optional() };
const datum = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, DATUM_HINWEIS);
const stunden = z
  .number()
  .min(GRENZEN.stundenMin, `Die Dauer muss mindestens ${GRENZEN.stundenMin} Stunden sein.`)
  .max(GRENZEN.stundenMax, `Die Dauer darf höchstens ${GRENZEN.stundenMax} Stunden sein.`)
  .nullable();

export const idParameter = z.object({ id });

export const attributAktivierungSchema = z.object({
  kennung: z.enum(ATTRIBUT_KENNUNGEN),
  modus: z.enum(AKTIVIERUNGS_MODI).default('behalten'),
  level: z.number().int().min(1, 'Das Level muss mindestens 1 sein.').max(GRENZEN.visionLevelMax).nullable().default(null),
});

export const attributAenderungSchema = z
  .object({
    name: pflichtText('Der Name', GRENZEN.nameMax),
    beschreibung: freiText('Die Beschreibung', GRENZEN.beschreibungMax),
    farbe,
    icon: z.enum(ICONS),
    verfallBelastung: z.enum(VERFALL_STUFEN),
    verfallZeit: z.enum(VERFALL_STUFEN),
    erschoepfung: z.boolean(),
    erschoepfungZiel: optionaleId,
  })
  .partial()
  .extend(archiviert);

const gewichteSchema = z
  .array(
    z.object({
      attributId: z.number().int().positive(),
      gewicht: z.number().int().min(1).max(GRENZEN.vorlageGewichtMax),
    }),
  )
  .min(1, 'Eine Tätigkeit braucht mindestens ein Attribut.')
  .max(GRENZEN.vorlageAttributeMax, `Eine Tätigkeit darf höchstens ${GRENZEN.vorlageAttributeMax} Attribute haben.`)
  .refine(
    (gewichte) => new Set(gewichte.map((gewicht) => gewicht.attributId)).size === gewichte.length,
    'Jedes Attribut darf nur einmal vorkommen.',
  );

export const vorlageSchema = z.object({
  name: pflichtText('Der Name', GRENZEN.nameMax),
  icon: z.enum(ICONS),
  gewichte: gewichteSchema,
  projektId: optionaleId.nullish(),
});
export const vorlageAenderungSchema = vorlageSchema.omit({ projektId: true }).partial().extend(archiviert);

export const visionSchema = z.object({
  titel: pflichtText('Der Titel', GRENZEN.nameMax),
  beschreibung: freiText('Die Beschreibung', GRENZEN.beschreibungMax),
  farbe,
  woopErgebnis: freiText('Das Ergebnis', GRENZEN.beschreibungMax),
  woopHindernis: freiText('Das Hindernis', GRENZEN.beschreibungMax),
  woopPlan: freiText('Der Plan', GRENZEN.beschreibungMax),
  level: z
    .number()
    .int('Das Level muss eine ganze Zahl sein.')
    .min(VISION.minLevel, `Eine Vision braucht mindestens Level ${VISION.minLevel}.`)
    .max(GRENZEN.visionLevelMax, `Das Level darf höchstens ${GRENZEN.visionLevelMax} sein.`)
    .nullable(),
});
export const visionAenderungSchema = visionSchema.partial().extend(archiviert);

export const organisationSchema = z.object({
  name: pflichtText('Der Name', GRENZEN.nameMax),
  beschreibung: freiText('Die Beschreibung', GRENZEN.beschreibungMax),
  farbe,
  visionId: optionaleId,
});
export const organisationAenderungSchema = organisationSchema.partial().extend(archiviert);

export const projektSchema = z.object({
  name: pflichtText('Der Name', GRENZEN.nameMax),
  beschreibung: freiText('Die Beschreibung', GRENZEN.beschreibungMax),
  visionId: optionaleId,
  organisationId: optionaleId,
  standardVorlageId: z.number().int().positive(),
  abschlussVorlageId: z.number().int().positive().nullable().optional(),
});
const investitionsZielSchema = z.object({
  art: z.enum(INVESTITIONS_ARTEN),
  id: z.number().int().positive(),
});

const investitionsGroesse = z.number().int().min(0).max(3);

export const projektAenderungSchema = projektSchema.partial().extend({
  ...archiviert,
  investition: z.boolean().optional(),
  investitionZiel: investitionsZielSchema.nullable().optional(),
  investitionRessourcen: z.boolean().optional(),
  investitionGroesse: investitionsGroesse.optional(),
  geschafft: z.boolean().optional(),
});

export const investitionSchema = z.object({
  name: pflichtText('Der Name', GRENZEN.nameMax),
  icon: z.enum(ICONS),
  groesse: investitionsGroesse,
  attributId: z.number().int().positive(),
  ziel: investitionsZielSchema.nullable().optional(),
});

export const investitionAenderungSchema = investitionSchema.partial().extend(archiviert);

export const vorhabenSchema = z.object({
  titel: pflichtText('Der Titel', GRENZEN.nameMax),
});

export const vorhabenAnlegenSchema = vorhabenSchema.extend({
  projektId: z.number().int().positive(),
});

export const vorhabenAenderungSchema = z.object({
  titel: pflichtText('Der Titel', GRENZEN.nameMax).optional(),
  boss: z
    .object({
      deadline: datum,
    })
    .nullable()
    .optional(),
});

export const faehigkeitSchema = z.object({
  name: pflichtText('Der Name', GRENZEN.nameMax),
  beschreibung: freiText('Die Beschreibung', GRENZEN.beschreibungMax),
  farbe,
  icon: z.enum(ICONS),
});
export const faehigkeitAenderungSchema = faehigkeitSchema.partial().extend(archiviert);

export const knotenSchema = z.object({
  titel: pflichtText('Der Titel', GRENZEN.nameMax),
  beschreibung: freiText('Die Beschreibung', GRENZEN.beschreibungMax),
  elternId: optionaleId,
});
export const knotenAenderungSchema = knotenSchema.omit({ elternId: true }).partial();

const vorhabenWahlSchema = z
  .discriminatedUnion('art', [
    z.object({ art: z.literal('bestehend'), id: z.number().int().positive() }),
    z.object({ art: z.literal('neu'), titel: pflichtText('Der Titel des Vorhabens', GRENZEN.nameMax) }),
  ])
  .nullable();

export const eintragSchema = z.object({
  projektId: z.number().int().positive().nullable(),
  vorlageId: z.number().int().positive(),
  vorhaben: vorhabenWahlSchema,
  abschluss: z.enum(ABSCHLUESSE).nullable(),
  erkenntnis: freiText('Die Erkenntnis', GRENZEN.notizMax),
  stunden,
  notiz: freiText('Die Notiz', GRENZEN.notizMax),
  meilenstein: z.boolean(),
  faehigkeitId: optionaleId,
  datum: z.string().nullable(),
});

const wahrheitswert = z.enum(['true', 'false']).transform((wert) => wert === 'true');

export const eintragAbfrageSchema = z.object({
  visionId: id.optional(),
  organisationId: id.optional(),
  projektId: id.optional(),
  vorlageId: id.optional(),
  faehigkeitId: id.optional(),
  nurMeilensteine: wahrheitswert.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(SEITE_MAX).default(SEITE_STANDARD),
});

export const basisAufgabeSchema = z.object({
  name: pflichtText('Der Name', GRENZEN.nameMax),
  icon: z.enum(ICONS),
  projektId: z.number().int().positive().nullable(),
  vorlageId: optionaleId,
  stunden,
});
export const basisAufgabeAenderungSchema = basisAufgabeSchema.partial().extend(archiviert);

const aufgabePrioritaet = z
  .number()
  .int(PRIORITAET_FORMAT)
  .min(1, PRIORITAET_FORMAT)
  .max(4, PRIORITAET_FORMAT)
  .nullable();

export const aufgabeSchema = z.object({
  name: pflichtText('Der Name', GRENZEN.nameMax),
  icon: z.literal('clipboard-list'),
  projektId: optionaleId,
  organisationId: optionaleId,
  visionId: optionaleId,
  vorlageId: optionaleId,
  stunden,
  faelligAm: datum.nullable(),
  faelligUm: z.string().nullable(),
  wiederholung: z.enum(WIEDERHOLUNGEN),
  wochentage: z.array(z.number().int()),
  prioritaet: aufgabePrioritaet,
  nurHeute: z.boolean(),
  meilenstein: z.boolean(),
  gegner: z.boolean(),
  boss: z.boolean(),
  deadline: datum.nullable(),
});
export const aufgabeAenderungSchema = aufgabeSchema.partial().extend(archiviert);
export const aufgabeAbfrageSchema = z.object({
  archiv: z.literal('1').optional(),
});

const saetze = z.number().int(SAETZE_HINWEIS).min(1, SAETZE_HINWEIS).max(SAETZE_BIS, SAETZE_HINWEIS);
const wiederholungen = z.number().int(WIEDERHOLUNGEN_MINDEST).min(1, WIEDERHOLUNGEN_MINDEST).nullable();
const sekunden = z.number().int(SEKUNDEN_MINDEST).min(1, SEKUNDEN_MINDEST).nullable();
const gramm = z.number().int(GEWICHT_MINDEST).min(1, GEWICHT_MINDEST).nullable();
const wochentag = z.number().int(WOCHENTAG_FORMAT).min(1, WOCHENTAG_FORMAT).max(7, WOCHENTAG_FORMAT);

const planEintragSchema = z.object({
  name: pflichtText('Der Name', GRENZEN.nameMax),
  art: z.enum(UEBUNGS_ARTEN),
  zielSaetze: saetze.nullable(),
  zielWiederholungen: wiederholungen,
  zielGewichtG: gramm,
  zielSekunden: sekunden,
  aufwaermSaetze: saetze.nullable(),
  aufwaermWiederholungen: wiederholungen,
  aufwaermGewichtG: gramm,
  aufwaermSekunden: sekunden,
});

export const trainingsplanSchema = z.object({
  name: pflichtText('Der Name', GRENZEN.nameMax),
  wochentage: z.array(wochentag),
  projektId: optionaleId,
  vorlageId: optionaleId,
  uebungen: z.array(planEintragSchema),
});
export const trainingsplanAenderungSchema = trainingsplanSchema.partial().extend(archiviert);
export const uebungSchema = z.object({
  name: pflichtText('Der Name', GRENZEN.nameMax),
  art: z.enum(UEBUNGS_ARTEN),
});
export const uebungAenderungSchema = uebungSchema.partial().extend(archiviert);
export const trainingAbfrageSchema = z.object({
  archiv: z.literal('1').optional(),
});
export const einheitStartSchema = z.object({
  planId: z.number().int().positive(),
});

export const titelSchema = z.object({
  schluessel: z.string().max(GRENZEN.nameMax).nullable(),
});

export const wocheParameter = z.object({ woche: datum });

export const rueckblickAbfrageSchema = z.object({ woche: datum.optional() });

export const rueckblickSchema = z.object({
  gut: freiText('Die Antwort', GRENZEN.notizMax),
  lernen: freiText('Die Antwort', GRENZEN.notizMax),
  fokus: freiText('Die Antwort', GRENZEN.notizMax),
});

export const statistikAbfrageSchema = z.object({
  zeitraum: z.enum(ZEITRAEUME).default('3m'),
});

/** Alter Schlüssel `aufgaben` und andere Unbekannte fallen weg, der Rest der Änderung bleibt gültig. */
function bekannteFunktionen(wert: unknown): unknown {
  if (typeof wert !== 'object' || wert === null || Array.isArray(wert)) {
    return wert;
  }
  const bekannt = new Set<string>(FUNKTIONEN);
  const kopie: Record<string, boolean> = {};
  for (const [schluessel, eintrag] of Object.entries(wert)) {
    if (bekannt.has(schluessel) && typeof eintrag === 'boolean') {
      kopie[schluessel] = eintrag;
    }
  }
  return kopie;
}

export const einstellungenAenderungSchema = z.object({
  charakterName: pflichtText('Der Name', PROFILNAME_MAX).optional(),
  sound: z.boolean().optional(),
  geburtsjahr: z.number().int().min(GEBURTSJAHR_MIN).max(new Date().getFullYear()).nullable().optional(),
  zielstrebigkeit: z.enum(ZIELSTREBIGKEITEN).optional(),
  fokus: z
    .array(z.enum(FOKUS_IDS))
    .min(1, FOKUS_PFLICHT)
    .refine((ids) => new Set(ids).size === ids.length, 'Jeden Fokus nur einmal.')
    .optional(),
  profilAngelegt: z.boolean().optional(),
  stil: z.enum(STILE).optional(),
  primaer: z.string().refine(istHexFarbe, 'Die Primärfarbe braucht das Format #rrggbb.').optional(),
  akzent: z.string().refine(istHexFarbe, 'Die Akzentfarbe braucht das Format #rrggbb.').optional(),
  hintergrund: z.string().refine(istHexFarbe, 'Die Hintergrundfarbe braucht das Format #rrggbb.').optional(),
  farbenZuruecksetzen: z.boolean().optional(),
  glimmen: z.boolean().optional(),
  funktionen: z.preprocess(bekannteFunktionen, z.partialRecord(z.enum(FUNKTIONEN), z.boolean())).optional(),
  ebenen: z.partialRecord(z.enum(EBENEN), z.boolean()).optional(),
  mobilLeiste: z
    .array(z.string())
    .max(LEISTEN_SEITEN.length)
    .refine(istLeiste, 'Die Leiste enthält eine unbekannte oder doppelte Seite.')
    .optional(),
  sprache: z.enum(SPRACHEN).optional(),
  zeitzone: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine((wert) => istZeitzone(wert), 'Die Zeitzone ist ungültig.')
    .optional(),
  gewichtEinheit: z.enum(GEWICHT_EINHEITEN).optional(),
});

function istZeitzone(wert: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: wert });
    return true;
  } catch {
    return false;
  }
}

export function beschreibeValidierungsfehler(fehler: z.ZodError): string {
  const erster = fehler.issues[0];
  if (!erster) {
    return 'Ungültige Eingabe.';
  }
  const feld = erster.path.join('.');
  return feld ? `${erster.message} (${feld})` : erster.message;
}

const datenWert = z.union([z.string(), z.number(), z.null()]);

export const datenImportSchema = z.object({
  app: z.literal(SICHERUNG_APP, { error: 'Das ist keine Stride-Sicherung.' }),
  schemaVersion: z.number().int().min(1),
  exportiertAm: z.string(),
  tabellen: z.record(z.string(), z.array(z.record(z.string(), datenWert))),
});

const TOKEN_MIN = 10;
const TOKEN_MAX = 200;
const ADRESSE_MAX = 2000;

export const todoistTokenSchema = z.object({
  token: z
    .string()
    .trim()
    .min(TOKEN_MIN, 'Der Todoist-Token ist zu kurz.')
    .max(TOKEN_MAX, 'Der Todoist-Token ist zu lang.'),
});

export const todoistParameter = z.object({ todoistId: z.string().min(1).max(TOKEN_MAX) });

const todoistZiel = z.enum(['vision', 'projekt', 'vorhaben']).nullable();
const labelStunden = z
  .number()
  .min(0)
  .max(GRENZEN.stundenMax, `Die Dauer darf höchstens ${GRENZEN.stundenMax} Stunden sein.`)
  .nullable()
  .refine(
    (wert) => wert === null || wert === 0 || wert >= GRENZEN.stundenMin,
    `Die Dauer muss mindestens ${GRENZEN.stundenMin} Stunden sein.`,
  );

export const todoistZuordnungSchema = z.object({
  projektId: optionaleId,
  vorlageId: optionaleId,
  stunden,
  zielArt: todoistZiel.optional(),
  zielId: optionaleId.optional(),
  faehigkeitId: optionaleId.optional(),
  abschluss: z.enum(['geschafft', 'gescheitert']).nullable().optional(),
  erkenntnis: freiText('Die Erkenntnis', GRENZEN.notizMax).optional(),
  notiz: freiText('Die Notiz', GRENZEN.notizMax).optional(),
  meilenstein: z.boolean().optional(),
});

export const todoistLabelSchema = z.object({
  aktiv: z.boolean(),
  zielArt: todoistZiel,
  zielId: optionaleId,
  projektId: optionaleId,
  vorlageId: optionaleId,
  stunden: labelStunden,
  faehigkeitId: z.number().int().min(0).nullable(),
  abschluss: z.enum(['geschafft', 'gescheitert', 'offen']).nullable(),
  erkenntnis: freiText('Die Erkenntnis', GRENZEN.notizMax),
  notiz: freiText('Die Notiz', GRENZEN.notizMax),
  meilenstein: z.boolean().nullable(),
});

export const todoistReihenfolgeSchema = z.object({
  ids: z.array(z.string().min(1).max(TOKEN_MAX)).max(500),
});

export const kalenderSchema = z.object({
  name: pflichtText('Der Name', GRENZEN.nameMax),
  adresse: pflichtText('Die Adresse', ADRESSE_MAX),
  projektId: z.number().int().positive(),
  vorlageId: optionaleId.default(null),
  filter: freiText('Der Filter', GRENZEN.nameMax).default(''),
});

export const kalenderAenderungSchema = kalenderSchema.omit({ adresse: true }).partial();

export const PASSWORT_MIN = 10;
export const PASSWORT_MAX = 200;
export const BENUTZER_MAX = 40;

const benutzernameText = z
  .string()
  .trim()
  .min(1, 'Der Benutzername darf nicht leer sein.')
  .max(BENUTZER_MAX, `Der Benutzername darf höchstens ${BENUTZER_MAX} Zeichen haben.`);

const passwortText = z
  .string()
  .min(PASSWORT_MIN, `Das Passwort muss mindestens ${PASSWORT_MIN} Zeichen haben.`)
  .max(PASSWORT_MAX, `Das Passwort darf höchstens ${PASSWORT_MAX} Zeichen haben.`);

export const anmeldeSchema = z.object({
  benutzername: benutzernameText.optional(),
  passwort: passwortText,
});

export const benutzernameSchema = z.object({ benutzername: benutzernameText });

export const kontoSchema = z.object({
  benutzername: benutzernameText,
  passwort: passwortText,
  profilname: pflichtText('Der Profilname', PROFILNAME_MAX).optional(),
});

export const passwortAenderungSchema = z.object({
  bisher: z.string().min(1, 'Das bisherige Passwort fehlt.'),
  neu: passwortText,
});
