import { ExternalLink } from 'lucide-react';
import { tx } from '../../text.ts';

const TODOIST_TOKEN_SEITE = 'https://app.todoist.com/app/settings/integrations/developer';

export function TodoistTokenSchritte() {
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm marker:text-leise">
      <li>
        <p>{tx('Öffne die Entwicklerseite in Todoist.')}</p>
        <a
          href={TODOIST_TOKEN_SEITE}
          target="_blank"
          rel="noreferrer"
          className="mt-1 flex min-h-12 w-full items-center gap-1 text-akzent hover:underline"
        >
          {tx('Token in Todoist öffnen')}
          <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
        </a>
      </li>
      <li>{tx('Kopiere den API-Token.')}</li>
      <li>{tx('Füge ihn hier ein und tippe auf Verbinden.')}</li>
    </ol>
  );
}
