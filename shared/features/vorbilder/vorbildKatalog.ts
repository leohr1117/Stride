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
  p('lalanne', 'Jack LaLanne', 'Fitness', 'Fitness-Pionier mit eigener TV-Sendung von 1951 bis 1985 und frühen Trainingsgeräten.', 1914, 2011, 'Körper', [95, 80, 100, 72, 85, 85, 80, 85, 98, 70, 85, 75, 90, 55, 92, 70, 88, 85, 85, 80], [
    [21, 0.3, 'Eröffnet in Oakland ein frühes Fitnessstudio'],
    [36, 0.65, 'Startet seine Fitness-Sendung im Fernsehen'],
    [70, 0.9, 'Zieht gefesselt 70 Boote durch einen Hafen'],
    [96, 1, 'Gilt als Pate der Fitness'],
  ]),
  p('owens', 'Jesse Owens', 'Leichtathletik', 'Gewann 1936 in Berlin vier Goldmedaillen im Sprint und im Weitsprung.', 1913, 1980, 'Körper', [98, 85, 90, '60°', 75, 70, 95, 85, '70°', '55°', 92, 40, 85, 90, 95, 60, 45, 98, 85, 98], [
    [21, 0.4, 'Fünf Weltrekorde in unter einer Stunde'],
    [22, 0.85, 'Vier Olympiasiege in Berlin'],
    [62, 0.95, 'Erhält die Freiheitsmedaille der USA'],
    [66, 1, 'Bleibt einer der größten Leichtathleten'],
  ]),
  p('griffithjoyner', 'Florence Griffith Joyner', 'Sprint', 'Olympiasiegerin 1988 und Weltrekordhalterin über 100 und 200 Meter.', 1959, 1998, 'Körper', [99, '70°', 92, '60°', 80, 88, 95, 80, '70°', '55°', 80, 70, 85, 75, 75, 70, 75, 98, 80, 98], [
    [24, 0.35, 'Olympiasilber über 200 Meter'],
    [28, 0.9, 'Drei Olympiasiege und Weltrekorde'],
    [38, 1, 'Ihre Sprint-Weltrekorde halten Jahrzehnte'],
  ]),
  p('bikila', 'Abebe Bikila', 'Marathon', 'Zweimal Olympiasieger im Marathon, beim ersten Sieg 1960 lief er barfuß.', 1932, 1973, 'Körper', [98, 95, 95, '55°', '55°', '50°', 85, 85, '70°', 60, 85, 40, 80, 65, 95, 55, 50, 95, '60°', 98], [
    [28, 0.6, 'Olympiasieg barfuß in Rom'],
    [32, 0.9, 'Verteidigt den Titel kurz nach einer Blinddarm-OP'],
    [41, 1, 'Macht Ostafrika zur Laufmacht'],
  ]),
  p('cruyff', 'Johan Cruyff', 'Fußball', 'Dreimal Ballon-d\'Or-Sieger und als Spieler wie Trainer Vordenker des Totalen Fußballs.', 1947, 2016, 'Wettkampf', [85, '70°', 65, 88, 75, 100, 98, 80, 45, 95, 98, 85, 95, 85, 88, 88, 85, 100, 85, 98], [
    [17, 0.15, 'Debüt bei Ajax'],
    [27, 0.6, 'Dritter Ballon d\'Or und WM-Finale'],
    [45, 0.9, 'Gewinnt als Trainer mit Barcelona den Europapokal'],
    [68, 1, 'Sein Spielstil prägt den Fußball bis heute'],
  ]),
  p('senna', 'Ayrton Senna', 'Formel 1', 'Dreimal Formel-1-Weltmeister und einer der schnellsten Fahrer der Geschichte.', 1960, 1994, 'Wettkampf', [88, '75°', 98, 80, 72, 85, 100, 100, '70°', 70, 90, 88, 85, 92, 85, 80, 80, 98, 45, 98], [
    [24, 0.3, 'Debüt in der Formel 1'],
    [28, 0.65, 'Erster WM-Titel mit McLaren'],
    [31, 0.9, 'Dritter WM-Titel'],
    [34, 1, 'Bleibt eine Legende des Motorsports'],
  ]),
  p('gibson', 'Althea Gibson', 'Tennis', 'Erste schwarze Spielerin mit einem Grand-Slam-Titel, später auch Golfprofi.', 1927, 2003, 'Wettkampf', [92, 90, 88, '60°', '60°', 70, 92, 95, '70°', '55°', 85, 40, 85, 55, 92, 60, 50, 92, 50, 98], [
    [28, 0.45, 'Erster Grand-Slam-Sieg einer schwarzen Spielerin'],
    [29, 0.8, 'Gewinnt Wimbledon und die US-Meisterschaften'],
    [37, 0.9, 'Erste schwarze Spielerin auf der Golf-Profitour'],
    [76, 1, 'Wegbereiterin für schwarze Spitzensportler'],
  ]),
  p('capablanca', 'José Raúl Capablanca', 'Schach', 'Kubanischer Schachweltmeister von 1921 bis 1927, berühmt für sein Endspiel.', 1888, 1942, 'Strategie', [70, '65°', 70, 95, 85, 90, '45°', '60°', '55°', '50°', 85, 70, 95, 60, 90, 85, 85, 95, 50, 100], [
    [12, 0.2, 'Schlägt den kubanischen Meister'],
    [32, 0.75, 'Wird Weltmeister'],
    [38, 0.9, 'Verliert den Titel an Aljechin'],
    [53, 1, 'Gilt als Meister des Endspiels'],
  ]),
  p('tal', 'Mikhail Tal', 'Schach', 'Achter Schachweltmeister, berühmt für kühne Opfer und Angriffe.', 1936, 1992, 'Strategie', [35, 80, 60, 92, '75°', 100, '45°', 95, 25, '45°', 88, 50, 92, 55, 90, 70, 45, 92, 50, 100], [
    [23, 0.6, 'Jüngster Weltmeister seiner Zeit'],
    [37, 0.85, 'Bleibt 95 Partien ungeschlagen'],
    [55, 1, 'Bleibt der Zauberer von Riga'],
  ]),
  p('menchik', 'Vera Menchik', 'Schach', 'Erste Frauen-Weltmeisterin im Schach und erste Frau in Turnieren der Weltspitze.', 1906, 1944, 'Strategie', ['55°', '70°', 85, 85, '60°', 70, '45°', 88, '60°', '50°', 70, '50°', 85, 35, 90, 65, 60, 80, 60, 95], [
    [21, 0.4, 'Erste Frauen-Weltmeisterin'],
    [25, 0.7, 'Schlägt den späteren Weltmeister Euwe'],
    [38, 1, 'Die Frauen-Olympiade trägt ihren Namen'],
  ]),
  p('baer', 'Ralph Baer', 'Spielkonsolen', 'Erfand die erste Spielkonsole für den Fernseher und gilt als Vater der Videospiele.', 1922, 2014, 'Esports/Gaming', ['55°', 80, 85, 88, '60°', 92, '60°', '65°', '65°', '60°', 85, 65, 85, 45, 90, 65, 70, 95, '65°', 75], [
    [16, 0.1, 'Flieht mit der Familie aus Deutschland'],
    [44, 0.35, 'Hat die Idee für Spiele am Fernseher'],
    [50, 0.75, 'Die erste Heimkonsole kommt auf den Markt'],
    [92, 1, 'Gilt als Vater der Videospiele'],
  ]),
  p('yokoi', 'Gunpei Yokoi', 'Game Boy', 'Nintendo-Entwickler, der Game & Watch und den Game Boy erfand.', 1941, 1997, 'Esports/Gaming', ['55°', '65°', 85, 85, '65°', 98, '65°', 80, '60°', 75, 90, 65, 85, 50, 88, 70, 70, 95, '65°', 70], [
    [23, 0.15, 'Fängt bei Nintendo an'],
    [38, 0.5, 'Erfindet Game & Watch'],
    [47, 0.9, 'Bringt den Game Boy heraus'],
    [56, 1, 'Seine Idee vom Spielen mit einfacher Technik bleibt'],
  ]),
  p('iwata', 'Satoru Iwata', 'Nintendo', 'Programmierer und ab 2002 Präsident von Nintendo, in seiner Zeit kamen DS und Wii.', 1959, 2015, 'Esports/Gaming', ['50°', '75°', 90, 92, 90, 88, '55°', 80, '60°', 95, 92, 75, 92, 70, 98, 85, 70, 92, '70°', 85], [
    [23, 0.2, 'Erstes eigenes Spiel bei HAL'],
    [33, 0.45, 'Rettet HAL als Chef vor der Pleite'],
    [42, 0.75, 'Wird Präsident von Nintendo'],
    [46, 0.9, 'DS und Wii erreichen ein Massenpublikum'],
    [55, 1, 'Bleibt das freundliche Gesicht von Nintendo'],
  ]),
  p('marley', 'Bob Marley', 'Reggae', 'Jamaikanischer Musiker, der Reggae weltweit bekannt machte.', 1945, 1981, 'Kunst', ['70°', 90, 85, '65°', 90, 95, '70°', 95, 45, 80, 98, 70, 85, 100, 85, 80, 75, 98, 40, 70], [
    [18, 0.2, 'Gründet die Wailers'],
    [28, 0.55, 'Catch a Fire macht Reggae international'],
    [31, 0.8, 'Spielt zwei Tage nach einem Attentat ein Konzert'],
    [36, 1, 'Wird zum weltweiten Gesicht des Reggae'],
  ]),
  p('mercury', 'Freddie Mercury', 'Rock', 'Sänger von Queen mit einer Stimme über vier Oktaven und legendären Live-Auftritten.', 1946, 1991, 'Kunst', ['65°', 85, 85, '70°', 92, 98, 85, 92, '50°', 80, 95, 85, 80, 98, 92, 85, 88, 98, 70, 80], [
    [24, 0.3, 'Gründet Queen mit Brian May und Roger Taylor'],
    [29, 0.65, 'Bohemian Rhapsody'],
    [38, 0.9, 'Legendärer Auftritt bei Live Aid'],
    [45, 1, 'Bleibt eine der größten Stimmen des Rock'],
  ]),
  p('hepburn', 'Audrey Hepburn', 'Film', 'Filmstar und Modeikone, später UNICEF-Botschafterin.', 1929, 1993, 'Kunst', ['65°', 85, 88, '70°', 90, 80, 85, 80, 50, '60°', 88, 80, 80, 92, 98, 88, 75, 95, 50, 98], [
    [15, 0.15, 'Tanzt im Krieg Ballett für den Widerstand'],
    [24, 0.6, 'Oscar für Ein Herz und eine Krone'],
    [32, 0.8, 'Frühstück bei Tiffany'],
    [59, 0.95, 'Wird UNICEF-Botschafterin'],
    [63, 1, 'Bleibt eine Ikone von Film und Mode'],
  ]),
  p('bobross', 'Bob Ross', 'Malen, TV', 'Malte in seiner Sendung The Joy of Painting Landschaften in einer halben Stunde und ist bis heute Kult im Netz.', 1942, 1995, 'Content/Creator', ['55°', '75°', 88, '60°', 92, 80, 80, '60°', '55°', 55, 80, 60, 70, 95, 98, 55, 65, 85, 45, 55], [
    [18, 0.1, 'Tritt in die Air Force ein'],
    [40, 0.5, 'Startet The Joy of Painting'],
    [51, 0.9, 'Die Sendung läuft elf Jahre'],
    [52, 1, 'Bleibt ein Gesicht der Internetkultur'],
  ]),
  p('irwin', 'Steve Irwin', 'Tierfilme', 'Der „Crocodile Hunter“ brachte Millionen Menschen mit Tierfilmen den Artenschutz nahe.', 1962, 2006, 'Content/Creator', [85, '75°', 85, 75, 95, 80, 85, 100, '70°', 80, 85, 75, 80, 92, 88, 75, 85, 88, 90, '45°'], [
    [29, 0.35, 'Übernimmt den Familienzoo'],
    [34, 0.7, 'The Crocodile Hunter macht ihn weltbekannt'],
    [44, 1, 'Bleibt ein Gesicht des Tierschutzes'],
  ]),
  p('henson', 'Jim Henson', 'Muppets', 'Puppenspieler und Filmemacher, Schöpfer der Muppets und von Kermit dem Frosch.', 1936, 1990, 'Content/Creator', ['55°', '70°', 90, 75, 85, 100, 90, 80, '55°', 85, 95, 85, 85, 92, 95, 88, 85, 98, 60, 70], [
    [18, 0.2, 'Startet Sam and Friends im Fernsehen'],
    [33, 0.55, 'Muppets für die Sesamstraße'],
    [40, 0.85, 'Die Muppet Show läuft weltweit'],
    [53, 1, 'Kermit und die Muppets bleiben'],
  ]),
  p('lovelace', 'Ada Lovelace', 'Programmieren', 'Mathematikerin, die das erste Programm für eine Rechenmaschine schrieb.', 1815, 1852, 'Innovation/Technik', ['50°', '60°', 85, 95, 75, 95, '50°', 70, 35, '45°', 85, 70, 60, 85, 92, 88, 50, 92, 45, 40], [
    [17, 0.2, 'Lernt Charles Babbage kennen'],
    [27, 0.8, 'Veröffentlicht das erste Computerprogramm'],
    [36, 1, 'Gilt als erste Programmiererin'],
  ]),
  p('turing', 'Alan Turing', 'Informatik', 'Begründer der theoretischen Informatik und Codeknacker der Enigma im Zweiten Weltkrieg.', 1912, 1954, 'Innovation/Technik', [85, '60°', 88, 100, '50°', 98, '55°', '70°', '65°', 70, 98, 55, 85, 92, 98, 80, 30, 100, 35, 95], [
    [24, 0.4, 'Beschreibt die Turingmaschine'],
    [27, 0.7, 'Knackt in Bletchley Park die Enigma mit'],
    [38, 0.9, 'Schlägt den Turing-Test vor'],
    [41, 1, 'Gilt als Vater der Informatik'],
  ]),
  p('hopper', 'Grace Hopper', 'Programmiersprachen', 'Informatikerin und Admiralin der US Navy, Wegbereiterin von Compilern und COBOL.', 1906, 1992, 'Innovation/Technik', ['55°', '75°', 92, 98, '75°', 92, '50°', 85, '65°', 85, 88, 55, 92, 70, 95, 80, 60, 92, 45, 98], [
    [27, 0.25, 'Doktor in Mathematik in Yale'],
    [37, 0.45, 'Programmiert den Harvard Mark I'],
    [45, 0.65, 'Baut einen der ersten Compiler'],
    [52, 0.8, 'Prägt die Sprache COBOL mit'],
    [78, 0.95, 'Wird Admiralin der US Navy'],
    [85, 1, 'Gilt als Pionierin des Programmierens'],
  ]),
  p('disney', 'Walt Disney', 'Disney', 'Trickfilm-Pionier und Unternehmer, Schöpfer von Micky Maus und Disneyland.', 1901, 1966, 'Business/Unternehmertum', ['55°', 60, 90, 75, 85, 98, '55°', 95, 40, 92, 98, 88, 85, 100, 80, 90, 88, 100, '70°', 80], [
    [21, 0.1, 'Sein erstes Studio geht pleite'],
    [26, 0.35, 'Erschafft mit Ub Iwerks Micky Maus'],
    [36, 0.65, 'Schneewittchen kommt ins Kino'],
    [53, 0.9, 'Eröffnet Disneyland'],
    [65, 1, 'Sein Unternehmen wird zum Weltkonzern'],
  ]),
  p('walker', 'Madam C. J. Walker', 'Haarpflege', 'Gründerin einer Haarpflege-Firma für schwarze Frauen und laut Guinness erste Selfmade-Millionärin der USA.', 1867, 1919, 'Business/Unternehmertum', ['55°', 90, 90, '65°', 88, 85, '50°', 92, '55°', 90, 80, 80, 75, 60, 90, 85, 70, 85, 45, 30], [
    [7, 0.02, 'Wird mit sieben Jahren Waise'],
    [20, 0.08, 'Arbeitet als Wäscherin in St. Louis'],
    [38, 0.4, 'Gründet ihre Haarpflege-Marke'],
    [42, 0.7, 'Baut in Indianapolis eine Fabrik'],
    [51, 1, 'Gilt als erste Selfmade-Millionärin der USA'],
  ]),
  p('honda', 'Soichiro Honda', 'Honda', 'Ingenieur, der Honda aus einer Holzhütte zum weltweiten Auto- und Motorradhersteller machte.', 1906, 1991, 'Business/Unternehmertum', ['65°', '75°', 85, 80, '70°', 92, 80, 92, '60°', 88, 90, 90, 85, 70, 88, 80, 88, 95, '70°', 35], [
    [22, 0.15, 'Eröffnet eine eigene Autowerkstatt'],
    [29, 0.25, 'Schwerer Unfall bei einem Autorennen'],
    [41, 0.5, 'Gründet Honda'],
    [66, 0.9, 'Tritt als Präsident ab'],
    [84, 1, 'Honda ist ein Weltkonzern'],
  ]),
  p('graham', 'Benjamin Graham', 'Value Investing', 'Vater des Value Investing und Lehrer von Warren Buffett.', 1894, 1976, 'Finanzen/Investing/Crypto', ['50°', '70°', 90, 98, 75, 88, '45°', 50, '60°', 75, 92, 75, 98, 65, 95, 80, 85, 98, '60°', 92], [
    [20, 0.1, 'Fängt nach dem Studium an der Wall Street an'],
    [40, 0.5, 'Veröffentlicht Security Analysis'],
    [55, 0.8, 'Veröffentlicht The Intelligent Investor'],
    [82, 1, 'Gilt als Vater des Value Investing'],
  ]),
  p('templeton', 'John Templeton', 'Investieren', 'Fondsmanager und Pionier globaler Investments, laut Money „wohl der beste globale Aktienpicker des Jahrhunderts“.', 1912, 2008, 'Finanzen/Investing/Crypto', ['55°', '75°', 90, 92, '65°', 85, '45°', 92, '65°', 75, 85, 90, 92, 45, 85, 85, 92, 88, '65°', 92], [
    [26, 0.2, 'Kauft je 100 Aktien jeder Firma unter einem Dollar'],
    [41, 0.5, 'Gründet den Templeton Growth Fund'],
    [74, 0.9, 'Wird für seine Stiftungen zum Ritter geschlagen'],
    [95, 1, 'Gilt als einer der besten globalen Aktienpicker'],
  ]),
  p('finney', 'Hal Finney', 'Bitcoin', 'Kryptograf und Cypherpunk, empfing 2009 die erste Bitcoin-Transaktion von Satoshi Nakamoto.', 1956, 2014, 'Finanzen/Investing/Crypto', ['60°', 92, 85, 92, '65°', 85, '50°', 75, '60°', '50°', 72, '55°', 75, 35, 92, 70, 75, 80, '70°', 75], [
    [35, 0.3, 'Arbeitet an der Verschlüsselung PGP mit'],
    [52, 0.75, 'Empfängt die erste Bitcoin-Transaktion'],
    [58, 1, 'Programmiert trotz ALS bis zuletzt'],
  ]),
  p('ramanujan', 'Srinivasa Ramanujan', 'Mathematik', 'Indischer Mathematiker, der fast ohne Ausbildung Tausende neue Formeln fand.', 1887, 1920, 'Wissenschaft/Genies', ['45°', 45, 85, 100, '55°', 100, '45°', 85, 30, '45°', 88, 20, 85, 75, 95, 60, 40, 95, 50, 75], [
    [18, 0.1, 'Verliert sein Stipendium, weil er nur Mathematik lernt'],
    [25, 0.45, 'Schreibt an G. H. Hardy in Cambridge'],
    [30, 0.85, 'Erster Inder als Fellow des Trinity College'],
    [32, 1, 'Hinterlässt fast 3900 Ergebnisse'],
  ]),
  p('lincoln', 'Abraham Lincoln', 'Präsidentschaft', '16. Präsident der USA, führte das Land durch den Bürgerkrieg und trieb das Ende der Sklaverei voran.', 1809, 1865, 'Führung/Wandel', [80, 80, 85, 88, 92, 80, '50°', 90, '55°', 98, 98, 60, 100, 98, 92, 85, 65, 100, 45, 65], [
    [27, 0.2, 'Wird als Anwalt zugelassen'],
    [49, 0.45, 'Debatten gegen Douglas machen ihn landesweit bekannt'],
    [52, 0.7, 'Wird Präsident der USA'],
    [53, 0.9, 'Emanzipationsproklamation'],
    [56, 1, 'Bleibt ein Symbol für Einheit und Freiheit'],
  ]),
  p('maathai', 'Wangari Maathai', 'Umweltschutz', 'Kenianische Umweltaktivistin, Gründerin des Green Belt Movement und erste afrikanische Friedensnobelpreisträgerin.', 1940, 2011, 'Führung/Wandel', ['55°', 95, 92, 88, 85, 75, '45°', 98, '55°', 92, 85, 45, 85, 65, 92, 80, 45, 90, 40, 95], [
    [31, 0.3, 'Erste Frau in Ost- und Zentralafrika mit Doktortitel'],
    [37, 0.5, 'Gründet das Green Belt Movement'],
    [51, 0.7, 'Wird bei einem Protest von der Polizei bewusstlos geschlagen'],
    [64, 0.95, 'Erste Afrikanerin mit dem Friedensnobelpreis'],
    [71, 1, 'Ihre Bewegung pflanzt weiter Bäume'],
  ]),
];

/** Richtungen, in denen mindestens eine Person steht. Die Reihenfolge folgt RICHTUNGEN. */
export function richtungenMitPersonen(): readonly Richtung[] {
  const vorhanden = new Set(PERSONEN.map((person) => person.richtung));
  return RICHTUNGEN.filter((richtung) => vorhanden.has(richtung));
}
