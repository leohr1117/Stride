export function titelPasstZumFilter(titel: string, filter: string): boolean {
  const woerter = filter
    .split(',')
    .map((wort) => wort.trim().toLowerCase())
    .filter((wort) => wort !== '');
  if (woerter.length === 0) {
    return true;
  }
  const text = titel.toLowerCase();
  return woerter.some((wort) => text.includes(wort));
}
