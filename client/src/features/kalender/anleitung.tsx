import { ExternalLink } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { tx } from '../../text.ts';
import { Segmentauswahl } from '../../ui/index.ts';

const GOOGLE_EINSTELLUNGEN = 'https://calendar.google.com/calendar/r/settings';
const APPLE_IPHONE = 'https://support.apple.com/guide/iphone/iph7613c4fb/ios';
const APPLE_MAC = 'https://support.apple.com/guide/calendar/icl32362/mac';
const APPLE_ICLOUD = 'https://www.icloud.com/calendar/';
const OUTLOOK = 'https://support.microsoft.com/de-DE/Outlook/share-your-calendar-in-outlook-com';

export type KalenderAnbieter = 'google' | 'apple' | 'andere';
type AppleOrt = 'iphone' | 'mac' | 'icloud';

const APPLE_ORTE: { wert: AppleOrt; label: string }[] = [
  { wert: 'iphone', label: 'iPhone' },
  { wert: 'mac', label: 'Mac' },
  { wert: 'icloud', label: 'iCloud' },
];

function Szene({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 48"
      className="h-11 w-14"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function BildRechner() {
  return (
    <Szene>
      <rect x="8" y="8" width="48" height="26" rx="3" />
      <path d="M24 40h16M32 34v6" />
      <circle cx="46" cy="16" r="2.5" />
    </Szene>
  );
}

function BildListe() {
  return (
    <Szene>
      <rect x="12" y="6" width="40" height="36" rx="3" />
      <path d="M18 16h16M18 34h16" />
      <rect x="16" y="20" width="32" height="8" rx="2" fill="currentColor" stroke="none" opacity="0.18" />
    </Szene>
  );
}

function BildKopie() {
  return (
    <Szene>
      <rect x="16" y="12" width="28" height="22" rx="3" />
      <path d="M24 12V10a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2h-2" />
    </Szene>
  );
}

function BildTelefon() {
  return (
    <Szene>
      <rect x="22" y="4" width="20" height="40" rx="4" />
      <path d="M28 38h8" />
      <circle cx="32" cy="16" r="2" fill="currentColor" stroke="none" />
    </Szene>
  );
}

function BildTeilen() {
  return (
    <Szene>
      <circle cx="32" cy="12" r="4" />
      <circle cx="16" cy="34" r="4" />
      <circle cx="48" cy="34" r="4" />
      <path d="M29 15 L19 31M35 15 L45 31" />
    </Szene>
  );
}

function BildSchalter() {
  return (
    <Szene>
      <rect x="14" y="16" width="36" height="16" rx="8" />
      <circle cx="40" cy="24" r="5" fill="currentColor" stroke="none" />
    </Szene>
  );
}

function BildAdresse() {
  return (
    <Szene>
      <rect x="6" y="14" width="52" height="20" rx="3" />
      <path d="M12 24h18M34 24h8" />
    </Szene>
  );
}

function Schritt({ bild, text }: { bild: ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-flaeche-2 text-akzent">{bild}</div>
      <p className="min-w-0 text-sm text-balance">{tx(text)}</p>
    </li>
  );
}

function LinkZeile({ adresse, label }: { adresse: string; label: string }) {
  return (
    <a href={adresse} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-akzent hover:underline">
      {tx(label)}
      <ExternalLink className="size-3.5 shrink-0" />
    </a>
  );
}

function GoogleAnleitung() {
  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        <Schritt bild={<BildRechner />} text="Öffne Google Kalender am Computer." />
        <Schritt bild={<BildListe />} text="Wähle den Kalender in den Einstellungen." />
        <Schritt bild={<BildKopie />} text="Kopiere die geheime Adresse im iCal-Format." />
      </ol>
      <p className="text-[13px] leading-[18px] text-leise">{tx('Google aktualisiert das Abo nur alle paar Stunden.')}</p>
      <LinkZeile adresse={GOOGLE_EINSTELLUNGEN} label="Google Kalender öffnen" />
    </div>
  );
}

function AppleAnleitung() {
  const [ort, setOrt] = useState<AppleOrt>('iphone');
  const link = ort === 'iphone' ? APPLE_IPHONE : ort === 'mac' ? APPLE_MAC : APPLE_ICLOUD;
  const label = ort === 'icloud' ? 'iCloud Kalender öffnen' : 'Anleitung von Apple';
  return (
    <div className="space-y-3">
      <Segmentauswahl optionen={APPLE_ORTE} wert={ort} onAendern={setOrt} dicht />
      <ol className="space-y-3">
        {ort === 'iphone' ? (
          <>
            <Schritt bild={<BildTelefon />} text="Öffne die Kalender-App." />
            <Schritt bild={<BildListe />} text="Tippe auf Kalender und dann auf das Info-Symbol." />
          </>
        ) : null}
        {ort === 'mac' ? (
          <>
            <Schritt bild={<BildRechner />} text="Öffne die Kalender-App." />
            <Schritt bild={<BildTeilen />} text="Klicke auf Teilen neben dem Kalender." />
          </>
        ) : null}
        {ort === 'icloud' ? (
          <>
            <Schritt bild={<BildRechner />} text="Öffne den Kalender auf iCloud.com." />
            <Schritt bild={<BildTeilen />} text="Klicke auf Teilen neben dem Kalender." />
          </>
        ) : null}
        <Schritt bild={<BildSchalter />} text="Schalte Öffentlicher Kalender ein und kopiere den Link." />
      </ol>
      <LinkZeile adresse={link} label={label} />
    </div>
  );
}

function AndereAnleitung() {
  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        <Schritt bild={<BildKopie />} text="Kopiere die iCal-Adresse aus der Kalender-App." />
        <Schritt bild={<BildAdresse />} text="Sie beginnt mit https:// oder webcal://." />
      </ol>
      <LinkZeile adresse={OUTLOOK} label="Outlook" />
    </div>
  );
}

export function KalenderAnleitung({ anbieter }: { anbieter: KalenderAnbieter }) {
  if (anbieter === 'google') {
    return <GoogleAnleitung />;
  }
  if (anbieter === 'apple') {
    return <AppleAnleitung />;
  }
  return <AndereAnleitung />;
}

export const ANBIETER: { wert: KalenderAnbieter; label: string }[] = [
  { wert: 'google', label: 'Google' },
  { wert: 'apple', label: 'Apple' },
  { wert: 'andere', label: 'Andere' },
];
