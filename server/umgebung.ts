/** Liest STRIDE_<name>. Ältere Installationen setzen noch ASCEND_<name>, das gilt weiter als Ersatz. */
export function strideVariable(name: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env[`STRIDE_${name}`] ?? env[`ASCEND_${name}`];
}
