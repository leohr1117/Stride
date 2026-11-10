# Stride

Stride ist eine Web-App, die den eigenen Alltag wie ein Rollenspiel führt: Du trägst ein, was du getan hast, bekommst dafür Erfahrungspunkte und steigst mit deinen Zielen und Fähigkeiten im Level auf.

![Ziele in Stride](docs/desktop-ziele.png)

## Funktionen

- **Einträge:** Eine Tätigkeit mit Dauer eintragen bringt XP. Tätigkeiten legst du selbst an und ordnest sie.
- **Ziele:** Visionen, Organisationen und Projekte mit eigenem Level, dazu offene Vorhaben.
- **Tageskette:** Ein Streak für jeden aktiven Tag, mit Schutz bei Pausen und einer Rückkehr nach einer Unterbrechung.
- **Gegner und Bosse:** Vorhaben können als Gegner oder Boss mit Deadline laufen. Ist die Deadline verpasst, kostet das XP.
- **Profil:** Können und Haben als Attribute, ein Baum aus Fähigkeiten, Investitionen, Klassen und Titel. Optional verlieren Attribute ohne Einträge an Wert.
- **Investitionen:** Eine Investition kann XP eines Attributs kosten. Beim Betrag gibt es Vorschläge, Betrag und Bonus-Stufe bleiben frei wählbar. Eine eigene Investition oder ein geschafftes Projekt gibt dauerhaft mehr XP.
- **Rückschau:** Verlauf aller Einträge, Rückblick und Statistik.
- **Vorbilder:** Vergleich des eigenen Profils mit bekannten Personen.
- **Basis:** Wiederkehrende Grundaufgaben.
- **Verbindungen:** Erledigte Aufgaben aus Todoist und Termine aus einem Kalender (iCal-Adresse, z. B. Google oder iCloud) werden zu Einträgen; Mehr zeigt eine Übersicht mit dem Status beider Verbindungen, und jede hat eine eigene Seite.
- **Benachrichtigungen:** Web-Push, wenn der Streak in Gefahr ist, ein Boss ansteht oder eine Rückkehr möglich ist, mit Ruhezeit.
- **Anpassen:** Bereiche lassen sich einzeln abschalten. Ansichten, Farbpaletten und eigene Farben.
- **Sonstiges:** Installierbar als PWA, mit einem Hinweis auf Heute nach der Anmeldung und einem Eintrag unter den Einstellungen. Sieben Sprachen (Deutsch, Englisch, Spanisch, Französisch, Japanisch, Russisch, Chinesisch). Ohne gewählte Sprache gilt die des Geräts, sonst Englisch. Eine früher im Browser gemerkte Sprache, Ansicht oder ein zugeklappter Bereich gilt weiter. Export und Import der Daten, mehrere Konten, auf Wunsch mit Selbst-Registrierung oder Anmeldung über Google, Anmeldung mit Passwortmanagern, Handbuch in der App. Zu viele Anfragen in kurzer Zeit werden gebremst, die Registrierung zusätzlich je Adresse. Stride schickt jetzt zusätzliche Sicherheitsangaben an den Browser. `GET /api/gesundheit` nennt ohne Anmeldung nur die laufende Version, etwa für eine Erreichbarkeitsprüfung, und zählt nicht zur Anfragegrenze. Ein Tagesprotokoll kann in einem eigenen Ordner liegen; Dateien, die älter als 14 Tage sind, werden entfernt.

Änderungen je Version stehen in [CHANGELOG.md](CHANGELOG.md).

## Technik

- TypeScript, React 19, React Router, TanStack Query, Tailwind CSS 4, Framer Motion, Recharts, Vite
- Server: Node.js (ab 23.6, führt TypeScript direkt aus), Fastify 5, SQLite über `node:sqlite`, Zod, web-push
- Tests: Vitest und Playwright

## Lokal starten

Voraussetzung: Node.js 23.6 oder neuer.

```bash
npm install
npm run dev
```

`npm run dev` startet den Server auf `127.0.0.1:3000` und den Vite-Entwicklungsserver (Standard `http://localhost:5173`), der `/api` an den Server weiterleitet. Beim ersten Aufruf legst du das erste Konto an.

Weitere Befehle:

```bash
npm test               # Unit-Tests (Vitest)
npm run typecheck      # Typprüfung
npm run e2e            # Browser-Tests; legen testvoll und testteil selbst an, ohne Dateien aus data/
npm run beispieldaten  # Beispielwelt in data/app.db; schaltet die nötigen Bereiche ein
npm run build          # Produktions-Build nach client/dist
npm start              # Server; Oberfläche aus STRIDE_CLIENT_DIR, Standard client/dist-live
```

