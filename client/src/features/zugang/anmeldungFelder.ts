interface Seitenfenster {
  history: {
    state: unknown;
    pushState: (zustand: unknown, titel: string, url?: string | URL | null) => void;
  };
  location: { pathname: string; search: string; hash: string };
}

export function seitenwechsel(fenster: Seitenfenster): void {
  const ziel = `${fenster.location.pathname}${fenster.location.search}${fenster.location.hash}`;
  fenster.history.pushState(fenster.history.state, '', ziel);
}
