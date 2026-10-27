let aktiv = false;

/** iOS setzt :focus-visible auch nach Antippen. Der Ring gilt nur für die Tastatur. */
export function beobachteFokusArt(): void {
  if (aktiv) {
    return;
  }
  aktiv = true;
  document.addEventListener(
    'pointerdown',
    () => {
      document.documentElement.dataset.eingabe = 'zeiger';
    },
    true,
  );
  document.addEventListener(
    'keydown',
    (ereignis) => {
      if (ereignis.metaKey || ereignis.ctrlKey || ereignis.altKey) {
        return;
      }
      if (ereignis.key === 'Tab' || ereignis.key.startsWith('Arrow')) {
        document.documentElement.dataset.eingabe = 'tastatur';
      }
    },
    true,
  );
}
