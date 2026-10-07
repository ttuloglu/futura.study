/// <reference types="vite/client" />
import type { AppLanguageCode } from './appLanguages';
import type { BookInspirationCatalog } from '../utils/bookInspirations';
import turkish from './bookInspirations/tr.json';

export const TURKISH_BOOK_INSPIRATIONS = turkish as BookInspirationCatalog;
const loaders = import.meta.glob<{ default: BookInspirationCatalog }>('./bookInspirations/*.json');
const pending = new Map<AppLanguageCode, Promise<BookInspirationCatalog>>();
export function loadBookInspirations(language: AppLanguageCode): Promise<BookInspirationCatalog> {
  if (language === 'tr') return Promise.resolve(TURKISH_BOOK_INSPIRATIONS);
  const cached = pending.get(language);
  if (cached) return cached;
  const loader = loaders[`./bookInspirations/${language}.json`];
  if (!loader) return Promise.reject(new Error(`Missing inspiration catalog: ${language}`));
  const request = loader().then(module => module.default as BookInspirationCatalog).catch(error => {
    pending.delete(language);
    throw error;
  });
  pending.set(language, request);
  return request;
}
