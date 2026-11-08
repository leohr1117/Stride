/** Liest STRIDE_<name>. Ältere Installationen setzen noch ASCEND_<name>, das gilt weiter als Ersatz. */
export function strideVariable(name: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env[`STRIDE_${name}`] ?? env[`ASCEND_${name}`];
}

export type DatenbankPfadName = 'DB_PFAD' | 'ZUGANG_PFAD';

/** STRIDE_DB_PFAD bzw. STRIDE_ZUGANG_PFAD, sonst der bisherige Name ohne Präfix. ASCEND_ gilt hier nicht. */
export function pfadVariable(name: DatenbankPfadName, env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env[`STRIDE_${name}`] ?? env[name];
}

/** Schreibt neuen und alten Namen auf denselben Pfad, damit ein geerbter neuer Name den gewählten nicht schlägt. */
export function schreibePfadVariable(name: DatenbankPfadName, wert: string, env: NodeJS.ProcessEnv = process.env): void {
  env[`STRIDE_${name}`] = wert;
  env[name] = wert;
}

/** Kopiert die Umgebung und setzt beide Datenbankpfade auf die isolierten Werte. */
export function mitDatenbankPfaden(basis: NodeJS.ProcessEnv, datenbank: string, zugang: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...basis };
  schreibePfadVariable('DB_PFAD', datenbank, env);
  schreibePfadVariable('ZUGANG_PFAD', zugang, env);
  return env;
}
