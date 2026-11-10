export const RICHTUNGEN = [
  'Körper',
  'Wettkampf',
  'Strategie',
  'Esports/Gaming',
  'Kunst',
  'Content/Creator',
  'Innovation/Technik',
  'Business/Unternehmertum',
  'Finanzen/Investing/Crypto',
  'Wissenschaft/Genies',
  'Führung/Wandel',
] as const;

export type Richtung = (typeof RICHTUNGEN)[number];

/** Bekannte Beispiele je Richtung für die Liste im Handbuch. Eine Richtung ohne Person hat keine. */
export const BEISPIEL_SCHLUESSEL: Readonly<Record<Richtung, readonly string[]>> = {
  'Körper': ['lee'],
  'Wettkampf': ['ali'],
  'Strategie': [],
  'Esports/Gaming': [],
  'Kunst': ['mozart'],
  'Content/Creator': [],
  'Innovation/Technik': ['jobs'],
  'Business/Unternehmertum': [],
  'Finanzen/Investing/Crypto': [],
  'Wissenschaft/Genies': ['einstein', 'davinci'],
  'Führung/Wandel': ['mandela', 'gandhi'],
};

export interface PersonRoh {
  schluessel: string;
  name: string;
  bekanntFuer: string;
  beschreibung: string;
  geboren: number;
  gestorben: number | null;
  richtung: Richtung;
  /** Kö, Ge, Di, In, So, Kr, Mo, Mu, Vi, Fü, dann Ei, Re, Au, Rw, An, Ne, Fr, Ve, Be, Qu. Ein Wert mit ° ist unsicher. */
  werte: readonly (number | string)[];
  stationen: readonly (readonly [number, number, string])[];
}

function p(
  schluessel: string,
  name: string,
  bekanntFuer: string,
  beschreibung: string,
  geboren: number,
  gestorben: number | null,
  richtung: Richtung,
  werte: readonly (number | string)[],
  stationen: readonly (readonly [number, number, string])[],
): PersonRoh {
  return { schluessel, name, bekanntFuer, beschreibung, geboren, gestorben, richtung, werte, stationen };
}

