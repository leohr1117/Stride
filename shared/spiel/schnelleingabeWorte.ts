import type { Sprache } from '../sprache/kern.ts';

/**
 * Eingabewörter der Schnelleingabe, nicht die Chrome-Texte.
 * Deutsch gilt immer. Die aktive Sprache kommt dazu.
 * Zweistellige Wochentag-Kürzel nutzt nur die aktive Sprache, siehe schnelleingabe.ts.
 */
export interface ZeitWorte {
  /** Nach der Stunde, mit Leerzeichen: „Uhr“, „o'clock“. */
  uhr: readonly string[];
  /** Angeklebtes „h“, französisch und spanisch: „9h“, „9h30“. */
  stundeKurz: readonly string[];
  am: readonly string[];
  pm: readonly string[];
  /** Japanisch und chinesisch, ohne Leerzeichen: 9時, 9点30分. */
  stunde: readonly string[];
  minute: readonly string[];
}

export interface CjkDatum {
  jahr: string;
  monat: string;
  tag: readonly string[];
}

export interface SprachWorte {
  heute: readonly string[];
  morgen: readonly string[];
  uebermorgen: readonly string[];
  /** „in“, „en“, „dans“, „через“. Leer, wenn die Zahl vorn steht. */
  in: readonly string[];
  /** Tag-Wörter nach der Zahl, Einzahl und Mehrzahl. Bei zahlZuerst das ganze Suffix, zum Beispiel „天后“. */
  tag: readonly string[];
  zahlZuerst: boolean;
  /** Montag ist 0. Lange Form und Kürzel. */
  wochentage: readonly (readonly string[])[];
  /** Januar ist 0. Nominativ, Genitiv und Schreibvarianten. */
  monate: readonly (readonly string[])[];
  /** Zwischen Tag und Monat, zum Beispiel spanisch „de“. */
  fueller: readonly string[];
  zeit: ZeitWorte;
  cjk: CjkDatum | null;
}

const KEINE_ZEIT: ZeitWorte = { uhr: [], stundeKurz: [], am: [], pm: [], stunde: [], minute: [] };

const MONATE_KANJI = [
  ['一月'],
  ['二月'],
  ['三月'],
  ['四月'],
  ['五月'],
  ['六月'],
  ['七月'],
  ['八月'],
  ['九月'],
  ['十月'],
  ['十一月'],
  ['十二月'],
] as const;

