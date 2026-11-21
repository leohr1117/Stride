import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

const WIN_LAUFWERK = /^[a-zA-Z]:[\\/]/;
const WIN_UNC = /^(?:\\\\|\/\/)/;

type PfadArt = 'win32' | 'posix';

function aussen(gespeichert: string): Error {
  return new Error(`Die Weltdatei liegt außerhalb des Datenordners: ${gespeichert}`);
}

function istWindowsAbsolut(wert: string): boolean {
  return WIN_LAUFWERK.test(wert) || WIN_UNC.test(wert);
}

function istPosixAbsolut(wert: string): boolean {
  return wert.startsWith('/') && !istWindowsAbsolut(wert);
}

function ordnerArt(ordner: string): PfadArt {
  if (istWindowsAbsolut(ordner)) {
    return 'win32';
  }
  if (ordner.startsWith('/')) {
    return 'posix';
  }
  return path === path.win32 ? 'win32' : 'posix';
}

function ausRelativ(roh: string): string {
  if (roh.includes('..') || roh.includes('\0')) {
    throw aussen(roh);
  }
  const teile = roh.split(/[\\/]+/).filter((teil) => teil.length > 0 && teil !== '.');
  if (teile.length === 0 || teile.some((teil) => teil === '..' || teil.includes(':'))) {
    throw aussen(roh);
  }
  return teile.join('/');
}

function relativDarin(basis: string, ziel: string, art: PfadArt): string | null {
  const p = art === 'win32' ? path.win32 : path.posix;
  const gleich = (links: string, rechts: string) => (art === 'win32' ? links.toLowerCase() === rechts.toLowerCase() : links === rechts);
  const basisTeile = basis.split(p.sep).filter((teil) => teil.length > 0);
  const zielTeile = ziel.split(p.sep).filter((teil) => teil.length > 0);
  let index = 0;
  while (index < basisTeile.length && index < zielTeile.length && gleich(basisTeile[index], zielTeile[index])) {
    index += 1;
  }
  if (index !== basisTeile.length) {
    return null;
  }
  const rest = zielTeile.slice(index);
  if (rest.length === 0 || rest.some((teil) => teil === '..' || teil.includes(':'))) {
    return null;
  }
  return rest.join('/');
}

function ausAbsolut(roh: string, datenordner: string): string {
  const art: PfadArt = istWindowsAbsolut(roh) ? 'win32' : 'posix';
  if (ordnerArt(datenordner) !== art) {
    throw aussen(roh);
  }
  const p = art === 'win32' ? path.win32 : path.posix;
  const relativ = relativDarin(p.resolve(datenordner), p.resolve(roh), art);
  if (relativ === null) {
    throw aussen(roh);
  }
  return relativ;
}

export function neutralisiereWeltdatei(gespeichert: string, datenordner: string): string {
  if (gespeichert === '') {
    throw aussen(gespeichert);
  }
  if (istWindowsAbsolut(gespeichert) || istPosixAbsolut(gespeichert)) {
    return ausAbsolut(gespeichert, datenordner);
  }
  return ausRelativ(gespeichert);
}

export function speichereWeltdatei(...teile: string[]): string {
  return ausRelativ(teile.join('/'));
}

export function migriereWeltdateien(db: DatabaseSync, datenordner: string): void {
  const zeilen = db.prepare('SELECT id, weltdatei FROM benutzer ORDER BY id').all() as { id: number; weltdatei: string }[];
  const aenderungen: { id: number; weltdatei: string }[] = [];
  for (const zeile of zeilen) {
    const neutral = neutralisiereWeltdatei(zeile.weltdatei, datenordner);
    if (neutral !== zeile.weltdatei) {
      aenderungen.push({ id: zeile.id, weltdatei: neutral });
    }
  }
  if (aenderungen.length === 0) {
    return;
  }
  const update = db.prepare('UPDATE benutzer SET weltdatei = ? WHERE id = ?');
  db.exec('BEGIN');
  try {
    for (const aenderung of aenderungen) {
      const ergebnis = update.run(aenderung.weltdatei, aenderung.id);
      if (Number(ergebnis.changes) !== 1) {
        throw new Error(`Die Weltdatei von Konto ${aenderung.id} wurde nicht umgestellt.`);
      }
    }
    db.exec('COMMIT');
  } catch (fehler) {
    db.exec('ROLLBACK');
    throw fehler;
  }
}
