import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, BookOpen, Tag, ChevronDown, X, Heart, SlidersHorizontal, Check, CalendarDays, Share2, LayoutGrid, List } from 'lucide-react';
import { CourseData } from '../types';
import { deriveCategoryFromCourse } from '../utils/smartbookCategories';
import { getSmartBookAgeGroupLabel } from '../utils/smartbookAgeGroup';
import { SMARTBOOK_SUBGENRE_OPTIONS } from '../utils/bookGeneration';
import { useUiI18n } from '../i18n/uiI18n';

interface ExploreViewProps {
  savedCourses: CourseData[];
  publicCourses: CourseData[];
  onCourseSelect: (id: string) => void;
  onShareCourse: (course: CourseData) => void | Promise<void>;
  likedCourseIds: string[];
  onToggleCourseLike: (id: string) => void;
}

function topicHue(topic: string): number {
  return Math.abs(topic.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0)) % 360;
}

function topicSeed(topic: string, id?: string): number {
  const source = `${id || ''}:${topic || ''}`;
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 33 + source.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getLibraryLikeCount(course: CourseData, isLiked: boolean): number {
  const base = 24 + (topicSeed(course.topic, course.id) % 742);
  return base + (isLiked ? 1 : 0);
}

function formatLikeCount(count: number): string {
  if (count >= 1000) {
    const compact = Math.round(count / 100) / 10;
    return `${compact}k`;
  }
  return `${count}`;
}

function formatCreatedDateLabel(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(date));
}

function bookTypeLabel(bookType?: CourseData['bookType']): string {
  if (bookType === 'fairy_tale') return 'Masal';
  if (bookType === 'story') return 'Hikaye';
  if (bookType === 'novel') return 'Roman';
  return 'Akademik';
}

function minimumPageCountForBookType(bookType?: CourseData['bookType']): number {
  if (bookType === 'fairy_tale') return 10;
  if (bookType === 'story') return 20;
  if (bookType === 'novel') return 30;
  return 10;
}

function estimatePageCount(course: CourseData): number {
  const minimumPageCount = minimumPageCountForBookType(course.bookType);
  if (Number.isFinite(course.targetPageCount)) {
    return Math.max(minimumPageCount, Math.floor(course.targetPageCount as number));
  }
  const textWords = course.nodes.reduce((sum, node) => {
    const content = `${node.content || ''} ${node.podcastScript || ''}`.trim();
    if (!content) return sum;
    return sum + content.split(/\s+/).filter(Boolean).length;
  }, 0);
  if (textWords > 0) return Math.max(minimumPageCount, Math.round(textWords / 180));
  return Math.max(minimumPageCount, course.nodes.length * 6);
}

function getLibraryReadCount(course: CourseData): number {
  const base = 180 + (topicSeed(course.topic, course.id) % 3200);
  const completed = course.nodes.filter((node) => node.status === 'completed').length;
  return base + completed * 17;
}

type LibraryLanguageCode =
  | 'tr'
  | 'en'
  | 'es'
  | 'zh'
  | 'ja'
  | 'ko'
  | 'ar'
  | 'ru'
  | 'fr'
  | 'de'
  | 'pt'
  | 'it'
  | 'unknown';

type SearchLanguageValue = Exclude<LibraryLanguageCode, 'unknown'> | 'all';
type LibrarySortMode = 'latest' | 'likes' | 'titleAsc';

const LANGUAGE_LABELS: Record<Exclude<LibraryLanguageCode, 'unknown'>, string> = {
  tr: 'Türkçe',
  en: 'English',
  es: 'Español',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  ar: 'العربية',
  ru: 'Русский',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  it: 'Italiano'
};

function detectLikelyLanguage(value: string): LibraryLanguageCode {
  const raw = String(value || '').trim();
  if (!raw) return 'unknown';

  if (/[\u4E00-\u9FFF]/.test(raw)) return 'zh';
  if (/[\u3040-\u30FF]/.test(raw)) return 'ja';
  if (/[\uAC00-\uD7AF]/.test(raw)) return 'ko';
  if (/[\u0600-\u06FF]/.test(raw)) return 'ar';
  if (/[\u0400-\u04FF]/.test(raw)) return 'ru';

  const text = raw.toLocaleLowerCase('tr-TR').trim();
  if (!text) return 'unknown';
  const trChars = (text.match(/[çğıöşüı]/g) || []).length;
  const trHits = (text.match(/\b(ve|ile|için|konu|ders|öğrenme|temelleri|nedir|nasıl|özeti)\b/g) || []).length;
  const esChars = (text.match(/[ñáéíóúü]/g) || []).length;
  const esHits = (text.match(/\b(de|la|el|los|las|para|con|como|qué|introduccion|fundamentos|servicios|datos)\b/g) || []).length;
  const frChars = (text.match(/[àâçéèêëîïôûùüÿœ]/g) || []).length;
  const frHits = (text.match(/\b(le|la|les|des|pour|avec|bonjour|introduction|bases)\b/g) || []).length;
  const deChars = (text.match(/[äöüß]/g) || []).length;
  const deHits = (text.match(/\b(und|mit|für|einführung|grundlagen|daten)\b/g) || []).length;
  const ptChars = (text.match(/[ãõáàâêéíóôúç]/g) || []).length;
  const ptHits = (text.match(/\b(de|para|com|introducao|fundamentos|dados)\b/g) || []).length;
  const itHits = (text.match(/\b(di|con|per|introduzione|fondamenti|dati)\b/g) || []).length;
  const enHits = (text.match(/\b(and|with|for|topic|lesson|learning|basics|what|how|introduction|data)\b/g) || []).length;

  if (trChars > 0 || trHits > Math.max(enHits, esHits, frHits, deHits, ptHits, itHits)) return 'tr';
  if (esChars > 0 || esHits > Math.max(enHits, trHits, frHits, deHits, ptHits, itHits)) return 'es';
  if (frChars > 0 || frHits > Math.max(enHits, trHits, esHits, deHits, ptHits, itHits)) return 'fr';
  if (deChars > 0 || deHits > Math.max(enHits, trHits, esHits, frHits, ptHits, itHits)) return 'de';
  if (ptChars > 0 || ptHits > Math.max(enHits, trHits, esHits, frHits, deHits, itHits)) return 'pt';
  if (itHits > Math.max(enHits, trHits, esHits, frHits, deHits, ptHits) && itHits > 0) return 'it';
  if (/[a-z]/.test(text)) return 'en';
  return 'unknown';
}

