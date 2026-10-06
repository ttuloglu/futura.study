import type { BookCreationDraft, IntakeBookType } from './bookCreationIntake';

// One seed list for the existing creation controls and the planning model.
export const BOOK_SUBGENRE_OPTIONS: Record<IntakeBookType, string[]> = {
  fairy_tale: ['Klasik Masal', 'Modern Masal', 'Macera Masalı', 'Eğitici Masal', 'Hayvan Masalları', 'Mitolojik / Fantastik', 'Uyku Masalı', 'Doğa ve Çevre', 'Dostluk Masalı'],
  story: ['Bilimsel', 'Genel Kültür', 'Ders Kitabı', 'Araştırma'],
  novel: ['Dram', 'Romantik', 'Komedi', 'Fantastik', 'Bilimkurgu', 'Gizem / Polisiye', 'Distopya', 'Uzay', 'Macera', 'Korku', 'Gerilim', 'Tarihi', 'Mitolojik', 'Gençlik', 'Süper Kahraman', 'Alternatif Dünya'],
};
export interface BookClassification { bookType: IntakeBookType; genre: string; subGenre: string }
export function taxonomyLabel(value: unknown): string {
  if (typeof value !== 'string') return '';
  const label = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().normalize('NFC');
  if (label.length > 80) throw new Error('Classification label is too long.');
  return label;
}
export function taxonomyKey(value: string): string { return taxonomyLabel(value).toLocaleLowerCase('tr-TR'); }
export function defaultBookTaxonomy(): BookClassification[] {
  return (Object.keys(BOOK_SUBGENRE_OPTIONS) as IntakeBookType[]).flatMap(bookType =>
    BOOK_SUBGENRE_OPTIONS[bookType].map(label => ({ bookType,
      genre: bookType === 'story' ? label : bookType === 'fairy_tale' ? 'Masal' : 'Hikaye',
      subGenre: bookType === 'story' ? '' : label,
    })));
}
export function mergeBookTaxonomy(entries: BookClassification[]): BookClassification[] {
  const catalog = new Map<string, BookClassification>();
  for (const entry of [...defaultBookTaxonomy(), ...entries]) {
    if (!['fairy_tale', 'novel', 'story'].includes(entry.bookType)) continue;
    const genre = taxonomyLabel(entry.genre), subGenre = taxonomyLabel(entry.subGenre);
    if (!genre) continue;
    const key = JSON.stringify([entry.bookType, taxonomyKey(genre), taxonomyKey(subGenre)]);
    if (!catalog.has(key)) catalog.set(key, { bookType: entry.bookType, genre, subGenre });
  }
  return [...catalog.values()];
}
export function canonicalBookClassification(bookType: IntakeBookType, genreValue: unknown, subGenreValue: unknown, entries: BookClassification[] = []): BookClassification {
  const catalog = mergeBookTaxonomy(entries).filter(entry => entry.bookType === bookType);
  let genre = bookType === 'story' ? taxonomyLabel(genreValue) : bookType === 'fairy_tale' ? 'Masal' : 'Hikaye';
  let subGenre = taxonomyLabel(subGenreValue);
  if (!genre || !subGenre) throw new Error('Missing book genre or subgenre.');
  const knownGenre = catalog.find(entry => taxonomyKey(entry.genre) === taxonomyKey(genre));
  if (knownGenre) genre = knownGenre.genre;
  const known = catalog.find(entry => taxonomyKey(entry.genre) === taxonomyKey(genre) && taxonomyKey(entry.subGenre) === taxonomyKey(subGenre));
  if (known) subGenre = known.subGenre;
  return { bookType, genre, subGenre };
}
export function classificationFromDraft(draft: BookCreationDraft): BookClassification {
  return canonicalBookClassification(draft.creativeBrief.bookType, draft.creativeBrief.workbookCategory, draft.creativeBrief.subGenre);
}
