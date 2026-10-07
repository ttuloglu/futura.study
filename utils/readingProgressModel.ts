// Semantic bookmarks survive font-size changes; coverage survives repeated visits.
export interface ReadingPosition {
  sourceIndex: number;
  contentStartOffset: number;
  pageIndex: number;
  pageCount: number;
  rangeStart: number;
  rangeEnd: number;
  isLast: boolean;
  theme?: string;
  fontScale?: number;
  active?: boolean;
}
export interface ReadingBookmark extends ReadingPosition { updatedAt: number; platform: 'native' | 'web' }
export interface ReadingRecord {
  bookId: string; title: string; bookType: string; genre: string; subGenre: string;
  learningLanguage?: string; learningLevel?: string;
  bookmarks: Partial<Record<'native' | 'web', ReadingBookmark>>;
  coverage: [number, number][]; reachedEnd: boolean; completedAt?: number; lastOpenedAt?: number; updatedAt: number;
}
export function mergeCoverage(ranges: [number, number][]): [number, number][] {
  const sorted = ranges.filter(([a,b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .map(([a,b]) => [Math.max(0,a), Math.min(1,b)] as [number,number]).filter(([a,b]) => b > a).sort((a,b) => a[0]-b[0]);
  const result: [number, number][] = [];
  for (const range of sorted) {
    const last = result[result.length-1];
    if (last && range[0] <= last[1] + .00001) last[1] = Math.max(last[1], range[1]);
    else result.push([...range]);
  }
  return result;
}
export function mergeReadingRecords(previous: ReadingRecord | undefined, next: ReadingRecord): ReadingRecord {
  const newer = !previous || next.updatedAt >= previous.updatedAt ? next : previous;
  const bookmarks = { ...previous?.bookmarks };
  for (const platform of ['native','web'] as const) {
    const incoming = next.bookmarks[platform];
    if (incoming && (!bookmarks[platform] || incoming.updatedAt >= bookmarks[platform]!.updatedAt)) bookmarks[platform] = incoming;
  }
  const coverage = mergeCoverage([...(previous?.coverage || []), ...next.coverage]);
  const reachedEnd = Boolean(previous?.reachedEnd || next.reachedEnd);
  const complete = coverage.reduce((sum,[a,b]) => sum+b-a, 0) >= .85 && reachedEnd;
  const completedAt = previous?.completedAt || next.completedAt || (complete ? next.updatedAt : undefined);
  const lastOpenedAt = Math.max(previous?.lastOpenedAt || 0, next.lastOpenedAt || 0);
  const learningLanguage = newer.learningLanguage || next.learningLanguage || previous?.learningLanguage;
  const learningLevel = newer.learningLevel || next.learningLevel || previous?.learningLevel;
  return { ...newer, bookmarks, coverage, reachedEnd,
    ...(learningLanguage ? { learningLanguage } : {}), ...(learningLevel ? { learningLevel } : {}),
    ...(completedAt ? { completedAt } : {}), ...(lastOpenedAt ? { lastOpenedAt } : {}), updatedAt: Math.max(previous?.updatedAt || 0,next.updatedAt) };
}

export function libraryReadingState(record?: ReadingRecord) {
  const bookmark = Object.values(record?.bookmarks || {}).sort((a,b) => b.updatedAt-a.updatedAt)[0];
  const started = Boolean(bookmark);
  const lastOpenedAt = started ? record?.lastOpenedAt || bookmark.updatedAt : 0;
  const progress = !started ? 0 : record?.completedAt ? 100 : Math.max(0, Math.min(99, Math.round((bookmark.rangeStart || 0) * 100)));
  return { started, lastOpenedAt, progress };
}

export function sortLibraryByReading<T extends { id: string; lastActivity?: Date }>(books: T[], records: Record<string,ReadingRecord>) {
  const activity = (book: T) => { const time = book.lastActivity ? new Date(book.lastActivity).getTime() : 0; return Number.isFinite(time) ? time : 0; };
  return [...books].sort((a,b) => {
    const first = libraryReadingState(records[a.id]), second = libraryReadingState(records[b.id]);
    return Number(second.started)-Number(first.started) || second.lastOpenedAt-first.lastOpenedAt || activity(b)-activity(a);
  });
}
export interface ReadingBookMetadata {
  id: string;
  languageLearning?: { purpose: string; targetLanguage: string; cefrLevel: string };
  creativeBrief?: { languageLearning?: ReadingBookMetadata['languageLearning'] };
}
export interface ReadingStats {
  total: number; month: number; types: Record<string,number>; genres: Record<string,number>; subGenres: Record<string,number>; inProgress: number;
  learning: { total: number; inProgress: number; languages: Record<string,number>; levels: Record<string,number> };
}
export function readingStats(records: ReadingRecord[], now = new Date(), books: ReadingBookMetadata[] = []): ReadingStats {
  const stats: ReadingStats = { total:0, month:0, types:{}, genres:{}, subGenres:{}, inProgress:0,
    learning: { total:0, inProgress:0, languages:{}, levels:{} } };
  const metadata = new Map(books.map(book => [book.id, book.languageLearning || book.creativeBrief?.languageLearning]));
  for (const record of records) {
    // Enrich older bookmarks from library metadata without changing their reading history.
    const profile = metadata.get(record.bookId);
    const language = record.learningLanguage || (profile?.purpose === 'language_learning' ? profile.targetLanguage : '');
    const level = record.learningLevel || (profile?.purpose === 'language_learning' ? profile.cefrLevel : '');
    const learning = Boolean(language || record.bookType === 'language_learning');
    if (!record.completedAt) {
      if (record.coverage.length) { stats.inProgress++; if (learning) stats.learning.inProgress++; }
      continue;
    }
    stats.total++;
    const type = learning ? 'language_learning' : record.bookType;
    stats.types[type] = (stats.types[type] || 0)+1;
    if (learning) {
      stats.learning.total++;
      if (language) stats.learning.languages[language] = (stats.learning.languages[language] || 0)+1;
      if (level && /^(A[12]|B[12]|C[12])$/.test(level)) stats.learning.levels[level] = (stats.learning.levels[level] || 0)+1;
    }
    if (record.genre) stats.genres[record.genre] = (stats.genres[record.genre] || 0)+1;
    if (record.subGenre) stats.subGenres[record.subGenre] = (stats.subGenres[record.subGenre] || 0)+1;
    const date = new Date(record.completedAt);
    if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) stats.month++;
  }
  return stats;
}

// Firestore does not support arrays inside arrays. Keep tuples in memory only.
export function encodeReadingRecord(record: ReadingRecord) {
  return { ...record, coverage: record.coverage.map(([start,end]) => ({start,end})) };
}
export function decodeReadingRecord(value: Record<string,unknown>): ReadingRecord {
  const ranges=Array.isArray(value.coverage) ? value.coverage : [];
  return { ...value, bookmarks:value.bookmarks || {}, coverage:mergeCoverage(ranges.map(range=>
    Array.isArray(range) ? range as [number,number] : [(range as {start:number}).start,(range as {end:number}).end])) } as ReadingRecord;
}
