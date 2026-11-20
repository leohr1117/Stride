import { tx } from '../../text.ts';
import { Fehlermeldung, Knopf } from '../../ui/index.ts';
import { GoogleKnopf, GoogleOder } from './GoogleAnmeldung.tsx';

export function AnmeldeAktionen({
  fehler,
  laeuft,
  google,
  onKonto,
}: {
  fehler: unknown;
  laeuft: boolean;
  google: boolean;
  onKonto?: () => void;
}) {
  return (
    <div className="flex flex-col pt-6">
      <Fehlermeldung fehler={fehler} />
      <Knopf type="submit" variante="primaer" className={fehler ? 'mt-4 w-full' : 'w-full'} aria-busy={laeuft || undefined}>
        {tx('Anmelden')}
      </Knopf>
      {google ? (
        <div className="mt-5">
          <GoogleOder />
        </div>
      ) : null}
      {google ? (
        <div className="mt-5">
          <GoogleKnopf />
        </div>
      ) : null}
      {onKonto ? <KontoHinweis onKonto={onKonto} /> : null}
    </div>
  );
}

function KontoHinweis({ onKonto }: { onKonto: () => void }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-x-1 text-center text-sm leading-5">
      <span data-konto-frage="" className="whitespace-nowrap text-leise">
        {tx('Noch kein Konto?')}
      </span>
      <button
        type="button"
        data-konto-knopf=""
        onClick={onKonto}
        className="inline-flex min-h-12 min-w-12 items-center justify-center whitespace-nowrap bg-transparent px-1 text-sm font-bold text-haupt underline underline-offset-2"
        style={{ fontWeight: 700 }}
      >
        {tx('Konto erstellen')}
      </button>
    </div>
  );
}

(AnmeldeAktionen as typeof AnmeldeAktionen & { fuss: boolean }).fuss = true;
