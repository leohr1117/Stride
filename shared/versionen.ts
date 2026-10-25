export const ABSCHNITTE = ['Hinzugefügt', 'Verbessert', 'Geändert', 'Behoben'] as const;
export type AbschnittTitel = (typeof ABSCHNITTE)[number];

export interface Versionsabschnitt {
  titel: AbschnittTitel;
  punkte: readonly string[];
}

export interface Versionseintrag {
  version: string;
  /** Seiten, auf denen sich die Oberfläche geändert hat. */
  seiten: string;
  /** Seiten oder Funktionen, an denen etwas behoben wurde. */
  behoben?: string;
  abschnitte: readonly Versionsabschnitt[];
}

export const VERSIONEN: readonly Versionseintrag[] = [
  {
    version: '3.7.1',
    seiten: 'Aufgaben, Übersicht',
    behoben: 'Aufgaben',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: [
          'Priorität ist farbig. p1 rot, p2 orange, p3 blau, p4 ruhig. Dieselbe Farbe steht am Kreis.',
        ],
      },
      {
        titel: 'Geändert',
        punkte: ['Der Schalter Nur heute ist weg. Das Datum legt den Tag fest.'],
      },
      {
        titel: 'Behoben',
        punkte: ['Die Info-Icons bei Meilenstein und Gegner öffnen wieder.'],
      },
    ],
  },
  {
    version: '3.7.0',
    seiten: 'Training, Übersicht, Mehr, Handbuch',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Eine Einheit ist ein Eintrag. Aufwärmen zählt nicht zum Bestwert. Der Schalter liegt unter Funktionen.',
          'Ein Plan hat Wochentage, Sätze und Wiederholungen oder eine Zeit. Das Gewicht ist in kg oder lb.',
          'Heute zeigt den Plan. Starten öffnet die Einheit, die Kreise haken ab.',
          'Der erste Bestwert ist ein Meilenstein. Ab zwei Schätzungen steht ein Diagramm darunter.',
        ],
      },
    ],
  },
  {
    version: '3.6.0',
    seiten: 'Aufgaben, Übersicht, Mehr, Handbuch',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Eigene Aufgaben. Eine Erledigung wird ein Eintrag. Der Schalter liegt unter Funktionen.',
          'Datum, Uhrzeit und Wiederholung. Im Namen gehen auch Priorität, Projekt, Organisation und Vision.',
          'Eine normale Aufgabe kann ein Gegner sein. Ein Meilenstein kann ein Boss werden.',
          'Heute zeigt, was fällig ist. Als Nächstes zeigt die kommenden sieben Tage.',
        ],
      },
    ],
  },
  {
    version: '3.5.1',
    seiten: 'Vorbilder, Profil, Ziele, Rückblick, Statistiken, Übersicht, Verbindungen, Fähigkeiten, Charakter, Basis',
    behoben: 'Vorbilder, Profil, Ziele, Rückblick, Statistiken, Übersicht, Verbindungen, Fähigkeiten, Charakter, Basis',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'Die Ähnlichkeit steht in Prozent oben im Vorbild, in der Liste und an jedem Wert.',
          'Radar und Listen zeigen nur aktive Werte, in Leveln statt von 0 bis 100.',
          'Niedrige Level bleiben im Radar klein. Das Spektrum nutzt dieselbe Skala.',
          'Beschriftungen folgen der gewählten Sprache.',
          'Ein schließender Dialog fängt das Wischen nicht mehr ab.',
          'Die erste Auswahl in einem Feld trägt wieder ihren eigenen Namen.',
        ],
      },
    ],
  },
  {
    version: '3.5.0',
    seiten: 'Verbindungen, Projekt',
    behoben: 'Mehr, Vorbilder, Übersicht',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Todoist: ein Projekt lässt sich einer Vision, einem Projekt oder einem Vorhaben zuordnen.',
          'Labels aus Todoist werden zu Regeln für den Eintrag. Sie gelten vor der Projekt-Zuordnung.',
          'Ein Projekt kann eine Abschlusstätigkeit haben. Keine ist erlaubt.',
          'Abschließen gibt einmalig Bonus-XP und zeigt XP, Level, Zeitraum, Einträge und Stunden.',
        ],
      },
      {
        titel: 'Verbessert',
        punkte: [
          'Hat die erledigte Aufgabe eine Dauer, übernimmt der Eintrag sie.',
          'Nachts gleicht Todoist seltener ab. Jetzt abgleichen bleibt.',
        ],
      },
    ],
  },
  {
    version: '3.4.1',
    seiten: 'Profil, Darstellung',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: [
          'Die Einführung beginnt mit der Sprache. Folien, Fragen und Start-Tätigkeiten folgen in dieser Sprache.',
          'Das Info-Symbol hat wieder Abstand zum Namen.',
          'Darstellung: alle Ansichten in einer Liste. Farben getrennt in Standardfarben und eigene Farben.',
          'Glühen steht unter Sound.',
        ],
      },
    ],
  },
  {
    version: '3.4.0',
    seiten: 'Darstellung, Einstellungen, Vorbilder, Profil, Ziele, Chronik, Charakter, Fähigkeiten, Projekt, Basis, Inhalte, Verbindungen, Accounts',
    behoben: 'Profil',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Darstellung: bei jedem Design auch die Farben der anderen Designs.',
          'Zeilen lassen sich direkt archivieren oder löschen, mit Rückgängig. Ungenutztes lässt sich endgültig löschen.',
          'Die App gibt es auf Deutsch, Englisch, Spanisch, Französisch, Russisch, Chinesisch und Japanisch. Die Sprache steht in den Einstellungen.',
        ],
      },
      {
        titel: 'Verbessert',
        punkte: ['Profil: Titel und Level bleiben getrennt, auch bei langen Namen.'],
      },
      {
        titel: 'Geändert',
        punkte: ['Der Durchschnittsmensch gilt weltweit.'],
      },
    ],
  },
  {
    version: '3.3.0',
    seiten: 'Vorbilder, Profil, Handbuch',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Mehr Vorbilder von heute, unter anderem aus Sport, Wissenschaft und dem Netz.',
          'Ähnlichkeit steht in Prozent auf der Karte und an der Richtung.',
          'Historische Genies, von da Vinci und Einstein bis Mandela.',
        ],
      },
      {
        titel: 'Verbessert',
        punkte: [
          'Vorbilder sind schlanke Karten. Das Radar liegt im Profil.',
          'Im Handbuch steht je Richtung ein bekanntes Beispiel, höchstens zwei.',
        ],
      },
      {
        titel: 'Geändert',
        punkte: [
          'Elf Richtungen, von Körper und Wettkampf bis Wissenschaft und Führung.',
          'Die Ähnlichkeit nutzt alle eigenen Werte, auch ausgeblendete.',
        ],
      },
    ],
  },
  {
    version: '3.2.0',
    seiten: 'Projekte, Übersicht, Charakter, Fähigkeiten, Einstellungen',
    behoben: 'Übersicht, Charakter, Projekt, Einstellungen',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: ['Projekte lassen sich abschließen und wieder öffnen.'],
      },
      {
        titel: 'Verbessert',
        punkte: [
          'In der Liste steht der Abschluss dezent, in der Kopfzeile ohne Umbruch.',
          'Übersicht und Charakter: ein XP-Abzug für alle steht einmal über der Liste. Am Namen nur bei genau diesem Attribut.',
          'Einstellungen: ein Tipp in die Zeile schaltet. Das Info-Icon nur das Icon.',
        ],
      },
      {
        titel: 'Geändert',
        punkte: [
          'Eine Projekt-Investition wird mit dem Projekt aktiv. Kein eigener Abschluss mehr.',
          'Fähigkeiten: die Blasen zeigen die XP. Freigeschaltet ist gefüllt.',
        ],
      },
    ],
  },
  {
    version: '3.1.0',
    seiten: 'Fähigkeiten, Charakter, Projekt, Funktionen',
    behoben: 'Übersicht, Charakter',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Fähigkeiten zeigen einen Baum, auf dem Handy und am PC.',
          'XP-Verlust lässt sich für Können und für Haben getrennt schalten.',
          'Eine Projekt-Investition schließt man ab. Danach steht Aktiv mit dem Bonus.',
        ],
      },
      {
        titel: 'Verbessert',
        punkte: ['Das Ausrufezeichen bei zu niedrigem Level steht direkt am Namen.'],
      },
    ],
  },
  {
    version: '3.0.0',
    seiten: 'Charakter, Projekt, Übersicht, Chronik',
    behoben: 'Charakter, Projekt, Übersicht',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Eigene Investitionen sind zurück. Das Ziel ist eine Vision, ein Projekt oder ein Attribut.',
          'Zu niedrige Attribute zeigen ein rotes Level und ein Ausrufezeichen.',
        ],
      },
      {
        titel: 'Verbessert',
        punkte: [
          'Schalter und der Größenregler reagieren sofort.',
          'Am Projekt öffnet Antippen die Investitions-Einstellungen.',
          'Eintragsdetails sind übersichtlicher.',
        ],
      },
      {
        titel: 'Geändert',
        punkte: ['Kritische Treffer gibt es nicht mehr. Bisherige XP bleiben.'],
      },
    ],
  },
  {
    version: '2.1.0',
    seiten: 'Übersicht, Charakter, Chronik, Projekt',
    behoben: 'Projekt, Charakter',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: [
          'Attribut-Balken zeigen Verluste und bleiben gleich lang.',
          'Besiegte Bosse sind in der Chronik rot und haben Schwerter.',
          'Titel ändern geht ohne Browser-Fenster.',
        ],
      },
    ],
  },
  {
    version: '2.0.0',
    seiten: 'Projekt, Charakter',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Ein Projekt kann eine Investition sein.',
          'Ist es geschafft, gibt es dauerhaft mehr XP.',
          'Das Ziel ist eine Vision, ein Projekt oder ein Attribut.',
        ],
      },
    ],
  },
  {
    version: '1.0.0',
    seiten: 'Projekt, Laufend, Charakter',
    behoben: 'Projekt',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Ein Boss hat nur noch ein Datum. Das Level siehst du nach dem Sieg.',
          'Nach dem Datum greift er an.',
          'Bosse brauchen Disziplin, Investitionen brauchen Ressourcen.',
        ],
      },
    ],
  },
  {
    version: '0.11.0',
    seiten: 'Chronik, Ziele, Eintrag, Mehr',
    behoben: 'Chronik, Eintrag',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: ['Der Versionsverlauf lässt sich aufklappen.'],
      },
      {
        titel: 'Verbessert',
        punkte: [
          'Die Chronik ist kürzer. Antippen zeigt die Details.',
          'Eine Vision zeigt Titel und Projekte. Antippen zeigt die Details.',
        ],
      },
      {
        titel: 'Geändert',
        punkte: ['Tätigkeiten eines Projekts gibt es nur bei diesem Projekt.'],
      },
    ],
  },
  {
    version: '0.10.0',
    seiten: 'Projekt, Mehr, Handbuch',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Investitionen lassen sich mit Ressourcen anlegen.',
          'Ein Projekt kann eine Investition werden.',
        ],
      },
      {
        titel: 'Verbessert',
        punkte: ['Kleine UI-Verbesserungen.'],
      },
    ],
  },
  {
    version: '0.9.1',
    seiten: 'Übersicht, Charakter, Profil, Chronik, Ziele',
    behoben: 'Übersicht, Charakter, Ziele',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: ['Kleine UI-Verbesserungen.'],
      },
    ],
  },
  {
    version: '0.9.0',
    seiten: 'Projekt, Laufend, Eintrag',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: ['Bosse haben eine Deadline.'],
      },
      {
        titel: 'Geändert',
        punkte: ['Einträge ziehen Lebenspunkte ab.'],
      },
    ],
  },
  {
    version: '0.8.0',
    seiten: 'Übersicht, Charakter, Profil, Darstellung',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: ['Der Level-Ring ist klarer.', 'Kleine UI-Verbesserungen.'],
      },
      {
        titel: 'Geändert',
        punkte: ['Profil bearbeiten gibt es in den Einstellungen.'],
      },
    ],
  },
  {
    version: '0.7.0',
    seiten: 'Projekt, Ziele, Eintrag, Basis, Mehr',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: ['Tätigkeiten können zu einem Projekt gehören.', 'Unter Mehr steht die Version.'],
      },
      {
        titel: 'Geändert',
        punkte: ['Neue Vorhaben liegen in einem Projekt.'],
      },
    ],
  },
  {
    version: '0.6.0',
    seiten: 'Übersicht, Charakter',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: ['Das Level zeigt einen Ring und den Weg bis zum nächsten Level.'],
      },
      {
        titel: 'Verbessert',
        punkte: ['Kleine UI-Verbesserungen.'],
      },
    ],
  },
  {
    version: '0.5.0',
    seiten: 'Eintrag, ausgeblendete Bereiche',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: ['Ein Eintrag kann ein Vorhaben und eine Fähigkeit zugleich haben.'],
      },
      {
        titel: 'Verbessert',
        punkte: ['Kleine UI-Verbesserungen.'],
      },
      {
        titel: 'Geändert',
        punkte: ['Ausgeschaltete Bereiche sind nicht mehr zu sehen.'],
      },
    ],
  },
  {
    version: '0.4.0',
    seiten: 'Startfragen, Daten, Darstellung',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Die Startfragen schlagen eine Ziel-Stufe vor.',
          'Die eigene Welt lässt sich zurücksetzen.',
          'Ansicht und Farben lassen sich wählen.',
        ],
      },
    ],
  },
  {
    version: '0.3.0',
    seiten: 'Charakter, Basis, Laufend, Vorbilder, Chronik, Statistiken, Rückblick, Inhalte',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Fähigkeiten, Bosse, Basis, Investitionen und Vorbilder.',
          'Chronik, Statistiken, Rückblick, Todoist und Kalender.',
        ],
      },
    ],
  },
  {
    version: '0.2.0',
    seiten: 'Ziele',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: ['Visionen, Projekte und Vorhaben.', 'Organisationen für mehrere Projekte.'],
      },
    ],
  },
  {
    version: '0.1.0',
    seiten: 'Eintrag, Inhalte, Übersicht, Charakter',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: ['Einträge, Tätigkeiten und Attribute mit Level.'],
      },
    ],
  },
];

export const AKTUELLE_VERSION = VERSIONEN[0].version;
