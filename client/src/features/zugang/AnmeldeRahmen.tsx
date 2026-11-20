import { ArrowLeft } from 'lucide-react';
import { useLayoutEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { RECHT_HUB_PFAD, RECHT_SEITEN } from '../../../../shared/recht/seiten.ts';
import { Absender } from '../../components/Absender.tsx';
import { tx } from '../../text.ts';
import { Flaeche, Formular } from '../../ui/index.ts';
import { RechtLinks } from '../recht/RechtLinks.tsx';

function pfadZu(id: 'impressum' | 'datenschutz'): string {
  const seite = RECHT_SEITEN.find((eintrag) => eintrag.id === id);
  if (seite) {
    return seite.pfad;
  }
  return id === 'impressum' ? '/impressum' : '/datenschutz';
}

function AnmeldeFussStil() {
  return (
    <style>{`
      form.anmelde-form.formular > .formular-fuss {
        background: transparent;
        padding-top: 0;
      }
      [data-anmelde-spalte] [data-absender] a {
        display: inline-flex;
        align-items: center;
        min-height: 24px;
      }
    `}</style>
  );
}

function useAnmeldeFenster(aktiv: boolean) {
  const rahmen = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!aktiv) {
      return;
    }
    const element = rahmen.current;
    if (!element) {
      return;
    }
    const richte = () => {
      element.style.width = `${window.innerWidth}px`;
    };
    richte();
    window.addEventListener('resize', richte);
    return () => {
      window.removeEventListener('resize', richte);
    };
  }, [aktiv]);
  return rahmen;
}

function FussAussen() {
  const links = [
    { href: RECHT_HUB_PFAD, text: tx('Rechtliches') },
    { href: pfadZu('impressum'), text: tx('Impressum') },
    { href: pfadZu('datenschutz'), text: tx('Datenschutz') },
  ];
  return (
    <div className="mt-6 flex w-full flex-col items-center gap-2 text-center">
      <nav aria-label={tx('Rechtliches')}>
        <ul className="flex flex-wrap items-center justify-center">
          {links.map((link, index) => (
            <li key={link.href} className="flex items-center">
              {index > 0 ? (
                <span aria-hidden="true" className="px-1.5 text-[13px] leading-[18px] text-leise">
                  ·
                </span>
              ) : null}
              <a href={link.href} className="inline-flex min-h-6 items-center text-[13px] leading-[18px] text-leise underline">
                {link.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <Absender />
    </div>
  );
}

export function AnmeldeRahmen({
  onAbsenden,
  titel,
  children,
  zurueck = false,
  fussAussen = false,
}: {
  onAbsenden: (ereignis: FormEvent) => void;
  titel: string;
  children: ReactNode;
  zurueck?: boolean;
  fussAussen?: boolean;
}) {
  const rahmen = useAnmeldeFenster(fussAussen);
  const karte = (
    <Flaeche className={fussAussen ? 'w-full p-6' : 'w-full p-6 md:w-[400px]'}>
      <Formular onAbsenden={onAbsenden} className={fussAussen ? 'anmelde-form w-full' : 'w-full'}>
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
        {fussAussen ? null : (
          <>
            <RechtLinks />
            <Absender />
          </>
        )}
      </Formular>
    </Flaeche>
  );
  if (!fussAussen) {
    return <main className="flex sicht-mitte items-center justify-center px-4">{karte}</main>;
  }
  return (
    <>
      <AnmeldeFussStil />
      <div className="w-full overflow-x-clip">
        <main ref={rahmen} className="flex sicht-mitte items-center justify-center px-4">
          <div data-anmelde-spalte="" className="flex w-full flex-col items-center md:w-[400px]">
            {karte}
            <FussAussen />
          </div>
        </main>
      </div>
    </>
  );
}
