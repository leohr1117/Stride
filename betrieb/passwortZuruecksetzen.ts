import { anzahlKonten, ersetzeZugangspasswort, listeKonten } from '../server/features/zugang/zugang.ts';

function frage(text: string, verdeckt: boolean): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    return Promise.reject(new Error('Bitte das Skript in einem Terminal ausführen.'));
  }
  return new Promise((resolve) => {
    process.stdout.write(text);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let wert = '';
    const ende = (ergebnis: string) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      process.stdout.write('\n');
      resolve(ergebnis);
    };
    const onData = (zeichen: string) => {
      if (zeichen === '\u0003') {
        stdin.setRawMode(false);
        process.stdout.write('\n');
        process.exit(1);
      }
      if (zeichen.includes('\r') || zeichen.includes('\n') || zeichen === '\u0004') {
        ende(wert);
        return;
      }
      if (zeichen === '\u007f' || zeichen === '\b') {
        wert = wert.slice(0, -1);
        if (!verdeckt) {
          process.stdout.write('\b \b');
        }
        return;
      }
      wert += zeichen;
      if (!verdeckt) {
        process.stdout.write(zeichen);
      }
    };
    stdin.on('data', onData);
  });
}

async function setzen(): Promise<void> {
  const mehrere = anzahlKonten() > 1;
  const benutzername = mehrere ? (await frage('Benutzername: ', false)).trim() : undefined;
  if (mehrere && !benutzername) {
    throw new Error('Der Benutzername fehlt.');
  }
  if (!mehrere && anzahlKonten() === 1) {
    const name = listeKonten()[0]?.benutzername;
    if (name) {
      console.log(`Account: ${name}`);
    }
  }

  const passwort = await frage('Neues Passwort: ', true);
  const wiederholung = await frage('Wiederholen: ', true);
  if (passwort !== wiederholung) {
    throw new Error('Die Passwörter stimmen nicht überein.');
  }
  ersetzeZugangspasswort(passwort, benutzername);
  console.log('Passwort zurückgesetzt.');
}

try {
  await setzen();
} catch (fehler) {
  console.error(fehler instanceof Error ? fehler.message : 'Das Passwort konnte nicht zurückgesetzt werden.');
  process.exit(1);
}
