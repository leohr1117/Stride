import { ArrowLeft } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { RECHT_HUB_PFAD } from '../../../../shared/recht/seiten.ts';
import { Absender } from '../../components/Absender.tsx';
import { tx } from '../../text.ts';
import { Flaeche, Formular } from '../../ui/index.ts';
import { RechtLinks } from '../recht/RechtLinks.tsx';

export function AnmeldeRahmen({
  onAbsenden,
  titel,
  children,
  zurueck = false,
}: {
  onAbsenden: (ereignis: FormEvent) => void;
  titel: string;
  children: ReactNode;
  zurueck?: boolean;
}) {
  const pfad = window.location.pathname.replace(/\/+$/, '') || '/';
  return (
    <main className="flex sicht-mitte items-center justify-center px-4">
      <Flaeche className="w-full p-6 md:w-[400px]">
        <Formular onAbsenden={onAbsenden} className="w-full">
          {zurueck ? (
            <a href="/" aria-label={tx('Anmelden')} className="inline-flex size-12 items-center justify-center rounded-full text-haupt -ms-3 -mt-2">
              <ArrowLeft className="size-5" aria-hidden="true" />
            </a>
          ) : null}
          <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <img src="/logo-v2.svg" alt="" className="size-7" />
            Stride
          </div>
          <h1 className="text-2xl leading-8 font-semibold break-words">{tx(titel)}</h1>
          {children}
          <RechtLinks />
          {pfad === RECHT_HUB_PFAD ? null : (
            <a href={RECHT_HUB_PFAD} className="block text-center text-sm font-medium leading-5 text-haupt underline underline-offset-2">
              {tx('Rechtliches')}
            </a>
          )}
          <Absender />
        </Formular>
      </Flaeche>
    </main>
  );
}
