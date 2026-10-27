import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Faehigkeit, TodoistZuordnung, TodoistZuordnungDaten, Vorlage } from '../../../../shared/api/index.ts';
import { taetigkeitenFuerProjekt } from '../../../../shared/spiel/taetigkeit.ts';
import { api } from '../../api/index.ts';
import { EINGABE_STIL, Fehlermeldung, Feld, InfoHinweis, Schalter } from '../../ui/index.ts';
import { tx } from '../../text.ts';
import { parseZiel, projekteFuerVision, vorschauTeile, zielVorschlag, type ZielBlick, type ZielProjekt } from '../../todoistZiel.ts';
import { DauerWahl, FaehigkeitWahl, TaetigkeitWahl, TextFeld, WeitereFelder, ZielWahl } from './felder.tsx';
import { dauerLabel, HINWEIS_MEILENSTEIN, merkeStatus, projektVonZiel, useMitziehText, visionHinweis, vorlagePasst, zielName } from './gemeinsam.ts';

export function ProjektZeile({
  zuordnung,
  blick,
  taetigkeiten,
  faehigkeiten,
  faehigkeitenAn,
}: {
  zuordnung: TodoistZuordnung;
  blick: ZielBlick;
  taetigkeiten: Vorlage[];
  faehigkeiten: Faehigkeit[];
  faehigkeitenAn: boolean;
}) {
  const client = useQueryClient();
  const speichern = useMutation({
    mutationFn: (daten: TodoistZuordnungDaten) => api.ordneTodoistZu(zuordnung.todoistId, daten),
    onSuccess: (status) => merkeStatus(client, status),
  });
  const notiz = useMitziehText(zuordnung.notiz);
  const erkenntnis = useMitziehText(zuordnung.erkenntnis);
  const an = zuordnung.zielArt !== null && zuordnung.zielId !== null;
  const vorschlag = zielVorschlag(zuordnung.name, blick);
  const [weitereOffen, setWeitereOffen] = useState(
    () => Boolean(zuordnung.faehigkeitId || zuordnung.meilenstein || zuordnung.abschluss || zuordnung.erkenntnis || zuordnung.notiz),
  );
  const projektId =
    an && zuordnung.zielArt
      ? projektVonZiel(zuordnung.zielArt, zuordnung.zielId ?? 0, zuordnung.projektId, blick)
      : null;
  const taetigkeitenZumZiel = an ? taetigkeitenFuerProjekt(taetigkeiten, projektId) : taetigkeiten;
  const vorhaben = zuordnung.zielArt === 'vorhaben';
  const visionListe: ZielProjekt[] = zuordnung.zielArt === 'vision' && zuordnung.zielId !== null ? projekteFuerVision(blick, zuordnung.zielId) : [];
  const hinweis = visionHinweis(zuordnung.zielArt, zuordnung.zielId, projektId, blick);

  const senden = (teil: Partial<TodoistZuordnungDaten> & Pick<TodoistZuordnungDaten, 'projektId' | 'vorlageId' | 'stunden' | 'zielArt' | 'zielId'>) => {
    const art = teil.zielArt ?? null;
    const abschluss =
      art === 'vision' || art === 'projekt' ? null : teil.abschluss !== undefined ? teil.abschluss : zuordnung.abschluss;
    speichern.mutate({
      projektId: teil.projektId,
      vorlageId: teil.vorlageId,
      stunden: teil.stunden,
      zielArt: art,
      zielId: teil.zielId ?? null,
      faehigkeitId: teil.faehigkeitId !== undefined ? teil.faehigkeitId : zuordnung.faehigkeitId,
      abschluss,
      erkenntnis: erkenntnis.text,
      notiz: notiz.text,
      meilenstein: art === 'vorhaben' ? false : teil.meilenstein !== undefined ? teil.meilenstein : zuordnung.meilenstein,
    });
  };

  const schalten = (ein: boolean) => {
    if (!ein) {
      senden({
        zielArt: null,
        zielId: null,
        projektId: null,
        vorlageId: zuordnung.vorlageId,
        stunden: zuordnung.stunden,
      });
      return;
    }
    if (!vorschlag) {
      return;
    }
    const naechstesProjekt = vorschlag.projektId;
    senden({
      zielArt: vorschlag.zielArt,
      zielId: vorschlag.zielId,
      projektId: naechstesProjekt,
      vorlageId: vorlagePasst(taetigkeiten, zuordnung.vorlageId, naechstesProjekt),
      stunden: zuordnung.stunden,
      abschluss: vorschlag.zielArt === 'vorhaben' ? zuordnung.abschluss : null,
      meilenstein: vorschlag.zielArt === 'vorhaben' ? false : zuordnung.meilenstein,
    });
  };

  const zielAendern = (wert: string) => {
    const ziel = parseZiel(wert);
    if (!ziel) {
      return;
    }
    const naechstesProjekt = projektVonZiel(ziel.art, ziel.id, zuordnung.projektId, blick);
    senden({
      zielArt: ziel.art,
      zielId: ziel.id,
      projektId: naechstesProjekt,
      vorlageId: vorlagePasst(taetigkeiten, zuordnung.vorlageId, naechstesProjekt),
      stunden: zuordnung.stunden,
      abschluss: ziel.art === 'vorhaben' ? zuordnung.abschluss : null,
      meilenstein: ziel.art === 'vorhaben' ? false : zuordnung.meilenstein,
    });
  };

  const vorschau = vorschauTeile([
    zuordnung.zielArt && zuordnung.zielId ? zielName(zuordnung.zielArt, zuordnung.zielId, blick) : null,
    taetigkeitenZumZiel.find((vorlage) => vorlage.id === zuordnung.vorlageId)?.name ?? tx('Standard'),
    zuordnung.stunden === null ? tx('Keine Angabe') : dauerLabel(zuordnung.stunden),
    faehigkeiten.find((faehigkeit) => faehigkeit.id === zuordnung.faehigkeitId)?.name,
    zuordnung.abschluss === 'geschafft' ? tx('Geschafft') : zuordnung.abschluss === 'gescheitert' ? tx('Gescheitert') : null,
    !vorhaben && zuordnung.meilenstein ? tx('Meilenstein') : null,
  ]);

  return (
    <div className="space-y-2 py-3">
      <Schalter
        label={<span>{zuordnung.name}</span>}
        an={an}
        onAendern={schalten}
        deaktiviert={speichern.isPending || (!an && vorschlag === null)}
        beschreibung={!an && vorschlag === null ? 'Lege zuerst ein Ziel an.' : undefined}
      />
      {an && (
        <>
          <ZielWahl blick={blick} art={zuordnung.zielArt} id={zuordnung.zielId} onAendern={zielAendern} erben={false} disabled={speichern.isPending} />
          {visionListe.length > 1 ? (
            <Feld label="Projekt">
              <select
                className={EINGABE_STIL}
                aria-label={tx('Projekt')}
                disabled={speichern.isPending}
                value={projektId ?? ''}
                onChange={(ereignis) => {
                  const naechstes = ereignis.target.value === '' ? null : Number(ereignis.target.value);
                  senden({
                    zielArt: 'vision',
                    zielId: zuordnung.zielId,
                    projektId: naechstes,
                    vorlageId: vorlagePasst(taetigkeiten, zuordnung.vorlageId, naechstes),
                    stunden: zuordnung.stunden,
                  });
                }}
              >
                <option value="">{tx('Projekt')}</option>
                {visionListe.map((projekt) => (
                  <option key={projekt.id} value={projekt.id}>
                    {projekt.name}
                  </option>
                ))}
              </select>
            </Feld>
          ) : null}
          {hinweis ? <p className="text-sm text-gefahr">{hinweis}</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <TaetigkeitWahl
              taetigkeiten={taetigkeitenZumZiel}
              wert={zuordnung.vorlageId}
              erben={false}
              disabled={speichern.isPending}
              onAendern={(vorlageId) =>
                senden({
                  zielArt: zuordnung.zielArt,
                  zielId: zuordnung.zielId,
                  projektId,
                  vorlageId,
                  stunden: zuordnung.stunden,
                })
              }
            />
            <DauerWahl
              wert={zuordnung.stunden}
              erben={false}
              disabled={speichern.isPending}
              onAendern={(stunden) =>
                senden({
                  zielArt: zuordnung.zielArt,
                  zielId: zuordnung.zielId,
                  projektId,
                  vorlageId: vorlagePasst(taetigkeiten, zuordnung.vorlageId, projektId),
                  stunden,
                })
              }
            />
          </div>
          <WeitereFelder offen={weitereOffen} onToggle={() => setWeitereOffen((wert) => !wert)}>
            {faehigkeitenAn ? (
              <FaehigkeitWahl
                faehigkeiten={faehigkeiten}
                wert={zuordnung.faehigkeitId}
                erben={false}
                disabled={speichern.isPending}
                onAendern={(faehigkeitId) =>
                  senden({
                    zielArt: zuordnung.zielArt,
                    zielId: zuordnung.zielId,
                    projektId,
                    vorlageId: zuordnung.vorlageId,
                    stunden: zuordnung.stunden,
                    faehigkeitId,
                  })
                }
              />
            ) : null}
            {vorhaben ? (
              <Feld label="Stand">
                <select
                  className={EINGABE_STIL}
                  aria-label={tx('Stand')}
                  disabled={speichern.isPending}
                  value={zuordnung.abschluss ?? ''}
                  onChange={(ereignis) => {
                    const roh = ereignis.target.value;
                    senden({
                      zielArt: zuordnung.zielArt,
                      zielId: zuordnung.zielId,
                      projektId,
                      vorlageId: zuordnung.vorlageId,
                      stunden: zuordnung.stunden,
                      abschluss: roh === '' ? null : (roh as 'geschafft' | 'gescheitert'),
                    });
                  }}
                >
                  <option value="">{tx('Dran geblieben')}</option>
                  <option value="geschafft">{tx('Geschafft')}</option>
                  <option value="gescheitert">{tx('Gescheitert')}</option>
                </select>
              </Feld>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center text-sm font-medium">
                  {tx('Meilenstein')}
                  <InfoHinweis text={HINWEIS_MEILENSTEIN} />
                </span>
                <Schalter
                  kompakt
                  label="Meilenstein"
                  an={zuordnung.meilenstein}
                  deaktiviert={speichern.isPending}
                  onAendern={(meilenstein) =>
                    senden({
                      zielArt: zuordnung.zielArt,
                      zielId: zuordnung.zielId,
                      projektId,
                      vorlageId: zuordnung.vorlageId,
                      stunden: zuordnung.stunden,
                      meilenstein,
                    })
                  }
                />
              </div>
            )}
            {zuordnung.abschluss === 'gescheitert' ? (
              <TextFeld
                label="Was nimmst du mit?"
                wert={erkenntnis.text}
                onAendern={erkenntnis.setText}
                onFocus={erkenntnis.onFocus}
                onBlur={() =>
                  erkenntnis.onBlur(() =>
                    senden({
                      zielArt: zuordnung.zielArt,
                      zielId: zuordnung.zielId,
                      projektId,
                      vorlageId: zuordnung.vorlageId,
                      stunden: zuordnung.stunden,
                    }),
                  )
                }
              />
            ) : null}
            <TextFeld
              label="Notiz"
              wert={notiz.text}
              onAendern={notiz.setText}
              onFocus={notiz.onFocus}
              onBlur={() =>
                notiz.onBlur(() =>
                  senden({
                    zielArt: zuordnung.zielArt,
                    zielId: zuordnung.zielId,
                    projektId,
                    vorlageId: zuordnung.vorlageId,
                    stunden: zuordnung.stunden,
                  }),
                )
              }
            />
          </WeitereFelder>
          <p className="text-xs text-leise">{vorschau}</p>
        </>
      )}
      <Fehlermeldung fehler={speichern.error} />
    </div>
  );
}
