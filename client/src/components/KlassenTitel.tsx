import { attributName, klassenText, tx } from '../text.ts';
import { useQuery } from '@tanstack/react-query';
import { Award } from 'lucide-react';
import type { Attribut } from '../../../shared/api/index.ts';
import { attributVorlage } from '../../../shared/features/attribute/attributKatalog.ts';
import { KOENNEN_KENNUNGEN, type KoennenKennung } from '../../../shared/spiel/begriffe.ts';
import { ARCHETYP, KLASSE } from '../../../shared/spiel/klassen.ts';
import { erfolgSichtbar, istAn } from '../../../shared/spiel/sichtbarkeit.ts';
import { api, SCHLUESSEL } from '../api/index.ts';
import { zahl } from '../format.ts';
import { useSichtbarkeit } from '../funktionen.ts';
import { KlassenBild } from './KlassenBild.tsx';
import { Fehlermeldung, Ueberschrift } from '../ui/index.ts';

function istKoennen(kennung: string | null): kennung is KoennenKennung {
  return kennung !== null && (KOENNEN_KENNUNGEN as readonly string[]).includes(kennung);
}

function staerksteKennungen(attribute: Attribut[]): KoennenKennung[] {
  const koennen: { kennung: KoennenKennung; level: number }[] = [];
  for (const attribut of attribute) {
    const kennung = attribut.kennung;
    if (!attribut.archiviert && istKoennen(kennung)) {
      koennen.push({ kennung, level: attribut.level.level });
    }
  }
  return koennen.sort((a, b) => b.level - a.level).map((eintrag) => eintrag.kennung);
}

function aktiveKennungen(attribute: Attribut[]): Set<KoennenKennung> {
  const aktiv = new Set<KoennenKennung>();
  for (const attribut of attribute) {
    const kennung = attribut.kennung;
    if (!attribut.archiviert && istKoennen(kennung)) {
      aktiv.add(kennung);
    }
  }
  return aktiv;
}

export function KlassenUndTitel({ attribute, klasse }: { attribute: Attribut[]; klasse: string }) {
  const sichtbarkeit = useSichtbarkeit();
  const koennenAn = istAn('koennen', sichtbarkeit);
  const { data: erfolge, error } = useQuery({ queryKey: SCHLUESSEL.erfolge, queryFn: api.erfolge });
  const [staerkstes, zweites] = staerksteKennungen(attribute);
  const aktiv = aktiveKennungen(attribute);
  const namen = new Map<string, string>();
  for (const attribut of attribute) {
    if (attribut.kennung !== null) {
      namen.set(attribut.kennung, attribut.name);
    }
  }

  return (
    <div className="space-y-6">
      {koennenAn && (
      <section>
        <Ueberschrift titel={tx("Klassen")} />
        <p className="mb-3 flex items-center gap-2 text-sm">
          <KlassenBild klasse={klasse} groesse="size-7" />
          <span>
            {tx("Deine Klasse:")} <span className="font-semibold break-words text-akzent">{klassenText(klasse)}</span>
          </span>
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-leise">
              <th className="py-1.5 font-medium">{tx("Können")}</th>
              <th className="py-1.5 font-medium">{tx("Archetyp")}</th>
              <th className="py-1.5 font-medium">{tx("Beiname")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rand">
            {KOENNEN_KENNUNGEN.map((kennung) => (
              <tr key={kennung} className={aktiv.has(kennung) ? 'text-haupt' : 'text-leise'}>
                <td className="py-1.5 break-words">
                  {attributName({ kennung, name: namen.get(kennung) ?? attributVorlage(kennung).name })}
                </td>
                <td className={`py-1.5 break-words ${kennung === staerkstes ? 'font-semibold text-akzent' : ''}`}>
                  <span className="inline-flex items-center gap-2">
                    <KlassenBild klasse={ARCHETYP[kennung].name} groesse="size-5" rahmen={false} />
                    {tx(ARCHETYP[kennung].name)}
                  </span>
                </td>
                <td className={`py-1.5 break-words ${kennung === zweites ? 'font-semibold text-akzent' : ''}`}>
                  {tx(ARCHETYP[kennung].beiname)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-leise">{tx("Fett ist dein stärkstes Können. Der Beiname folgt dem zweitstärksten.")}</p>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-leise">
          <span className="inline-flex items-center gap-1.5">
            <KlassenBild klasse={KLASSE.startKlasse} groesse="size-4" rahmen={false} />
            {tx('{name} bis Level {level}', { name: tx(KLASSE.startKlasse), level: zahl(KLASSE.abLevel) })}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5 break-words">
            <KlassenBild klasse={KLASSE.ausgeglichen} groesse="size-4" rahmen={false} />
            {tx('{name}, wenn alle Können nah beieinander liegen', { name: tx(KLASSE.ausgeglichen) })}
          </span>
        </p>
      </section>
      )}

      <section>
        <Ueberschrift titel={tx("Titel")} />
        <Fehlermeldung fehler={error} />
        <div className="space-y-3">
          {erfolge?.kategorien.filter((kategorie) => erfolgSichtbar(kategorie.kennzahl, sichtbarkeit)).map((kategorie) => (
            <div key={kategorie.kennzahl}>
              <p className="mb-1.5 text-xs text-leise">{tx(kategorie.label)}</p>
              <div className="flex flex-wrap gap-1.5">
                {kategorie.stufen.map((stufe) => (
                  <span
                    key={stufe.schluessel}
                    className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
                      stufe.erreichtAm ? 'bg-xp/15 font-medium text-haupt' : 'bg-flaeche-2 text-leise'
                    }`}
                  >
                    {stufe.erreichtAm && <Award className="size-3" />}
                    {tx(stufe.name)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
