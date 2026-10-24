import type {
  AnlaufErgebnis,
  Laufendes,
  Organisation,
  OrganisationDaten,
  Projekt,
  ProjektAenderung,
  ProjektAuswahl,
  ProjektDaten,
  ProjektDetail,
  ProjektMitBelohnung,
  Vision,
  VisionDaten,
  VisionErgebnis,
  Vorhaben,
  VorhabenAenderung,
  Ziele,
} from '../../../shared/api/ziele.ts';
import { anfrage, type MitArchiv } from './kern.ts';

export const zieleApi = {
  ziele: () => anfrage<Ziele>('/ziele'),
  laufendes: () => anfrage<Laufendes>('/laufend'),
  erstelleVision: (daten: VisionDaten) => anfrage<Vision>('/visionen', 'POST', daten),
  aendereVision: (id: number, daten: MitArchiv<VisionDaten>) => anfrage<Vision>(`/visionen/${id}`, 'PATCH', daten),
  loescheVision: (id: number) => anfrage<void>(`/visionen/${id}`, 'DELETE'),
  erreicheVision: (id: number) => anfrage<VisionErgebnis>(`/visionen/${id}/erreichen`, 'POST', {}),
  nimmVisionZurueck: (id: number) => anfrage<Vision>(`/visionen/${id}/zuruecknehmen`, 'POST', {}),
  erstelleOrganisation: (daten: OrganisationDaten) => anfrage<Organisation>('/organisationen', 'POST', daten),
  aendereOrganisation: (id: number, daten: MitArchiv<OrganisationDaten>) =>
    anfrage<Organisation>(`/organisationen/${id}`, 'PATCH', daten),
  loescheOrganisation: (id: number) => anfrage<void>(`/organisationen/${id}`, 'DELETE'),
  projektauswahl: () => anfrage<ProjektAuswahl[]>('/projekte/auswahl'),
  projekt: (id: number) => anfrage<ProjektDetail>(`/projekte/${id}`),
  erstelleProjekt: (daten: ProjektDaten) => anfrage<Projekt>('/projekte', 'POST', daten),
  aendereProjekt: (id: number, daten: ProjektAenderung) =>
    anfrage<ProjektMitBelohnung>(`/projekte/${id}`, 'PATCH', daten),
  loescheProjekt: (id: number) => anfrage<void>(`/projekte/${id}`, 'DELETE'),
  erstelleVorhaben: (projektId: number, titel: string) =>
    anfrage<Vorhaben>(`/projekte/${projektId}/vorhaben`, 'POST', { titel }),
  aendereVorhaben: (id: number, daten: VorhabenAenderung) => anfrage<Vorhaben>(`/vorhaben/${id}`, 'PATCH', daten),
  loescheVorhaben: (id: number) => anfrage<void>(`/vorhaben/${id}`, 'DELETE'),
  lasseVorhabenLos: (id: number) => anfrage<Vorhaben>(`/vorhaben/${id}/loslassen`, 'POST', {}),
  starteNeuenAnlauf: (id: number) => anfrage<AnlaufErgebnis>(`/vorhaben/${id}/neuer-anlauf`, 'POST', {}),
};

export const zieleSchluessel = {
  ziele: ['ziele'],
  laufendes: ['laufendes'],
  projektauswahl: ['projektauswahl'],
  projekt: (id: number) => ['projekt', id] as const,
};
