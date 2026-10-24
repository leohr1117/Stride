import { FARBE, type AttributKennung, type AttributTyp, type IconName } from '../../spiel/begriffe.ts';

export interface AttributVorlage {
  kennung: AttributKennung;
  typ: AttributTyp;
  name: string;
  beschreibung: string;
  farbe: string;
  icon: IconName;
}

export const ATTRIBUT_KATALOG: AttributVorlage[] = [
  { kennung: 'koerper', typ: 'attribut', name: 'Körper', beschreibung: 'Kraft, Ausdauer, Fitness', farbe: FARBE.rot, icon: 'heart-pulse' },
  { kennung: 'geist', typ: 'attribut', name: 'Geist', beschreibung: 'Mentale Gesundheit, Ruhe, Reflexion, Resilienz', farbe: FARBE.gruen, icon: 'leaf' },
  { kennung: 'disziplin', typ: 'attribut', name: 'Disziplin', beschreibung: 'Durchhalten, Fokus, Ordnung', farbe: FARBE.blau, icon: 'target' },
  { kennung: 'intellekt', typ: 'attribut', name: 'Intellekt', beschreibung: 'Wissen, Lernen, Verstehen, Sprachen', farbe: FARBE.violett, icon: 'brain' },
  { kennung: 'soziales', typ: 'attribut', name: 'Soziales', beschreibung: 'Soft Skills, Beziehungen, Kommunikation', farbe: FARBE.pink, icon: 'users' },
  { kennung: 'kreativitaet', typ: 'attribut', name: 'Kreativität', beschreibung: 'Ideen, Gestalten, Erschaffen', farbe: FARBE.orange, icon: 'lightbulb' },
  { kennung: 'motorik', typ: 'attribut', name: 'Motorik', beschreibung: 'Geschick, Koordination, Technik in Hand und Körper', farbe: FARBE.tuerkis, icon: 'hand' },
  { kennung: 'mut', typ: 'attribut', name: 'Mut', beschreibung: 'Risiken eingehen, Komfortzone verlassen', farbe: FARBE.gelb, icon: 'shield' },
  { kennung: 'vitalitaet', typ: 'attribut', name: 'Vitalität', beschreibung: 'Schlaf, Ernährung, Energie', farbe: FARBE.schiefer, icon: 'battery-charging' },
  { kennung: 'fuehrung', typ: 'attribut', name: 'Führung', beschreibung: 'Menschen leiten, Verantwortung übernehmen', farbe: FARBE.indigo, icon: 'flag' },
  { kennung: 'einfluss', typ: 'status', name: 'Einfluss', beschreibung: 'Wie sehr du andere bewegst', farbe: FARBE.indigo, icon: 'handshake' },
  { kennung: 'ressourcen', typ: 'status', name: 'Ressourcen', beschreibung: 'Geld, Eigentum, Mittel', farbe: FARBE.gelb, icon: 'coins' },
  { kennung: 'autoritaet', typ: 'status', name: 'Autorität', beschreibung: 'Verantwortung, Position, Vertrauen', farbe: FARBE.orange, icon: 'crown' },
  { kennung: 'reichweite', typ: 'status', name: 'Reichweite', beschreibung: 'Wie viele Menschen dich erreichen', farbe: FARBE.tuerkis, icon: 'megaphone' },
  { kennung: 'ansehen', typ: 'status', name: 'Ansehen', beschreibung: 'Ruf, Anerkennung, Respekt', farbe: FARBE.pink, icon: 'award' },
  { kennung: 'netzwerk', typ: 'status', name: 'Netzwerk', beschreibung: 'Kontakte, die Türen öffnen', farbe: FARBE.gruen, icon: 'network' },
  { kennung: 'freiheit', typ: 'status', name: 'Freiheit', beschreibung: 'Unabhängigkeit bei Zeit, Ort und Geld', farbe: FARBE.blau, icon: 'feather' },
  { kennung: 'vermaechtnis', typ: 'status', name: 'Vermächtnis', beschreibung: 'Was über dich hinaus bleibt', farbe: FARBE.violett, icon: 'landmark' },
  { kennung: 'beziehungen', typ: 'status', name: 'Beziehungen', beschreibung: 'Familie, Freundschaften, Partnerschaft', farbe: FARBE.rot, icon: 'heart' },
  { kennung: 'qualifikation', typ: 'status', name: 'Qualifikation', beschreibung: 'Abschlüsse, Zertifikate, Nachweise', farbe: FARBE.schiefer, icon: 'graduation-cap' },
];

export function attributVorlage(kennung: AttributKennung): AttributVorlage {
  const vorlage = ATTRIBUT_KATALOG.find((eintrag) => eintrag.kennung === kennung);
  if (!vorlage) {
    throw new Error(`Für "${kennung}" gibt es keine Attribut-Vorlage.`);
  }
  return vorlage;
}
