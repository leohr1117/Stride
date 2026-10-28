import { tx } from '../../text.ts';
import { Karte } from '../../ui/index.ts';

export function HinweisKarte() {
  return (
    <Karte className="space-y-3" label={tx('Benachrichtigungen')}>
      <h2 className="font-semibold break-words">{tx('Benachrichtigungen')}</h2>
      <p className="text-sm leading-snug break-words">
        {tx('Unter Mehr schaltest du Benachrichtigungen für dieses Gerät ein. Höchstens eine am Tag. Eine Benachrichtigung gibt keine XP.')}
      </p>
      <div className="space-y-1">
        <h3 className="text-sm font-medium">{tx('Streak in Gefahr')}</h3>
        <p className="text-sm leading-snug break-words">
          {tx('Am angeschlagenen Tag, einmal. Der Text bittet um einen Eintrag.')}
        </p>
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-medium">{tx('Rückkehr')}</h3>
        <p className="text-sm leading-snug break-words">{tx('Einmal, wenn die Rückkehr aufgeht.')}</p>
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-medium">{tx('Boss-Datum')}</h3>
        <p className="text-sm leading-snug break-words">
          {tx('Einen Tag vorher, nur wenn Bosse an sind. Der Sieg bleibt in der App.')}
        </p>
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-medium">{tx('Ruhezeit')}</h3>
        <p className="text-sm leading-snug break-words">
          {tx('In dieser Zeit geht nichts raus. Danach höchstens eine Benachrichtigung, wenn sie noch stimmt.')}
        </p>
      </div>
      <p className="text-sm leading-snug break-words">
        {tx('Auf dem iPhone nur aus der App auf dem Home-Bildschirm. Im Safari-Tab bleibt der Knopf aus.')}
      </p>
    </Karte>
  );
}
