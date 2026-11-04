import { fuelle, localeFuer, type Sprache } from './kern.ts';
import { zeige } from './index.ts';

export type MengenKategorie = 'einzahl' | 'wenige' | 'mehrzahl';

const regeln = new Map<Sprache, Intl.PluralRules>();

function regelnFuer(sprache: Sprache): Intl.PluralRules {
  const vorhanden = regeln.get(sprache);
  if (vorhanden) return vorhanden;
  const neu = new Intl.PluralRules(localeFuer(sprache));
  regeln.set(sprache, neu);
  return neu;
}

export function mengenKategorie(sprache: Sprache, n: number): MengenKategorie {
  if (sprache === 'ja' || sprache === 'zh') return 'mehrzahl';
  const kategorie = regelnFuer(sprache).select(Math.abs(n));
  if (kategorie === 'one') return 'einzahl';
  if (kategorie === 'few') return 'wenige';
  return 'mehrzahl';
}

export const MENGEN_PAARE: readonly { mehrzahl: string; einzahl: string }[] = [
  {
    mehrzahl: 'Schutz: alle {tage} Tage, unter Heute einsetzen',
    einzahl: 'Schutz: alle {tage} Tag, unter Heute einsetzen',
  },
  {
    mehrzahl: 'Rückkehr: {frist} Tage, wenn kein Schutz',
    einzahl: 'Rückkehr: {frist} Tag, wenn kein Schutz',
  },
  {
    mehrzahl:
      'Ein Tag Pause ist frei. Danach ist der Streak angeschlagen. Alle {tage} Tage Streak liegt ein Schutz bereit. Unter Heute setzt du ihn ein. Er hält die bisherigen Tage. Am selben Tag brauchst du einen Eintrag. Der Schutz gibt keine XP.',
    einzahl:
      'Ein Tag Pause ist frei. Danach ist der Streak angeschlagen. Alle {tage} Tag Streak liegt ein Schutz bereit. Unter Heute setzt du ihn ein. Er hält die bisherigen Tage. Am selben Tag brauchst du einen Eintrag. Der Schutz gibt keine XP.',
  },
  {
    mehrzahl:
      'Setzt du ihn nicht ein, öffnet die Rückkehr für {frist} Tage. Ein Eintrag in der Frist schließt sie. Disziplin und Geist bekommen XP, wenn sie an sind. Nach der Frist ist die Rückkehr vorbei, ohne XP. Die nächste kommt erst {abstand} Tage nach dem Ende der letzten.',
    einzahl:
      'Setzt du ihn nicht ein, öffnet die Rückkehr für {frist} Tag. Ein Eintrag in der Frist schließt sie. Disziplin und Geist bekommen XP, wenn sie an sind. Nach der Frist ist die Rückkehr vorbei, ohne XP. Die nächste kommt erst {abstand} Tag nach dem Ende der letzten.',
  },
  { mehrzahl: 'Hält die {n} Tage', einzahl: 'Hält den {n} Tag' },
  { mehrzahl: '{n} Tage · Pause aufgebraucht', einzahl: '{n} Tag · Pause aufgebraucht' },
  { mehrzahl: '{tage} Tage', einzahl: '{tage} Tag' },
  { mehrzahl: '{anzahl} Einträge', einzahl: '{anzahl} Eintrag' },
  { mehrzahl: 'Level {level} · {anzahl} Einträge', einzahl: 'Level {level} · {anzahl} Eintrag' },
  {
    mehrzahl: '{laenge} Tage sind angeschlagen. Ein Eintrag heute hält sie.',
    einzahl: '{laenge} Tag ist angeschlagen. Ein Eintrag heute hält ihn.',
  },
  { mehrzahl: '{anzahl} Bereiche', einzahl: '{anzahl} Bereich' },
  { mehrzahl: '{n} Geräte', einzahl: '{n} Gerät' },
  { mehrzahl: '{anzahl} Datensätze importiert.', einzahl: '{anzahl} Datensatz importiert.' },
  { mehrzahl: '{zahl} neue Einträge übernommen.', einzahl: '{zahl} neuer Eintrag übernommen.' },
  { mehrzahl: '{alter} Jahre', einzahl: '{alter} Jahr' },
  { mehrzahl: 'Mit {alter} Jahren', einzahl: 'Mit {alter} Jahr' },
  { mehrzahl: 'Das entspricht ungefähr {alter} Jahren.', einzahl: 'Das entspricht ungefähr {alter} Jahr.' },
  {
    mehrzahl: 'Die Dauer muss mindestens {min} Stunden sein.',
    einzahl: 'Die Dauer muss mindestens {min} Stunde sein.',
  },
  {
    mehrzahl: 'Die Dauer darf höchstens {max} Stunden sein.',
    einzahl: 'Die Dauer darf höchstens {max} Stunde sein.',
  },
];