export const PERSONEN: readonly PersonRoh[] = [
  p('lee', 'Bruce Lee', 'Kampfkunst', 'Kampfkünstler, Schauspieler und Gründer von Jeet Kune Do.', 1940, 1973, 'Körper', [95, '75°', 95, 80, 80, 95, 100, 90, '70°', 75, 90, 70, 85, 95, 90, 75, 75, 98, '60°', 75], [
    [18, 0.3, 'Beginnt in den USA zu unterrichten'],
    [27, 0.7, 'Filme machen ihn weltweit bekannt'],
    [33, 1, 'Jeet Kune Do bleibt'],
  ]),
  p('ali', 'Muhammad Ali', 'Boxen', 'Schwergewichts-Weltmeister und einer der bekanntesten Sportler seiner Zeit.', 1942, 2016, 'Wettkampf', [95, 90, 92, '60°', 98, 85, 95, 100, '65°', 80, 98, 85, 85, 100, 92, 90, 60, 100, 50, 95], [
    [22, 0.4, 'Olympiasieg und erster WM-Titel'],
    [32, 0.75, 'Holt den Schwergewichtstitel zurück'],
    [74, 1, 'Gilt als einer der größten Sportler'],
  ]),
  p('mozart', 'Wolfgang Amadeus Mozart', 'Klassik', 'Komponist der Klassik mit über 800 Werken.', 1756, 1791, 'Kunst', ['45°', '65°', 85, 90, 70, 100, 90, 70, '45°', 45, 98, 40, 85, 98, 95, 70, 55, 100, '60°', 80], [
    [8, 0.25, 'Reist als Wunderkind durch Europa'],
    [25, 0.65, 'Freischaffend in Wien'],
    [35, 1, 'Hinterlässt über 800 Werke'],
  ]),
  p('jobs', 'Steve Jobs', 'Apple', 'Mitgründer von Apple, bekannt durch das iPhone und Pixar.', 1955, 2011, 'Innovation/Technik', ['50°', '65°', 85, 85, 75, 98, '50°', 92, 45, 92, 98, 98, 85, 98, 75, 95, 85, 100, 50, 45], [
    [21, 0.2, 'Gründet Apple'],
    [42, 0.7, 'Kehrt zu Apple zurück'],
    [52, 0.95, 'Stellt das iPhone vor'],
    [56, 1, 'Apple ist ein Weltunternehmen'],
  ]),
  p('davinci', 'Leonardo da Vinci', 'Renaissance', 'Universalgenie der Renaissance, bekannt durch die Mona Lisa und Erfindungsskizzen.', 1452, 1519, 'Wissenschaft/Genies', ['70°', '70°', 60, 100, 65, 100, 95, 80, '60°', '50°', 98, 65, 85, 100, 98, 85, 70, 100, '50°', 50], [
    [30, 0.4, 'Arbeitet als Maler und Ingenieur'],
    [51, 0.8, 'Malt die Mona Lisa'],
    [67, 1, 'Bilder und Skizzen bleiben weltbekannt'],
  ]),
  p('newton', 'Isaac Newton', 'Physik', 'Begründete Gravitation, Bewegungsgesetze und die Infinitesimalrechnung.', 1643, 1727, 'Wissenschaft/Genies', ['50°', 50, 95, 100, 35, 95, '60°', 70, '50°', 70, 100, 75, 100, 95, 85, 80, 80, 100, 35, 100], [
    [24, 0.35, 'Legt Gravitation und Licht dar'],
    [44, 0.8, 'Veröffentlicht die Principia'],
    [84, 1, 'Bewegungsgesetze und Gravitation gelten weiter'],
  ]),
  p('einstein', 'Albert Einstein', 'Physik', 'Entwickelte die Relativitätstheorie und die Formel E = mc².', 1879, 1955, 'Wissenschaft/Genies', ['55°', '75°', 85, 100, 75, 100, '55°', 85, '55°', 60, 100, 70, 100, 100, 95, 90, 75, 100, 50, 100], [
    [26, 0.5, 'Spezielle Relativitätstheorie'],
    [36, 0.75, 'Allgemeine Relativitätstheorie'],
    [76, 1, 'E = mc² bleibt weltbekannt'],
  ]),
  p('tesla', 'Nikola Tesla', 'Erfindungen', 'Erfinder des Wechselstrom-Systems und des Induktionsmotors.', 1856, 1943, 'Wissenschaft/Genies', ['50°', '50°', 90, 98, '55°', 100, '60°', 90, '50°', 45, 90, 35, 75, 98, 85, 70, 70, 98, 30, 65], [
    [31, 0.45, 'Wechselstrom-Patente'],
    [43, 0.7, 'Vorführungen in den USA'],
    [87, 1, 'Sein Stromsystem bleibt in Gebrauch'],
  ]),
  p('curie', 'Marie Curie', 'Forschung', 'Erforschte die Radioaktivität und erhielt Nobelpreise in zwei Fächern.', 1867, 1934, 'Wissenschaft/Genies', ['55°', 90, 98, 100, '65°', 85, '60°', 90, 40, 60, 95, 50, 95, 92, 98, 75, 55, 100, 75, 100], [
    [36, 0.6, 'Erster Nobelpreis'],
    [44, 0.85, 'Zweiter Nobelpreis'],
    [67, 1, 'Die Forschung zur Radioaktivität bleibt'],
  ]),
  p('aurelius', 'Marcus Aurelius', 'Stoa', 'Römischer Kaiser und Stoiker, Autor der Selbstbetrachtungen.', 121, 180, 'Führung/Wandel', ['60°', 85, 90, 92, 70, 80, '50°', 60, '55°', 92, 85, 100, 100, 80, 85, 95, 60, 92, '60°', 90], [
    [40, 0.65, 'Wird Kaiser'],
    [55, 0.9, 'Schreibt die Selbstbetrachtungen'],
    [59, 1, 'Die Stoa bleibt durch ihn präsent'],
  ]),
  p('gandhi', 'Mahatma Gandhi', 'Unabhängigkeit', 'Führte Indien mit gewaltlosem Widerstand in die Unabhängigkeit.', 1869, 1948, 'Führung/Wandel', ['50°', 95, 98, 80, 92, 85, '45°', 98, 70, 98, 100, 30, 90, 98, 85, 85, 35, 100, '55°', 75], [
    [45, 0.4, 'Wirkt in Südafrika'],
    [61, 0.75, 'Salzmarsch'],
    [79, 1, 'Indien wird unabhängig'],
  ]),
  p('king', 'Martin Luther King Jr.', 'Bürgerrechte', 'Anführer der Bürgerrechtsbewegung und Friedensnobelpreisträger.', 1929, 1968, 'Führung/Wandel', ['55°', 90, 92, 88, 98, 88, '45°', 100, '55°', 98, 98, 45, 85, 95, 95, 88, 45, 100, '70°', 90], [
    [26, 0.45, 'Montgomery-Busboykott'],
    [34, 0.8, 'Marsch auf Washington'],
    [35, 0.9, 'Friedensnobelpreis'],
    [39, 1, 'Die Bürgerrechtsbewegung trägt seinen Namen'],
  ]),
  p('mandela', 'Nelson Mandela', 'Versöhnung', 'Führte den Kampf gegen die Apartheid und wurde Präsident Südafrikas.', 1918, 2013, 'Führung/Wandel', ['70°', 100, 95, 82, 92, 75, '50°', 98, '60°', 95, 98, 70, 95, 98, 98, 92, 20, 100, 50, 85], [
    [46, 0.3, 'Beginnt die lange Haft'],
    [72, 0.7, 'Kommt frei'],
    [76, 0.9, 'Wird Präsident'],
    [95, 1, 'Bleibt das Gesicht der Versöhnung'],
  ]),
];

/** Richtungen, in denen mindestens eine Person steht. Die Reihenfolge folgt RICHTUNGEN. */
export function richtungenMitPersonen(): readonly Richtung[] {
  const vorhanden = new Set(PERSONEN.map((person) => person.richtung));
  return RICHTUNGEN.filter((richtung) => vorhanden.has(richtung));
}
