import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TodoistStatus } from '../../../../shared/api/index.ts';
import { api } from '../../api/index.ts';
import { Abschnitt } from '../../components/Ausklappbar.tsx';
import { tx } from '../../text.ts';
import { merkeStatus, useTodoistBlick } from './gemeinsam.ts';
import { LabelZeile } from './LabelZeile.tsx';
import { ProjektZeile } from './ProjektZeile.tsx';

const INFO_PROJEKTE =
  'Ordne das Todoist-Projekt einer Vision, einem Projekt oder einem Vorhaben zu. Die Tätigkeit und die Dauer gelten, wenn kein Label sie setzt.';
const INFO_LABELS =
  'Ein Label setzt Felder des Eintrags und gilt vor dem Todoist-Projekt. Bei mehreren Labels füllt jedes Feld die oberste Regel, die es setzt. Die Dauer der Aufgabe zählt zuerst. Der Aufgabentitel wird die Notiz, ein Text hier kommt dahinter. Meilenstein gilt ohne Vorhaben, Geschafft nur mit Vorhaben.';

export function TodoistZuordnungen({ status }: { status: TodoistStatus }) {
  const { blick, taetigkeiten, faehigkeiten, faehigkeitenAn } = useTodoistBlick();
  const client = useQueryClient();
  const reihenfolge = useMutation({
    mutationFn: (ids: string[]) => api.ordneTodoistLabelReihenfolge(ids),
    onSuccess: (neu) => merkeStatus(client, neu),
  });
  const aktiv = status.labels.filter((label) => label.aktiv);
  const verschiebe = (id: string, richtung: -1 | 1) => {
    const ids = aktiv.map((label) => label.todoistId);
    const index = ids.indexOf(id);
    const ziel = index + richtung;
    if (index < 0 || ziel < 0 || ziel >= ids.length) {
      return;
    }
    const [entfernt] = ids.splice(index, 1);
    if (entfernt === undefined) {
      return;
    }
    ids.splice(ziel, 0, entfernt);
    reihenfolge.mutate(ids);
  };

  return (
    <div className="space-y-4">
      <Abschnitt titel="Projekte" kennung="todoist-projekte" info={INFO_PROJEKTE}>
        {status.projekte.length === 0 ? (
          <p className="text-sm text-leise">{tx('Keine Projekte in Todoist.')}</p>
        ) : (
          <div className="divide-y divide-rand">
            {status.projekte.map((zuordnung) => (
              <ProjektZeile
                key={zuordnung.todoistId}
                zuordnung={zuordnung}
                blick={blick}
                taetigkeiten={taetigkeiten}
                faehigkeiten={faehigkeiten}
                faehigkeitenAn={faehigkeitenAn}
              />
            ))}
          </div>
        )}
      </Abschnitt>
      <Abschnitt titel="Labels" kennung="todoist-labels" info={INFO_LABELS}>
        {status.labels.length === 0 ? (
          <p className="text-sm text-leise">{tx('Keine Labels in Todoist.')}</p>
        ) : (
          <div className="divide-y divide-rand">
            {status.labels.map((label) => (
              <LabelZeile
                key={label.todoistId}
                label={label}
                index={aktiv.findIndex((eintrag) => eintrag.todoistId === label.todoistId)}
                anzahl={aktiv.length}
                blick={blick}
                taetigkeiten={taetigkeiten}
                faehigkeiten={faehigkeiten}
                faehigkeitenAn={faehigkeitenAn}
                reihenfolgeLaeuft={reihenfolge.isPending}
                onReihenfolge={(richtung) => verschiebe(label.todoistId, richtung)}
              />
            ))}
          </div>
        )}
      </Abschnitt>
    </div>
  );
}