function normalizeStoredLanguageCode(value: unknown): LibraryLanguageCode {
  const raw = String(value || '').trim().toLowerCase();
  const allowed = new Set<LibraryLanguageCode>([
    'tr', 'en', 'es', 'zh', 'ja', 'ko', 'ar', 'ru', 'fr', 'de', 'pt', 'it', 'unknown'
  ]);
  return allowed.has(raw as LibraryLanguageCode) ? (raw as LibraryLanguageCode) : 'unknown';
}

function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ğüşıöç\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function searchTokenOverlapScore(query: string, candidate: string): number {
  const queryTokens = new Set(query.split(' ').filter((token) => token.length >= 2));
  const candidateTokens = new Set(candidate.split(' ').filter((token) => token.length >= 2));
  if (queryTokens.size === 0 || candidateTokens.size === 0) return 0;

  let overlap = 0;
  queryTokens.forEach((token) => {
    if (candidateTokens.has(token)) overlap += 1;
  });

  return overlap / Math.max(queryTokens.size, candidateTokens.size);
}

function sanitizeSmartBookDescriptionText(value: string): string {
  return String(value || '')
    .replace(/\bSmartBook\s+çalışma\s+akışı\b/gi, 'SmartBook içeriği')
    .replace(/\bSmartBook\s+study\s+flow\b/gi, 'SmartBook content')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveRealCategoryFromCourse(course: CourseData): string {
  return deriveCategoryFromCourse(course);
}

export default function ExploreView({
  savedCourses,
  publicCourses,
  onCourseSelect,
  onShareCourse,
  likedCourseIds,
  onToggleCourseLike
}: ExploreViewProps) {
  const { locale, t } = useUiI18n();
  const [libraryViewMode, setLibraryViewMode] = useState<'shelf' | 'list'>('shelf');
  const [searchText, setSearchText] = useState('');
  const [searchLanguage, setSearchLanguage] = useState<SearchLanguageValue | ''>('');
  const [appliedSearchText, setAppliedSearchText] = useState('');
  const [appliedSearchLanguage, setAppliedSearchLanguage] = useState<SearchLanguageValue | ''>('');
  const [ageFilter, setAgeFilter] = useState<'all' | '7_11' | '12_18' | 'general'>('all');
  const [bookTypeFilter, setBookTypeFilter] = useState<'all' | 'fairy_tale' | 'story' | 'novel'>('all');
  const [subGenreFilter, setSubGenreFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<LibrarySortMode>('latest');
  const [isAgeFilterMenuOpen, setIsAgeFilterMenuOpen] = useState(false);
  const [isBookTypeFilterMenuOpen, setIsBookTypeFilterMenuOpen] = useState(false);
  const [isSubGenreFilterMenuOpen, setIsSubGenreFilterMenuOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<CourseData | null>(null);
  const ageFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const bookTypeFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const subGenreFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedCourse) return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedCourse(null);
    };

    body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    return () => {
      body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [selectedCourse]);

  useEffect(() => {
    if (!isLanguageMenuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (languageMenuRef.current?.contains(target)) return;
      setIsLanguageMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isLanguageMenuOpen]);

  useEffect(() => {
    if (!isSortMenuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (sortMenuRef.current?.contains(target)) return;
      setIsSortMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isSortMenuOpen]);

  useEffect(() => {
    if (!isAgeFilterMenuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (ageFilterMenuRef.current?.contains(target)) return;
      setIsAgeFilterMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isAgeFilterMenuOpen]);

  useEffect(() => {
    if (!isBookTypeFilterMenuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (bookTypeFilterMenuRef.current?.contains(target)) return;
      setIsBookTypeFilterMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isBookTypeFilterMenuOpen]);

  useEffect(() => {
    if (!isSubGenreFilterMenuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (subGenreFilterMenuRef.current?.contains(target)) return;
      setIsSubGenreFilterMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isSubGenreFilterMenuOpen]);

  const sortedCourses = useMemo(() => {
    const byId = new Map<string, CourseData>();
    [...publicCourses, ...savedCourses].forEach((course) => {
      byId.set(course.id, course);
    });
    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
  }, [publicCourses, savedCourses]);

  const likedCourseIdSet = useMemo(() => new Set(likedCourseIds), [likedCourseIds]);

  const getProgress = (course: CourseData) => {
    const completed = course.nodes.filter((n) => n.status === 'completed').length;
    const raw = course.nodes.length > 0 ? Math.round((completed / course.nodes.length) * 100) : 0;
    return Math.min(100, Math.max(0, raw));
  };

  const getCourseDescription = (course: CourseData) => {
    if (course.description?.trim()) return sanitizeSmartBookDescriptionText(course.description);
    const lectureNode = course.nodes.find((node) => node.type === 'lecture' && node.description?.trim());
    const firstNodeWithDescription = course.nodes.find((node) => node.description?.trim());
    return sanitizeSmartBookDescriptionText(
      lectureNode?.description?.trim() ||
      firstNodeWithDescription?.description?.trim() ||
      'Bu SmartBook için açıklama henüz eklenmedi.'
    );
  };

  const getEstimatedStudyDuration = (course: CourseData) => {
    if (course.totalDuration?.trim()) {
      const raw = course.totalDuration.trim().toLocaleLowerCase('tr-TR');
      let totalMinutes = 0;
      let foundUnit = false;

      for (const match of raw.matchAll(/(\d+(?:[.,]\d+)?)\s*(saat|hour|hours|hr|h)\b/g)) {
        const value = Number.parseFloat((match[1] || '0').replace(',', '.'));
        if (Number.isFinite(value) && value > 0) {
          totalMinutes += Math.round(value * 60);
          foundUnit = true;
        }
      }
      for (const match of raw.matchAll(/(\d+)\s*(dk|dakika|min|mins|minute|minutes)\b/g)) {
        const value = Number.parseInt(match[1] || '0', 10);
        if (Number.isFinite(value) && value > 0) {
          totalMinutes += value;
          foundUnit = true;
        }
      }
      for (const match of raw.matchAll(/(\d+)\s*(sn|saniye|sec|secs|second|seconds)\b/g)) {
        const value = Number.parseInt(match[1] || '0', 10);
        if (Number.isFinite(value) && value > 0) {
          totalMinutes += Math.max(1, Math.round(value / 60));
          foundUnit = true;
        }
      }

      if (!foundUnit) {
        const firstNumber = Number.parseInt((raw.match(/\d+/) || [])[0] || '0', 10);
        if (Number.isFinite(firstNumber) && firstNumber > 0) {
          totalMinutes = firstNumber;
        }
      }

      if (totalMinutes > 0) {
        return `${Math.max(1, totalMinutes)} dk`;
      }
    }

    const totalMinutes = course.nodes.reduce((sum, node) => {
      const match = String(node.duration || '').match(/\d+/);
      return sum + (match ? Number.parseInt(match[0], 10) : 0);
    }, 0);

    const normalizedMinutes = totalMinutes > 0 ? totalMinutes : Math.max(10, course.nodes.length * 8);
    return `${Math.max(1, normalizedMinutes)} dk`;
  };

  const languageOptions = useMemo(() => {
    const found = new Set<Exclude<LibraryLanguageCode, 'unknown'>>();
    sortedCourses.forEach((course) => {
      const lectureNode = course.nodes.find((node) => node.type === 'lecture' && node.description?.trim());
      const probeText = `${course.topic} ${course.category || ''} ${course.description || ''} ${lectureNode?.description || ''}`.trim();
      const storedCode = normalizeStoredLanguageCode(course.language);
      const code = storedCode !== 'unknown' ? storedCode : detectLikelyLanguage(probeText);
      if (code !== 'unknown') {
        found.add(code);
      }
    });

    const preferredOrder: Array<Exclude<LibraryLanguageCode, 'unknown'>> = [
      'tr', 'en', 'es', 'zh', 'ja', 'ko', 'fr', 'de', 'pt', 'it', 'ar', 'ru'
    ];

    return preferredOrder
      .filter((code) => found.has(code))
      .map((code) => ({ code, label: LANGUAGE_LABELS[code] }));
  }, [sortedCourses]);

  const searchLanguageOptions = useMemo(
    () => [{ code: 'all' as const, label: t('Tüm Diller') }, ...languageOptions],
    [languageOptions]
  );

  const canRunSearch = Boolean(searchText.trim());
  const hasSearchState = Boolean(
    searchText.trim() ||
    searchLanguage ||
    appliedSearchText.trim() ||
    appliedSearchLanguage ||
    ageFilter !== 'all' ||
    bookTypeFilter !== 'all' ||
    subGenreFilter !== 'all'
  );
  const hasCascadeFilterSelection = ageFilter !== 'all' || bookTypeFilter !== 'all' || subGenreFilter !== 'all';
  const selectedLanguageLabel =
    searchLanguage === 'all'
      ? t('Tüm Diller')
      : searchLanguage
        ? LANGUAGE_LABELS[searchLanguage]
        : '';

  const ageFilterOptions = useMemo(
    () => [
      { value: 'all' as const, label: 'Tüm Yaşlar' },
      { value: '7_11' as const, label: getSmartBookAgeGroupLabel('7_11') },
      { value: '12_18' as const, label: getSmartBookAgeGroupLabel('12_18') },
      { value: 'general' as const, label: getSmartBookAgeGroupLabel('general') }
    ],
    []
  );

  const bookTypeFilterOptions = useMemo(
    () => [
      { value: 'all' as const, label: 'Tüm Türler' },
      { value: 'novel' as const, label: 'Roman' },
      { value: 'story' as const, label: 'Hikaye' },
      { value: 'fairy_tale' as const, label: 'Masal' }
    ],
    []
  );

  const selectedAgeFilterLabel =
    ageFilterOptions.find((option) => option.value === ageFilter)?.label || 'Yaş Grubu';
  const selectedBookTypeFilterLabel =
    bookTypeFilterOptions.find((option) => option.value === bookTypeFilter)?.label || 'Tür';
  const selectedSubGenreFilterLabel = subGenreFilter === 'all' ? 'Alt Tür' : subGenreFilter;

  const subGenreOptions = useMemo(() => {
    const set = new Set<string>();
    const addGenre = (value: unknown) => {
      if (typeof value !== 'string') return;
      const normalized = value.trim();
      if (!normalized) return;
      set.add(normalized);
    };

    if (bookTypeFilter === 'all') {
      Object.values(SMARTBOOK_SUBGENRE_OPTIONS).forEach((items) => items.forEach(addGenre));
      sortedCourses.forEach((course) => addGenre(course.subGenre));
    } else {
      (SMARTBOOK_SUBGENRE_OPTIONS[bookTypeFilter] || []).forEach(addGenre);
      sortedCourses
        .filter((course) => (course.bookType || 'novel') === bookTypeFilter)
        .forEach((course) => addGenre(course.subGenre));
    }

    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'))];
  }, [bookTypeFilter, sortedCourses]);

  useEffect(() => {
    if (subGenreFilter === 'all') return;
    if (subGenreOptions.includes(subGenreFilter)) return;
    setSubGenreFilter('all');
  }, [subGenreFilter, subGenreOptions]);

  const filteredCourses = useMemo(() => {
    const normalizedQuery = normalizeSearchText(appliedSearchText);
    return sortedCourses.filter((course) => {
      const normalizedAge = (course.ageGroup || 'general') as '7_11' | '12_18' | 'general';
      if (ageFilter !== 'all' && normalizedAge !== ageFilter) return false;

      const normalizedBookType = (course.bookType || 'novel') as 'fairy_tale' | 'story' | 'novel';
      if (bookTypeFilter !== 'all' && normalizedBookType !== bookTypeFilter) return false;

      if (subGenreFilter !== 'all') {
        const courseSubGenre = String(course.subGenre || '').trim();
        if (!courseSubGenre || courseSubGenre !== subGenreFilter) return false;
      }

      const description = getCourseDescription(course);
      if (appliedSearchLanguage && appliedSearchLanguage !== 'all') {
        const storedLang = normalizeStoredLanguageCode(course.language);
        const langProbe = `${course.topic || ''} ${description}`;
        const lang = storedLang !== 'unknown' ? storedLang : detectLikelyLanguage(langProbe);
        if (lang !== 'unknown' && lang !== appliedSearchLanguage) return false;
      }

      if (!normalizedQuery) return true;

      const displayCategory = deriveRealCategoryFromCourse(course);
      const haystack = normalizeSearchText(
        `${course.topic} ${description} ${displayCategory} ${Array.isArray(course.searchTags) ? course.searchTags.join(' ') : ''}`
      );
      if (haystack.includes(normalizedQuery)) return true;
      return searchTokenOverlapScore(normalizedQuery, haystack) > 0;
    });
  }, [ageFilter, appliedSearchLanguage, appliedSearchText, bookTypeFilter, sortedCourses, subGenreFilter]);

  const displayCourses = useMemo(() => {
    const next = [...filteredCourses];

    next.sort((a, b) => {
      if (sortMode === 'titleAsc') {
        const byTitle = a.topic.localeCompare(b.topic, 'tr');
        if (byTitle !== 0) return byTitle;
      } else if (sortMode === 'likes') {
        const aLikes = getLibraryLikeCount(a, likedCourseIdSet.has(a.id));
        const bLikes = getLibraryLikeCount(b, likedCourseIdSet.has(b.id));
        if (bLikes !== aLikes) return bLikes - aLikes;
      } else {
        const aCreatedMs = new Date(a.createdAt).getTime();
        const bCreatedMs = new Date(b.createdAt).getTime();
        const aTime = Number.isFinite(aCreatedMs) ? aCreatedMs : new Date(a.lastActivity).getTime();
        const bTime = Number.isFinite(bCreatedMs) ? bCreatedMs : new Date(b.lastActivity).getTime();
        if (bTime !== aTime) return bTime - aTime;
      }

      const byLastActivity = new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
      if (byLastActivity !== 0) return byLastActivity;
      return a.topic.localeCompare(b.topic, 'tr');
    });

    return next;
  }, [filteredCourses, likedCourseIdSet, sortMode]);

  const shelfRows = useMemo(() => {
    const rows: CourseData[][] = [];
    for (let i = 0; i < displayCourses.length; i += 2) {
      rows.push(displayCourses.slice(i, i + 2));
    }
    return rows;
  }, [displayCourses]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canRunSearch) return;
    setAppliedSearchText(searchText.trim());
    setAppliedSearchLanguage(searchLanguage);
  };

  const clearSearchResults = () => {
    setSearchText('');
    setSearchLanguage('');
    setAppliedSearchText('');
    setAppliedSearchLanguage('');
    setAgeFilter('all');
    setBookTypeFilter('all');
    setSubGenreFilter('all');
    setIsAgeFilterMenuOpen(false);
    setIsBookTypeFilterMenuOpen(false);
    setIsSubGenreFilterMenuOpen(false);
    setIsLanguageMenuOpen(false);
    setIsSortMenuOpen(false);
  };

  return (
    <div className="view-container">
      <div className="app-content-width space-y-6 pb-24">

        <header>
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Search size={14} className="text-[#86a9d4]" />
              </div>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Kitap ara"
                className={`explore-library-search-input w-full h-11 pl-9 ${hasSearchState ? 'pr-[134px]' : 'pr-[96px]'} rounded-2xl text-[12px] font-medium text-white placeholder:text-zinc-500 focus:outline-none`}
                style={{
                  background: 'rgba(17, 22, 29, 0.9)',
                  boxShadow: 'inset 0 0 0 1px rgba(86,133,190,0.24)'
                }}
              />

              <div ref={languageMenuRef} className="absolute right-1.5 top-1.5 z-10">
                <button
                  type="button"
                  onClick={() => {
                    if (searchLanguageOptions.length === 0) return;
                    setIsLanguageMenuOpen((prev) => !prev);
                    setIsAgeFilterMenuOpen(false);
                    setIsBookTypeFilterMenuOpen(false);
                    setIsSubGenreFilterMenuOpen(false);
                    setIsSortMenuOpen(false);
                  }}
                  className={`h-8 min-w-[82px] max-w-[104px] px-2.5 rounded-xl border border-dashed text-[10px] font-semibold focus:outline-none inline-flex items-center justify-between gap-1.5 ${searchLanguageOptions.length > 0 ? 'text-[#dcecff]' : 'text-[#7f95b3]'
                    }`}
                  style={{
                    background: 'rgba(17, 22, 29, 0.92)',
                    borderColor: 'rgba(86,133,190,0.24)'
                  }}
                  aria-label="Dil seç"
                  aria-haspopup="listbox"
                  aria-expanded={isLanguageMenuOpen}
                  disabled={searchLanguageOptions.length === 0}
                >
                  <span className="truncate">
                    {selectedLanguageLabel || (searchLanguageOptions.length > 0 ? 'Dil' : 'Dil yok')}
                  </span>
                  <ChevronDown
                    size={11}
                    className={`shrink-0 transition-transform ${isLanguageMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isLanguageMenuOpen && searchLanguageOptions.length > 0 && (
                  <div
                    role="listbox"
                    aria-label="Dil seçenekleri"
                    className="absolute top-full right-0 mt-2 z-20 min-w-[120px] rounded-2xl border border-dashed p-1 shadow-[0_12px_24px_-18px_rgba(0,0,0,0.75)]"
                    style={{
                      background: 'rgba(17, 22, 29, 0.9)',
                      borderColor: 'rgba(86,133,190,0.24)'
                    }}
                  >
                    {searchLanguageOptions.map((option) => {
                      const isSelected = searchLanguage === option.code;
                      return (
                        <button
                          key={option.code}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setSearchLanguage(option.code);
                            setIsLanguageMenuOpen(false);
                          }}
                          className={`w-full h-9 px-2 rounded-lg text-left text-[11px] font-semibold transition-colors border border-dashed ${isSelected
                              ? 'bg-[rgba(23,38,58,0.72)] border-[#8fb6e6]/28 text-[#dcecff]'
                              : 'border-transparent text-[#d3e4f8] hover:bg-[rgba(23,38,58,0.5)]'
                            }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {hasSearchState && (
                <button
                  type="button"
                  onClick={clearSearchResults}
                  className="absolute inset-y-0 right-[90px] my-auto h-8 w-8 rounded-lg inline-flex items-center justify-center text-[#9fb8d8] hover:bg-[rgba(23,38,58,0.45)] active:scale-95 transition-all z-10"
                  aria-label="Sonuçları temizle"
                  title="Sonuçları temizle"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={!canRunSearch}
              className={`h-11 px-4 rounded-2xl border border-dashed text-[11px] font-bold transition-all ${canRunSearch
                  ? 'text-[#dcecff] active:scale-95'
                  : 'text-[#7f95b3] opacity-60 cursor-not-allowed'
                }`}
              style={{
                background: 'rgba(17, 22, 29, 0.9)',
                borderColor: canRunSearch ? 'rgba(86,133,190,0.24)' : 'rgba(86,133,190,0.14)'
              }}
            >
              Ara
            </button>

            <button
              type="button"
              onClick={() => setLibraryViewMode((prev) => (prev === 'shelf' ? 'list' : 'shelf'))}
              className="h-11 w-11 rounded-2xl border border-dashed inline-flex items-center justify-center text-[#dcecff] active:scale-95 transition-all"
              style={{
                background: 'rgba(17, 22, 29, 0.9)',
                borderColor: 'rgba(86,133,190,0.24)'
              }}
              aria-label={libraryViewMode === 'shelf' ? 'Liste görünümüne geç' : 'Raf görünümüne geç'}
              title={libraryViewMode === 'shelf' ? 'Liste görünümü' : 'Raf görünümü'}
            >
              {libraryViewMode === 'shelf' ? <List size={14} /> : <LayoutGrid size={14} />}
            </button>

          </form>
        </header>

        <section>
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2">
            <div ref={sortMenuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsAgeFilterMenuOpen(false);
                  setIsBookTypeFilterMenuOpen(false);
                  setIsSubGenreFilterMenuOpen(false);
                  setIsLanguageMenuOpen(false);
                  setIsSortMenuOpen((prev) => !prev);
                }}
                className="h-10 w-10 rounded-2xl border border-dashed inline-flex items-center justify-center text-[#dcecff] active:scale-95 transition-all"
                style={{
                  background: 'rgba(17, 22, 29, 0.9)',
                  borderColor: 'rgba(86,133,190,0.24)'
                }}
                aria-label="Sıralama filtreleri"
                title="Sıralama"
                aria-haspopup="menu"
                aria-expanded={isSortMenuOpen}
              >
                <SlidersHorizontal size={14} />
              </button>

              {isSortMenuOpen && (
                <div
                  role="menu"
                  aria-label="Kütüphane sıralama"
                  className="absolute top-full left-0 mt-2 z-20 w-[170px] rounded-2xl border border-dashed p-1 shadow-[0_12px_24px_-18px_rgba(0,0,0,0.75)]"
                  style={{
                    background: 'rgba(17, 22, 29, 0.94)',
                    borderColor: 'rgba(86,133,190,0.24)'
                  }}
                >
                  {([
                    { value: 'titleAsc', label: 'A > Z' },
                    { value: 'likes', label: 'Beğenilenler' },
                    { value: 'latest', label: 'Son Çıkanlar' }
                  ] as const).map((option) => {
                    const selected = sortMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        onClick={() => {
                          setSortMode(option.value);
                          setIsSortMenuOpen(false);
                        }}
                        className={`w-full h-9 px-2 rounded-lg text-left text-[11px] font-semibold transition-colors border border-dashed inline-flex items-center justify-between ${selected
                            ? 'text-[#dcecff] bg-[rgba(23,38,58,0.66)]'
                            : 'border-transparent text-[#d3e4f8] hover:bg-[rgba(23,38,58,0.45)]'
                          }`}
                        style={{ borderColor: selected ? 'rgba(86,133,190,0.24)' : undefined }}
                      >
                        <span>{option.label}</span>
                        {selected ? <Check size={12} className="text-[#8fb6e6]" /> : <span className="w-3" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div ref={ageFilterMenuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsAgeFilterMenuOpen((prev) => !prev);
                  setIsBookTypeFilterMenuOpen(false);
                  setIsSubGenreFilterMenuOpen(false);
                  setIsLanguageMenuOpen(false);
                  setIsSortMenuOpen(false);
                }}
                className="h-10 w-full px-2 rounded-2xl border border-dashed border-[#58769c]/45 bg-[#131b27] text-[10px] font-semibold text-[#dcecff] focus:outline-none inline-flex items-center justify-between gap-1.5"
                aria-label="Yaş grubu filtresi"
                aria-haspopup="listbox"
                aria-expanded={isAgeFilterMenuOpen}
              >
                <span className="truncate">{selectedAgeFilterLabel}</span>
                <ChevronDown size={11} className={`shrink-0 transition-transform ${isAgeFilterMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isAgeFilterMenuOpen && (
                <div
                  role="listbox"
                  aria-label="Yaş grubu seçenekleri"
                  className="absolute top-full left-0 mt-2 z-20 min-w-[120px] rounded-2xl border border-dashed p-1 shadow-[0_12px_24px_-18px_rgba(0,0,0,0.75)]"
                  style={{
                    background: 'rgba(17, 22, 29, 0.94)',
                    borderColor: 'rgba(86,133,190,0.24)'
                  }}
                >
                  {ageFilterOptions.map((option) => {
                    const isSelected = ageFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setAgeFilter(option.value);
                          setIsAgeFilterMenuOpen(false);
                        }}
                        className={`w-full h-9 px-2 rounded-lg text-left text-[10px] font-semibold transition-colors border border-dashed ${isSelected
                            ? 'bg-[rgba(23,38,58,0.72)] border-[#8fb6e6]/28 text-[#dcecff]'
                            : 'border-transparent text-[#d3e4f8] hover:bg-[rgba(23,38,58,0.5)]'
                          }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div ref={bookTypeFilterMenuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsBookTypeFilterMenuOpen((prev) => !prev);
                  setIsAgeFilterMenuOpen(false);
                  setIsSubGenreFilterMenuOpen(false);
                  setIsLanguageMenuOpen(false);
                  setIsSortMenuOpen(false);
                }}
                className="h-10 w-full px-2 rounded-2xl border border-dashed border-[#58769c]/45 bg-[#131b27] text-[10px] font-semibold text-[#dcecff] focus:outline-none inline-flex items-center justify-between gap-1.5"
                aria-label="Tür filtresi"
                aria-haspopup="listbox"
                aria-expanded={isBookTypeFilterMenuOpen}
              >
                <span className="truncate">{selectedBookTypeFilterLabel}</span>
                <ChevronDown size={11} className={`shrink-0 transition-transform ${isBookTypeFilterMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isBookTypeFilterMenuOpen && (
                <div
                  role="listbox"
                  aria-label="Tür seçenekleri"
                  className="absolute top-full left-0 mt-2 z-20 min-w-[120px] rounded-2xl border border-dashed p-1 shadow-[0_12px_24px_-18px_rgba(0,0,0,0.75)]"
                  style={{
                    background: 'rgba(17, 22, 29, 0.94)',
                    borderColor: 'rgba(86,133,190,0.24)'
                  }}
                >
                  {bookTypeFilterOptions.map((option) => {
                    const isSelected = bookTypeFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setBookTypeFilter(option.value);
                          setIsBookTypeFilterMenuOpen(false);
                        }}
                        className={`w-full h-9 px-2 rounded-lg text-left text-[10px] font-semibold transition-colors border border-dashed ${isSelected
                            ? 'bg-[rgba(23,38,58,0.72)] border-[#8fb6e6]/28 text-[#dcecff]'
                            : 'border-transparent text-[#d3e4f8] hover:bg-[rgba(23,38,58,0.5)]'
                          }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div ref={subGenreFilterMenuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsSubGenreFilterMenuOpen((prev) => !prev);
                  setIsAgeFilterMenuOpen(false);
                  setIsBookTypeFilterMenuOpen(false);
                  setIsLanguageMenuOpen(false);
                  setIsSortMenuOpen(false);
                }}
                className="h-10 w-full px-2 rounded-2xl border border-dashed border-[#58769c]/45 bg-[#131b27] text-[10px] font-semibold text-[#dcecff] focus:outline-none inline-flex items-center justify-between gap-1.5"
                aria-label="Alt tür filtresi"
                aria-haspopup="listbox"
                aria-expanded={isSubGenreFilterMenuOpen}
              >
                <span className="truncate">{selectedSubGenreFilterLabel}</span>
                <ChevronDown size={11} className={`shrink-0 transition-transform ${isSubGenreFilterMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isSubGenreFilterMenuOpen && (
                <div
                  role="listbox"
                  aria-label="Alt tür seçenekleri"
                  className="absolute top-full left-0 mt-2 z-20 min-w-[120px] max-h-[240px] overflow-y-auto overscroll-contain rounded-2xl border border-dashed p-1 shadow-[0_12px_24px_-18px_rgba(0,0,0,0.75)]"
                  style={{
                    background: 'rgba(17, 22, 29, 0.94)',
                    borderColor: 'rgba(86,133,190,0.24)',
                    WebkitOverflowScrolling: 'touch'
                  }}
                >
                  {subGenreOptions.map((option) => {
                    const isSelected = subGenreFilter === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setSubGenreFilter(option);
                          setIsSubGenreFilterMenuOpen(false);
                        }}
                        className={`w-full h-9 px-2 rounded-lg text-left text-[10px] font-semibold transition-colors border border-dashed ${isSelected
                            ? 'bg-[rgba(23,38,58,0.72)] border-[#8fb6e6]/28 text-[#dcecff]'
                            : 'border-transparent text-[#d3e4f8] hover:bg-[rgba(23,38,58,0.5)]'
                          }`}
                      >
                        {option === 'all' ? 'Tüm Alt Türler' : option}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setAgeFilter('all');
                setBookTypeFilter('all');
                setSubGenreFilter('all');
                setIsAgeFilterMenuOpen(false);
                setIsBookTypeFilterMenuOpen(false);
                setIsSubGenreFilterMenuOpen(false);
              }}
              disabled={!hasCascadeFilterSelection}
              className={`h-10 w-10 rounded-2xl border border-dashed inline-flex items-center justify-center transition-all ${hasCascadeFilterSelection
                  ? 'text-[#dcecff] active:scale-95'
                  : 'text-[#7f95b3]'
                }`}
              style={{
                background: 'rgba(17, 22, 29, 0.9)',
                borderColor: hasCascadeFilterSelection ? 'rgba(86,133,190,0.24)' : 'rgba(86,133,190,0.14)'
              }}
              aria-label="Filtre seçimlerini temizle"
              title="Filtre seçimlerini temizle"
            >
              <X size={14} />
            </button>
          </div>
        </section>

        {displayCourses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
              <BookOpen size={24} className="text-white/20" />
            </div>
            <p className="text-sm font-bold text-white/40">{t('Kütüphanede SmartBook bulunamadı')}</p>
            <p className="text-[11px] text-white/25 mt-1">
              {appliedSearchText && appliedSearchLanguage
                ? 'Arama kriterlerini değiştirip tekrar dene.'
                : 'Ana sayfadan yeni bir SmartBook oluşturarak başla.'}
            </p>
          </div>
        ) : (
          <>
            {libraryViewMode === 'shelf' ? (
              <section>
                <div className="space-y-2">
                  {shelfRows.map((row, rowIndex) => (
                    <div key={`shelf-${rowIndex}`} className="space-y-1">
                      <div className="grid grid-cols-2 gap-3 items-end">
                        {Array.from({ length: 2 }).map((_, colIndex) => {
                          const course = row[colIndex];
                          if (!course) {
                            return (
                              <div key={`shelf-${rowIndex}-empty-${colIndex}`} className="opacity-0 pointer-events-none">
                                <div className="w-full aspect-[3/4]" />
                                <div className="mt-1 h-7" />
                              </div>
                            );
                          }

                          return (
                            <div
                              key={course.id}
                              className="library-shelf-card relative w-full px-2 pt-2 pb-1"
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedCourse(course)}
                                className="w-full text-center border-0 bg-transparent outline-none focus:outline-none focus:ring-0 shadow-none appearance-none active:scale-[0.99] transition-transform"
                                style={{ border: '0', background: 'transparent', boxShadow: 'none' }}
                              >
                                <div
                                  className="relative mx-auto w-full max-w-[112px] aspect-[3/4] rounded-[3px] overflow-hidden"
                                  style={course.coverImageUrl
                                    ? {
                                      background: 'transparent'
                                    }
                                    : {
                                      background: 'rgba(26, 31, 38, 0.92)'
                                    }}
                                >
                                  {course.coverImageUrl ? (
                                    <img
                                      src={course.coverImageUrl}
                                      alt={`${course.topic} SmartBook kapağı`}
                                      className="w-full h-full object-contain object-center border-0"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <BookOpen size={20} className="text-white/25" />
                                    </div>
                                  )}
                                </div>
                                <p className="mt-1.5 px-1 text-[10px] font-semibold leading-tight text-white/85 line-clamp-2 min-h-[28px]">
                                  {course.topic}
                                </p>
                                <p className="px-1 mt-0.5 text-[10px] leading-tight text-white/70 truncate min-h-[12px]">
                                  {course.creatorName?.trim() ? course.creatorName : 'Anonim'}
                                </p>
                              </button>
                              {(() => {
                                const isLiked = likedCourseIdSet.has(course.id);
                                const likeCount = getLibraryLikeCount(course, isLiked);
                                return (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void onShareCourse(course);
                                      }}
                                      className="absolute top-1 left-1 flex items-center justify-center rounded-lg w-6 h-6 active:scale-95 transition-transform"
                                      style={{
                                        background: 'rgba(17, 22, 29, 0.72)',
                                        border: '1px dashed rgba(86, 133, 190, 0.16)',
                                        boxShadow: 'none'
                                      }}
                                      aria-label="SmartBook paylaş"
                                      title="Paylaş"
                                    >
                                      <Share2 size={10} className="text-white/80" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        onToggleCourseLike(course.id);
                                      }}
                                      className="absolute top-1 right-1 flex flex-col items-center justify-center rounded-lg px-1 py-1 active:scale-95 transition-transform"
                                      style={{
                                        background: 'rgba(17, 22, 29, 0.7)',
                                        border: '1px dashed rgba(86, 133, 190, 0.16)',
                                        boxShadow: 'none'
                                      }}
                                      aria-label={isLiked ? 'Beğeniden çıkar' : 'Beğen'}
                                      title={isLiked ? 'Beğeniden çıkar' : 'Beğen'}
                                    >
                                      <Heart
                                        size={10}
                                        className={isLiked ? 'text-[#ff7d9d]' : 'text-white/70'}
                                        fill={isLiked ? 'rgba(255,125,157,0.32)' : 'transparent'}
                                      />
                                      <span className="mt-0.5 text-[7px] leading-none text-white/80 font-semibold">
                                        {formatLikeCount(likeCount)}
                                      </span>
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <section>
                <div className="space-y-2.5">
                  {displayCourses.map((course) => {
                    const hue = topicHue(course.topic);
                    const description = getCourseDescription(course);
                    const category = deriveRealCategoryFromCourse(course);
                    const estimatedDuration = getEstimatedStudyDuration(course);
                    const createdDateLabel = formatCreatedDateLabel(course.createdAt, locale);
                    const isLiked = likedCourseIdSet.has(course.id);
                    const likeCount = getLibraryLikeCount(course, isLiked);
                    return (
                      <div
                        key={course.id}
                        onClick={() => setSelectedCourse(course)}
                        className="cursor-pointer active:scale-[0.995] transition-all rounded-2xl overflow-hidden bg-[#111b29] shadow-[inset_0_0_0_1px_rgba(54,79,108,0.34)]"
                        style={{ background: 'rgba(17, 22, 29, 0.42)' }}
                      >
                        <div className="flex items-stretch gap-0 h-[112px]">
                          <div
                            className={`relative shrink-0 w-[70px] h-full rounded-none overflow-hidden ${course.coverImageUrl ? '' : 'bg-[#1a2637]'}`}
                            style={course.coverImageUrl ? { background: 'transparent', boxShadow: 'none' } : { background: `linear-gradient(135deg, hsl(${hue},52%,24%), hsl(${hue},40%,13%))` }}
                          >
                            {course.coverImageUrl ? (
                              <img
                                src={course.coverImageUrl}
                                alt={`${course.topic} SmartBook kapağı`}
                                className="w-full h-full object-contain object-center border-0"
                              />
                            ) : (
                              <>
                                <div className="absolute left-0 top-0 bottom-0 w-[4px] opacity-45" style={{ background: `hsl(${hue},60%,55%)` }} />
                                <div className="w-full h-full flex items-center justify-center">
                                  <BookOpen size={18} className="text-white/25" />
                                </div>
                              </>
                            )}
                          </div>

                          <div className="min-w-0 flex-1 h-full px-2.5 py-1.5 flex flex-col">
                            <div
                              className="flex items-center justify-between gap-2 pb-1 mb-1 border-b border-dashed"
                              style={{ borderColor: 'rgba(86,133,190,0.18)' }}
                            >
                              <h3 className="min-w-0 text-[12px] font-bold text-white leading-tight truncate">
                                {course.topic}
                              </h3>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void onShareCourse(course);
                                }}
                                className="shrink-0 flex items-center justify-center rounded-lg w-7 h-7 active:scale-95 transition-transform"
                                style={{
                                  background: 'rgba(17, 22, 29, 0.76)',
                                  boxShadow: 'inset 0 0 0 1px rgba(86, 133, 190, 0.22)'
                                }}
                                aria-label="SmartBook paylaş"
                                title="Paylaş"
                              >
                                <Share2 size={11} className="text-white/80" />
                              </button>
                            </div>

                            <p className="flex-1 min-h-0 text-[11px] text-zinc-300/95 leading-[1.25] line-clamp-5 overflow-hidden">
                              {description}
                            </p>

                            <div
                              className="mt-1 pt-1 border-t border-dashed flex items-center justify-between gap-2"
                              style={{ borderColor: 'rgba(86,133,190,0.18)' }}
                            >
                              <div className="min-w-0 flex items-center gap-1.5 text-[9px] text-[#b9cde8]">
                                <span
                                  className="min-w-0 max-w-[45%] truncate inline-flex items-center gap-1 rounded-md px-1.5 py-0.5"
                                  style={{
                                    background: 'rgba(23, 38, 58, 0.8)',
                                    boxShadow: 'inset 0 0 0 1px rgba(55,80,111,0.26)'
                                  }}
                                  title={category}
                                >
                                  <Tag size={8} className="text-[#8fb6e6] shrink-0" />
                                  <span className="truncate">{category}</span>
                                </span>
                                <span
                                  className="shrink-0 inline-flex items-center rounded-md px-1.5 py-0.5"
                                  style={{
                                    background: 'rgba(23, 38, 58, 0.8)',
                                    boxShadow: 'inset 0 0 0 1px rgba(55,80,111,0.22)'
                                  }}
                                  title="Yaş grubu / seviye"
                                >
                                  {getSmartBookAgeGroupLabel(course.ageGroup)}
                                </span>
                                <span className="shrink-0 text-[#7fa2cb]">{estimatedDuration}</span>
                                <span className="shrink-0 text-white/20">•</span>
                                <span className="min-w-0 truncate inline-flex items-center gap-1 text-[#a8bfdc]">
                                  <CalendarDays size={8} className="text-[#8fb6e6] shrink-0" />
                                  <span className="truncate">{createdDateLabel}</span>
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onToggleCourseLike(course.id);
                                }}
                                className="shrink-0 inline-flex items-center gap-1 rounded-lg px-1.5 py-1 active:scale-95 transition-transform"
                                style={{
                                  background: 'rgba(17, 22, 29, 0.76)',
                                  boxShadow: 'inset 0 0 0 1px rgba(86, 133, 190, 0.22)'
                                }}
                                aria-label={isLiked ? 'Beğeniden çıkar' : 'Beğen'}
                                title={isLiked ? 'Beğeniden çıkar' : 'Beğen'}
                              >
                                <Heart
                                  size={10}
                                  className={isLiked ? 'text-[#ff7d9d]' : 'text-white/70'}
                                  fill={isLiked ? 'rgba(255,125,157,0.22)' : 'transparent'}
                                />
                                <span className="text-[8px] font-semibold leading-none text-white/75">
                                  {formatLikeCount(likeCount)}
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {selectedCourse && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/22 backdrop-blur-sm"
            onClick={() => setSelectedCourse(null)}
            aria-label="Kapat"
          />

          <div className="absolute inset-0 px-3 sm:px-4 flex items-center justify-center">
            <div
              className="w-full max-w-[460px] rounded-[24px] border border-dashed p-4 shadow-[0_20px_38px_-18px_rgba(0,0,0,0.7)] backdrop-blur-[22px] animate-enter overflow-hidden"
              style={{ background: 'rgba(17, 22, 29, 0.42)', borderColor: 'rgba(173, 149, 124, 0.09)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[14px] font-black text-white">{t('Kitap Bilgisi')}</h3>
                <button
                  type="button"
                  onClick={() => setSelectedCourse(null)}
                  className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full border border-dashed text-white leading-none transition-colors hover:bg-[rgba(23,28,36,0.52)]"
                  style={{ backgroundColor: 'rgba(17, 22, 29, 0.42)', borderColor: 'rgba(173, 149, 124, 0.09)' }}
                  aria-label="Kapat"
                >
                  <X size={13} />
                </button>
              </div>

              <div className="mt-3 flex items-start gap-3">
                <div
                  className="w-[98px] h-[132px] rounded-[4px] overflow-hidden shrink-0"
                  style={selectedCourse.coverImageUrl ? { background: 'transparent' } : { background: 'rgba(17, 22, 29, 0.42)' }}
                >
                  {selectedCourse.coverImageUrl ? (
                    <img
                      src={selectedCourse.coverImageUrl}
                      alt={`${selectedCourse.topic} ${t('kitap kapağı')}`}
                      className="w-full h-full object-contain object-center border-0"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen size={22} className="text-white/30" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[14px] font-black text-white leading-tight">{selectedCourse.topic}</p>
                  <p className="text-[11px] text-white/70 leading-snug line-clamp-4">
                    {getCourseDescription(selectedCourse)}
                  </p>
                  <div className="pt-1 text-[10px] text-[#bfd4ee] space-y-0.5">
                    <p>{t('Kategori:')} {t(deriveRealCategoryFromCourse(selectedCourse))}</p>
                    <p>{t('Yaş Grubu:')} {t(getSmartBookAgeGroupLabel(selectedCourse.ageGroup))}</p>
                    <p>{t('Oluşturucu:')} {selectedCourse.creatorName?.trim() || t('Anonim')}</p>
                    <p>{t('Sayfa:')} {estimatePageCount(selectedCourse)} sf</p>
                    <p>{t('Tür:')} {t(bookTypeLabel(selectedCourse.bookType))}</p>
                    <p>{t('Alt Tür:')} {selectedCourse.subGenre ? t(selectedCourse.subGenre) : t('Belirtilmedi')}</p>
                  </div>
                </div>
              </div>

              <div
                className="mt-3 rounded-2xl border border-dashed px-3 py-2 flex items-center justify-between gap-2"
                style={{ backgroundColor: 'rgba(17, 22, 29, 0.42)', borderColor: 'rgba(173, 149, 124, 0.09)' }}
              >
                <div className="text-[10px] text-[#bfd4ee]">
                  <p>{t('Okunma:')} <span className="font-bold text-white">{getLibraryReadCount(selectedCourse)}</span></p>
                  <p>{t('Beğeni:')} <span className="font-bold text-white">{formatLikeCount(getLibraryLikeCount(selectedCourse, likedCourseIdSet.has(selectedCourse.id)))}</span></p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextId = selectedCourse.id;
                    setSelectedCourse(null);
                    onCourseSelect(nextId);
                  }}
                  className="h-10 px-5 rounded-2xl border border-dashed text-[12px] font-black text-white active:scale-95"
                  style={{ backgroundColor: 'rgba(17, 22, 29, 0.42)', borderColor: 'rgba(173, 149, 124, 0.09)' }}
                >
                  Oku
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
