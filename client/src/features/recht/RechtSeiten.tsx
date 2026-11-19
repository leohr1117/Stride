import { ArrowLeft } from 'lucide-react';
import { useKopf } from '../../components/Kopf.tsx';
import { tx } from '../../text.ts';
import { RECHT_SEITEN } from '../../../../shared/recht/seiten.ts';
import { RechtDokument } from './RechtDokument.tsx';
import { rechtTitel } from './titel.ts';

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

export function RechtOeffentlich({ pfad }: { pfad: string }) {
  const seite = RECHT_SEITEN.find((eintrag) => eintrag.pfad === pfad);
  if (!seite) {
    return null;
  }
  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl pb-16">
      <div className="inhalt-spalte">
        <header data-kopf="" className="flex h-14 min-w-0 items-center gap-1 border-b border-rand">
          <a href="/" aria-label={tx('Anmelden')} className="inline-flex size-12 shrink-0 items-center justify-center rounded-full text-haupt">
            <ArrowLeft className="size-5" aria-hidden="true" />
          </a>
          <h1 className="min-w-0 truncate text-xl leading-7 font-semibold">{rechtTitel(seite.id)}</h1>
        </header>
        <div className="pt-4">
          <RechtDokument id={seite.id} />
        </div>
      </div>
    </main>
  );
}
