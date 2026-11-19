import { Building2, FileText, Mail, Package, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { RechtId } from '../../../../shared/recht/arten.ts';
import { KONTAKT_PFAD, RECHT_SEITEN } from '../../../../shared/recht/seiten.ts';
import { DichteZeilen, Liste, Zeile } from '../../components/Zeile.tsx';
import { tx } from '../../text.ts';
import { AnmeldeRahmen } from '../zugang/AnmeldeRahmen.tsx';
import { useKopf } from '../../components/Kopf.tsx';

const SYMBOLE: Record<RechtId, LucideIcon> = {
  impressum: Building2,
  datenschutz: ShieldCheck,
  nutzung: FileText,
  lizenzen: Package,
};

function kurzTitel(id: RechtId): string {
  switch (id) {
    case 'impressum':
      return tx('Impressum');
    case 'datenschutz':
      return tx('Datenschutz');
    case 'nutzung':
      return tx('Nutzungsbedingungen');
    case 'lizenzen':
      return tx('Lizenzen');
  }
}

function ziel(angemeldet: boolean, pfad: string): { nach?: string; href?: string } {
  return angemeldet ? { nach: pfad } : { href: pfad };
}

export function RechtHubListe({ angemeldet }: { angemeldet: boolean }) {
  const kontakt = ziel(angemeldet, KONTAKT_PFAD);
  return (
    <div data-recht-hub="" className="space-y-4">
      <Liste>
        <Zeile
          name={tx('Kontakt')}
          titel={<span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-haupt">{tx('Kontakt')}</span>}
          symbol={<Mail aria-hidden />}
          symbolKlasse="pointer-events-none flex size-5 shrink-0 items-center justify-center text-haupt [&_svg]:size-5"
          nach={kontakt.nach}
          href={kontakt.href}
        />
      </Liste>
      <Liste>
        {RECHT_SEITEN.map((seite) => {
          const Icon = SYMBOLE[seite.id];
          const label = kurzTitel(seite.id);
          const link = ziel(angemeldet, seite.pfad);
          return (
            <Zeile
              key={seite.pfad}
              titel={label}
              name={label}
              symbol={<Icon aria-hidden />}
              nach={link.nach}
              href={link.href}
            />
          );
        })}
      </Liste>
    </div>
  );
}

export function RechtlichesSeite() {
  useKopf({ titel: 'Rechtliches' });
  return (
    <DichteZeilen>
      <RechtHubListe angemeldet />
    </DichteZeilen>
  );
}

export function RechtHubOeffentlich() {
  return (
    <AnmeldeRahmen onAbsenden={(ereignis) => ereignis.preventDefault()} titel="Rechtliches" zurueck>
      <DichteZeilen>
        <RechtHubListe angemeldet={false} />
      </DichteZeilen>
    </AnmeldeRahmen>
  );
}