Die Daten liegen in `data/` (`app.db` und `zugang.db`). Liegt `app.db` schon vor, legt `npm run beispieldaten` nichts an. `npm run beispieldaten -- --ersetzen` sichert die alte Datei und baut die Beispielwelt neu. Dafür schaltet das Skript die Bereiche ein, die die Beispielwelt braucht, und aktiviert fehlende Attribute.

### Umgebungsvariablen

| Variable | Zweck |
|---|---|
| `PORT` | Port des Servers, Standard 3000 |
| `STRIDE_DB_PFAD` | Pfad der Datenbank, Standard `data/app.db`. Dieser Name gilt vor dem alten Namen `DB_PFAD`. |
| `STRIDE_ZUGANG_PFAD` | Pfad der Zugangsdatenbank, Standard `data/zugang.db`. Dieser Name gilt vor dem alten Namen `ZUGANG_PFAD`. |
| `LOG_LEVEL` | Log-Stufe, Standard `warn` |
| `STRIDE_LOG_PFAD` | Ordner für das Tagesprotokoll. Jeder Tag ist eine Datei. Dateien, die älter als 14 Tage sind, werden gelöscht. Ohne die Variable nur die Konsole. Nicht die Datenbankdatei eintragen. `ASCEND_LOG_PFAD` wird weiter gelesen. |
| `STRIDE_CLIENT_DIR` | Ordner, aus dem der laufende Server die Oberfläche ausliefert. Standard ist `client/dist-live`. Ist der Ordner beim ersten Start noch leer, wird `client/dist` hineinkopiert. `npm run build` und die Browser-Tests schreiben und lesen weiter `client/dist`. Der alte Name `ASCEND_CLIENT_DIR` wird weiter gelesen. |
| `STRIDE_TOKEN_SCHLUESSEL` | 32 Byte Base64. Damit wird der Todoist-Token verschlüsselt gespeichert. Ohne ihn lässt sich Todoist nicht neu einrichten, vorhandene Tokens bleiben unverschlüsselt und laufen weiter. Ist er gesetzt, packt der Start sie einmal. Wer ihn ändert, gibt die Tokens neu ein. Der alte Name `ASCEND_TOKEN_SCHLUESSEL` wird weiter gelesen. |
| `STRIDE_ADMIN` | Admin wird einmal vergeben: Das Konto muss schon existieren, die Variable steht auf diesen Namen, nach dem Neustart zählt die gespeicherte Konto-ID. Ein späteres Konto mit demselben Namen ist kein Admin. Die Selbst-Registrierung dieses Namens bleibt gesperrt. `ASCEND_ADMIN` wird weiter gelesen. Fehlt das Konto beim ersten Start, wird nichts gespeichert und der nächste Start versucht es erneut. Nach dem Löschen des Admin-Kontos bindet beim nächsten Start nur ein anderer Name, und nur wenn dieses Konto schon existiert. Sonst warnt das Log, und eine spätere Registrierung bindet nicht. Derselbe Name bindet nie wieder. |
| `STRIDE_REGISTRIERUNG` | `1` erlaubt neuen Nutzern, selbst ein Konto zu erstellen. Standard aus. |
| `STRIDE_GOOGLE` | `1` erlaubt die Anmeldung über Google. Standard aus. Wirkt nur mit Client-ID und Secret. |
| `STRIDE_GOOGLE_CLIENT_ID` | Client-ID der Google-Cloud-Anmeldung. |
| `STRIDE_GOOGLE_CLIENT_SECRET` | Client-Geheimnis der Google-Cloud-Anmeldung. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Schlüssel für Web-Push |
| `STRIDE_TEST` | Nur für Tests: `1` schaltet den Testmodus ein (alter Name `ASCEND_TEST`). Dann setzt `POST /api/test/heute` mit `{ datum }` die Spieluhr des Servers (Kette, Einträge, Verfall, Bosse, Buchungen, Kalender- und Todoist-Zuordnung). Sitzungen und Sperren bleiben echte Zeit. Der Server warnt beim Start. `datum: null` stellt die echte Uhr wieder her. |

In der Google Cloud Console muss die Weiterleitungs-URI `https://<host>/api/zugang/google/zurueck` eingetragen sein.

Eine Vorlage mit allen Variablen steht in `.env.example`. Die Werte werden als Umgebungsvariablen gesetzt, zum Beispiel mit `node --env-file=.env`.

## Lizenz

GNU Affero General Public License v3.0, siehe [LICENSE](LICENSE).

## Autor

Stride von leohr: Leonardo Hramzow, [leohr.de](https://leohr.de), [GitHub](https://github.com/leohr1117)
