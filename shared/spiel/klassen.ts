import { KOENNEN_KENNUNGEN, type AttributKennung, type KoennenKennung } from './begriffe.ts';

export const KLASSE = {
  abLevel: 10,
  ausgeglichenAb: 0.75,
  startKlasse: 'Neuling',
  ausgeglichen: 'Allrounder',
} as const;

export const ARCHETYP: Record<KoennenKennung, { name: string; beiname: string }> = {
  koerper: { name: 'Athlet', beiname: 'Starker' },
  geist: { name: 'Weiser', beiname: 'Besonnener' },
  disziplin: { name: 'Krieger', beiname: 'Disziplinierter' },
  intellekt: { name: 'Gelehrter', beiname: 'Kluger' },
  soziales: { name: 'Diplomat', beiname: 'Charismatischer' },
  kreativitaet: { name: 'Künstler', beiname: 'Kreativer' },
  motorik: { name: 'Virtuose', beiname: 'Geschickter' },
  mut: { name: 'Abenteurer', beiname: 'Mutiger' },
  vitalitaet: { name: 'Druide', beiname: 'Vitaler' },
  fuehrung: { name: 'Feldherr', beiname: 'Führender' },
};

export interface KennungsWert {
  kennung: AttributKennung;
  level: number;
}

function istKoennen(kennung: AttributKennung): kennung is KoennenKennung {
  return (KOENNEN_KENNUNGEN as readonly string[]).includes(kennung);
}

export function bestimmeKlasse(werte: KennungsWert[]): string {
  const koennen: { kennung: KoennenKennung; level: number }[] = [];
  for (const wert of werte) {
    if (istKoennen(wert.kennung)) {
      koennen.push({ kennung: wert.kennung, level: wert.level });
    }
  }
  koennen.sort((a, b) => b.level - a.level);

  const staerkstes = koennen[0];
  const zweites = koennen[1];
  if (!staerkstes || !zweites || staerkstes.level < KLASSE.abLevel) {
    return KLASSE.startKlasse;
  }
  const schwaechstes = koennen[koennen.length - 1];
  if (koennen.length >= 3 && schwaechstes.level / staerkstes.level >= KLASSE.ausgeglichenAb) {
    return KLASSE.ausgeglichen;
  }
  return `${ARCHETYP[zweites.kennung].beiname} ${ARCHETYP[staerkstes.kennung].name}`;
}

export type KlassenZeichen = KoennenKennung | 'neuling' | 'allrounder';

const NAME_ZU_KENNUNG = new Map<string, KoennenKennung>(
  (Object.entries(ARCHETYP) as [KoennenKennung, { name: string }][]).map(([kennung, archetyp]) => [archetyp.name, kennung]),
);

/** Zeichen der Klasse: das stärkste Können, sonst Neuling oder Allrounder. */
export function klassenZeichen(klasse: string): KlassenZeichen {
  if (klasse === KLASSE.ausgeglichen) {
    return 'allrounder';
  }
  const name = klasse.split(' ').at(-1) ?? '';
  return NAME_ZU_KENNUNG.get(name) ?? 'neuling';
}
