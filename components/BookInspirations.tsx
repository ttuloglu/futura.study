import React, { useEffect, useId, useRef, useState } from 'react';
import { useUiI18n } from '../i18n/uiI18n';
import FloatIslandSheet from './FloatIslandSheet';
import FaviconSpinner from './FaviconSpinner';
import { loadBookInspirations, TURKISH_BOOK_INSPIRATIONS } from '../data/bookInspirations';
import { sampleBookInspirations, type BookInspiration, type BookInspirationCatalog, type BookInspirationCategory } from '../utils/bookInspirations';

// These controls remain localized even while the larger literary catalog is loading.
const controls = {
  tr: ['Tümünü gör', 'İlhamlar', 'Tekrar dene'], en: ['See all', 'Inspiration', 'Try again'],
  ar: ['عرض الكل', 'أفكار ملهمة', 'حاول مجددًا'], da: ['Se alle', 'Inspiration', 'Prøv igen'],
  de: ['Alle ansehen', 'Inspiration', 'Erneut versuchen'], el: ['Προβολή όλων', 'Έμπνευση', 'Δοκιμάστε ξανά'],
  es: ['Ver todas', 'Inspiración', 'Reintentar'], fi: ['Näytä kaikki', 'Inspiraatio', 'Yritä uudelleen'],
  fr: ['Tout voir', 'Inspirations', 'Réessayer'], hi: ['सभी देखें', 'प्रेरणा', 'फिर कोशिश करें'],
  id: ['Lihat semua', 'Inspirasi', 'Coba lagi'], it: ['Vedi tutte', 'Ispirazioni', 'Riprova'],
  ja: ['すべて見る', 'インスピレーション', '再試行'], ko: ['모두 보기', '영감', '다시 시도'],
  nl: ['Alles bekijken', 'Inspiratie', 'Opnieuw proberen'], no: ['Se alle', 'Inspirasjon', 'Prøv igjen'],
  pl: ['Zobacz wszystkie', 'Inspiracje', 'Spróbuj ponownie'], 'pt-BR': ['Ver todas', 'Inspiração', 'Tentar novamente'],
  sv: ['Visa alla', 'Inspiration', 'Försök igen'], th: ['ดูทั้งหมด', 'แรงบันดาลใจ', 'ลองอีกครั้ง'],
} as const;

export default function BookInspirations({ category, isOpen, disabled, onSelect, onBrowseChange }: {
  category: BookInspirationCategory;
  isOpen: boolean;
  disabled: boolean;
  onSelect: (inspiration: BookInspiration) => void;
  onBrowseChange: (open: boolean) => void;
}) {
  const { language } = useUiI18n();
  const headingId = useId();
  const [catalog, setCatalog] = useState<{ language: string; data: BookInspirationCatalog } | null>(
    language === 'tr' ? { language, data: TURKISH_BOOK_INSPIRATIONS } : null,
  );
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [suggestionIds, setSuggestionIds] = useState<string[]>([]);
  const sampledCategory = useRef<BookInspirationCategory | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const allRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const ready = catalog?.language === language ? catalog.data : null;
  const [allLabel, title, retryLabel] = controls[language];

  useEffect(() => {
    let active = true;
    setFailed(false);
    void loadBookInspirations(language).then(data => {
      if (active) setCatalog({ language, data });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [language, retry]);
  useEffect(() => {
    if (!isOpen) { sampledCategory.current = null; return; }
    // StrictMode replays effects; an opening must consume exactly one trio.
    if (sampledCategory.current === category) return;
    sampledCategory.current = category;
    const key = `fortale-inspirations-last:${category}`;
    let previous: string[] = [];
    try { const saved = JSON.parse(sessionStorage.getItem(key) || '[]'); if (Array.isArray(saved)) previous = saved; } catch { /* Suggestions work without storage. */ }
    const ids = sampleBookInspirations(TURKISH_BOOK_INSPIRATIONS.entries, category, previous);
    setSuggestionIds(ids);
    try { sessionStorage.setItem(key, JSON.stringify(ids)); } catch { /* Private browsing may disable storage. */ }
  }, [isOpen, category]);
  useEffect(() => {
    onBrowseChange(browsing);
    return () => onBrowseChange(false);
  }, [browsing, onBrowseChange]);
  useEffect(() => {
    if (!isOpen || disabled) setBrowsing(false);
  }, [isOpen, disabled]);
  useEffect(() => {
    if (!browsing) return;
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const buttons = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [browsing]);

  const close = () => { onBrowseChange(false); setBrowsing(false); requestAnimationFrame(() => allRef.current?.focus({ preventScroll: true })); };
  const select = (inspiration: BookInspiration) => { onBrowseChange(false); setBrowsing(false); onSelect(inspiration); };
  const suggestions = ready ? suggestionIds.map(id => ready.entries.find(entry => entry.id === id)).filter((entry): entry is BookInspiration => Boolean(entry)) : [];
  const all = ready?.entries.filter(entry => entry.category === category) || [];
  const row = (entry: BookInspiration, first = false) => <button type="button" key={entry.id}
    ref={first ? firstRef : undefined} className="fortale-inspiration-row" disabled={disabled} onClick={() => select(entry)}>
    <span className="fortale-inspiration-dot" aria-hidden="true" /><span>{entry.label}</span>
  </button>;

  return <>
    <section className="fortale-book-inspirations" aria-labelledby={headingId} data-no-ui-translate="true" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <button ref={allRef} id={headingId} type="button" className="fortale-inspirations-all" onClick={() => { (document.activeElement as HTMLElement | null)?.blur?.(); onBrowseChange(true); setBrowsing(true); }} disabled={disabled || !ready}
        aria-haspopup="dialog" aria-expanded={browsing}>{allLabel}</button>
      <div className="fortale-inspiration-suggestions" aria-busy={!ready && !failed}>
        {suggestions.map(entry => row(entry))}
        {!ready && !failed && [0, 1, 2].map(index => <div key={index} className="fortale-inspiration-skeleton" aria-hidden="true"><span className="fortale-inspiration-dot"/><span/></div>)}
        {failed && <button type="button" className="fortale-inspirations-retry" onClick={() => setRetry(value => value + 1)}>{retryLabel}</button>}
      </div>
    </section>
    <FloatIslandSheet isOpen={browsing} onClose={close} title={<span data-no-ui-translate="true">{title}</span>}
      layer={1100} maxWidth={560} panelRef={panelRef} initialFocusRef={firstRef}
      panelClassName="fortale-inspirations-sheet" bodyClassName="fortale-inspirations-list">
      <div data-no-ui-translate="true" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        {ready ? all.map((entry, index) => row(entry, index === 0)) : <FaviconSpinner size={24}/>}
      </div>
    </FloatIslandSheet>
  </>;
}
