import type { ReactNode } from 'react';
import { klassenZeichen, type KlassenZeichen } from '../../../shared/spiel/klassen.ts';

function Zeichen({ kinder }: { kinder: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="size-full" fill="currentColor" aria-hidden="true">
      {kinder}
    </svg>
  );
}

const ZEICHEN: Record<KlassenZeichen, ReactNode> = {
  koerper: (
    <Zeichen kinder={
      <path d="M 7.66 14.96 L 8.09 18.29 L 5.78 19.68 L 3.04 17.74 L 2.61 14.41 L 4.92 13.02 Z M 8.04 17.24 L 9.5 16.36 L 7.28 12.68 L 5.82 13.55 Z M 8.61 16.14 L 16.94 10.93 L 15.39 8.36 L 7.06 13.57 Z M 18.18 10.95 L 16.72 11.82 L 14.5 8.14 L 15.96 7.26 Z M 20.96 6.76 L 21.39 10.09 L 19.08 11.48 L 16.34 9.54 L 15.91 6.21 L 18.22 4.82 Z" />
    } />
  ),
  geist: (
    <Zeichen kinder={
      <path d="M 11.3 8.28 A 6.6 6.6 0 1 0 13.72 17.3 A 5.05 5.05 0 0 1 11.3 8.28 Z M 18.9 1.85 L 19.62 3.91 L 21.8 3.96 L 20.06 5.28 L 20.69 7.37 L 18.9 6.12 L 17.11 7.37 L 17.74 5.28 L 16 3.96 L 18.18 3.91 Z" />
    } />
  ),
  disziplin: (
    <Zeichen kinder={
      <path fillRule="evenodd" d="M 4.15 21.35 L 4.15 12.05 C 4.15 6.55 7.45 3.15 12 3.15 C 16.55 3.15 19.85 6.55 19.85 12.05 L 19.85 21.35 Z M 6.7 7.85 H 17.3 V 10.65 H 13.35 V 16.55 H 10.65 V 10.65 H 6.7 Z" />
    } />
  ),
  intellekt: (
    <Zeichen kinder={
      <path d="M 1.55 6.35 Q 5.15 4.55 8.55 5.85 Q 10.15 6.7 10.7 8.05 L 10.7 19.15 Q 9.85 18.15 8.15 17.7 Q 4.85 16.85 1.55 18.35 Z M 22.45 6.35 Q 18.85 4.55 15.45 5.85 Q 13.85 6.7 13.3 8.05 L 13.3 19.15 Q 14.15 18.15 15.85 17.7 Q 19.15 16.85 22.45 18.35 Z" />
    } />
  ),
  soziales: (
    <Zeichen kinder={
      <path d="M 3.7 1.2 H 12.9 A 2.55 2.55 0 0 1 15.45 3.75 V 8.15 A 2.55 2.55 0 0 1 12.9 10.7 H 3.7 A 2.55 2.55 0 0 1 1.15 8.15 V 3.75 A 2.55 2.55 0 0 1 3.7 1.2 Z M 10.4 10.7 L 14.5 10.7 L 13.2 12.85 Z M 11.1 13.55 H 20.3 A 2.55 2.55 0 0 1 22.85 16.1 V 20.2 A 2.55 2.55 0 0 1 20.3 22.75 H 11.1 A 2.55 2.55 0 0 1 8.55 20.2 V 16.1 A 2.55 2.55 0 0 1 11.1 13.55 Z M 8.55 15.7 L 12.4 13.55 L 9.15 11.7 Z" />
    } />
  ),
  kreativitaet: (
    <Zeichen kinder={
      <path fillRule="evenodd" d="M 20.6 12.4 C 20.6 16.65 16.55 20.1 11.55 20.1 C 6.55 20.1 2.5 16.65 2.5 12.4 C 2.5 8.15 6.55 4.7 11.55 4.7 C 16.55 4.7 20.6 8.15 20.6 12.4 Z M 13.8 14.35 A 2.35 2.35 0 1 1 18.5 14.35 A 2.35 2.35 0 1 1 13.8 14.35 Z M 5.05 8.55 A 1.85 1.85 0 1 1 8.75 8.55 A 1.85 1.85 0 1 1 5.05 8.55 Z M 9.5 7.25 A 1.85 1.85 0 1 1 13.2 7.25 A 1.85 1.85 0 1 1 9.5 7.25 Z M 5.8 13.35 A 1.75 1.75 0 1 1 9.3 13.35 A 1.75 1.75 0 1 1 5.8 13.35 Z M 10.25 12.15 A 1.6 1.6 0 1 1 13.45 12.15 A 1.6 1.6 0 1 1 10.25 12.15 Z" />
    } />
  ),
  motorik: (
    <Zeichen kinder={
      <path d="M 11.47 15.53 C 12.28 16.94 11.26 19.05 9.18 20.25 C 7.09 21.46 4.75 21.29 3.93 19.88 C 3.12 18.46 4.14 16.35 6.23 15.15 C 8.31 13.94 10.65 14.11 11.47 15.53 Z M 11.15 16.35 L 13.55 15.35 L 15.15 3.25 L 12.75 4.25 Z M 15.05 3.35 C 20.55 4.35 21.05 10.15 15.55 12.45 C 19.15 10.55 18.85 6.25 14.15 5.35 Z" />
    } />
  ),
  mut: (
    <Zeichen kinder={
      <path d="M 1.4 20.85 L 22.6 20.85 L 16.55 8.15 L 13.05 13.15 L 8.7 3.85 L 5.55 9.35 L 8.45 11.55 L 4.85 14.55 L 7.35 16.35 L 2.7 20.85 Z" />
    } />
  ),
  vitalitaet: (
    <Zeichen kinder={
      <path d="M 12.2 2.25 L 15.2 2.75 L 17.65 5.55 L 17.85 8.95 L 16.15 11.15 L 13.85 10.15 L 14.85 7.85 L 13.45 5.55 L 11.05 6.35 L 9.35 8.15 L 10.25 4.55 Z M 20.34 17.05 L 18.41 19.4 L 14.76 20.12 L 11.72 18.59 L 10.66 16.02 L 12.68 14.53 L 14.17 16.54 L 16.86 16.48 L 17.37 14 L 16.66 11.63 L 19.33 14.21 Z M 3.46 16.7 L 2.39 13.85 L 3.59 10.33 L 6.43 8.46 L 9.19 8.83 L 9.47 11.32 L 6.98 11.61 L 5.69 13.97 L 7.58 15.65 L 9.99 16.22 L 6.42 17.24 Z" />
    } />
  ),
  fuehrung: (
    <Zeichen kinder={
      <path d="M 2.7 16.35 L 4.55 9.55 L 7.15 12.45 L 12 6.35 L 16.85 12.45 L 19.45 9.55 L 21.3 16.35 Z M 3.1 9.15 A 2.05 2.05 0 1 1 7.2 9.15 A 2.05 2.05 0 1 1 3.1 9.15 Z M 9.85 5.55 A 2.15 2.15 0 1 1 14.15 5.55 A 2.15 2.15 0 1 1 9.85 5.55 Z M 16.8 9.15 A 2.05 2.05 0 1 1 20.9 9.15 A 2.05 2.05 0 1 1 16.8 9.15 Z M 2.85 16.15 L 21.15 16.15 L 21.15 18.55 L 2.85 18.55 Z M 4.15 18.55 L 19.85 18.55 L 19.85 21.15 L 4.15 21.15 Z" />
    } />
  ),
  neuling: (
    <Zeichen kinder={
      <path d="M 11.55 15.15 C 6.7 15.35 2.15 12.7 2.7 8.35 C 6.35 7.15 9.9 11.2 11.55 15.15 Z M 12.45 13.45 C 16.5 7.55 22.15 5.15 21.45 9.85 C 18.15 13.85 15.05 14.15 12.45 13.45 Z M 10.45 13.15 L 13.55 13.15 L 13.55 19.05 L 10.45 19.05 Z M 3.4 18.45 C 3.4 22.25 20.6 22.25 20.6 18.45 C 16.7 20.7 7.3 20.7 3.4 18.45 Z" />
    } />
  ),
  allrounder: (
    <Zeichen kinder={
      <path d="M 10.05 3.15 A 1.95 1.95 0 1 1 13.95 3.15 A 1.95 1.95 0 1 1 10.05 3.15 Z M 1.45 4.55 L 22.55 4.55 L 22.55 7.55 L 1.45 7.55 Z M 10.65 4.55 L 13.35 4.55 L 13.35 18.85 L 10.65 18.85 Z M 5.85 18.85 L 18.15 18.85 L 18.15 21.65 L 5.85 21.65 Z M 3.2 7.55 L 5.9 7.55 L 5.9 10.7 L 3.2 10.7 Z M 1 10.7 L 8.1 10.7 Q 6.8 15.35 4.55 15.85 Q 2.3 15.35 1 10.7 Z M 18.1 7.55 L 20.8 7.55 L 20.8 10.7 L 18.1 10.7 Z M 15.9 10.7 L 23 10.7 Q 21.7 15.35 19.45 15.85 Q 17.2 15.35 15.9 10.7 Z" />
    } />
  ),
};

export function KlassenBild({
  klasse,
  groesse = 'size-8',
  rahmen = true,
  profil = false,
}: {
  klasse: string;
  groesse?: string;
  rahmen?: boolean;
  profil?: boolean;
}) {
  const bild = ZEICHEN[klassenZeichen(klasse)];
  if (!rahmen) {
    return <span className={`inline-flex shrink-0 text-akzent ${groesse}`} aria-hidden="true">{bild}</span>;
  }
  const flaeche = profil ? 'profilbild bg-flaeche-2 text-haupt' : 'bg-akzent text-akzent-text';
  return (
    <span
      className={`klassenbild ${flaeche} inline-flex shrink-0 items-center justify-center rounded-full ${groesse}`}
      data-profilbild={profil ? '' : undefined}
      aria-hidden="true"
    >
      <span className={profil && groesse === 'size-8' ? 'size-[18px]' : 'size-[62%]'}>{bild}</span>
    </span>
  );
}
