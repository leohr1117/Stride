import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { Faehigkeit, TodoistStatus, TodoistZielArt, Vorlage } from '../../../../shared/api/index.ts';
import { DAUER_OPTIONEN } from '../../../../shared/spiel/begriffe.ts';
import { istAn } from '../../../../shared/spiel/sichtbarkeit.ts';
import { taetigkeitPasst } from '../../../../shared/spiel/taetigkeit.ts';
import { api, SCHLUESSEL } from '../../api/index.ts';
import { useSichtbarkeit } from '../../funktionen.ts';
import { tx } from '../../text.ts';
import { projekteFuerVision, type ZielBlick } from '../../todoistZiel.ts';

export function useTodoistBlick(): {
  blick: ZielBlick;
  taetigkeiten: Vorlage[];
  faehigkeiten: Faehigkeit[];
  faehigkeitenAn: boolean;
} {
  const sichtbarkeit = useSichtbarkeit();
  const visionenAn = istAn('visionen', sichtbarkeit);
  const vorhabenAn = istAn('vorhaben', sichtbarkeit);
  const faehigkeitenAn = istAn('faehigkeiten', sichtbarkeit);
  const { data: ziele } = useQuery({ queryKey: SCHLUESSEL.ziele, queryFn: api.ziele });
  const { data: vorlagen = [] } = useQuery({ queryKey: SCHLUESSEL.vorlagen, queryFn: api.vorlagen });
  const { data: faehigkeiten = [] } = useQuery({
    queryKey: SCHLUESSEL.faehigkeiten,
    queryFn: api.faehigkeiten,
    enabled: faehigkeitenAn,
  });
  return {
    blick: {
      projekte: (ziele?.projekte ?? []).filter((projekt) => projekt.aktiv),
      vorhaben: vorhabenAn ? (ziele?.vorhaben ?? []) : [],
      visionen: visionenAn ? (ziele?.visionen ?? []).filter((vision) => !vision.archiviert && vision.erreichtAm === null) : [],
      organisationen: ziele?.organisationen ?? [],
    },
    taetigkeiten: vorlagen.filter((vorlage) => !vorlage.archiviert),
    faehigkeiten: faehigkeitenAn ? faehigkeiten.filter((faehigkeit) => !faehigkeit.archiviert) : [],
    faehigkeitenAn,
  };
}

export function merkeStatus(client: ReturnType<typeof useQueryClient>, status: TodoistStatus): void {
  client.setQueryData(SCHLUESSEL.verbindungen, (bisher: unknown) =>
    bisher && typeof bisher === 'object' ? { ...bisher, todoist: status } : bisher,
  );
}

export function useMitziehText(wert: string) {
  const [text, setText] = useState(wert);
  const feldFokus = useRef(false);
  useEffect(() => {
    if (!feldFokus.current) {
      setText(wert);
    }
  }, [wert]);
  return {
    text,
    setText,
    onFocus: () => {
      feldFokus.current = true;
    },
    onBlur: (sichern: (text: string) => void) => {
      feldFokus.current = false;
      if (text !== wert) {
        sichern(text);
      }
    },
  };
}

export function dauerLabel(stunden: number): string {
  const option = DAUER_OPTIONEN.find((eintrag) => eintrag.stunden === stunden);
  return option ? tx(option.label) : tx('Dauer');
}

export function zielName(art: TodoistZielArt, id: number, blick: ZielBlick): string | null {
  if (art === 'projekt') {
    return blick.projekte.find((projekt) => projekt.id === id)?.name ?? null;
  }
  if (art === 'vorhaben') {
    return blick.vorhaben.find((eintrag) => eintrag.id === id)?.titel ?? null;
  }
  return blick.visionen.find((vision) => vision.id === id)?.titel ?? null;
}

export function projektVonZiel(art: TodoistZielArt, id: number, wahl: number | null, blick: ZielBlick): number | null {
  if (art === 'projekt') {
    return id;
  }
  if (art === 'vorhaben') {
    return blick.vorhaben.find((eintrag) => eintrag.id === id)?.projektId ?? null;
  }
  const liste = projekteFuerVision(blick, id);
  if (wahl !== null && liste.some((projekt) => projekt.id === wahl)) {
    return wahl;
  }
  return liste[0]?.id ?? null;
}

export function vorlagePasst(taetigkeiten: readonly Vorlage[], vorlageId: number | null, projektId: number | null): number | null {
  if (vorlageId === null) {
    return null;
  }
  const vorlage = taetigkeiten.find((eintrag) => eintrag.id === vorlageId);
  return vorlage && taetigkeitPasst(vorlage.projektId, projektId) ? vorlageId : null;
}

export function sortiert<T extends { id: number }>(liste: readonly T[], name: (eintrag: T) => string): T[] {
  return [...liste].sort((links, rechts) => name(links).localeCompare(name(rechts), 'de') || links.id - rechts.id);
}

export function visionHinweis(art: TodoistZielArt | null, id: number | null, projektId: number | null, blick: ZielBlick): string | null {
  if (art !== 'vision' || id === null) {
    return null;
  }
  const liste = projekteFuerVision(blick, id);
  if (liste.length === 0) {
    return tx('Diese Vision hat kein aktives Projekt.');
  }
  if (liste.length > 1 && !liste.some((projekt) => projekt.id === projektId)) {
    return tx('Wähle ein Projekt für diese Vision.');
  }
  return null;
}
