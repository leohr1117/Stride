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
    version: '3.38.0',
    seiten: 'Ziele, Laufend, Projekt',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Auf Ziele legt Neu eine Vision, eine Organisation oder ein Projekt an.',
          'Jede Vision ist ein Abschnitt mit Farbpunkt. Laufend steht als Zeile darüber.',
          'Das Archiv ist zugeklappt.',
          'Am Projekt liegt das Menü im Kopf. Der Stift ist weg.',
          'Vorhaben, Tätigkeiten nur für das Projekt und die Basis stehen in eigenen Abschnitten.',
        ],
      },
    ],
  },
  {
    version: '3.37.0',
    seiten: 'Heute',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Auf Heute stehen die ersten Schritte, bis der erste XP da ist.',
          'Ein erledigter Schritt zeigt einen Haken und den Namen. Einen Zähler gibt es nicht.',
          'Die ersten Schritte stehen nur noch auf Heute.',
        ],
      },
    ],
  },
  {
    version: '3.36.1',
    seiten: 'Heute',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Die Startseite heißt Heute.',
          'XP diese Woche, Streak und Momentum stehen nebeneinander.',
          'Rückkehr, Schutz und ein angeschlagener Streak stehen im Abschnitt Streak.',
          'Neben Bosse greifen an steht der Weg zu Laufend. Basis öffnet die Basis-Seite.',
        ],
      },
    ],
  },
  {
    version: '3.35.6',
    seiten: 'Tätigkeiten',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'Bei den Tätigkeiten stehen die Anteile in Prozent und ergeben zusammen 100 %.',
          'Im Balken ist jedes Stück so breit wie sein Anteil. Gleiche Farben bleiben getrennt.',
        ],
      },
    ],
  },
  {
    version: '3.35.5',
    seiten: 'Vorbilder',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Die Ähnlichkeit mit einem Vorbild vergleicht die Form des Profils, nicht die Höhe der Level.',
        ],
      },
    ],
  },
  {
    version: '3.35.4',
    seiten: 'Vorbilder',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'Im Vergleich mit einem Vorbild ist die eigene Fläche in der Akzentfarbe zu sehen.',
          'Das Info-Symbol an Vorbildern hat die Größe der anderen und sitzt mittig an der Zeile.',
        ],
      },
    ],
  },
  {
    version: '3.35.3',
    seiten: 'Mehr',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Nach einem Update erscheint einmal der Hinweis, dass Stride aktualisiert wurde.',
          'Mehr zeigt einen Punkt, bis Was ist neu geöffnet wurde.',
          'Was ist neu stellt die Versionen seit dem letzten Besuch nach oben.',
        ],
      },
    ],
  },
  {
    version: '3.35.2',
    seiten: 'Eintrag',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Beim Eintragen stehen die Tätigkeiten in einer Zeile. Der Chip + Tätigkeit legt eine neue an.',
          'Wofür? ist eine Überschrift ohne Kasten und ohne Tipp.',
          'Eintragen bleibt unten im Dialog stehen.',
        ],
      },
    ],
  },
  {
    version: '3.35.1',
    seiten: 'Bereiche, Karten auf Heute',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Bereiche stehen in Gruppen nach dem Fundort. Nach dem Einschalten führt Öffnen dorthin.',
          'Karten auf Heute blendet Zeilen ausgeschalteter Bereiche aus.',
        ],
      },
    ],
  },
  {
    version: '3.35.0',
    seiten: 'Profil, Übersicht',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Können, Haben, Fähigkeiten und Investitionen sind eigene Seiten.',
          'Das Profil zeigt sie als Zeile mit der Anzahl. Jede Seite hat ihr eigenes Archiv.',
          'Unter Werte auf der Übersicht führen Können und Haben auf die Seite.',
        ],
      },
    ],
  },
  {
    version: '3.34.0',
    seiten: 'Mehr',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Mehr zeigt alle eingeschalteten Seiten in vier Listen, auch die aus der Leiste.',
          'Tätigkeiten steht bei den Seiten. Die Einstellungen zeigen rechts den aktuellen Wert.',
          'Verbindungen steht direkt unter Mehr. Der Schnellzugriff entfällt.',
        ],
      },
    ],
  },
  {
    version: '3.33.0',
    seiten: 'Übersicht',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Am Computer zeigt die Seitenleiste die Seiten in vier Gruppen, ohne Überschrift.',
          'Profil ist ein Eintrag mit kleinem Bild. Die Karte darunter entfällt.',
          'Tätigkeiten steht bei den Seiten. Ausgeschaltete Seiten fehlen.',
        ],
      },
    ],
  },
  {
    version: '3.32.0',
    seiten: 'Übersicht, Projekt, Fähigkeit',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Der Plus-Knopf sitzt unten rechts und öffnet den Eintrag.',
          'Auf einem Projekt oder einer Fähigkeit übernimmt er die Auswahl. Der extra Eintrag-Knopf entfällt.',
        ],
      },
    ],
  },
  {
    version: '3.31.0',
    seiten: 'Chronik, Mehr',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Dialoge sitzen mittig oder als Blatt. Ein roter Knopf löscht nur, was sich nicht zurücknehmen lässt.',
          'Löschen, Loslassen und Zurücknehmen gelten sofort. Eine Meldung bietet Rückgängig.',
          'Der Bereich im Verlauf ist eine Liste mit Farbpunkt, Haken und Alle.',
        ],
      },
    ],
  },
  {
    version: '3.30.0',
    seiten: 'Übersicht, Darstellung',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Die Leiste unten zeigt Übersicht, Ziele, Chronik und Mehr. Mehr bleibt fest. Profil und Tätigkeiten kannst du in die Leiste legen.',
        ],
      },
    ],
  },
  {
    version: '3.29.2',
    seiten: 'Übersicht, Mehr',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Leiste, Seitenleiste und Mehr lesen ihre Seiten aus einer gemeinsamen Liste. Was du siehst, bleibt gleich.',
        ],
      },
    ],
  },
  {
    version: '3.29.1',
    seiten: 'Übersicht, Chronik',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Neue Profile haben die Chronik von Anfang an eingeschaltet.',
          'Der Levelring hat wieder seinen Farbverlauf und den hellen Lichtpunkt an der Spitze, auch oben rechts.',
        ],
      },
    ],
  },
  {
    version: '3.29.0',
    seiten: 'Profil, Tätigkeiten, Darstellung',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Das Label steht über dem Feld. Ein Fehler steht direkt am Feld.',
          'Speichern bleibt sichtbar, wenn die Tastatur offen ist.',
          'Eine Meldung kann Rückgängig anbieten. Ohne Rückgängig fragt ein Warndialog.',
        ],
      },
    ],
  },
  {
    version: '3.28.0',
    seiten: 'Mehr, Übersicht, Ziele, Darstellung, Chronik',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Zeilen stehen in einer Liste. Titel, Wert und Pfeil haben feste Größen.',
          'Abschnittstitel sind normal geschrieben, ohne Großbuchstaben.',
          'Glühen ist in jeder Ansicht wieder da, auch in Standard, und folgt dem Schalter.',
        ],
      },
    ],
  },
  {
    version: '3.27.0',
    seiten: 'Darstellung',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: ['Eigene Farben bleiben lesbar. Text, Streak, Ring und Schalter halten den Kontrast.'],
      },
    ],
  },
  {
    version: '3.26.0',
    seiten: 'Übersicht, Ziele',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Levelring, Streak und Schalter behalten ihre Farbe. Eine Palette ändert sie nicht.',
          'Fortschritt und Schalter sind blau, der Streak ist orange.',
          'Der Ring am Profilbild hebt sich vom Bild ab.',
        ],
      },
      {
        titel: 'Behoben',
        punkte: ['Die Farbpunkte vor den Namen von Visionen sitzen bündig.'],
      },
    ],
  },
  {
    version: '3.25.0',
    seiten: 'Darstellung',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Die Ansicht Standard hat eine eigene Form. Minimal behält die runde Form.',
          'Hell und Dunkel folgen der Logo-Palette. Gespeichertes Schlicht wird beim Öffnen zu Standard.',
        ],
      },
    ],
  },
  {
    version: '3.24.0',
    seiten: 'Einführung, Vorbilder',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: ['Die Einführung legt auf Wunsch ein erstes Ziel an.'],
      },
      {
        titel: 'Geändert',
        punkte: [
          'Die Einführung fragt Sprache, Namen, Fokus und Ziel. Folien, Geburtsjahr und die Start-Angebote entfallen.',
          'Fertig öffnet die Übersicht. Fehlt das Geburtsjahr, zeigt ein Vorbild den Hinweis zum Eintragen.',
        ],
      },
    ],
  },
  {
    version: '3.23.0',
    seiten: 'Verbindungen',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Todoist und Kalender zeigen keine XP-Vorschau mehr.'],
      },
    ],
  },
  {
    version: '3.22.0',
    seiten: 'Ziele',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Visionen und Organisationen zeigen einen Farbpunkt vor dem Namen. Die Linie links und der Balken oben entfallen.'],
      },
    ],
  },
  {
    version: '3.21.0',
    seiten: 'Übersicht, Ziele, Mehr',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Zurück schließt den obersten Dialog. Die Seite darunter bleibt.'],
      },
    ],
  },
  {
    version: '3.20.0',
    seiten: 'Übersicht, Ziele, Mehr',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Der Kopf zeigt den Seitentitel. Auf Unterseiten sitzt der Zurück-Pfeil links im Kopf.',
          'Das Profilbild mit Levelring liegt rechts im Kopf. Die Knöpfe Profil und Mehr dort entfallen.',
        ],
      },
    ],
  },
  {
    version: '3.19.1',
    seiten: 'Tätigkeiten',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Am Computer zeigt Tätigkeiten keinen Zurück-Pfeil.',
          'Zurück von Können, Haben und Investitionen führt zum Profil.',
        ],
      },
    ],
  },
  {
    version: '3.19.0',
    seiten: 'Übersicht, Ziele, Mehr',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Seiten außerhalb der Leiste zeigen den Zurück-Pfeil.',
          'Jeder Leistenplatz merkt sich die letzte Seite. Ein Tipp auf den aktiven Platz kehrt an den Anfang zurück.',
          'Der Zurück-Knopf im Browser geht denselben Weg wie der Pfeil.',
        ],
      },
      {
        titel: 'Behoben',
        punkte: ['Zurück führt wieder dorthin, wo du herkamst.'],
      },
    ],
  },
  {
    version: '3.18.0',
    seiten: 'Ziele, Mehr, Handbuch, Projekt',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: [
          'Unter einer Vision stehen ihre Projekte und Organisationen klar untereinander.',
          'Unter Mehr steht, dass du Bereiche unter App & Verbindungen ein- und ausschaltest.',
          'Eine Tätigkeit nur für ein Projekt ist als solche gekennzeichnet.',
        ],
      },
    ],
  },
  {
    version: '3.17.0',
    seiten: 'Mehr, Übersicht, Handbuch',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Unter Mehr schaltest du Benachrichtigungen für dieses Gerät ein. Höchstens eine am Tag.',
          'Sie gelten für einen angeschlagenen Streak, für die Rückkehr und für das Boss-Datum am Vortag.',
          'In der Ruhezeit bleibt es still. Danach kommt höchstens eine, wenn sie noch stimmt.',
          'Nach einem Erfolg kann die Übersicht einmal fragen, ob du Benachrichtigungen einschalten willst.',
        ],
      },
    ],
  },
  {
    version: '3.16.0',
    seiten: 'Übersicht, Chronik, Einführung, Handbuch',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Der Schutz hält den Streak, wenn ein Tag Pause nicht reicht. Du verdienst ihn alle sieben Tage und setzt ihn unter Heute ein.',
          'Bricht der Streak, bleiben sieben Tage für die Rückkehr. Ein Eintrag in der Frist schließt sie.',
          'Zum Start bietet die Einführung ein Vorbild. Sind Projekte an, kommt ein erster Boss dazu.',
          'Nach einem Erfolg kann die Übersicht fragen, wie hilfreich Stride gerade ist.',
        ],
      },
    ],
  },
  {
    version: '3.15.0',
    seiten: 'Einführung',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Die Einführung erklärt Einträge, Ziele und den Streak in klaren Sätzen. Die Fragen nennen, was die Wahl einschaltet.',
        ],
      },
    ],
  },
  {
    version: '3.14.0',
    seiten: 'Darstellung',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Unter Darstellung speicherst du eigene Farbpaletten. Auswählen übernimmt die Farben. Anlegen, Bearbeiten und Löschen liegt auf einer eigenen Seite.',
        ],
      },
      {
        titel: 'Geändert',
        punkte: ['Schlicht ist die neue Standardansicht, in Schwarz, Grau und Weiß.'],
      },
    ],
  },
  {
    version: '3.13.0',
    seiten: 'Tätigkeiten',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Unter Tätigkeiten legst du die Reihenfolge fest. Die oberste steht zuerst.',
        ],
      },
    ],
  },
  {
    version: '3.12.0',
    seiten: 'Mehr, Übersicht',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Unter Mehr wählst du, welche Karten die Übersicht zeigt. Ausgeblendete Karten verschwinden. Der Bereich bleibt eingeschaltet.',
        ],
      },
    ],
  },
  {
    version: '3.11.1',
    seiten: 'Profil',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Benutzernamen ändert nur der Admin. Der eigene Name wird angezeigt und bleibt eindeutig.',
        ],
      },
    ],
  },
  {
    version: '3.11.0',
    seiten: 'Mehr, Übersicht',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Neu unter Mehr: Übersicht. Die Seite listet die Karten der Übersicht und wann sie erscheinen.',
        ],
      },
    ],
  },
  {
    version: '3.10.0',
    seiten: 'Profil',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Jeder Benutzername ist nur einmal vergeben. Du kannst ihn jederzeit ändern. Ist er schon vergeben, bleibt der bisherige.',
        ],
      },
    ],
  },
  {
    version: '3.9.8',
    seiten: 'Verbindungen',
    behoben: 'Verbindungen',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'Bei der Todoist-Zuordnung steht über jedem Feld, wofür es gilt. Die Zuordnung am Anfang entfällt.',
        ],
      },
    ],
  },
  {
    version: '3.9.7',
    seiten: 'Verbindungen',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: [
          'Jede Verbindung zeigt den letzten Abgleich, einen klaren Fehler und wie viele Einträge übernommen wurden.',
          'Der Abgleich läuft auch beim Öffnen. Trennen behält die Einträge, nichts kommt doppelt.',
        ],
      },
    ],
  },
  {
    version: '3.9.6',
    seiten: 'Verbindungen',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Google- und Apple-Kalender lassen sich mit einer kurzen Anleitung verbinden. Vor dem Speichern erscheinen die letzten Termine und die XP.',
        ],
      },
      {
        titel: 'Geändert',
        punkte: ['Ein Termin zählt erst nach dem Verbinden, sobald er vorbei ist. Ohne Zuordnung zählt er nicht.'],
      },
    ],
  },
  {
    version: '3.9.5',
    seiten: 'Verbindungen',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Todoist lässt sich Schritt für Schritt verbinden. Aufgaben ohne Zuordnung zählen als gewählte Tätigkeit oder gar nicht.',
        ],
      },
      {
        titel: 'Geändert',
        punkte: [
          'Eine erledigte Todoist-Aufgabe mit Deadline zählt als Gegner, mit Meilenstein als Boss. Nur Aufgaben nach dem Verbinden zählen.',
        ],
      },
    ],
  },
  {
    version: '3.9.4',
    seiten: 'Charakter',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Attributnamen lassen sich nicht mehr ändern.'],
      },
    ],
  },
  {
    version: '3.9.3',
    seiten: 'Darstellung, Vorbilder, Verbindungen, Ziele',
    behoben: 'Darstellung, Vorbilder, Verbindungen, Ziele',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Paletten, der Durchschnittsmensch und weitere Texte sind in allen Sprachen übersetzt.'],
      },
    ],
  },
  {
    version: '3.9.2',
    seiten: 'Darstellung, Vorbilder',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: ['Fehlende Übersetzungen werden in allen sieben Sprachen erkannt.'],
      },
    ],
  },
  {
    version: '3.9.1',
    seiten: 'Übersicht, Charakter, Vorbilder, Mehr',
    behoben: 'Übersicht, Charakter, Vorbilder, Mehr',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Seiten, Dialoge und Diagramme bleiben auf dem Handy und am PC im Bild.'],
      },
    ],
  },
  {
    version: '3.9.0',
    seiten: 'Mehr',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Tätigkeit anlegen ist ein Knopf und öffnet das Formular direkt.'],
      },
    ],
  },
  {
    version: '3.8.3',
    seiten: 'Mehr',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Die Einstellungen Inhalte und Funktionen heißen jetzt Tätigkeiten und App & Verbindungen. Verbindungen stehen unter App & Verbindungen.',
          'Am PC sagt die Leiste-Einstellung, dass sie nur auf dem Handy gilt.',
        ],
      },
    ],
  },
  {
    version: '3.8.2',
    seiten: 'Handbuch, Mehr',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Handbuch und Einführung nennen die Bereiche Aufgaben und Training nicht mehr.'],
      },
    ],
  },
  {
    version: '3.8.1',
    seiten: 'Übersicht, Mehr',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Training gibt es nicht mehr. Bisherige Einträge bleiben.'],
      },
    ],
  },
  {
    version: '3.8.0',
    seiten: 'Übersicht, Mehr, Handbuch',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Aufgaben gibt es nicht mehr. Bisherige Einträge bleiben.'],
      },
    ],
  },
  {
    version: '3.7.9',
    seiten: 'Fähigkeiten',
    behoben: 'Fähigkeiten',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Speichern bleibt bei offener Tastatur erreichbar.'],
      },
    ],
  },
  {
    version: '3.7.8',
    seiten: 'Charakter, Projekte, Inhalte',
    behoben: 'Charakter, Projekte, Inhalte',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Beim Schieben eines Reglers bleibt die Tastatur zu. Der Fokus-Ring erscheint nur bei der Tastatur.'],
      },
    ],
  },
  {
    version: '3.7.7',
    seiten: 'Darstellung',
    behoben: 'Darstellung',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Eigene Farben bleiben in jeder Ansicht erhalten.'],
      },
    ],
  },
  {
    version: '3.7.6',
    seiten: 'Chronik',
    behoben: 'Chronik',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Löschen in der Chronik erscheint nur beim Wischen.'],
      },
    ],
  },
  {
    version: '3.7.5',
    seiten: 'Mehr',
    behoben: 'Mehr',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Zurück auf Unterseiten bleibt auf dem Handy sichtbar.'],
      },
    ],
  },
  {
    version: '3.7.4',
    seiten: 'Übersicht, Mehr',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Neues Logo erscheint jetzt auch auf dem Handy.'],
      },
    ],
  },
  {
    version: '3.7.3',
    seiten: 'Übersicht, Mehr',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Neues Logo.'],
      },
    ],
  },
  {
    version: '3.7.2',
    seiten: 'Übersicht, Mehr',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Die App heißt jetzt Stride.'],
      },
    ],
  },
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
