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
      <path d="M1.6 9h3.4v6H1.6zm17.4 0H22.4v6h-3.4zM4.4 7.2h2.8v9.6H4.4zm12.4 0h2.8v9.6h-2.8zM6.6 10.6h10.8v2.8H6.6z" />
    } />
  ),
  geist: (
    <Zeichen kinder={
      <path
        fillRule="evenodd"
        d="M1.2 12C4.4 7.2 7.8 4.8 12 4.8s7.6 2.4 10.8 7.2C19.6 16.8 16.2 19.2 12 19.2S4.4 16.8 1.2 12zm9.1 0a1.7 1.7 0 1 0 3.4 0 1.7 1.7 0 0 0-3.4 0z"
      />
    } />
  ),
  disziplin: (
    <Zeichen kinder={
      <path d="M9.4 1.3h5.2l-.7 11.6h4.8v2.7h-4.4v3.2h2.3V21H7.4v-2.2h2.3v-3.2H5.3v-2.7h4.8z" />
    } />
  ),
  intellekt: (
    <Zeichen kinder={
      <>
        <path d="M1.6 6.2C4.2 5 7.1 4.8 10.5 6.1v12.4C7.1 17.2 4.3 17.4 1.6 18.7z" />
        <path d="M22.4 6.2C19.8 5 16.9 4.8 13.5 6.1v12.4c3.4-1.3 6.2-1.1 8.9.2z" />
      </>
    } />
  ),
  soziales: (
    <Zeichen kinder={
      <>
        <circle cx="6.8" cy="8.2" r="3.5" />
        <circle cx="17.2" cy="8.2" r="3.5" />
        <path d="M1.8 21c.9-3.4 3-5.4 5.2-5.4 1.6 0 2.5.8 5 .8s3.4-.8 5-.8c2.2 0 4.3 2 5.2 5.4z" />
      </>
    } />
  ),
  kreativitaet: (
    <Zeichen kinder={
      <>
        <path d="M2.2 18.2c1.6 2.8 5.6 3.2 8 .6l6.2-6.2c.8-.8.6-2-.4-2.6l-2.2-1.4c-.8-.5-1.9-.2-2.5.6l-6.2 6.2c-2.2 2.2-3.8 1.2-2.9 2.8z" />
        <path d="M14.6 7.4 18.8 3.2c1.5-1.5 3.8-.2 3.4 1.8L20.2 9.6 15.8 8.6z" />
      </>
    } />
  ),
  motorik: (
    <Zeichen kinder={
      <>
        <path d="M3.6 1.8h3.4V12H3.6zm5.2-.8h3.6V12H8.8zm5.4 1.4h3.4V12h-3.4z" />
        <path d="M3.4 10.6h14.8c1 0 1.8.8 1.8 1.8v5.2c0 2-1.8 3.6-4 3.6H6.2c-2.2 0-4-1.6-4-3.6v-4.6c0-.8.4-1.6 1.2-2.4z" />
        <path d="M1.2 13.4c0-1.2 1-2.2 2.2-2.2H5v5.4H3.4c-1.2 0-2.2-1-2.2-2.2z" />
      </>
    } />
  ),
  mut: (
    <Zeichen kinder={
      <path d="M13.8 1.2 5.4 13.2h5L8.2 22.8 19.2 9.4h-5.2z" />
    } />
  ),
  vitalitaet: (
    <Zeichen kinder={
      <path d="M12 21.2S4.2 16.4 4.2 10.8C4.2 7.6 6.5 5.4 9.2 5.4c1.5 0 2.6.8 2.8 1.8.2-1 1.3-1.8 2.8-1.8 2.7 0 5 2.2 5 5.4 0 5.6-7.8 10.4-7.8 10.4z" />
    } />
  ),
  fuehrung: (
    <Zeichen kinder={
      <>
        <path d="M3.4 1.6h3.6V22H3.4z" />
        <path d="M7 2.4h13.2v8.6H7z" />
      </>
    } />
  ),
  neuling: (
    <Zeichen kinder={
      <>
        <path d="M10.4 12.8h3.2V21h-3.2z" />
        <path d="M12 13.2C8.2 12.4 4.4 10.2 3.6 6.4 7.4 6.2 10.6 9.2 12 13.2z" />
        <path d="M12 12.4C16.2 11.2 19.8 8.2 20.4 4.4 16.6 4.8 13.4 8 12 12.4z" />
      </>
    } />
  ),
  allrounder: (
    <Zeichen kinder={
      <path
        fillRule="evenodd"
        d="M12 1.8a10.2 10.2 0 1 0 0 20.4 10.2 10.2 0 0 0 0-20.4zm0 4.6a5.6 5.6 0 1 1 0 11.2 5.6 5.6 0 0 1 0-11.2z"
      />
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
