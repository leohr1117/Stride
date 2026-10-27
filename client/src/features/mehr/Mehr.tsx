import { tx } from '../../text.ts';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, HardDrive, ListChecks, Palette, SlidersHorizontal, User, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { LEISTE_STANDARD, sichtbareLeiste } from '../../../../shared/spiel/leiste.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { STIL_INFO } from '../../../../shared/features/darstellung/stile.ts';
import { AKTUELLE_VERSION, VERSIONEN } from '../../../../shared/versionen.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useSichtbarkeit } from '../../funktionen.ts';
import { HANDBUCH, sichtbareGruppen } from '../../navigation.ts';
import { verbindungsStand } from './verbindungsStand.ts';

function Kachel({ to, icon: KachelIcon, titel, text, gefahr = false }: { to: string; icon: LucideIcon; titel: string; text?: string; gefahr?: boolean }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-rand bg-flaeche p-4 transition hover:border-leise/50 active:scale-[0.99]"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-akzent/15 text-akzent">
        <KachelIcon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{titel}</span>
        {text && <span className={`block text-xs break-words ${gefahr ? 'text-gefahr' : 'text-leise'}`}>{text}</span>}
      </span>
      <ChevronRight className="size-4 shrink-0 text-leise" />
    </Link>
  );
}

function Schnellzugriff() {
  const sichtbarkeit = useSichtbarkeit();
  const { data } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const inLeiste = new Set(
    sichtbareLeiste(data?.mobilLeiste ?? LEISTE_STANDARD, sichtbarkeit.funktionen, sichtbarkeit.ebenen),
  );
  const seiten = [
    ...sichtbareGruppen(sichtbarkeit.funktionen, sichtbarkeit.ebenen).flatMap((gruppe) => gruppe.eintraege),
    ...(istAn('handbuch', sichtbarkeit) ? [HANDBUCH] : []),
  ].filter((eintrag) => eintrag.pfad !== '/mehr' && !inLeiste.has(eintrag.pfad));

  if (seiten.length === 0) {
    return null;
  }

  return (
    <section className="md:hidden">
      <p className="mb-3 text-[11px] font-semibold tracking-wider text-leise uppercase">{tx("Schnellzugriff")}</p>
      <div className="chip-reihe -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {seiten.map(({ pfad, label, icon: SeitenIcon }) => (
          <Link key={pfad} to={pfad} className="flex w-[4.6rem] shrink-0 flex-col items-center gap-1.5 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl border border-rand bg-flaeche text-haupt">
              <SeitenIcon className="size-5" />
            </span>
            <span className="w-full text-[11px] font-medium leading-tight break-words text-balance">{tx(label)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function MehrSeite() {
  const { data: einstellungen } = useQuery({ queryKey: SCHLUESSEL.einstellungen, queryFn: api.einstellungen });
  const { data: zugang } = useQuery({ queryKey: SCHLUESSEL.zugang, queryFn: api.zugang });
  const { data: verbindungen } = useQuery({ queryKey: SCHLUESSEL.verbindungen, queryFn: api.verbindungen });
  const stand = verbindungen ? verbindungsStand(verbindungen) : null;
  const profil = [einstellungen?.charakterName, zugang?.benutzername].filter((teil) => teil).join(' · ');
  const verbindungsText = stand ? tx(stand.text) : undefined;
  const darstellung = einstellungen
    ? tx('Leiste · {stil}', { stil: tx(STIL_INFO[einstellungen.stil].label) })
    : undefined;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight break-words md:text-3xl">{tx("Mehr")}</h1>
      <Schnellzugriff />
      <div className="grid gap-3 sm:grid-cols-2">
        <Kachel to="/mehr/profil" icon={User} titel={tx("Profil")} text={profil || undefined} />
        <Kachel to="/mehr/inhalte" icon={ListChecks} titel={tx("Tätigkeiten")} />
        <Kachel to="/mehr/darstellung" icon={Palette} titel={tx("Darstellung")} text={darstellung} />
        <Kachel to="/mehr/funktionen" icon={SlidersHorizontal} titel={tx("App & Verbindungen")} text={verbindungsText} gefahr={stand?.fehler} />
        <Kachel to="/mehr/daten" icon={HardDrive} titel={tx("Daten")} />
      </div>
      <Versionshinweis />
    </div>
  );
}

function Versionshinweis() {
  const [offen, setOffen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={offen}
        onClick={() => setOffen((aktuell) => !aktuell)}
        className="flex min-h-11 w-full items-center gap-2 py-2 text-sm text-leise"
      >
        <span className="min-w-0 flex-1 text-left">Version {AKTUELLE_VERSION}</span>
        <ChevronDown className={`size-4 shrink-0 transition ${offen ? '' : '-rotate-90'}`} />
      </button>
      {offen && (
        <div className="max-h-80 max-w-xl space-y-3 overflow-y-auto overscroll-contain pb-2">
          {VERSIONEN.map((eintrag, index) => (
            <section
              key={eintrag.version}
              aria-label={`Version ${eintrag.version}`}
              className={index > 0 ? 'border-t border-rand pt-3' : undefined}
            >
              <p className="text-sm font-medium">{eintrag.version}</p>
              <p className="mt-0.5 text-xs leading-snug text-leise">
                <span className="block">
                  {tx('Seiten')}: {eintrag.seiten.split(', ').map((teil) => tx(teil)).join(', ')}
                </span>
                {eintrag.behoben ? (
                  <span className="block">
                    {tx('Behoben')}: {eintrag.behoben.split(', ').map((teil) => tx(teil)).join(', ')}
                  </span>
                ) : null}
              </p>
              <div className="mt-2 space-y-2">
                {eintrag.abschnitte
                  .filter((abschnitt) => abschnitt.punkte.length > 0)
                  .map((abschnitt) => (
                    <div key={abschnitt.titel}>
                      <p className="text-xs font-semibold">{tx(abschnitt.titel)}</p>
                      <ul className="mt-0.5 space-y-0.5">
                        {abschnitt.punkte.map((text) => (
                          <li key={text} className="text-sm leading-snug text-leise break-words">
                            {tx(text)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
