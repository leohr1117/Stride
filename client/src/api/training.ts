import type { EintragErgebnis } from '../../../shared/api/eintraege.ts';
import type {
  Bestwert,
  TrainingHeute,
  Trainingseinheit,
  Trainingsplan,
  TrainingsplanDaten,
  Uebung,
  UebungDaten,
} from '../../../shared/api/training.ts';
import { abfrageText, anfrage, type MitArchiv } from './kern.ts';

export const trainingApi = {
  trainingsplaene: (archiv = false) =>
    anfrage<Trainingsplan[]>(`/trainingsplaene${abfrageText({ archiv: archiv ? '1' : undefined })}`),
  erstelleTrainingsplan: (daten: TrainingsplanDaten) => anfrage<Trainingsplan>('/trainingsplaene', 'POST', daten),
  aendereTrainingsplan: (id: number, daten: MitArchiv<TrainingsplanDaten>) =>
    anfrage<Trainingsplan>(`/trainingsplaene/${id}`, 'PATCH', daten),
  loescheTrainingsplan: (id: number) => anfrage<void>(`/trainingsplaene/${id}`, 'DELETE'),
  uebungen: (archiv = false) => anfrage<Uebung[]>(`/uebungen${abfrageText({ archiv: archiv ? '1' : undefined })}`),
  erstelleUebung: (daten: UebungDaten) => anfrage<Uebung>('/uebungen', 'POST', daten),
  aendereUebung: (id: number, daten: MitArchiv<UebungDaten>) => anfrage<Uebung>(`/uebungen/${id}`, 'PATCH', daten),
  loescheUebung: (id: number) => anfrage<void>(`/uebungen/${id}`, 'DELETE'),
  trainingseinheiten: () => anfrage<Trainingseinheit[]>('/trainingseinheiten'),
  starteEinheit: (planId: number) => anfrage<Trainingseinheit>('/trainingseinheiten', 'POST', { planId }),
  trainingseinheit: (id: number) => anfrage<Trainingseinheit>(`/trainingseinheiten/${id}`),
  schliesseEinheitAb: (id: number) => anfrage<EintragErgebnis>(`/trainingseinheiten/${id}/abschliessen`, 'POST'),
  verwirfEinheit: (id: number) => anfrage<void>(`/trainingseinheiten/${id}`, 'DELETE'),
  hakeSatzAb: (id: number, erledigt: boolean) => anfrage<Trainingseinheit>(`/trainingssaetze/${id}`, 'PATCH', { erledigt }),
  bestwerte: (uebungId: number) => anfrage<Bestwert[]>(`/uebungen/${uebungId}/bestwerte`),
  trainingHeute: () => anfrage<TrainingHeute[]>('/training/heute'),
};

export const trainingSchluessel = {
  trainingsplaene: ['trainingsplaene'],
  uebungen: ['uebungen'],
  einheiten: ['trainingseinheiten'],
  einheit: (id: number) => ['trainingseinheiten', id] as const,
  bestwerte: (uebungId: number) => ['bestwerte', uebungId] as const,
  heute: ['training', 'heute'],
} as const;
