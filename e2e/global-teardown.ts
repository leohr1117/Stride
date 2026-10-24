import { loescheTestkopie } from './kopie.ts';

export default async function globalTeardown(): Promise<void> {
  await loescheTestkopie();
}
