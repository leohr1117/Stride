import { Liste, Zeile } from '../../components/Zeile.tsx';
import { tx } from '../../text.ts';
import { AbschnittKopf } from '../../ui/index.ts';
import { RECHT_SEITEN } from '../../../../shared/recht/seiten.ts';
import { rechtTitel } from './titel.ts';

export function RechtLinks({ className = '' }: { className?: string }) {
  return (
    <nav aria-label={tx('Rechtliches')} className={className}>
      <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {RECHT_SEITEN.map((seite) => (
          <li key={seite.pfad}>
            <a href={seite.pfad} className="text-[13px] leading-[18px] text-leise underline">
              {rechtTitel(seite.id)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function RechtBereich() {
  return (
    <section className="mt-6" data-abschnitt="recht">
      <AbschnittKopf titel={tx('Rechtliches')} />
      <Liste>
        {RECHT_SEITEN.map((seite) => (
          <Zeile key={seite.pfad} titel={rechtTitel(seite.id)} nach={seite.pfad} />
        ))}
      </Liste>
    </section>
  );
}
