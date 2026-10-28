import { expect, test } from 'vitest';

test('die Einführung bietet kein Start-Vorbild und keinen Start-Boss mehr an', async () => {
  const modul = await import('./onboarding.ts');
  expect(modul).not.toHaveProperty('START_BOSS_NAME');
  expect(modul).not.toHaveProperty('START_PROJEKT');
  expect(modul).not.toHaveProperty('startBossSichtbar');
  expect(modul).not.toHaveProperty('vorbildVorschlag');
});
