import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { RECHT_HUB_PFAD, RECHT_SEITEN } from '../../../../shared/recht/seiten.ts';
import { useKopf } from '../../components/Kopf.tsx';
import { tx } from '../../text.ts';
import { RechtDokument } from './RechtDokument.tsx';

export function ImpressumSeite() {
  useKopf({ titel: 'Impressum' });
  return <RechtDokument id="impressum" />;
}

export function DatenschutzSeite() {
  useKopf({ titel: 'Datenschutzerklärung' });
  return <RechtDokument id="datenschutz" />;
}

export function NutzungSeite() {
  useKopf({ titel: 'Nutzungsbedingungen' });
  return <RechtDokument id="nutzung" />;
}

export function LizenzSeite() {
  useKopf({ titel: 'Lizenzhinweise' });
  return <RechtDokument id="lizenzen" />;
}

function oeffentlichesZurueck(): { href: string; zumHub: boolean } {
  const standard = { href: '/', zumHub: false };
  if (!document.referrer) {
    return standard;
  }
  try {
    const herkunft = new URL(document.referrer);
    const pfad = herkunft.pathname.replace(/\/+$/, '') || '/';
    if (herkunft.origin === window.location.origin && pfad === RECHT_HUB_PFAD) {
      return { href: RECHT_HUB_PFAD, zumHub: true };
    }
  } catch {
    return standard;
  }
  return standard;
}

export function OeffentlicheSeite({ titel, children }: { titel: string; children: ReactNode }) {
  const zurueck = oeffentlichesZurueck();
  const name = zurueck.zumHub ? tx('Zurück zu {ziel}', { ziel: tx('Rechtliches') }) : tx('Anmelden');
  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl pb-16">
      <div className="inhalt-spalte">
        <header data-kopf="" className="flex h-14 min-w-0 items-center gap-1 border-b border-rand">
          <a href={zurueck.href} aria-label={name} className="inline-flex size-12 shrink-0 items-center justify-center rounded-full text-haupt">
            <ArrowLeft className="size-5" aria-hidden="true" />
          </a>
          <h1 className="min-w-0 truncate text-xl leading-7 font-semibold">{tx(titel)}</h1>
        </header>
        <div className="pt-4">{children}</div>
      </div>
    </main>
  );
}

export function RechtOeffentlich({ pfad }: { pfad: string }) {
  const seite = RECHT_SEITEN.find((eintrag) => eintrag.pfad === pfad);
  if (!seite) {
    return null;
  }
  return (
    <OeffentlicheSeite titel={seite.titel}>
      <RechtDokument id={seite.id} />
    </OeffentlicheSeite>
  );
}
