/** Liest STRIDE_<name>. Ältere Installationen setzen noch ASCEND_<name>, das gilt weiter als Ersatz. */
export function strideVariable(name: string): string | undefined {
  return process.env[`STRIDE_${name}`] ?? process.env[`ASCEND_${name}`];
}
