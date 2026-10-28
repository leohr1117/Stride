/** Antwort von GET /api/hinweise sowie von Abo und PATCH. Die Angebotskarte kommt nicht hierher. */
export interface HinweisStand {
  oeffentlicherSchluessel: string | null;
  angemeldet: boolean;
  geraete: number;
  ruheVon: string;
  ruheBis: string;
  streak: boolean;
  rueckkehr: boolean;
  boss: boolean;
  angebot: false;
}

/** Antwort von POST /api/hinweise/angebot. */
export interface HinweisAngebotAntwort {
  gesehen: true;
}
