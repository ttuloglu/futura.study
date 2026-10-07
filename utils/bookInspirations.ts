export type BookInspirationCategory = 'masal' | 'hikaye' | 'calisma-kitabi' | 'yabanci-dil-hikaye';
export interface BookInspiration {
  id: string;
  category: BookInspirationCategory;
  label: string;
  brief: string;
}
export interface BookInspirationCatalog {
  ui: { all: string; title: string; loading: string; retry: string; unavailable: string };
  entries: BookInspiration[];
}

export function getInspirationCategory(bookType: 'fairy_tale' | 'novel' | 'story', languageLearning: boolean): BookInspirationCategory {
  if (bookType === 'fairy_tale') return 'masal';
  if (bookType === 'story') return 'calisma-kitabi';
  return languageLearning ? 'yabanci-dil-hikaye' : 'hikaye';
}

// Exclude the last opening's three suggestions; shuffle a copy so the full catalog keeps its order.
export function sampleBookInspirations(
  entries: readonly BookInspiration[], category: BookInspirationCategory,
  previousIds: readonly string[] = [], random: () => number = Math.random,
): string[] {
  const all = entries.filter(entry => entry.category === category);
  const fresh = all.filter(entry => !previousIds.includes(entry.id));
  const pool = [...(fresh.length >= 3 ? fresh : all)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3).map(entry => entry.id);
}
