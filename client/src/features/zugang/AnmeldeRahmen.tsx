import type { FormEvent, ReactNode } from 'react';
import { Absender } from '../../components/Absender.tsx';
import { tx } from '../../text.ts';
import { Flaeche, Formular } from '../../ui/index.ts';

export function AnmeldeRahmen({
  onAbsenden,
  titel,
  children,
}: {
  onAbsenden: (ereignis: FormEvent) => void;
  titel: string;
  children: ReactNode;
}) {
  return (
    <main className="flex sicht-mitte items-center justify-center px-4">
      <Flaeche className="w-full p-6 md:w-[400px]">
        <Formular onAbsenden={onAbsenden} className="w-full">
          <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <img src="/logo-v2.svg" alt="" className="size-7" />
            Stride
          </div>
          <h1 className="text-2xl leading-8 font-semibold break-words">{tx(titel)}</h1>
          {children}
          <Absender />
        </Formular>
      </Flaeche>
    </main>
  );
}
