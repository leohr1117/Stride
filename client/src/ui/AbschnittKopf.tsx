import type { ReactNode } from 'react';

const TITEL =
  'ueberschrift abschnittskopf min-w-0 text-[13px] leading-[18px] font-semibold tracking-normal text-balance break-words text-leise normal-case';

/** Abschnittsüberschrift auf dem Grund: 13 px, halbfett, leise, 24 px darüber, 8 px darunter. */
export function AbschnittKopf({
  titel,
  aktion,
  hinweis,
  zusatz,
}: {
  titel: string;
  aktion?: ReactNode;
  hinweis?: string;
  zusatz?: ReactNode;
}) {
  return (
    <div className="abschnitt-kopf">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center">
          <h2 className={TITEL}>{titel}</h2>
          {zusatz ? <span className="shrink-0">{zusatz}</span> : null}
        </div>
        {aktion ? <div className="shrink-0">{aktion}</div> : null}
      </div>
      {hinweis ? <p className="mt-1 text-[13px] leading-[18px] break-words text-leise">{hinweis}</p> : null}
    </div>
  );
}
