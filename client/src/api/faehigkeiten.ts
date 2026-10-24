import type { Faehigkeit, FaehigkeitDaten, SkillErgebnis, SkillKnotenDaten } from '../../../shared/api/faehigkeiten.ts';
import { anfrage, type MitArchiv } from './kern.ts';

export const faehigkeitenApi = {
  faehigkeiten: () => anfrage<Faehigkeit[]>('/faehigkeiten'),
  faehigkeit: (id: number) => anfrage<Faehigkeit>(`/faehigkeiten/${id}`),
  erstelleFaehigkeit: (daten: FaehigkeitDaten) => anfrage<Faehigkeit>('/faehigkeiten', 'POST', daten),
  aendereFaehigkeit: (id: number, daten: MitArchiv<FaehigkeitDaten>) =>
    anfrage<Faehigkeit>(`/faehigkeiten/${id}`, 'PATCH', daten),
  loescheFaehigkeit: (id: number) => anfrage<void>(`/faehigkeiten/${id}`, 'DELETE'),
  erstelleKnoten: (faehigkeitId: number, daten: SkillKnotenDaten) =>
    anfrage<Faehigkeit>(`/faehigkeiten/${faehigkeitId}/knoten`, 'POST', daten),
  aendereKnoten: (id: number, daten: Partial<Omit<SkillKnotenDaten, 'elternId'>>) =>
    anfrage<Faehigkeit>(`/knoten/${id}`, 'PATCH', daten),
  loescheKnoten: (id: number) => anfrage<Faehigkeit>(`/knoten/${id}`, 'DELETE'),
  schalteSkillFrei: (id: number) => anfrage<SkillErgebnis>(`/knoten/${id}/freischalten`, 'POST', {}),
  sperreSkill: (id: number) => anfrage<Faehigkeit>(`/knoten/${id}/sperren`, 'POST', {}),
};

export const faehigkeitenSchluessel = {
  faehigkeiten: ['faehigkeiten'],
  faehigkeit: (id: number) => ['faehigkeit', id] as const,
};