export const WORTE: Record<Sprache, SprachWorte> = {
  de: {
    heute: ['heute'],
    morgen: ['morgen'],
    uebermorgen: ['übermorgen'],
    in: ['in'],
    tag: ['Tag', 'Tagen'],
    zahlZuerst: false,
    wochentage: [
      ['Montag', 'Mo'],
      ['Dienstag', 'Di'],
      ['Mittwoch', 'Mi'],
      ['Donnerstag', 'Do'],
      ['Freitag', 'Fr'],
      ['Samstag', 'Sa'],
      ['Sonntag', 'So'],
    ],
    monate: [
      ['Januar'],
      ['Februar'],
      ['März'],
      ['April'],
      ['Mai'],
      ['Juni'],
      ['Juli'],
      ['August'],
      ['September'],
      ['Oktober'],
      ['November'],
      ['Dezember'],
    ],
    fueller: [],
    zeit: { ...KEINE_ZEIT, uhr: ['Uhr'] },
    cjk: null,
  },
  en: {
    heute: ['today'],
    morgen: ['tomorrow'],
    uebermorgen: ['day after tomorrow'],
    in: ['in'],
    tag: ['day', 'days'],
    zahlZuerst: false,
    wochentage: [
      ['Monday', 'Mon'],
      ['Tuesday', 'Tue', 'Tues'],
      ['Wednesday', 'Wed'],
      ['Thursday', 'Thu', 'Thur', 'Thurs'],
      ['Friday', 'Fri'],
      ['Saturday', 'Sat'],
      ['Sunday', 'Sun'],
    ],
    monate: [
      ['January', 'Jan'],
      ['February', 'Feb'],
      ['March', 'Mar'],
      ['April', 'Apr'],
      ['May'],
      ['June', 'Jun'],
      ['July', 'Jul'],
      ['August', 'Aug'],
      ['September', 'Sep', 'Sept'],
      ['October', 'Oct'],
      ['November', 'Nov'],
      ['December', 'Dec'],
    ],
    fueller: [],
    zeit: { ...KEINE_ZEIT, uhr: ["o'clock", 'oclock'], am: ['a.m.', 'am'], pm: ['p.m.', 'pm'] },
    cjk: null,
  },
  es: {
    heute: ['hoy'],
    morgen: ['mañana'],
    uebermorgen: ['pasado mañana'],
    in: ['en'],
    tag: ['día', 'días'],
    zahlZuerst: false,
    wochentage: [
      ['lunes', 'lun'],
      ['martes', 'mar'],
      ['miércoles', 'mié'],
      ['jueves', 'jue'],
      ['viernes', 'vie'],
      ['sábado', 'sáb'],
      ['domingo', 'dom'],
    ],
    monate: [
      ['enero'],
      ['febrero'],
      ['marzo'],
      ['abril'],
      ['mayo'],
      ['junio'],
      ['julio'],
      ['agosto'],
      ['septiembre', 'setiembre'],
      ['octubre'],
      ['noviembre'],
      ['diciembre'],
    ],
    fueller: ['de'],
    zeit: { ...KEINE_ZEIT, stundeKurz: ['h'] },
    cjk: null,
  },
  fr: {
    heute: ["aujourd'hui"],
    morgen: ['demain'],
    uebermorgen: ['après-demain'],
    in: ['dans'],
    tag: ['jour', 'jours'],
    zahlZuerst: false,
    wochentage: [
      ['lundi', 'lun'],
      ['mardi', 'mar'],
      ['mercredi', 'mer'],
      ['jeudi', 'jeu'],
      ['vendredi', 'ven'],
      ['samedi', 'sam'],
      ['dimanche', 'dim'],
    ],
    monate: [
      ['janvier'],
      ['février'],
      ['mars'],
      ['avril'],
      ['mai'],
      ['juin'],
      ['juillet'],
      ['août'],
      ['septembre'],
      ['octobre'],
      ['novembre'],
      ['décembre'],
    ],
    fueller: [],
    zeit: { ...KEINE_ZEIT, stundeKurz: ['h'] },
    cjk: null,
  },
  ru: {
    heute: ['сегодня'],
    morgen: ['завтра'],
    uebermorgen: ['послезавтра'],
    in: ['через'],
    tag: ['день', 'дня', 'дней'],
    zahlZuerst: false,
    wochentage: [
      ['понедельник', 'пн'],
      ['вторник', 'вт'],
      ['среда', 'ср'],
      ['четверг', 'чт'],
      ['пятница', 'пт'],
      ['суббота', 'сб'],
      ['воскресенье', 'вс'],
    ],
    monate: [
      ['январь', 'января'],
      ['февраль', 'февраля'],
      ['март', 'марта'],
      ['апрель', 'апреля'],
      ['май', 'мая'],
      ['июнь', 'июня'],
      ['июль', 'июля'],
      ['август', 'августа'],
      ['сентябрь', 'сентября'],
      ['октябрь', 'октября'],
      ['ноябрь', 'ноября'],
      ['декабрь', 'декабря'],
    ],
    fueller: [],
    zeit: KEINE_ZEIT,
    cjk: null,
  },
  zh: {
    heute: ['今天', '今日'],
    morgen: ['明天', '明日'],
    uebermorgen: ['后天', '後天'],
    in: [],
    tag: ['天后', '天後'],
    zahlZuerst: true,
    wochentage: [
      ['星期一', '周一'],
      ['星期二', '周二'],
      ['星期三', '周三'],
      ['星期四', '周四'],
      ['星期五', '周五'],
      ['星期六', '周六'],
      ['星期日', '星期天', '周日', '周天'],
    ],
    monate: MONATE_KANJI,
    fueller: [],
    zeit: { ...KEINE_ZEIT, stunde: ['点', '點', '时', '時'], minute: ['分'] },
    cjk: { jahr: '年', monat: '月', tag: ['日', '号', '號'] },
  },
  ja: {
    heute: ['今日', 'きょう'],
    morgen: ['明日', 'あした', 'あす'],
    uebermorgen: ['明後日', 'あさって'],
    in: [],
    tag: ['日後'],
    zahlZuerst: true,
    wochentage: [
      ['月曜日', '月曜'],
      ['火曜日', '火曜'],
      ['水曜日', '水曜'],
      ['木曜日', '木曜'],
      ['金曜日', '金曜'],
      ['土曜日', '土曜'],
      ['日曜日', '日曜'],
    ],
    monate: MONATE_KANJI,
    fueller: [],
    zeit: { ...KEINE_ZEIT, stunde: ['時'], minute: ['分'] },
    cjk: { jahr: '年', monat: '月', tag: ['日'] },
  },
};

/** Vergleicht Wörter ohne Großschreibung, Akzente und mit ue für ü. */
export function falte(text: string): string {
  return text
    .replaceAll('’', "'")
    .replaceAll('‘', "'")
    .replaceAll('´', "'")
    .replaceAll('`', "'")
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '');
}
