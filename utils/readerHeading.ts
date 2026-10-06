// Page counters belong in the reader controls, not above the book's prose.
export function readerHeading(title?: string): string {
  const heading = title?.trim() || '';
  return /^(?:sayfa|page)\s*\d+\s*[.:–-]?$/iu.test(heading) ? '' : heading;
}
