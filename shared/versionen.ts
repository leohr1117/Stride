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
    version: '4.1.21',
    seiten: 'Investitionen',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Eine Investition kann jetzt auf ein Attribut, ein Projekt oder beides wirken. Mindestens ein Ziel bleibt Pflicht. Bestehende Investitionen bleiben, wie sie sind.',
        ],
      },
    ],
  },
  {
    version: '4.1.20',
    seiten: 'Können, Haben, Mehr',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Der Verlust bei Nichtnutzung entfällt. Attribute verlieren XP nur noch mit der Zeit, wenn sie keine Einträge bekommen.',
        ],
      },
    ],
  },
  {
    version: '4.1.19',
    seiten: 'Tätigkeiten',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: [
          'Im Tätigkeiten-Formular scrollt senkrechtes Wischen über die Regler, statt den Wert zu verschieben.',
        ],
      },
    ],
  },
  {
    version: '4.1.18',
    seiten: 'Tätigkeiten',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Tätigkeiten verteilen feste Prozent. Unter 100 % geht der Rest an kein Attribut. Ein Minus zieht XP ab, nie unter 0.',
        ],
      },
    ],
  },
  {
    version: '4.1.17',
    seiten: 'Bereiche, Heute, Statistik',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Der Streak lässt sich unter Bereiche aussetzen. Heute und die Statistik zeigen ihn dann nicht. Eingeschaltet ist die bisherige Länge wieder da.',
        ],
      },
    ],
  },
  {
    version: '4.1.16',
    seiten: 'Heute',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Liegt die Tageskette in einer Pause, bleibt die Länge stehen. Neue Einträge bekommen dabei kein Momentum. Schutz und eine offene Rückkehr ruhen.',
        ],
      },
    ],
  },
  {
    version: '4.1.15',
    seiten: 'Bereiche, Heute, Konto, Profil',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Erfolge, Titel und die Hinweise auf Heute lassen sich ausblenden. Die Hinweise gelten nur für dieses Gerät.',
        ],
      },
    ],
  },
  {
    version: '4.1.14',
    seiten: 'Vorbilder',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          '31 neue Vorbilder aus Sport, Kunst, Technik, Wirtschaft und Geschichte.',
        ],
      },
    ],
  },
  {
    version: '4.1.13',
    seiten: 'Vorbilder',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: [
          'Vorbild-Werte sind sichtbar als Schätzung gekennzeichnet. Unsichere Werte tragen ein ~, im Radar einen hohlen Punkt.',
        ],
      },
    ],
  },
  {
    version: '4.1.12',
    seiten: 'Verbindungen',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: [
          'Der Todoist-Token wird verschlüsselt gespeichert. Neu verbinden geht nur, wenn der Betreiber es freigeschaltet hat; verbundene Konten laufen weiter.',
        ],
      },
    ],
  },
  {
    version: '4.1.11',
    seiten: 'Vorbilder, Handbuch',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Vorbilder zeigt nur noch Personen, die seit mindestens zehn Jahren verstorben sind.',
        ],
      },
    ],
  },
  {
    version: '4.1.10',
    seiten: 'Mehr',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: [
          'Scheitert eine Verbindung, steht der Grund mit einer Lösung an der Zeile. Trennen und Entfernen sagen vorher, was bleibt.',
        ],
      },
    ],
  },
  {
    version: '4.1.9',
    seiten: 'Alle',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: [
          'Im hellen Modus passt die Farbe der Browserleiste jetzt zum Hintergrund, und installierte Apps holen nach einem Update das aktuelle Manifest.',
        ],
      },
    ],
  },
  {
    version: '4.1.8',
    seiten: 'Anmeldung, Mehr',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: [
          'Unter der Anmeldung und unten in Mehr und Konto steht jetzt, von wem Stride ist, mit Link zu leohr.de.',
        ],
      },
    ],
  },
  {
    version: '4.1.7',
    seiten: 'Mehr',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: [
          'Todoist und Kalender haben unter Verbindungen jeweils eine eigene Seite, der Status steht als Text daneben.',
        ],
      },
    ],
  },
  {
    version: '4.1.6',
    seiten: 'Mehr',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Die laufende Version lässt sich ohne Anmeldung abrufen. Der Server kann ein Tagesprotokoll führen und Dateien entfernen, die älter als 14 Tage sind.',
        ],
      },
    ],
  },
  {
    version: '4.1.4',
    seiten: 'Alle',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Ein angemeldetes Konto sieht nur die eigenen Daten.'],
      },
    ],
  },
  {
    version: '4.1.3',
    seiten: 'Mehr, Anmeldung',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Du kannst dein eigenes Konto jetzt endgültig löschen. Alle Daten dieses Kontos werden dabei entfernt.',
          'Bist du das einzige Konto, kannst du die Daten vorher exportieren. Danach ist die Instanz leer.',
        ],
      },
      {
        titel: 'Geändert',
        punkte: ['Die Admin-Rolle bleibt an dem einmal vergebenen Konto, auch wenn der Name sich ändert.'],
      },
    ],
  },
  {
    version: '4.1.2',
    seiten: 'Alle',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Stride schickt jetzt zusätzliche Sicherheitsangaben an den Browser.'],
      },
    ],
  },
  {
    version: '4.1.1',
    seiten: 'Anmeldung',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Stride bremst jetzt zu viele Anfragen in kurzer Zeit und schützt die Registrierung besser.'],
      },
    ],
  },
  {
    version: '4.1.0',
    seiten: 'Anmeldung, Mehr',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: ['Wer Stride selbst betreibt, kann jetzt die Anmeldung über Google erlauben.'],
      },
    ],
  },
  {
    version: '4.0.9',
    seiten: 'Heute',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Die Hinweise auf Heute zum Installieren, zu Benachrichtigungen und zur Bewertung sind jetzt eine schmale Zeile.',
        ],
      },
    ],
  },
  {
    version: '4.0.8',
    seiten: 'Anmeldung',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Wer Stride selbst betreibt, kann jetzt erlauben, dass neue Nutzer selbst ein Konto erstellen.',
        ],
      },
    ],
  },
  {
    version: '4.0.7',
    seiten: 'Heute, Mehr',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Die App lässt sich jetzt direkt aus der App heraus installieren.',
        ],
      },
    ],
  },
  {
    version: '4.0.6',
    seiten: 'Profil',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Die zwölf Klassenzeichen sind feiner und sauberer gezeichnet.',
        ],
      },
    ],
  },
  {
    version: '4.0.5',
    seiten: 'Profil',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Die zwölf Klassen haben neue Zeichen: Hantel, Mondsichel mit Stern, Helm, Buch, Sprechblasen, Palette, Achtelnote, Bergspitze, Triskele, Krone, Keimling und Waage.',
        ],
      },
    ],
  },
  {
    version: '4.0.4',
    seiten: 'Ziele',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Auf Ziele rücken direkte Projekte und Organisationen unter der Vision ein. Projekte einer Organisation rücken nur am Namen eine Stufe weiter ein. Level und Menü bleiben rechts auf einer Kante.',
        ],
      },
    ],
  },
  {
    version: '4.0.3',
    seiten: 'Profil',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'Freigeschaltete Titel sind klar lesbar und behalten den Pokal. Noch nicht erreichte Titel bleiben dezenter und ohne Symbol.',
        ],
      },
    ],
  },
  {
    version: '4.0.2',
    seiten: 'Profil',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Im Profil entfällt die Zeile Erfolge. Klassen und Titel bleiben, und den Titel wählst du weiter unter Profil bearbeiten.',
        ],
      },
    ],
  },
  {
    version: '4.0.1',
    seiten: 'Anmeldung',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Auf der Anmeldung steht die Überschrift unter dem Logo. Auf dem Handy ist das Formular eine Gruppe, auf dem Computer ist es 400 Pixel breit.',
        ],
      },
    ],
  },
  {
    version: '4.0.0',
    seiten: 'Was ist neu',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Diese Version fasst die vorhandenen Funktionen zusammen: Einträge, Ziele, Tageskette, Bosse, Profil, Investitionen, Rückblick, Vorbilder, Basis, Verbindungen und Benachrichtigungen. Aussehen und Verhalten bleiben gleich.',
        ],
      },
    ],
  },
  {
    version: '3.56.87',
    seiten: 'Benachrichtigungen',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Die Ruhezeit lässt sich nur ändern, solange Benachrichtigungen auf diesem Gerät an sind.'],
      },
    ],
  },
  {
    version: '3.56.86',
    seiten: 'Leiste',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Unter Weitere Seiten steht der Hinweis, dass alle Plätze belegt sind, nur noch einmal.'],
      },
    ],
  },
  {
    version: '3.56.85',
    seiten: 'Können, Haben',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Ein zu niedriges Attribut senkt andere XP nur, solange der Verfall für Können oder Haben an ist.'],
      },
    ],
  },
  {
    version: '3.56.84',
    seiten: 'Heute, Mehr, Ziele, Vorbilder, Fokus, Passwort, Leiste',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Auf dem Computer sind alle Seiten gleich breit, und die Aktionen im Kopf stehen auf derselben Kante wie der Inhalt.'],
      },
    ],
  },
  {
    version: '3.56.83',
    seiten: 'Tätigkeit, Investition, Attribut, Basis',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Das Symbol wählt man in einer Zeile. Das Raster öffnet sich erst beim Antippen.'],
      },
    ],
  },
  {
    version: '3.56.82',
    seiten: 'Ziele',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: ['Das eigene Level steht in derselben Zeile wie die Vorschläge.'],
      },
    ],
  },
  {
    version: '3.56.81',
    seiten: 'Vorbild',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Beim Vorbild steht der Name nur noch im Seitenkopf. Darunter stehen bekannt für, Level mit Klasse und Titel und die Ähnlichkeit.'],
      },
    ],
  },
  {
    version: '3.56.80',
    seiten: 'Tätigkeiten, Projekt',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: ['Bei Tätigkeiten bleibt unter dem Namen in einer Zeile stehen, was sie stärkt. Reicht der Platz nicht, endet die Zeile mit ….'],
      },
    ],
  },
  {
    version: '3.56.79',
    seiten: 'Ziel, Fokus, Einführung',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Auswahllisten stehen als Zeilen statt als Karten.'],
      },
    ],
  },
  {
    version: '3.56.78',
    seiten: 'Laufend, Projekt, Leiste',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Zweitknöpfe haben keine graue Fläche mehr.'],
      },
    ],
  },
  {
    version: '3.56.77',
    seiten: 'Projekt',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Projekt abschließen steht im Menü im Kopf der Projektseite.'],
      },
    ],
  },
  {
    version: '3.56.76',
    seiten: 'Können, Haben',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: ['Die Verlust-Stufen eines Attributs stehen je Gruppe in einer Zeile.'],
      },
    ],
  },
  {
    version: '3.56.75',
    seiten: 'Laufend, Projekt',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Bosse öffnen sich in Laufend und auf der Projektseite durch Tippen auf die ganze Zeile.'],
      },
    ],
  },
  {
    version: '3.56.74',
    seiten: 'Heute',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Kennzahlen auf Heute stehen mittig in gleich breiten Spalten.'],
      },
    ],
  },
  {
    version: '3.56.73',
    seiten: 'Was ist neu',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Die Mitte von Symbolen, Zahlen und Texten wird geprüft. Die Oberfläche bleibt gleich.',
        ],
      },
    ],
  },
  {
    version: '3.56.72',
    seiten: 'Heute, Basis, Laufend',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'In der Basis, bei Bossen und auf Laufend stehen die Symbole der Zeilen in einer Spalte und mittig am Text.',
        ],
      },
    ],
  },
  {
    version: '3.56.71',
    seiten: 'Was ist neu',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Eine früher im Browser gemerkte Sprache, Ansicht oder ein zugeklappter Bereich gilt weiter.',
        ],
      },
    ],
  },
  {
    version: '3.56.70',
    seiten: 'Was ist neu',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Ohne gewählte Sprache und ohne passende Sprache des Geräts startet die App auf Englisch.',
        ],
      },
    ],
  },
  {
    version: '3.56.69',
    seiten: 'Was ist neu',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Die dunkle Browserleiste und der Startbildschirm der installierten App sind dasselbe Dunkelgrau wie die App.',
        ],
      },
    ],
  },
  {
    version: '3.56.68',
    seiten: 'Was ist neu',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Die laufende App bleibt in ihrem eigenen Ordner. Ein Bau daneben ändert sie nicht von selbst.',
        ],
      },
    ],
  },
  {
    version: '3.56.67',
    seiten: 'Heute',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'Auf Heute stehen Streak-Text, Hinweis und + Eintrag in einer Zeile. Auf einem schmalen Bildschirm steht dort Streak offen.',
        ],
      },
    ],
  },
  {
    version: '3.56.66',
    seiten: 'Ziele',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: [
          'Auf Ziele ist der Knopf Neu gefüllt und hat ein Plus davor.',
        ],
      },
    ],
  },
  {
    version: '3.56.65',
    seiten: 'Ziele',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'Auf Ziele stehen die Level der Visionen in derselben Spalte wie die Level der Projekte.',
        ],
      },
    ],
  },
  {
    version: '3.56.64',
    seiten: 'Ziele',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'Auf Ziele beginnt die Nebenzeile eines Projekts mit den Tagen in Folge. Rechts steht nur das Level.',
        ],
      },
    ],
  },
  {
    version: '3.56.63',
    seiten: 'Heute',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'Auf Heute stehen die Knöpfe der Benachrichtigung nebeneinander und sehen aus wie in den Dialogen.',
        ],
      },
    ],
  },
  {
    version: '3.56.62',
    seiten: 'Fähigkeiten',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'Auf einer Fähigkeit ist der Ring wieder dünn und beginnt oben. Baum, Ränge und Karte leuchten wieder in der Farbe der Fähigkeit.',
        ],
      },
    ],
  },
  {
    version: '3.56.61',
    seiten: 'Heute, Projekt, Profil',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: [
          'Der Levelring auf Heute und im Projekt ist etwas größer. Die Zahl, das Wort Level, der Strich und der Lichtpunkt wachsen im gleichen Verhältnis mit.',
        ],
      },
    ],
  },
  {
    version: '3.56.60',
    seiten: 'Heute, Projekt, Profil, Fähigkeiten',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Der Levelring beginnt wieder oben, läuft im Uhrzeigersinn und endet mit einem Lichtpunkt.'],
      },
    ],
  },
  {
    version: '3.56.59',
    seiten: 'Heute, Projekt',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Der Levelring auf Heute und im Projekt ist wieder größer, und Schrift und Strich passen zur Größe.'],
      },
    ],
  },
  {
    version: '3.56.58',
    seiten: 'Heute, Laufend, Projekt',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Bei offenen Bossen sitzt das Schwert mittig im Ring. Ein voller Ring hat oben keine Lücke.'],
      },
    ],
  },
  {
    version: '3.56.57',
    seiten: 'Fähigkeiten',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'Auf einer Fähigkeit sind Farbe, Verlauf und Glühen wieder da. Zahlen auf erreichten Rängen und Knoten bleiben weiß und lesbar, der Rangname auch, und der Ring leuchtet in der Farbe der Fähigkeit.',
        ],
      },
    ],
  },
  {
    version: '3.56.56',
    seiten: 'Heute, Laufend, Projekt',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Bei offenen Bossen sind Ring und Schwert größer und beide rot.'],
      },
    ],
  },
  {
    version: '3.56.55',
    seiten: 'Fähigkeiten',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'Auf einer Fähigkeit sind Ring, XP-Balken und erreichte Ränge in der Fortschrittsfarbe. Der Rangname bleibt lesbar, Knoten haben einen Rand, und freigeschaltete zeigen einen Haken. Die Farbe der Fähigkeit bleibt am Symbol.',
        ],
      },
    ],
  },
  {
    version: '3.56.54',
    seiten: 'Was ist neu',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Nur die Versionsnummer. Aussehen und Verhalten bleiben gleich.'],
      },
    ],
  },
  {
    version: '3.56.53',
    seiten: 'Was ist neu',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Nur die Versionsnummer. Aussehen und Verhalten bleiben gleich.'],
      },
    ],
  },
  {
    version: '3.56.52',
    seiten: 'Verbindungen',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Auf Verbindungen steht der Link zum Todoist-Token in einer eigenen Zeile und ist leichter zu treffen.'],
      },
    ],
  },
  {
    version: '3.56.51',
    seiten: 'Accounts',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Bei Accounts zeigt jede Zeile den Benutzernamen und die Rolle in der Nebenzeile.'],
      },
    ],
  },
  {
    version: '3.56.50',
    seiten: 'Vorbilder',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Bei den Vorbildern steht die Zeile Du in einer eigenen Fläche. Die Richtungen haben links und rechts Abstand zum Rand.',
        ],
      },
    ],
  },
  {
    version: '3.56.49',
    seiten: 'Handbuch',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Im Handbuch bleiben die Tabellen in der Breite. Die Level-Tabelle zeigt Level, XP und Dauer, der Hinweis darunter nennt die XP am Tag. Vorbilder stehen als Liste mit Richtung und Level.',
        ],
      },
    ],
  },
  {
    version: '3.56.48',
    seiten: 'Statistik',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'In der Statistik ist der gewählte Zeitraum kräftiger geschrieben. Die Achsen nutzen glatte Schritte, und die Balken von Tätigkeiten und Projekten sind gleich hoch.',
        ],
      },
    ],
  },
  {
    version: '3.56.47',
    seiten: 'Investitionen, Heute, Basis',
    behoben: 'Investitionen, Heute, Basis',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'Der Scrollbalken in Blättern liegt neben dem Inhalt und verdeckt keine Felder. Auf dem Handy erscheint er nur beim Scrollen.',
        ],
      },
    ],
  },
  {
    version: '3.56.46',
    seiten: 'Heute, Können, Haben, Verlauf',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Boss-Symbole und prozentuale XP-Abzüge sind rot. Bei einem zu niedrigen Attribut sind Warnzeichen, Text und Level rot.'],
      },
    ],
  },
  {
    version: '3.56.45',
    seiten: 'Heute, Können, Haben',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Bei Attributen steht der Zustand hinter dem Namen, das Level bleibt rechts. Reicht der Platz nicht, bleibt das Warnzeichen, und ein Tipp zeigt den Text.'],
      },
    ],
  },
  {
    version: '3.56.44',
    seiten: 'Heute, Profil, Fähigkeiten, Ziele',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Der Levelring schließt mit einem kurzen Verlauf, einer Spitze und einem leichten Glühen ab.'],
      },
    ],
  },
  {
    version: '3.56.43',
    seiten: 'Heute',
    behoben: 'Heute',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Die Schwerter der Bosse bleiben im Ring.'],
      },
    ],
  },
  {
    version: '3.56.42',
    seiten: 'Heute, Ziele, Verlauf, Mehr, Profil',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Das Klassenzeichen im Profilbild liegt auf einer Fläche in der Textfarbe. Am Computer zeigt der Zeiger Profil und Level.'],
      },
    ],
  },
  {
    version: '3.56.41',
    seiten: 'Heute',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Auf Heute steht der Streak-Hinweis in einer Zeile. + Eintrag ist ein Textknopf.'],
      },
    ],
  },
  {
    version: '3.56.40',
    seiten: 'Heute, Ziele, Basis',
    behoben: 'Heute, Ziele, Basis',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Auf dem Handy sind einklappbare Gruppen an allen Ecken abgerundet.'],
      },
    ],
  },
  {
    version: '3.56.39',
    seiten: 'Heute, Ziele, Verlauf, Rückblick, Statistik, Basis, Handbuch, Mehr, Vorbilder',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Flächen heben sich deutlicher vom Hintergrund ab.'],
      },
    ],
  },
  {
    version: '3.56.38',
    seiten: 'Heute, Ziele, Verlauf, Rückblick, Statistik, Basis, Handbuch, Mehr, Vorbilder',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Auf dem Handy steht jeder Abschnitt als eingerückte Gruppe. Die Zeilen darin trennt eine Linie.'],
      },
    ],
  },
  {
    version: '3.56.37',
    seiten: 'Heute, Ziele, Verlauf, Rückblick, Statistik, Basis, Handbuch, Mehr, Vorbilder',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Die Abstände über und unter den Abschnittsüberschriften sind überall gleich.'],
      },
    ],
  },
  {
    version: '3.56.36',
    seiten: 'Heute, Ziele, Verlauf, Handbuch, Fähigkeiten, Vorbilder, Mehr',
    behoben: 'Heute, Ziele, Verlauf, Handbuch, Fähigkeiten, Vorbilder, Mehr',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Bei 1 steht die Einzahl, in jeder Sprache.'],
      },
    ],
  },
  {
    version: '3.56.35',
    seiten: 'Heute',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Auf Heute bleibt die Streak-Zahl sichtbar. Der Abschnitt darunter erscheint nur, wenn es etwas zu tun gibt.',
        ],
      },
    ],
  },
  {
    version: '3.56.34',
    seiten: 'Heute',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Auf Heute steht Basis nur in der Überschrift. Die letzte Zeile öffnet alle Basis-Aufgaben.',
        ],
      },
    ],
  },
  {
    version: '3.56.33',
    seiten: 'Rückblick',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Im Rückblick heißt der Bereich Veränderung. Die Kennzahlen sind einheitlich, die Wochenpfeile sind größer, und die Felder lassen sich nicht mehr ziehen.',
        ],
      },
    ],
  },
  {
    version: '3.56.32',
    seiten: 'Verlauf',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Im Verlauf hat der Knopf zum Laden älterer Einträge einen Rahmen statt einer grauen Fläche.',
        ],
      },
    ],
  },
  {
    version: '3.56.31',
    seiten: 'Ziele',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Auf Ziele sind Organisationen niedriger. Die Projekte darunter rücken ein. Abgeschlossen steht in der Nebenzeile.',
        ],
      },
    ],
  },
  {
    version: '3.56.30',
    seiten: 'Heute',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Auf Heute stehen die Bereiche auf der vollen Breite. Bosse stehen in einer Liste. Basis, Werte und Aktivität klappen gleich auf.',
        ],
      },
    ],
  },
  {
    version: '3.56.29',
    seiten: 'Heute, Basis, Können, Haben',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Offene Aufgaben zeigen einen leeren Kreis, erledigte einen gefüllten Kreis mit Haken. Ein zu niedriges Attribut steht als Zeile mit Warnzeichen.',
        ],
      },
    ],
  },
  {
    version: '3.56.28',
    seiten: 'Heute, Können, Haben',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Der Levelring ist einfarbig und auf Heute kleiner. Die XP-Zeile passt in eine Zeile. Bei Können und Haben zeigt das Radar die Werte als Fläche.',
        ],
      },
    ],
  },
  {
    version: '3.56.27',
    seiten: 'Heute, Können, Haben, Rückblick',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Auf Heute, Können und Haben sind Level, Hinweis und XP-Abzug nicht mehr rot. Im Rückblick steht verlorenes XP in der normalen Textfarbe.',
        ],
      },
    ],
  },
  {
    version: '3.56.26',
    seiten: 'Heute, Verlauf',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Auf Heute sind Bosse nicht mehr rosa hinterlegt. Rot bleibt nur der Abzug bei Disziplin. Einträge im Verlauf haben dieselbe Farbe wie die übrigen.',
        ],
      },
    ],
  },
  {
    version: '3.56.25',
    seiten: 'Rückblick, Verbindungen',
    behoben: 'Rückblick, Verbindungen',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'Speichern und Verbinden bleiben gut lesbar. Fehlt eine Eingabe, steht der Fehler am Feld.',
        ],
      },
    ],
  },
  {
    version: '3.56.24',
    seiten: 'Eintrag, Einführung',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Beim Eintragen stehen Tätigkeit, Vorhaben und Fähigkeit in je einer Zeile. Die Felder in den Blättern sind gleich hoch, und in der Einführung steht Weiter direkt darunter.',
        ],
      },
    ],
  },
  {
    version: '3.56.23',
    seiten: 'Verlauf, Ziele',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Im Verlauf und bei den Zielen sind die Zeilen gleich hoch. Die XP-Werte im Verlauf stehen rechts bündig.',
        ],
      },
    ],
  },
  {
    version: '3.56.22',
    seiten: 'Mehr, Konto, Vorbilder, Accounts',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Unter Mehr, beim Konto, bei Vorbildern und bei Accounts sind die Zeilen gleich hoch. Werte stehen rechts bündig.',
        ],
      },
    ],
  },
  {
    version: '3.56.21',
    seiten: 'Ziele, Rückblick, Statistik, Können, Haben, Basis, Handbuch, Mehr, Konto, Vorbilder',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Die übrigen Seiten nutzen dieselbe Abschnittsüberschrift. Auf dem Handy stehen Listen, Tabellen und Diagramme auf einer Fläche in voller Breite.',
        ],
      },
    ],
  },
  {
    version: '3.56.20',
    seiten: 'Verlauf, Verbindungen, Vorbilder',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Auf Verlauf, Verbindungen und Vorbilder sehen die Abschnittsüberschriften gleich aus. Auf dem Handy reichen die Listen über die ganze Breite.',
        ],
      },
    ],
  },
  {
    version: '3.56.19',
    seiten: 'Heute, Verlauf, Statistik',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Heute, Verlauf und Statistik heißen in der Leiste, unter Mehr und im Seitenkopf gleich.'],
      },
    ],
  },
  {
    version: '3.56.18',
    seiten: 'Heute, Können, Haben, Fähigkeiten, Ziele, Profil',
    behoben: 'Heute, Können, Haben, Fähigkeiten, Ziele, Profil',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Auf dem Handy reicht der Inhalt bis an den rechten Rand.'],
      },
    ],
  },
  {
    version: '3.56.17',
    seiten: 'Heute, Können, Haben, Fähigkeiten, Ziele, Profil',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: ['Fortschrittsbalken enden mit einem kurzen Verlauf, einer schmalen Spitze und einem leichten Glühen.'],
      },
    ],
  },
  {
    version: '3.56.16',
    seiten: 'Investitionen',
    behoben: 'Investitionen',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Das Investitionsblatt wird rechts nicht mehr abgeschnitten. Name und Betrag bleiben vollständig sichtbar.'],
      },
    ],
  },
  {
    version: '3.56.15',
    seiten: 'Investitionen',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: ['Der eigene Betrag steht in derselben Zeile wie die Vorschläge.'],
      },
    ],
  },
  {
    version: '3.56.14',
    seiten: 'Investitionen',
    behoben: 'Investitionen',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'Beim Betrag einer Investition stehen drei verschiedene XP-Beträge. Wochen und Monate stehen an den Vorschlägen nicht mehr.',
        ],
      },
    ],
  },
  {
    version: '3.56.13',
    seiten: 'Ziele, Können, Haben, Basis',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Beim Level einer Vision, beim Verfall, bei der Dauer einer Basis-Aufgabe und beim Schätzen eines Levels stehen Vorschläge. Ein eigener Wert bleibt frei.',
        ],
      },
    ],
  },
  {
    version: '3.56.12',
    seiten: 'Investitionen',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Beim Betrag einer Investition stehen Vorschläge für eine Woche, einen Monat und drei Monate. Betrag und Bonus-Stufe bleiben frei kombinierbar.',
        ],
      },
    ],
  },
  {
    version: '3.56.11',
    seiten: 'Verlauf, Investitionen',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Eine bezahlte Investition steht im Verlauf am Tag der Zahlung. Löschen erscheint dort als eigene Zeile.',
        ],
      },
    ],
  },
  {
    version: '3.56.10',
    seiten: 'Investitionen',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Beim Anlegen einer Investition wählst du Kosten und Wirkung. Zu wenig XP speichert nichts. Löschen gibt gezahltes XP zurück.',
        ],
      },
    ],
  },
  {
    version: '3.56.9',
    seiten: 'Investitionen',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Eine Investition kann XP eines Attributs kosten, und das Level kann dabei sinken. Reicht das XP nicht, wird nichts gespeichert. Löschen gibt das XP zurück, Archivieren lässt es abgezogen.',
        ],
      },
    ],
  },
  {
    version: '3.56.8',
    seiten: 'Heute',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Die Streak-Karte auf Heute erklärt den Stand in einem Satz. Der Knopf + Eintrag öffnet denselben Eintrag wie der Plus-Knopf.',
        ],
      },
    ],
  },
  {
    version: '3.56.7',
    seiten: 'Handbuch',
    behoben: 'Handbuch',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'Im Handbuch bleibt eine Leiste oben und führt zu den Abschnitten. Der sichtbare Abschnitt ist hervorgehoben.',
        ],
      },
    ],
  },
  {
    version: '3.56.6',
    seiten: 'Heute, Mehr, Profil',
    behoben: 'Profilbild',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'Das Profilbild im Kopf, auf Mehr und auf dem Profil ist rund, auch in Hologramm und Antik. Der Fokus im Kopf folgt dem Kreis.',
        ],
      },
    ],
  },
  {
    version: '3.56.5',
    seiten: 'Was ist neu',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: ['Nur die Versionsnummer. Aussehen und Verhalten bleiben gleich.'],
      },
    ],
  },
  {
    version: '3.56.4',
    seiten: 'Darstellung',
    behoben: 'Darstellung',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'In jeder Ansicht sind alle vorgegebenen Paletten wählbar. Selbst erstellte bleiben in ihrer Ansicht.',
          'Text und Rahmen bleiben lesbar, wenn die Palette aus einer anderen Ansicht kommt. Levelring und Fehler behalten ihre Farbe.',
        ],
      },
    ],
  },
  {
    version: '3.56.3',
    seiten: 'Heute, Rückblick, Verbindungen',
    behoben: 'Heute, Rückblick, Verbindungen',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'Basis auf Heute klappt außen auf. In der Karte führt ein Pfeil zur Seite.',
          'Ein Rückblick gibt kein Geist-XP, wenn Geist archiviert oder ausgeschaltet ist. Der Knopf zeigt dann nur Speichern.',
          'Speichern steht unter dem letzten Feld und verdeckt keine Eingabe.',
          'Todoist-Projekte und Labels haben wieder einen Schalter. Ausgeschaltet zählen sie nicht. Neue sind aus.',
        ],
      },
    ],
  },
  {
    version: '3.56.2',
    seiten: 'Heute, Investitionen, Tätigkeiten, Basis, Verbindungen',
    behoben: 'Heute, Investitionen, Tätigkeiten, Basis, Verbindungen',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'Ein Attribut in der Investition lässt sich durch erneutes Tippen abwählen. Die Bereiche heißen Investiert in und Bonus für.',
          'Blätter bleiben am rechten Rand vollständig sichtbar.',
          'Knöpfe zum Anlegen zeigen nur ein Plus.',
          'Auswahlfelder sehen aus wie die anderen Eingabefelder.',
        ],
      },
    ],
  },
  {
    version: '3.56.1',
    seiten: 'Profil, Können, Haben, Fähigkeiten, Heute',
    behoben: 'Profil, Können, Haben, Fähigkeiten, Heute',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: [
          'Level werden ohne Nachkommastellen angezeigt, auch im Radar und unter den Diagrammen.',
          'Auf dem Profil stehen die zwei Radar-Diagramme nebeneinander. Der Hinweis bleibt im Bild.',
          'Das Ausrufezeichen bei zu niedrigem Level steht hinter dem Namen.',
          'In der Liste der Fähigkeiten passen Level und Zahl in den Ring.',
        ],
      },
    ],
  },
  {
    version: '3.56.0',
    seiten: 'Heute, Ziele, Profil, Mehr, Verbindungen',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Können, Haben, Fähigkeiten und Investitionen haben eigene Seiten. Das Profil fasst sie nur zusammen.',
          'Mehr ist eine Liste. Verbindungen zeigen, als was erledigte Aufgaben und vergangene Termine zählen.',
          'Das Handbuch erklärt die Regeln auf einer Seite. Empfehlungen und doppelte Schalter sind weg.',
        ],
      },
    ],
  },
  {
    version: '3.55.0',
    seiten: 'Heute, Darstellung',
    behoben: 'Heute',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Minimal, Jade, Hologramm und Antik behalten ihre eigene Form. Streak, Ring, Schalter, Fehler und Erfolg haben in jeder Ansicht dieselben Farben.',
        ],
      },
      {
        titel: 'Behoben',
        punkte: ['In der Ansicht Antik hat das Profilbild im Kopf keinen eckigen Rahmen.'],
      },
    ],
  },
  {
    version: '3.54.0',
    seiten: 'Paletten, Daten',
    abschnitte: [
      {
        titel: 'Verbessert',
        punkte: ['Ein Hinweis heißt Info zu dem Namen daneben und lässt sich mit der Tastatur öffnen.'],
      },
      {
        titel: 'Geändert',
        punkte: [
          'Beim Anlegen einer Palette steht, wofür Primär, Akzent und Hintergrund da sind. Streak, Ring und Schalter behalten feste Farben.',
          'Profil zurücksetzen nennt Tätigkeiten.',
        ],
      },
    ],
  },
  {
    version: '3.53.0',
    seiten: 'Heute, Bereiche, Tätigkeiten',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Der Hinweis am Streak nennt nur die freie Pause und den angeschlagenen Streak.',
          'Bei Bosse steht, dass nur ein Datum gilt und nach der Deadline Disziplin verloren geht.',
          'Bei Verfall steht, dass ungenutzte Attribute XP verlieren. Die Stärke stellst du pro Attribut ein.',
        ],
      },
    ],
  },
  {
    version: '3.52.0',
    seiten: 'Verbindungen',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Bei jedem Kalender steht, als welche Tätigkeit vergangene Termine zählen.',
          'Gehört zu kann leer bleiben. Ohne Projekt zählt eine allgemeine Tätigkeit.',
          'Hat der Kalender einen Fehler, steht rechts Fehler.',
        ],
      },
    ],
  },
  {
    version: '3.51.0',
    seiten: 'Verbindungen',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'In Todoist steht bei jedem Projekt, als welche Tätigkeit eine erledigte Aufgabe zählt.',
          'Ohne eigene Wahl gilt die Zeile Standard.',
          'Labels sind zugeklappt. Ein Label geht vor dem Projekt, bei mehreren das oberste.',
        ],
      },
    ],
  },
  {
    version: '3.50.0',
    seiten: 'Verbindungen',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Eine erledigte Todoist-Aufgabe zählt mit der Tätigkeit, auch ohne Ziel.',
          'Ein Label ersetzt die Zuordnung des Projekts. Bei mehreren gilt das oberste.',
          'Ein vergangener Termin zählt mit der Tätigkeit, auch ohne Projekt.',
        ],
      },
    ],
  },
  {
    version: '3.49.1',
    seiten: 'Beispieldaten',
    abschnitte: [
      {
        titel: 'Behoben',
        punkte: ['Beispieldaten schalten die nötigen Bereiche ein und füllen eine neue Datenbank.'],
      },
    ],
  },
  {
    version: '3.49.0',
    seiten: 'Anmeldung, Passwort',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Passwortmanager können die Anmeldung, das erste Konto und das Ändern des Passworts ausfüllen und speichern.',
        ],
      },
      {
        titel: 'Geändert',
        punkte: ['Schlägt die Anmeldung fehl, bleibt der Benutzername stehen. Nur das Passwort wird geleert.'],
      },
    ],
  },
  {
    version: '3.48.0',
    seiten: 'Profil, Können, Haben, Fähigkeiten, Basis, Paletten',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Beim Attribut steht Verfall über den Verlust-Feldern, nur wenn Verfall an ist.',
          'Ein neues Attribut legst du über Können oder Haben an. Jede Zeile hat Hinzufügen.',
          'Klassen und Titel zeigt die Tabelle, darunter den Satz zum stärksten Können.',
          'Fähigkeit und Knoten heißen im Dialog so. Unter einem Knoten steht Darunter anlegen.',
          'Eine Palette zeigt die Farben und Auswählen. Bearbeiten und Löschen liegen im Menü.',
        ],
      },
    ],
  },
  {
    version: '3.47.0',
    seiten: 'Eintrag, Ziele, Tätigkeiten, Investitionen, Erfolge',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Dialoge für Eintrag, Ziele, Tätigkeiten, Investitionen und Erfolge haben eine feste Reihenfolge.',
          'Eine neue Tätigkeit aus einem Projekt gilt für alle Projekte oder nur für dieses.',
          'Bei einer Vision steht die XP beim Erreichen neben dem Level.',
          'Der Investitionsdialog hat kein Info-Icon. Der Schalter heißt Bonus gilt auch für Ressourcen.',
          'Erfolge zeigen den Stand im Titel und die Zeile Titel wählen.',
        ],
      },
    ],
  },
  {
    version: '3.46.0',
    seiten: 'Benachrichtigungen, Daten',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Auf diesem Gerät ist ein Schalter. Darunter steht, ob Benachrichtigungen an sind.',
          'Die Arten heißen Streak in Gefahr, Boss einen Tag vorher und Rückkehr geht auf. Ist das Gerät aus, sind die Schalter gesperrt.',
          'Die Ruhezeit steht in einer Zeile und öffnet die Felder Ruhe von und Ruhe bis.',
          'Daten zeigt Exportieren mit einem Symbol, Importieren und den roten Eintrag Profil zurücksetzen.',
        ],
      },
    ],
  },
  {
    version: '3.45.0',
    seiten: 'Darstellung, Paletten, Karten auf Heute',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Die Sprache steht in einer Zeile und öffnet eine Liste. Die Ansicht wählst du über Vorschaukacheln.',
          'Farben dieser Ansicht, eigene Paletten und eigene Farben liegen untereinander. Zurücksetzen holt die Palette.',
          'Karten auf Heute zeigt nur Schalter. Zeilen ausgeschalteter Bereiche fehlen.',
        ],
      },
    ],
  },
  {
    version: '3.44.0',
    seiten: 'Tätigkeiten, Bereiche',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Tätigkeiten zeigt alle Einträge. Die für ein Projekt stehen in einer eigenen Gruppe. Unter dem Namen steht, was sie stärkt.',
          'Eine Zeile öffnet die Tätigkeit. Die Reihenfolge liegt im Menü oben.',
          'Bereiche sagt unter dem Titel, dass Ausschalten nur ausblendet. Ein gesperrter Schalter nennt den Grund in der Zeile.',
        ],
      },
    ],
  },
  {
    version: '3.43.0',
    seiten: 'Accounts',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Der Admin ändert einen Benutzernamen im Menü bei Accounts.',
          'Ist der Name schon vergeben, steht der Fehler am Feld. Der bisherige Name bleibt.',
          'Die Seiten für Benutzernamen führen zu Accounts.',
        ],
      },
    ],
  },
  {
    version: '3.42.0',
    seiten: 'Konto',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Das Konto zeigt Profil und Anmeldung. Der Benutzername ist nur zum Lesen.',
          'Ziel-Stufen und die Liste der Benutzernamen stehen nicht mehr im Konto.',
          'Beim Geburtsjahr steht das ungefähre Alter. Unter Fokus steht, was Speichern archiviert.',
        ],
      },
    ],
  },
  {
    version: '3.41.0',
    seiten: 'Handbuch',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Das Handbuch ist eine Scrollseite. Oben stehen Sprünge zu den Abschnitten.',
          'Einträge, Streak, Level, Visionen und Vorbilder stehen offen in Tabellen.',
          'Empfohlen, Nach Vorliebe und die Hinweistexte sind weg.',
        ],
      },
    ],
  },
  {
    version: '3.40.0',
    seiten: 'Verlauf, Rückblick, Statistik, Basis',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Der Verlauf filtert über ein Blatt. Rückblick und Statistik stehen oben als Zeilen.',
          'Löschen im Verlauf ist nur beim Wischen rot.',
          'Der Rückblick zeigt Höhepunkte, Wachstum und Zahlen. Speichern bleibt unten.',
          'Die Statistik zeigt die Kennzahlen ohne Karten.',
          'Die Basis gruppiert nach Projekt. Eine Zeile legt eine Basis-Aufgabe an.',
        ],
      },
    ],
  },
  {
    version: '3.39.1',
    seiten: 'Vorbilder',
    abschnitte: [
      {
        titel: 'Hinzugefügt',
        punkte: [
          'Vorbilder lassen sich als Favorit merken.',
          'Favoriten stehen oben auf der Liste und bleiben bei jedem Richtungsfilter sichtbar.',
          'Entfernen gilt sofort. Eine Meldung bietet Rückgängig.',
        ],
      },
    ],
  },
  {
    version: '3.39.0',
    seiten: 'Profil, Fähigkeit, Vorbilder',
    abschnitte: [
      {
        titel: 'Geändert',
        punkte: [
          'Das Profil fasst Level, Kennzahlen, Erfolge und die Seiten im Profil zusammen.',
          'Die Spektren von Können und Haben stehen klein nebeneinander.',
          'Der Stift im Profil öffnet das Konto.',
          'An einer Fähigkeit liegt das Menü im Kopf.',
          'Vorbilder sind eine Liste. Die Richtungen rollen seitlich.',
        ],
      },
    ],
  },
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
