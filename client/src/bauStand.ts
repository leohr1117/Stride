const roh = import.meta.env.VITE_STRIDE_COMMIT;

export const BAU_COMMIT = typeof roh === 'string' ? roh.trim() : '';

export function quellcodeAdresse(commit = BAU_COMMIT): string {
  return /^[0-9a-f]{40}$/.test(commit)
    ? `https://github.com/leohr1117/Stride/tree/${commit}`
    : 'https://github.com/leohr1117/Stride';
}
