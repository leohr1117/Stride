import { describe, expect, it } from 'vitest';
import {
  ebenenFuerStufe,
  eintragTipp,
  fehlendeZuordnung,
  hinweisAusblenden,
  leseEbenen,
  normalisiereEbenen,
  passendeZielEbene,
  setzeEbene,
  wendeEbenenAn,
  standardEbenen,
  zieleAktiv,
  zielTitel,
} from './ebenen.ts';

describe('ebenen', () => {
  it('setzt pro Stufe die passenden Ebenen, Organisation bleibt aus', () => {
    expect(ebenenFuerStufe('traeumer')).toEqual({
      visionen: true,
      organisationen: false,
      projekte: true,
      vorhaben: true,
    });
    expect(ebenenFuerStufe('macher')).toEqual({
      visionen: false,
      organisationen: false,
      projekte: true,
      vorhaben: true,
    });
    expect(ebenenFuerStufe('bodenstaendig')).toEqual({
      visionen: false,
      organisationen: false,
      projekte: true,
      vorhaben: true,
    });
    expect(ebenenFuerStufe('uebung')).toEqual({
      visionen: false,
      organisationen: false,
      projekte: false,
      vorhaben: false,
    });
    expect(ebenenFuerStufe('einfach')).toEqual(ebenenFuerStufe('uebung'));
    expect(passendeZielEbene(ebenenFuerStufe('traeumer'))).toBe('visionen');
    expect(passendeZielEbene(ebenenFuerStufe('macher'))).toBe('projekte');
    expect(passendeZielEbene(ebenenFuerStufe('bodenstaendig'))).toBe('projekte');
    expect(passendeZielEbene(ebenenFuerStufe('uebung'))).toBeNull();
    expect(passendeZielEbene(ebenenFuerStufe('einfach'))).toBeNull();
    expect(zieleAktiv(standardEbenen())).toBe(true);
    expect(zieleAktiv(ebenenFuerStufe('bodenstaendig'))).toBe(true);
    expect(zieleAktiv(ebenenFuerStufe('einfach'))).toBe(false);
    expect(zieleAktiv({ visionen: false, organisationen: true, projekte: false, vorhaben: false })).toBe(false);
    expect(zielTitel('vorhaben')).toBe('Vorhaben');
    expect(zielTitel('organisationen', false)).toBe('Organisation');
  });

  it('koppelt Vorhaben an Projekte', () => {
    expect(
      normalisiereEbenen({ visionen: true, organisationen: true, projekte: false, vorhaben: false }).organisationen,
    ).toBe(false);
    expect(normalisiereEbenen({ visionen: false, organisationen: false, projekte: false, vorhaben: true })).toEqual({
      visionen: false,
      organisationen: false,
      projekte: true,
      vorhaben: true,
    });
    expect(setzeEbene(standardEbenen(), 'projekte', false)).toEqual({
      visionen: true,
      organisationen: false,
      projekte: false,
      vorhaben: false,
    });
    expect(setzeEbene({ visionen: false, organisationen: false, projekte: false, vorhaben: false }, 'vorhaben', true)).toEqual({
      visionen: false,
      organisationen: false,
      projekte: true,
      vorhaben: true,
    });
    expect(
      wendeEbenenAn(standardEbenen(), { projekte: false }),
    ).toEqual({
      visionen: true,
      organisationen: false,
      projekte: false,
      vorhaben: false,
    });
  });

  it('lässt fehlende gespeicherte Ebenen auf allen an', () => {
    expect(leseEbenen(undefined)).toEqual(standardEbenen());
    expect(leseEbenen({ visionen: false }).projekte).toBe(true);
  });

  it('formuliert die Rückfrage nur für Ebenen mit Daten', () => {
    const vorher = standardEbenen();
    const nachher = ebenenFuerStufe('bodenstaendig');
    expect(
      hinweisAusblenden(vorher, nachher, { visionen: 2, organisationen: 0, projekte: 12, vorhaben: 4 }),
    ).toBe('2 Visionen werden ausgeblendet und lassen sich wieder einschalten.');
    expect(hinweisAusblenden(vorher, nachher, { visionen: 0, organisationen: 1, projekte: 0, vorhaben: 3 })).toBe(
      '1 Organisation wird ausgeblendet und lässt sich wieder einschalten.',
    );
    expect(hinweisAusblenden(vorher, ebenenFuerStufe('traeumer'), { visionen: 1, organisationen: 0, projekte: 1, vorhaben: 1 })).toBe(
      null,
    );
  });

  it('nennt die fehlende höhere Ebene', () => {
    const ebenen = standardEbenen();
    expect(fehlendeZuordnung({ ebene: 'projekt', ebenen, visionId: null, organisationId: null })).toBe(
      'Nicht zugeordnet: zählt nicht für Vision oder Organisation.',
    );
    expect(
      fehlendeZuordnung({
        ebene: 'projekt',
        ebenen: { ...ebenen, organisationen: false },
        visionId: null,
        organisationId: null,
      }),
    ).toBe('Nicht zugeordnet: zählt nicht für die Vision.');
    expect(fehlendeZuordnung({ ebene: 'vorhaben', ebenen, projektId: null })).toBe(
      'Nicht zugeordnet: zählt nicht für das Projekt.',
    );
    expect(fehlendeZuordnung({ ebene: 'vorhaben', ebenen, projektId: 4 })).toBe(null);
  });
});

describe('eintragTipp', () => {
  const leer = { vorhabenGewaehlt: false, faehigkeitGewaehlt: false };

  it('nennt nur die sichtbaren leeren Wahlen', () => {
    expect(eintragTipp({ vorhabenSichtbar: true, faehigkeitSichtbar: true, ...leer })).toBe(
      'Tipp: Wähl ein Vorhaben oder eine Fähigkeit.',
    );
    expect(eintragTipp({ vorhabenSichtbar: true, faehigkeitSichtbar: false, ...leer })).toBe('Tipp: Wähl ein Vorhaben.');
    expect(eintragTipp({ vorhabenSichtbar: false, faehigkeitSichtbar: true, ...leer })).toBe('Tipp: Wähl eine Fähigkeit.');
  });

  it('bleibt weg, sobald etwas gewählt ist oder nichts sichtbar ist', () => {
    expect(
      eintragTipp({ vorhabenSichtbar: true, faehigkeitSichtbar: true, vorhabenGewaehlt: true, faehigkeitGewaehlt: false }),
    ).toBe(null);
    expect(
      eintragTipp({ vorhabenSichtbar: true, faehigkeitSichtbar: true, vorhabenGewaehlt: false, faehigkeitGewaehlt: true }),
    ).toBe(null);
    expect(
      eintragTipp({ vorhabenSichtbar: true, faehigkeitSichtbar: false, vorhabenGewaehlt: true, faehigkeitGewaehlt: false }),
    ).toBe(null);
    expect(eintragTipp({ vorhabenSichtbar: false, faehigkeitSichtbar: false, ...leer })).toBe(null);
  });
});
