import { useEffect, useState, type FormEvent } from 'react';
import { istKontaktEmail } from '../../../../shared/kontakt.ts';
import { ApiFehler, api } from '../../api/index.ts';
import { useKopf } from '../../components/Kopf.tsx';
import { tx } from '../../text.ts';
import { EINGABE_STIL, Fehlermeldung, Feld, Formular, Knopf, Ladeanzeige } from '../../ui/index.ts';
import { OeffentlicheSeite } from '../recht/RechtSeiten.tsx';

type Stand = 'laden' | 'offen' | 'weg' | 'gesendet';

function KontaktFormular() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [nachricht, setNachricht] = useState('');
  const [website, setWebsite] = useState('');
  const [emailFehler, setEmailFehler] = useState<string | null>(null);
  const [nachrichtFehler, setNachrichtFehler] = useState<string | null>(null);
  const [formularFehler, setFormularFehler] = useState<unknown>(null);
  const [stand, setStand] = useState<Stand>('laden');
  const [sendet, setSendet] = useState(false);

  useEffect(() => {
    let aktiv = true;
    api
      .kontaktStatus()
      .then((antwort) => {
        if (aktiv) {
          setStand(antwort.verfuegbar ? 'offen' : 'weg');
        }
      })
      .catch(() => {
        if (aktiv) {
          setStand('weg');
        }
      });
    return () => {
      aktiv = false;
    };
  }, []);

  if (stand === 'laden') {
    return <Ladeanzeige />;
  }
  if (stand === 'weg') {
    return (
      <p role="status" className="text-base leading-6 break-words">
        {tx('Das Kontaktformular ist nicht verfügbar.')}
      </p>
    );
  }
  if (stand === 'gesendet') {
    return (
      <p role="status" className="text-base leading-6 break-words">
        {tx('Deine Nachricht ist angekommen.')}
      </p>
    );
  }

  function senden(ereignis: FormEvent) {
    ereignis.preventDefault();
    const emailText = email.trim();
    const nachrichtText = nachricht.trim();
    const emailHinweis = emailText === '' ? 'Die E-Mail-Adresse fehlt.' : istKontaktEmail(emailText) ? null : 'Die E-Mail-Adresse ist ungültig.';
    const nachrichtHinweis = nachrichtText === '' ? 'Die Nachricht fehlt.' : null;
    setEmailFehler(emailHinweis);
    setNachrichtFehler(nachrichtHinweis);
    setFormularFehler(null);
    if (emailHinweis || nachrichtHinweis) {
      return;
    }
    setSendet(true);
    void api
      .kontaktSenden({ name: name.trim(), email: emailText, nachricht: nachrichtText, website })
      .then(() => setStand('gesendet'))
      .catch((fehler: unknown) => {
        if (fehler instanceof ApiFehler && fehler.status === 503) {
          setStand('weg');
          return;
        }
        setFormularFehler(fehler);
      })
      .finally(() => setSendet(false));
  }

  return (
    <Formular onAbsenden={senden}>
      {formularFehler ? <Fehlermeldung fehler={formularFehler} /> : null}
      <Feld label="Name">
        <input
          className={EINGABE_STIL}
          value={name}
          maxLength={80}
          autoComplete="name"
          onChange={(ereignis) => setName(ereignis.target.value)}
        />
      </Feld>
      <Feld label="E-Mail" fehler={emailFehler}>
        <input
          className={EINGABE_STIL}
          type="text"
          inputMode="email"
          autoComplete="email"
          value={email}
          maxLength={200}
          onChange={(ereignis) => setEmail(ereignis.target.value)}
        />
      </Feld>
      <Feld label="Nachricht" fehler={nachrichtFehler}>
        <textarea
          className={EINGABE_STIL}
          rows={6}
          value={nachricht}
          maxLength={4000}
          onChange={(ereignis) => setNachricht(ereignis.target.value)}
        />
      </Feld>
      <div className="h-0 overflow-hidden" aria-hidden="true">
        <input className="h-0 w-0 border-0 p-0" tabIndex={-1} autoComplete="off" value={website} onChange={(ereignis) => setWebsite(ereignis.target.value)} name="website" />
      </div>
      <Knopf type="submit" variante="primaer" aria-busy={sendet}>
        {tx('Senden')}
      </Knopf>
    </Formular>
  );
}

export function KontaktSeite() {
  useKopf({ titel: 'Kontakt' });
  return <KontaktFormular />;
}

export function KontaktOeffentlich() {
  return (
    <OeffentlicheSeite titel="Kontakt">
      <KontaktFormular />
    </OeffentlicheSeite>
  );
}
