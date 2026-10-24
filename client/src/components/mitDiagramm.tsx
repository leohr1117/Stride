import { lazy, Suspense, type ComponentProps, type ReactNode } from 'react';

const AttributRadarGeladen = lazy(() => import('./AttributRadar.tsx').then((modul) => ({ default: modul.AttributRadar })));
const ProfilRadarGeladen = lazy(() => import('./ProfilRadar.tsx').then((modul) => ({ default: modul.ProfilRadar })));
const LebenswegGeladen = lazy(() => import('./LebenswegDiagramm.tsx').then((modul) => ({ default: modul.LebenswegDiagramm })));
const LinienGeladen = lazy(() => import('./Diagramme.tsx').then((modul) => ({ default: modul.LinienDiagramm })));
const SaeulenGeladen = lazy(() => import('./Diagramme.tsx').then((modul) => ({ default: modul.SaeulenDiagramm })));

function rahmen(kind: ReactNode) {
  return <Suspense fallback={null}>{kind}</Suspense>;
}

export function AttributRadar(props: ComponentProps<typeof AttributRadarGeladen>) {
  return rahmen(<AttributRadarGeladen {...props} />);
}

export function ProfilRadar(props: ComponentProps<typeof ProfilRadarGeladen>) {
  return rahmen(<ProfilRadarGeladen {...props} />);
}

export function LebenswegDiagramm(props: ComponentProps<typeof LebenswegGeladen>) {
  return rahmen(<LebenswegGeladen {...props} />);
}

export function LinienDiagramm(props: ComponentProps<typeof LinienGeladen>) {
  return rahmen(<LinienGeladen {...props} />);
}

export function SaeulenDiagramm(props: ComponentProps<typeof SaeulenGeladen>) {
  return rahmen(<SaeulenGeladen {...props} />);
}
