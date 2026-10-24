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

/** Ein oder zwei bekannte Beispiele je Richtung, für die Tabelle im Handbuch. */
export const BEISPIEL_SCHLUESSEL: Readonly<Record<Richtung, readonly string[]>> = {
  'Körper': ['johnson', 'biles'],
  'Wettkampf': ['ronaldo', 'messi'],
  'Strategie': ['carlsen'],
  'Esports/Gaming': ['faker'],
  'Kunst': ['swift', 'mozart'],
  'Content/Creator': ['mrbeast', 'lame'],
  'Innovation/Technik': ['musk', 'jobs'],
  'Business/Unternehmertum': ['zuckerberg', 'kardashian'],
  'Finanzen/Investing/Crypto': ['buffett'],
  'Wissenschaft/Genies': ['einstein', 'davinci'],
  'Führung/Wandel': ['mandela', 'obama'],
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
  p('bumstead', 'Chris Bumstead', 'Classic Physique', 'Sechsmal Mr Olympia Classic Physique in Folge, von 2019 bis 2024.', 1995, null, 'Körper', [97, '72°', 95, 60, 72, 55, 80, 70, 90, 55, 60, 65, 80, 72, 85, 65, 75, 75, '72°', 85], [
    [24, 0.55, 'Erster Mr-Olympia-Titel'],
    [29, 0.9, 'Sechster Titel in Folge'],
  ]),
  p('goggins', 'David Goggins', 'Ultralauf', 'Ehemaliger Navy-SEAL, Ultraläufer und Autor von Can\'t Hurt Me.', 1975, null, 'Körper', [92, 90, 100, 60, 55, 45, 75, 100, '75°', 70, 65, 60, 75, 62, 70, 55, 85, 72, '50°', 80], [
    [24, 0.25, 'Schließt die Navy-SEAL-Ausbildung ab'],
    [43, 0.75, 'Veröffentlicht Can\'t Hurt Me'],
  ]),
  p('johnson', 'Dwayne Johnson', 'Wrestling, Film', 'Wrestling-Legende, Schauspieler und Unternehmer.', 1972, null, 'Körper', [88, '75°', 92, 62, 92, 72, 80, 75, '75°', 82, 85, 90, 72, 92, 90, 92, 80, 85, '75°', 70], [
    [24, 0.2, 'Debüt im Wrestling'],
    [29, 0.45, 'Erste große Filmrolle'],
    [48, 0.85, 'Weltweite Film- und Fitnessmarke'],
  ]),
  p('kipchoge', 'Eliud Kipchoge', 'Marathon', 'Zweimal Olympiasieger im Marathon und ehemaliger Weltrekordhalter.', 1984, null, 'Körper', [98, 90, 98, 65, 68, 45, 85, 80, 98, 80, 70, 60, 85, 60, 95, 60, 65, 92, '75°', 95], [
    [18, 0.2, 'Weltmeister über 5000 Meter'],
    [32, 0.65, 'Olympiasieg in Rio'],
    [35, 0.85, 'Erster Marathon unter zwei Stunden'],
  ]),
  p('biles', 'Simone Biles', 'Turnen', 'Meistdekorierte Turnerin, mit 11 olympischen Medaillen und 30 WM-Medaillen.', 1997, null, 'Körper', [98, 80, 95, 62, 75, 80, 100, 98, '75°', 70, 80, 70, 85, 80, 95, 72, 70, 95, '75°', 100], [
    [19, 0.5, 'Vier Olympiasiege in Rio'],
    [24, 0.65, 'Olympia in Tokio'],
    [27, 0.9, 'Weitere Olympiasiege in Paris'],
  ]),
  p('nippard', 'Jeff Nippard', 'Krafttraining', 'Zeigt wissenschaftsbasiertes Krafttraining auf YouTube.', 1990, null, 'Körper', [85, '75°', 90, 85, 75, 70, 75, 55, 88, 55, 62, 60, 85, 70, 82, 65, 85, 65, '70°', 75], [
    [24, 0.4, 'Startet den Trainingskanal'],
    [30, 0.75, 'Der Kanal wird zur festen Größe'],
  ]),
  p('reif', 'Pamela Reif', 'Home-Workout', 'Zeigt Home-Workouts ohne Sprache und erreicht damit ein internationales Publikum.', 1996, null, 'Körper', [85, '72°', 92, 62, 78, 72, 82, 60, 92, 60, 65, 70, 65, 75, 78, 65, 85, 62, '65°', 60], [
    [18, 0.35, 'Erste Fitnessvideos'],
    [22, 0.75, 'Der Kanal erreicht ein internationales Publikum'],
  ]),
  p('lee', 'Bruce Lee', 'Kampfkunst', 'Kampfkünstler, Schauspieler und Gründer von Jeet Kune Do.', 1940, 1973, 'Körper', [95, '75°', 95, 80, 80, 95, 100, 90, '70°', 75, 90, 70, 85, 95, 90, 75, 75, 98, '60°', 75], [
    [18, 0.3, 'Beginnt in den USA zu unterrichten'],
    [27, 0.7, 'Filme machen ihn weltweit bekannt'],
    [33, 1, 'Jeet Kune Do bleibt'],
  ]),
  p('ronaldo', 'Cristiano Ronaldo', 'Fußball', 'Fünfmal Ballon-d\'Or-Sieger und Inbegriff von Trainingsdisziplin.', 1985, null, 'Wettkampf', [97, '75°', 99, 60, 85, 65, 95, 85, 98, 85, 92, 95, 80, 100, 82, 90, 82, 98, 75, 98], [
    [18, 0.1, 'Wechselt zu Manchester United'],
    [23, 0.4, 'Erster Ballon d\'Or'],
    [31, 0.75, 'Champions-League-Titel mit Real Madrid'],
  ]),
  p('messi', 'Lionel Messi', 'Fußball', 'Achtmal Ballon-d\'Or-Sieger und Weltmeister 2022.', 1987, null, 'Wettkampf', [88, '75°', 88, 62, 70, 95, 100, 70, '75°', 80, 88, 95, 82, 95, 95, 85, 82, 100, 85, 100], [
    [18, 0.15, 'Durchbruch bei Barcelona'],
    [22, 0.45, 'Erster Ballon d\'Or'],
    [35, 0.88, 'Weltmeister mit Argentinien'],
  ]),
  p('yamal', 'Lamine Yamal', 'Fußball', 'Flügelspieler von Barça und Spanien, Jahrgang 2007, schon an der Weltspitze.', 2007, null, 'Wettkampf', [88, '75°', 80, 45, 75, 92, 95, 85, '75°', 45, 75, 75, 55, 85, 75, 62, 60, 65, '65°', 80], [
    [16, 0.5, 'Durchbruch bei Barça und in der Nationalmannschaft'],
    [17, 0.8, 'Europameister mit Spanien'],
  ]),
  p('sinner', 'Jannik Sinner', 'Tennis', 'Führender Tennisspieler der Welt mit fünf Grand-Slam-Titeln.', 2001, null, 'Wettkampf', [92, 88, 95, 62, 68, 70, 95, 72, '75°', 55, 72, 80, 72, 68, 80, 65, 72, 80, '72°', 96], [
    [23, 0.75, 'Erste Grand-Slam-Titel und Nummer 1'],
    [24, 0.9, 'Weitere Grand-Slam-Siege'],
  ]),
  p('djokovic', 'Novak Djokovic', 'Tennis', 'Rekordhalter mit 24 Grand-Slam-Titeln und 428 Wochen als Nummer 1.', 1987, null, 'Wettkampf', [95, 95, 99, 75, 72, 75, 98, 72, 98, 70, 85, 88, 85, 80, 72, 82, 80, 100, 75, 100], [
    [20, 0.2, 'Erster Grand-Slam-Titel'],
    [24, 0.45, 'Nummer 1 der Welt'],
    [36, 0.9, '24. Grand-Slam-Titel'],
  ]),
  p('hamilton', 'Lewis Hamilton', 'Formel 1', 'Siebenmal Formel-1-Weltmeister, Rekordhalter bei Siegen und Poles.', 1985, null, 'Wettkampf', [88, '75°', 92, 68, 82, 80, 95, 95, '75°', 72, 88, 90, 78, 88, 85, 90, 82, 95, '65°', 98], [
    [22, 0.3, 'Erster Formel-1-Titel'],
    [35, 0.8, 'Siebter Weltmeistertitel'],
    [39, 0.92, 'Wechsel zu Ferrari'],
  ]),
  p('ali', 'Muhammad Ali', 'Boxen', 'Schwergewichts-Weltmeister und einer der bekanntesten Sportler seiner Zeit.', 1942, 2016, 'Wettkampf', [95, 90, 92, '60°', 98, 85, 95, 100, '65°', 80, 98, 85, 85, 100, 92, 90, 60, 100, 50, 95], [
    [22, 0.4, 'Olympiasieg und erster WM-Titel'],
    [32, 0.75, 'Holt den Schwergewichtstitel zurück'],
    [74, 1, 'Gilt als einer der größten Sportler'],
  ]),
  p('jordan', 'Michael Jordan', 'Basketball', 'Sechsmal NBA-Champion und Gesicht der Marke Air Jordan.', 1963, null, 'Wettkampf', [97, 85, 95, '65°', 75, 85, 100, 85, '75°', 85, 92, 98, 85, 98, 85, 92, 85, 100, '60°', 100], [
    [28, 0.45, 'Erster NBA-Titel mit den Bulls'],
    [35, 0.8, 'Sechster Titel'],
    [50, 0.92, 'Air Jordan ist eine Weltmarke'],
  ]),
  p('carlsen', 'Magnus Carlsen', 'Schach', 'Fünfmal Schachweltmeister und seit 2011 an der Spitze der Weltrangliste.', 1990, null, 'Strategie', [72, '75°', 90, 95, 70, 90, '45°', 72, '72°', 55, 78, 75, 98, 70, 82, 72, 90, 98, '70°', 100], [
    [13, 0.15, 'Wird Großmeister'],
    [23, 0.6, 'Wird Weltmeister'],
    [33, 0.88, 'Gibt den WM-Titel ab und bleibt Nummer 1'],
  ]),
  p('gukesh', 'Gukesh Dommaraju', 'Schach', 'Jüngster anerkannter Schachweltmeister.', 2006, null, 'Strategie', ['65°', 90, 95, 92, 55, 80, '45°', 60, '70°', 40, 65, 50, 88, 50, 85, 55, 60, 82, '72°', 98], [
    [16, 0.5, 'Großmeister und Kandidatenturnier'],
    [18, 0.9, 'Wird Weltmeister'],
  ]),
  p('nakamura', 'Hikaru Nakamura', 'Schach', 'Weltranglisten-Zweiter, fünfmal US-Meister und großer Schach-Streamer.', 1987, null, 'Strategie', ['62°', '75°', 85, 92, 85, 75, '45°', 70, '65°', 55, 72, 70, 88, 75, 72, 70, 90, 85, '72°', 95], [
    [15, 0.25, 'Wird Großmeister'],
    [20, 0.5, 'US-Meister'],
    [33, 0.85, 'Einer der größten Schach-Streamer'],
  ]),
  p('rozman', 'Levy Rozman', 'Schach', 'Internationaler Meister und der bekannteste Schachlehrer im Netz.', 1995, null, 'Strategie', ['55°', '75°', 85, 88, 92, 88, '45°', 72, '62°', 65, 78, 68, 80, 85, 80, 75, 88, 70, '70°', 70], [
    [22, 0.4, 'Startet GothamChess'],
    [26, 0.8, 'Wird zum größten Schach-Lehrkanal'],
  ]),
  p('hou', 'Hou Yifan', 'Schach', 'Viermal Frauen-Weltmeisterin und Professorin an der Peking-Universität.', 1994, null, 'Strategie', ['60°', '75°', 90, 98, 62, 75, '45°', 60, '70°', 62, 65, 55, 92, 50, 90, 62, 72, 85, '65°', 98], [
    [14, 0.3, 'Jüngste Großmeisterin'],
    [16, 0.6, 'Erste Frauen-Weltmeisterschaft'],
    [26, 0.88, 'Professur in Peking'],
  ]),
  p('praggnanandhaa', 'R Praggnanandhaa', 'Schach', 'Zweiter beim World Cup 2023 und Sieger der FIDE Circuit 2025.', 2005, null, 'Strategie', ['62°', '75°', 92, 90, 58, 78, '45°', 60, '72°', 40, 60, 48, 82, 52, 82, 55, 60, 70, '75°', 92], [
    [12, 0.3, 'Wird Großmeister'],
    [18, 0.7, 'Zweiter beim World Cup'],
    [20, 0.9, 'Sieger der FIDE Circuit'],
  ]),
  p('faker', 'Faker', 'League of Legends', 'Sechsmal Weltmeister in League of Legends und gilt als bester Spieler des Spiels.', 1996, null, 'Esports/Gaming', ['65°', 90, 98, 82, 72, 80, 98, 62, '72°', 80, 82, 75, 92, 70, 95, 72, 70, 98, '65°', 100], [
    [17, 0.4, 'Erster WM-Titel mit T1'],
    [27, 0.85, 'Weiterer WM-Titel'],
  ]),
  p('zywoo', 'ZywOo', 'Counter-Strike', 'Mehrfach als bester Counter-Strike-Spieler der Welt ausgezeichnet.', 2000, null, 'Esports/Gaming', ['65°', '75°', 92, 72, 60, 75, 98, 70, '70°', 60, 60, 62, 82, 55, 85, 58, 70, 85, '65°', 95], [
    [18, 0.5, 'HLTV-Spieler des Jahres'],
    [23, 0.8, 'Major-Siege mit Vitality'],
  ]),
  p('donk', 'donk', 'Counter-Strike', 'Jüngster HLTV-Spieler des Jahres 2024, spielt für Team Spirit.', 2007, null, 'Esports/Gaming', ['65°', '75°', 90, 60, 45, 72, 98, 85, '70°', 40, 55, 50, 72, 50, 72, 45, 60, 62, '60°', 92], [
    [16, 0.45, 'Wechselt in die Profimannschaft'],
    [17, 0.88, 'HLTV-Spieler des Jahres'],
  ]),
  p('bugha', 'Bugha', 'Fortnite', 'Fortnite-Weltmeister 2019 und Streamer.', 2002, null, 'Esports/Gaming', ['55°', '72°', 85, 62, 70, 70, 95, 72, '62°', 45, 55, 65, 65, 62, 68, 58, 82, 70, '62°', 85], [
    [16, 0.75, 'Gewinnt die Fortnite-Weltmeisterschaft'],
    [20, 0.88, 'Streamt weiter'],
  ]),
  p('tenz', 'TenZ', 'Valorant', 'Ehemaliger Valorant-Profi und heute Streamer, bekannt für sein Aim.', 2001, null, 'Esports/Gaming', ['55°', '72°', 82, 65, 80, 75, 97, 70, '62°', 45, 62, 62, 72, 72, 75, 62, 85, 72, '62°', 82], [
    [19, 0.6, 'Spielt an der Valorant-Spitze'],
    [22, 0.85, 'Wechselt ins Streaming'],
  ]),
  p('caps', 'Caps', 'League of Legends', 'Bester westlicher League-of-Legends-Spieler, lange bei G2.', 1999, null, 'Esports/Gaming', ['60°', '75°', 90, 78, 70, 82, 95, 72, '68°', 70, 62, 60, 85, 62, 82, 62, 70, 82, '65°', 92], [
    [18, 0.45, 'Durchbruch in der LEC'],
    [20, 0.75, 'WM-Finale mit G2'],
  ]),
  p('swift', 'Taylor Swift', 'Pop', 'Umsatzstärkste Live-Künstlerin und die reichste Musikerin.', 1989, null, 'Kunst', [78, '75°', 95, 78, 92, 95, '70°', 72, '75°', 85, 95, 92, 80, 98, 85, 90, 88, 95, '72°', 85], [
    [16, 0.12, 'Erstes Album'],
    [25, 0.5, 'Welttour zum Album 1989'],
    [34, 0.88, 'Eras Tour'],
  ]),
  p('eilish', 'Billie Eilish', 'Pop', 'Prägende Pop-Figur der 2020er mit einem eigenen Sound.', 2001, null, 'Kunst', ['55°', 72, 80, 70, 78, 95, '62°', 82, '72°', 55, 80, 82, 65, 90, 85, 72, 82, 82, '75°', 80], [
    [17, 0.5, 'Debütalbum und Welthit'],
    [18, 0.75, 'Mehrere Grammys'],
  ]),
  p('badbunny', 'Bad Bunny', 'Latin Trap', 'Hat spanischsprachigen Rap weltweit bekannt gemacht.', 1994, null, 'Kunst', ['70°', '75°', 85, 62, 88, 92, 82, 88, '72°', 72, 90, 88, 72, 92, 85, 82, 88, 90, '70°', 82], [
    [22, 0.35, 'Durchbruch im Latin Trap'],
    [28, 0.8, 'Weltweite Nummer-1-Alben'],
  ]),
  p('lamar', 'Kendrick Lamar', 'Rap', 'Erster Rapper mit dem Pulitzer-Preis für Musik.', 1987, null, 'Kunst', ['60°', '75°', 88, 90, 70, 98, '65°', 85, '72°', 72, 88, 82, 90, 85, 92, 78, 90, 98, '75°', 95], [
    [25, 0.45, 'Album good kid, mAAd city'],
    [30, 0.8, 'Pulitzer-Preis für Musik'],
  ]),
  p('rihanna', 'Rihanna', 'Pop, Fenty', 'Weltstar und Unternehmerin mit der Marke Fenty.', 1988, null, 'Kunst', ['65°', '75°', 78, 70, 90, 90, '72°', 85, '70°', 85, 92, 98, 75, 98, 82, 92, 90, 92, '72°', 80], [
    [17, 0.15, 'Erste Hits'],
    [29, 0.65, 'Startet Fenty Beauty'],
    [33, 0.88, 'Milliardärin durch die eigenen Marken'],
  ]),
  p('zendaya', 'Zendaya', 'Film, Serie', 'Schauspielerin mit zwei Emmys und Filmen mit mehreren Milliarden Dollar Einspiel.', 1996, null, 'Kunst', ['68°', '75°', 85, 72, 85, 82, 85, 70, '75°', 62, 82, 82, 72, 90, 92, 82, 72, 80, '75°', 85], [
    [19, 0.3, 'Hauptrolle in einer Erfolgsserie'],
    [26, 0.75, 'Emmy für Euphoria'],
  ]),
  p('chalamet', 'Timothée Chalamet', 'Film', 'Schauspieler mit vier Oscar-Nominierungen.', 1995, null, 'Kunst', ['62°', '75°', 85, 72, 80, 85, '75°', 78, '72°', 55, 80, 78, 72, 85, 80, 80, 72, 78, '70°', 82], [
    [22, 0.45, 'Durchbruch mit Call Me by Your Name'],
    [26, 0.75, 'Hauptrolle in Dune'],
  ]),
  p('mozart', 'Wolfgang Amadeus Mozart', 'Klassik', 'Komponist der Klassik mit über 800 Werken.', 1756, 1791, 'Kunst', ['45°', '65°', 85, 90, 70, 100, 90, 70, '45°', 45, 98, 40, 85, 98, 95, 70, 55, 100, '60°', 80], [
    [8, 0.25, 'Reist als Wunderkind durch Europa'],
    [25, 0.65, 'Freischaffend in Wien'],
    [35, 1, 'Hinterlässt über 800 Werke'],
  ]),
  p('mrbeast', 'MrBeast', 'YouTube', 'Größter YouTuber, mit Beast Industries und der Marke Feastables.', 1998, null, 'Content/Creator', ['50°', '70°', 95, 72, 92, 92, '55°', 95, 55, 90, 92, 92, 72, 100, 72, 92, 82, 85, '65°', 60], [
    [20, 0.3, 'Erste große Challenge-Videos'],
    [24, 0.75, 'Wird zum größten YouTuber'],
  ]),
  p('speed', 'IShowSpeed', 'Livestreams', 'Weltweite Livestreams und einer der populärsten Entertainer im Netz.', 2005, null, 'Content/Creator', [80, '72°', 80, 45, 98, 80, 85, 98, '60°', 55, 85, 75, 50, 98, 72, 82, 85, 72, '60°', 40], [
    [16, 0.5, 'Durchbruch mit Livestreams'],
    [19, 0.85, 'Weltweite IRL-Streams'],
  ]),
  p('cenat', 'Kai Cenat', 'Livestreams', 'Meistabonnierter Twitch-Streamer und Gastgeber der Streamer University.', 2001, null, 'Content/Creator', ['60°', '70°', 82, 50, 95, 80, '60°', 85, '55°', 72, 85, 78, 55, 92, 62, 85, 82, 70, '65°', 40], [
    [19, 0.45, 'Durchbruch auf Twitch'],
    [22, 0.8, 'Meistabonnierter Twitch-Streamer'],
  ]),
  p('chamberlain', 'Emma Chamberlain', 'YouTube', 'Hat den YouTube-Vlog-Stil geprägt und führt Podcast und eigene Marke.', 2001, null, 'Content/Creator', ['50°', '68°', 70, 62, 85, 90, '58°', 70, '62°', 60, 78, 78, 60, 85, 75, 80, 85, 70, '65°', 40], [
    [16, 0.45, 'Startet den Vlog-Kanal'],
    [18, 0.75, 'Prägt den Vlog-Stil'],
  ]),
  p('lame', 'Khaby Lame', 'TikTok', 'Betreibt den meistgefolgten TikTok-Account, mit wortloser Comedy.', 2000, null, 'Content/Creator', ['55°', '72°', 75, 50, 92, 85, '70°', 62, '62°', 45, 78, 78, 50, 98, 80, 75, 82, 70, '70°', 40], [
    [20, 0.6, 'Wird zur größten TikTok-Figur'],
    [22, 0.88, 'Meistgefolgter Account'],
  ]),
  p('pewdiepie', 'PewDiePie', 'YouTube', 'Schwedischer YouTuber und jahrelang der größte einzelne Kanal der Welt.', 1989, null, 'Content/Creator', ['50°', '70°', 75, 65, 88, 85, '50°', 65, '60°', 50, 85, 85, 60, 95, 60, 75, 95, 85, 75, 40], [
    [20, 0.35, 'Startet den Kanal'],
    [24, 0.75, 'Größter einzelner YouTube-Kanal'],
    [33, 0.9, 'Lebt in Japan und lädt seltener hoch'],
  ]),
  p('ninja', 'Ninja', 'Streaming', 'Machte Streaming mit Fortnite einem großen Publikum bekannt.', 1991, null, 'Content/Creator', ['55°', '70°', 85, 60, 85, 75, 92, 65, '55°', 55, 75, 85, 65, 90, 72, 80, 85, 75, 75, '45°'], [
    [26, 0.55, 'Fortnite-Streams erreichen ein Massenpublikum'],
    [29, 0.85, 'Streaming ist Mainstream'],
  ]),
  p('hassabis', 'Demis Hassabis', 'Künstliche Intelligenz', 'Mitgründer von Google DeepMind und Chemie-Nobelpreisträger 2024 für AlphaFold.', 1976, null, 'Innovation/Technik', ['55°', '75°', 90, 100, 75, 95, '60°', 82, '72°', 88, 92, 85, 100, 65, 95, 92, 72, 98, '72°', 100], [
    [34, 0.5, 'Gründet DeepMind'],
    [48, 0.95, 'Nobelpreis für AlphaFold'],
  ]),
  p('huang', 'Jensen Huang', 'Halbleiter', 'Gründer und Chef von Nvidia.', 1963, null, 'Innovation/Technik', ['55°', '75°', 95, 92, 80, 85, '50°', 92, '62°', 95, 98, 99, 92, 78, 88, 95, 72, 95, '75°', 90], [
    [30, 0.2, 'Gründet Nvidia'],
    [56, 0.7, 'Nvidia wird zum zentralen Ausrüster für KI'],
    [61, 0.92, 'Nvidia ist eines der wertvollsten Unternehmen'],
  ]),
  p('karpathy', 'Andrej Karpathy', 'Künstliche Intelligenz', 'KI-Forscher und Lehrer, bekannt durch OpenAI, Tesla und Anthropic.', 1986, null, 'Innovation/Technik', ['55°', '75°', 88, 97, 85, 88, '50°', 70, '65°', 62, 82, 80, 92, 82, 92, 88, 88, 85, '65°', 98], [
    [29, 0.45, 'Forschung zu Deep Learning'],
    [31, 0.7, 'Leitet die KI bei Tesla'],
    [39, 0.9, 'Arbeitet bei Anthropic'],
  ]),
  p('su', 'Lisa Su', 'Halbleiter', 'Seit 2014 Chefin von AMD und Elektroingenieurin.', 1969, null, 'Innovation/Technik', ['50°', '75°', 95, 95, 72, 80, '50°', 82, '65°', 92, 88, 85, 92, 58, 90, 85, 65, 88, '65°', 98], [
    [45, 0.6, 'Wird Chefin von AMD'],
    [53, 0.88, 'AMD wieder vorn im Chipmarkt'],
  ]),
  p('altman', 'Sam Altman', 'Künstliche Intelligenz', 'Chef von OpenAI, dem Unternehmen hinter ChatGPT.', 1985, null, 'Innovation/Technik', ['50°', '75°', 85, 88, 88, 80, '45°', 92, '60°', 88, 98, 92, 82, 85, 62, 98, 80, 85, '70°', 60], [
    [30, 0.4, 'Leitet Y Combinator'],
    [37, 0.85, 'ChatGPT wird weltweit genutzt'],
  ]),
  p('musk', 'Elon Musk', 'Tesla, SpaceX', 'Gründete SpaceX und machte Tesla zum größten Hersteller von Elektroautos.', 1971, null, 'Innovation/Technik', ['50°', '62°', 92, 90, 72, 88, '50°', 100, 45, 85, 100, 100, 72, 100, 45, 95, 90, 92, 40, 72], [
    [24, 0.05, 'Gründet Zip2'],
    [31, 0.25, 'Gründet SpaceX'],
    [37, 0.5, 'Erster Orbitflug und Tesla-Chef'],
    [49, 0.85, 'Erster bemannter Flug von SpaceX'],
  ]),
  p('levels', 'Pieter Levels', 'Indie-Software', 'Baut Apps allein und macht seine Umsätze öffentlich.', 1992, null, 'Innovation/Technik', ['62°', '75°', 92, 85, 85, 90, '55°', 85, '70°', 35, 70, 72, 75, 75, 75, 75, 98, 62, '65°', 45], [
    [23, 0.3, 'Startet als Indie-Entwickler'],
    [28, 0.75, 'Mehrere Produkte mit offenen Umsätzen'],
  ]),
  p('jobs', 'Steve Jobs', 'Apple', 'Mitgründer von Apple, bekannt durch das iPhone und Pixar.', 1955, 2011, 'Innovation/Technik', ['50°', '65°', 85, 85, 75, 98, '50°', 92, 45, 92, 98, 98, 85, 98, 75, 95, 85, 100, 50, 45], [
    [21, 0.2, 'Gründet Apple'],
    [42, 0.7, 'Kehrt zu Apple zurück'],
    [52, 0.95, 'Stellt das iPhone vor'],
    [56, 1, 'Apple ist ein Weltunternehmen'],
  ]),
  p('zuckerberg', 'Mark Zuckerberg', 'Meta', 'Gründer und Chef von Meta.', 1984, null, 'Business/Unternehmertum', [78, '72°', 90, 88, 65, 80, 82, 85, '72°', 92, 98, 98, 82, 92, 48, 95, 85, 92, 80, 62], [
    [20, 0.2, 'Gründet Facebook'],
    [28, 0.6, 'Börsengang'],
    [37, 0.85, 'Das Unternehmen heißt Meta'],
  ]),
  p('perkins', 'Melanie Perkins', 'Canva', 'Mitgründerin und Chefin von Canva.', 1987, null, 'Business/Unternehmertum', ['55°', '75°', 92, 82, 78, 88, '50°', 90, '65°', 90, 85, 92, 78, 60, 88, 82, 80, 82, '75°', 62], [
    [25, 0.45, 'Gründet Canva'],
    [34, 0.85, 'Canva wird zum weltweiten Designwerkzeug'],
  ]),
  p('hormozi', 'Alex Hormozi', 'Unternehmen', 'Unternehmer und Investor bei Acquisition, mit Büchern und Videos zum Geschäft.', 1992, null, 'Business/Unternehmertum', [82, '75°', 95, 82, 88, 80, '65°', 85, '75°', 88, 78, 88, 82, 85, 70, 82, 92, 65, '75°', 55], [
    [24, 0.4, 'Baut Gym Launch auf'],
    [28, 0.8, 'Gründet Acquisition.com'],
  ]),
  p('bartlett', 'Steven Bartlett', 'Podcast', 'Gründer, Investor und Host des Podcasts The Diary of a CEO.', 1992, null, 'Business/Unternehmertum', ['58°', '75°', 85, 78, 92, 80, '50°', 80, '68°', 80, 80, 78, 72, 88, 72, 92, 85, 65, '70°', 45], [
    [22, 0.35, 'Gründet Social Chain'],
    [28, 0.75, 'Startet The Diary of a CEO'],
  ]),
  p('kardashian', 'Kim Kardashian', 'Marken', 'Medienunternehmerin und Gründerin der Marke Skims.', 1980, null, 'Business/Unternehmertum', ['72°', '75°', 88, 65, 95, 78, '62°', 72, '75°', 82, 90, 92, 62, 98, 55, 92, 80, 78, 55, 62], [
    [27, 0.35, 'Eine Reality-Show macht sie weltweit bekannt'],
    [39, 0.8, 'Gründet Skims'],
  ]),
  p('cuban', 'Mark Cuban', 'Investitionen', 'Unternehmer, Investor und langjähriger Teilnehmer bei Shark Tank.', 1958, null, 'Business/Unternehmertum', ['62°', '75°', 82, 82, 85, 78, '55°', 85, '68°', 82, 85, 92, 80, 85, 75, 90, 90, 80, '75°', 65], [
    [41, 0.4, 'Verkauft Broadcast.com'],
    [42, 0.6, 'Kauft die Dallas Mavericks'],
    [53, 0.85, 'Wird durch Shark Tank breit bekannt'],
  ]),
  p('wolfe', 'Whitney Wolfe Herd', 'Bumble', 'Gründerin von Bumble und Mitgründerin von Tinder.', 1989, null, 'Business/Unternehmertum', ['55°', '75°', 85, 72, 85, 80, '50°', 85, '65°', 85, 78, 82, 70, 62, 75, 80, 72, 72, '72°', 55], [
    [23, 0.35, 'Ist bei der Gründung von Tinder dabei'],
    [25, 0.7, 'Gründet Bumble'],
    [31, 0.9, 'Bumble geht an die Börse'],
  ]),
  p('buffett', 'Warren Buffett', 'Investieren', 'Investoren-Legende und langjähriger Chef von Berkshire Hathaway.', 1930, null, 'Finanzen/Investing/Crypto', [30, '75°', 98, 98, 70, 70, '45°', 45, 55, 88, 95, 99, 100, 80, 95, 95, 95, 100, '72°', 85], [
    [26, 0.08, 'Erste eigene Firma'],
    [35, 0.25, 'Übernimmt Berkshire Hathaway'],
    [70, 0.8, 'Wird zur Referenz für langfristiges Investieren'],
  ]),
  p('dalio', 'Ray Dalio', 'Hedgefonds', 'Gründer von Bridgewater, einem der größten Hedgefonds.', 1949, null, 'Finanzen/Investing/Crypto', ['45°', '75°', 92, 92, 72, 82, '45°', 72, '62°', 85, 85, 95, 90, 72, 72, 90, 92, 85, '65°', 80], [
    [26, 0.2, 'Gründet Bridgewater'],
    [56, 0.65, 'Bridgewater wird zum größten Hedgefonds'],
    [68, 0.88, 'Veröffentlicht Principles'],
  ]),
  p('buterin', 'Vitalik Buterin', 'Ethereum', 'Mitgründer von Ethereum und Programmierer.', 1994, null, 'Finanzen/Investing/Crypto', ['50°', '75°', 85, 98, 68, 95, '45°', 85, '62°', 72, 90, 85, 92, 85, 80, 85, 88, 92, '62°', 60], [
    [19, 0.5, 'Veröffentlicht das Ethereum-Whitepaper'],
    [21, 0.8, 'Ethereum startet'],
  ]),
  p('saylor', 'Michael Saylor', 'Bitcoin', 'Macht Bitcoin zur Reserve seiner Firma Strategy, früher MicroStrategy.', 1965, null, 'Finanzen/Investing/Crypto', ['60°', '75°', 88, 85, 82, 75, '45°', 98, '65°', 82, 82, 92, 70, 85, 55, 80, 88, 72, '55°', 80], [
    [24, 0.2, 'Gründet MicroStrategy'],
    [55, 0.75, 'Legt die Firmenreserve in Bitcoin an'],
  ]),
  p('wood', 'Cathie Wood', 'Investieren', 'Chefin von ARK Invest, mit Fokus auf disruptive Technologie.', 1955, null, 'Finanzen/Investing/Crypto', ['45°', '75°', 85, 85, 80, 75, '45°', 92, '60°', 80, 70, 80, 70, 75, 55, 78, 80, 62, '62°', 80], [
    [59, 0.6, 'Gründet ARK Invest'],
    [65, 0.85, 'Die Fonds werden weltweit bekannt'],
  ]),
  p('stephan', 'Graham Stephan', 'Immobilien, YouTube', 'Immobilieninvestor und Finanz-YouTuber mit über fünf Millionen Abonnenten.', 1990, null, 'Finanzen/Investing/Crypto', ['50°', '72°', 88, 78, 82, 70, '45°', 62, '60°', 55, 65, 78, 68, 80, 70, 68, 92, 55, '72°', 55], [
    [22, 0.3, 'Erste Immobilien'],
    [27, 0.7, 'Der YouTube-Kanal wächst stark'],
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
  p('hawking', 'Stephen Hawking', 'Physik', 'Erforschte Schwarze Löcher und schrieb Eine kurze Geschichte der Zeit.', 1942, 2018, 'Wissenschaft/Genies', [15, 95, 90, 100, 80, 90, 15, 90, 40, '60°', 92, 70, 98, 95, 92, 88, 50, 95, 55, 100], [
    [32, 0.55, 'Beschreibt die Hawking-Strahlung'],
    [46, 0.8, 'Eine kurze Geschichte der Zeit'],
    [76, 1, 'Sein Buch bleibt ein Weltbestseller'],
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
  p('malala', 'Malala Yousafzai', 'Bildung', 'Bildungsaktivistin und jüngste Friedensnobelpreisträgerin.', 1997, null, 'Führung/Wandel', ['50°', 95, 85, 85, 88, 70, '45°', 100, '55°', 80, 85, 70, 75, 92, 88, 85, 70, 85, 75, 92], [
    [15, 0.5, 'Wird weltweit für ihren Einsatz für Bildung bekannt'],
    [17, 0.8, 'Friedensnobelpreis'],
    [23, 0.92, 'Schließt in Oxford ab'],
  ]),
  p('obama', 'Barack Obama', 'Politik', 'Erster schwarzer Präsident der USA.', 1961, null, 'Führung/Wandel', [72, '75°', 85, 92, 95, 75, '65°', 75, '60°', 95, 95, 85, 95, 98, 75, 98, 80, 92, 85, 95], [
    [47, 0.75, 'Wird US-Präsident'],
    [55, 0.9, 'Die Amtszeit endet'],
  ]),
];