const EINZAHL_VON = new Map(MENGEN_PAARE.map((paar) => [paar.mehrzahl, paar.einzahl]));

const EINZAHL_GLEICH: Record<string, Partial<Record<Sprache, string>>> = {
  '{anzahl} Kalender': {
    en: '{anzahl} calendar',
    es: '{anzahl} calendario',
    fr: '{anzahl} calendrier',
    ru: '{anzahl} календарь',
  },
  '{anzahl} Vorhaben offen': {
    en: '{anzahl} task open',
    es: '{anzahl} tarea abierta',
    fr: '{anzahl} tâche ouverte',
    ru: '{anzahl} задача открыта',
  },
};

const RU_WENIGE: Record<string, string> = {
  'Schutz: alle {tage} Tage, unter Heute einsetzen': 'Защита: каждые {tage} дня, применить в Сегодня',
  'Rückkehr: {frist} Tage, wenn kein Schutz': 'Возвращение: {frist} дня, если нет защиты',
  'Ein Tag Pause ist frei. Danach ist der Streak angeschlagen. Alle {tage} Tage Streak liegt ein Schutz bereit. Unter Heute setzt du ihn ein. Er hält die bisherigen Tage. Am selben Tag brauchst du einen Eintrag. Der Schutz gibt keine XP.':
    'Один день паузы свободен. Дальше серия надломлена. Каждые {tage} дня серии готова одна защита. Её применяют под «Сегодня». Она сохраняет уже набранные дни. В тот же день нужна запись. Защита не даёт XP.',
  'Setzt du ihn nicht ein, öffnet die Rückkehr für {frist} Tage. Ein Eintrag in der Frist schließt sie. Disziplin und Geist bekommen XP, wenn sie an sind. Nach der Frist ist die Rückkehr vorbei, ohne XP. Die nächste kommt erst {abstand} Tage nach dem Ende der letzten.':
    'Если её не применить, возвращение открыто {frist} дня. Запись в срок его закрывает. Дисциплина и Разум получают XP, если они включены. После срока возвращение заканчивается, без XP. Следующее приходит только через {abstand} дня после конца предыдущего.',
  'Hält die {n} Tage': 'Сохраняет {n} дня',
  '{n} Tage · Pause aufgebraucht': '{n} дня · пауза исчерпана',
  '{tage} Tage': '{tage} дня',
  '{anzahl} Einträge': '{anzahl} записи',
  'Level {level} · {anzahl} Einträge': 'Уровень {level} · {anzahl} записи',
  '{laenge} Tage sind angeschlagen. Ein Eintrag heute hält sie.': '{laenge} дня надломлены. Запись сегодня их сохраняет.',
  '{anzahl} Bereiche': '{anzahl} раздела',
  '{n} Geräte': '{n} устройства',
  '{anzahl} Datensätze importiert.': 'Импортировано записи: {anzahl}.',
  '{zahl} neue Einträge übernommen.': 'Перенесено новые записи: {zahl}.',
  '{alter} Jahre': '{alter} года',
  'Mit {alter} Jahren': 'В {alter} года',
  'Das entspricht ungefähr {alter} Jahren.': 'Это примерно {alter} года.',
  '{anzahl} Kalender': '{anzahl} календаря',
  '{anzahl} Vorhaben offen': '{anzahl} задачи открыто',
};

export function zeigeMenge(
  sprache: Sprache,
  n: number,
  mehrzahl: string,
  werte: Record<string, string | number> = {},
): string {
  const kat = mengenKategorie(sprache, n);
  if (kat === 'wenige') {
    const vorlage = RU_WENIGE[mehrzahl];
    if (vorlage) return fuelle(vorlage, werte);
  }
  if (kat === 'einzahl') {
    const sonder = EINZAHL_GLEICH[mehrzahl]?.[sprache];
    if (sonder) return fuelle(sonder, werte);
    const einzahl = EINZAHL_VON.get(mehrzahl);
    if (einzahl) return zeige(einzahl, sprache, werte);
  }
  return zeige(mehrzahl, sprache, werte);
}
