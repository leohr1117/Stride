import { GRENZEN } from '../../../../shared/spiel/begriffe.ts';
import { tx } from '../../text.ts';
import { Chip, EINGABE_STIL, Fehlermeldung, Feld, Karte } from '../../ui/index.ts';
import type { EintragStand } from './planStand.ts';

function Fehler({ text }: { text: string | null }) {
  if (!text) {
    return null;
  }
  return <Fehlermeldung fehler={new Error(text)} />;
}

function ZahlFeld({
  label,
  wert,
  onWert,
  placeholder,
}: {
  label: string;
  wert: string;
  onWert: (wert: string) => void;
  placeholder?: string;
}) {
  return (
    <Feld label={<span className="whitespace-nowrap text-xs md:text-sm">{tx(label)}</span>}>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={wert}
        placeholder={placeholder}
        onChange={(ereignis) => onWert(ereignis.target.value)}
        className={`${EINGABE_STIL} zahl`}
      />
    </Feld>
  );
}

function Zahlen({
  eintrag,
  aufwaermen,
  onChange,
}: {
  eintrag: EintragStand;
  aufwaermen: boolean;
  onChange: (eintrag: EintragStand) => void;
}) {
  const saetze = aufwaermen ? eintrag.aufwaermSaetze : eintrag.saetze;
  const wiederholungen = aufwaermen ? eintrag.aufwaermWiederholungen : eintrag.wiederholungen;
  const sekunden = aufwaermen ? eintrag.aufwaermSekunden : eintrag.sekunden;
  const gewicht = aufwaermen ? eintrag.aufwaermGewicht : eintrag.gewicht;
  const setze = (teil: Partial<EintragStand>) => onChange({ ...eintrag, ...teil });
  const setzeGewicht = (text: string) => {
    const feld = { ...gewicht, text, beruehrt: true };
    setze(aufwaermen ? { aufwaermGewicht: feld } : { gewicht: feld });
  };
  return (
    <div className={`grid items-end gap-3 ${eintrag.art === 'dauer' ? 'grid-cols-2' : 'grid-cols-3'}`}>
      <ZahlFeld
        label="Sätze"
        wert={saetze}
        onWert={(text) => setze(aufwaermen ? { aufwaermSaetze: text } : { saetze: text })}
      />
      {eintrag.art === 'dauer' ? (
        <ZahlFeld
          label="Sekunden"
          wert={sekunden}
          onWert={(text) => setze(aufwaermen ? { aufwaermSekunden: text } : { sekunden: text })}
        />
      ) : (
        <>
          <ZahlFeld
            label="Wiederholungen"
            wert={wiederholungen}
            onWert={(text) => setze(aufwaermen ? { aufwaermWiederholungen: text } : { wiederholungen: text })}
          />
          <ZahlFeld label="Gewicht" wert={gewicht.text} onWert={setzeGewicht} placeholder={tx('ohne')} />
        </>
      )}
    </div>
  );
}

export function PlanEintragKarte({
  eintrag,
  onChange,
  onEntfernen,
}: {
  eintrag: EintragStand;
  onChange: (eintrag: EintragStand) => void;
  onEntfernen: () => void;
}) {
  return (
    <Karte className="space-y-4">
      <div className="space-y-2">
        <Feld label="Übung oder Gerät">
          <input
            type="text"
            autoComplete="off"
            maxLength={GRENZEN.nameMax}
            value={eintrag.name}
            placeholder={tx('Kniebeuge, Klimmzugstange …')}
            onChange={(ereignis) => onChange({ ...eintrag, name: ereignis.target.value })}
            className={EINGABE_STIL}
          />
        </Feld>
        <Fehler text={eintrag.nameFehler} />
      </div>
      <div role="group" className="flex flex-wrap gap-2">
        <Chip aktiv={eintrag.art === 'kraft'} onClick={() => onChange({ ...eintrag, art: 'kraft' })}>
          {tx('Wiederholungen')}
        </Chip>
        <Chip aktiv={eintrag.art === 'dauer'} onClick={() => onChange({ ...eintrag, art: 'dauer' })}>
          {tx('Dauer')}
        </Chip>
      </div>
      <Zahlen eintrag={eintrag} aufwaermen={false} onChange={onChange} />
      <Fehler text={eintrag.vorgabeFehler} />
      {eintrag.aufwaermen ? (
        <div className="space-y-2 rounded-sm bg-flaeche-2 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs tracking-widest text-leise uppercase">{tx('Aufwärmen')}</p>
            <button type="button" className="text-sm text-leise" onClick={() => onChange({ ...eintrag, aufwaermen: false })}>
              {tx('Entfernen')}
            </button>
          </div>
          <Zahlen eintrag={eintrag} aufwaermen onChange={onChange} />
          <Fehler text={eintrag.aufwaermFehler} />
        </div>
      ) : (
        <button type="button" className="block text-sm font-medium text-akzent" onClick={() => onChange({ ...eintrag, aufwaermen: true })}>
          {tx('Aufwärmen hinzufügen')}
        </button>
      )}
      <button type="button" className="block text-sm text-leise" onClick={onEntfernen}>
        {tx('Eintrag entfernen')}
      </button>
    </Karte>
  );
}
