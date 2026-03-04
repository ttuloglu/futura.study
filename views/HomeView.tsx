import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ViewState,
  CourseData,
  TimelineNode,
  StickyNoteData,
  SmartBookAgeGroup,
  CreditActionType,
  SmartBookBookType,
  SmartBookCreativeBrief,
  SmartBookEndingStyle
} from '../types';
import { Plus, BookOpen, Clock3, ChevronDown, StickyNote, X, Trash2, Check, Download, Copy, Share2, Bell, BookPlus, ArrowRight, ArrowLeft } from 'lucide-react';
import { extractDocumentContext, generateCourseCover, generateCourseOutline, generateLectureContent, generateLectureImages } from '../ai';
import { FREE_PLAN_LIMITS } from '../planLimits';
import FaviconSpinner from '../components/FaviconSpinner';
import { SMARTBOOK_AGE_GROUP_OPTIONS, getSmartBookAgeGroupLabel } from '../utils/smartbookAgeGroup';
import { BOOK_CONTENT_SAFETY_MESSAGE, findRestrictedBookTopicInTexts } from '../utils/contentSafety';
import {
  SMARTBOOK_BOOK_TYPE_OPTIONS,
  SMARTBOOK_SUBGENRE_OPTIONS,
  SMARTBOOK_ENDING_OPTIONS,
  buildTargetPageFromBrief,
  getPageRangeByBookType
} from '../utils/bookGeneration';
import { getBookTypeCreateCreditCost } from '../utils/creditCosts';
import { normalizeAppLanguageCode } from '../data/appLanguages';
import { useUiI18n } from '../i18n/uiI18n';

interface HomeViewProps {
  onNavigate: (view: ViewState) => void;
  onCourseCreate: (data: CourseData) => void;
  savedCourses: CourseData[];
  publicCourses: CourseData[];
  onCourseSelect: (id: string) => void;
  stickyNotes: StickyNoteData[];
  onCreateStickyNote: (payload: { title?: string; text: string; reminderAt?: string | null }) => Promise<StickyNoteData | undefined>;
  onUpdateStickyNote: (noteId: string, payload: { title?: string; text: string; reminderAt?: string | null }) => Promise<StickyNoteData | undefined>;
  onDeleteStickyNote: (noteId: string) => Promise<void>;
  onRequireCredit: (action: CreditActionType, costOverride?: number) => boolean;
  onConsumeCredit: (action: CreditActionType, costOverride?: number) => Promise<boolean> | boolean;
  isBootstrapping?: boolean;
  bootstrapMessage?: string;
  defaultBookLanguage?: string;
}

type StickyModalState = {
  isOpen: boolean;
  noteId: string | null;
  title: string;
  text: string;
  reminderAt: string | null;
  createdAt: string;
};

type StickyTint = {
  bg: string;
  border: string;
};

const stickyTintPalette: StickyTint[] = [
  { bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.45)' },
  { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.45)' },
  { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.45)' },
  { bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.45)' },
  { bg: 'rgba(14, 165, 233, 0.12)', border: 'rgba(14, 165, 233, 0.45)' }
];

const STICKY_MODAL_TOP_INSET = 'calc(env(safe-area-inset-top, 0px) + 78px)';
const STICKY_MODAL_BOTTOM_INSET = 'calc(env(safe-area-inset-bottom, 0px) + 84px)';
const APP_SURFACE_COLOR = '#1A1F26';
const MAX_SOURCE_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const DOCUMENT_ACCEPT =
  '.pdf,.txt,.md,.markdown,.csv,.json,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*,application/pdf,text/plain,text/markdown,text/csv,application/json,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const READING_WORDS_PER_MINUTE = 180;
const CREATION_STEP_COUNT = 9;
const CREATION_STEP_TITLES = [
  'Kitap Türü',
  'Alt Tür',
  'Yaş Grubu',
  'Dil (Yazın)',
  'Kurgu Modu',
  'Zaman',
  'Mekan',
  'Kitap Adı',
  'Kahramanlar ve Oluşturucu'
] as const;

type StoryInputMode = 'auto' | 'manual' | null;

function formatStickyDate(date: Date | string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
}

function formatStickyReminder(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
}

function toLocalDateTimeValue(value: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function toIsoDateTimeValue(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function estimateReadingMinutesFromText(text: string): number {
  const clean = String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\(\s*<?(?:data:image\/[^)]+|https?:\/\/[^)]+)>?\s*\)/gi, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const wordCount = clean ? clean.split(/\s+/).filter(Boolean).length : 0;
  if (!wordCount) return 3;
  return Math.max(1, Math.ceil(wordCount / READING_WORDS_PER_MINUTE));
}

function buildStickyContent(title: string, text: string): string {
  const blocks = [title.trim(), text.trim()].filter(Boolean);
  return blocks.join('\n\n').trim();
}

function buildStickyDownloadName(title: string): string {
  const normalized = (title || 'yapiskan-not')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9ğüşıöç\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48);
  const safeName = normalized || 'yapiskan-not';
  return `${safeName}.txt`;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function getUserFacingError(error: unknown, fallback: string): string {
  const rawMessage = (error as { message?: string } | null)?.message;
  if (!rawMessage || typeof rawMessage !== 'string') return fallback;
  const cleaned = rawMessage
    .replace(/^Firebase:\s*/i, '')
    .replace(/\s*\(functions\/[a-z-]+\)\.?$/i, '')
    .trim();
  return cleaned || fallback;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Dosya verisi işlenemedi.'));
        return;
      }
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

function toTitleCaseTr(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((chunk) => {
      const lower = chunk.toLocaleLowerCase('tr-TR');
      if (!lower) return '';
      const first = lower.charAt(0).toLocaleUpperCase('tr-TR');
      return `${first}${lower.slice(1)}`;
    })
    .join(' ')
    .trim();
}

type SmartBookLanguageCode =
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

function normalizeStoredLanguageCode(value: unknown): SmartBookLanguageCode {
  const raw = String(value || '').trim().toLowerCase();
  const allowed = new Set<SmartBookLanguageCode>([
    'tr', 'en', 'es', 'zh', 'ja', 'ko', 'ar', 'ru', 'fr', 'de', 'pt', 'it', 'unknown'
  ]);
  return allowed.has(raw as SmartBookLanguageCode) ? (raw as SmartBookLanguageCode) : 'unknown';
}

function detectLikelyLanguage(value: string): SmartBookLanguageCode {
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

function compactInlineText(value: string): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

function ensureSentenceEnding(value: string): string {
  const trimmed = compactInlineText(value);
  if (!trimmed) return '';
  return /[.!?…:;。！？]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function sanitizeSmartBookDescriptionText(value: string): string {
  const compact = compactInlineText(value);
  if (!compact) return '';

  const cleaned = compact
    .replace(/\b(?:SmartBook|Fortale)\s+çalışma\s+akışı\b/gi, 'Fortale içeriği')
    .replace(/\b(?:SmartBook|Fortale)\s+study\s+flow\b/gi, 'Fortale content')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return ensureSentenceEnding(cleaned);
}

function normalizeTopicTokens(value: string): string[] {
  return compactInlineText(value)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ğüşıöç\s]/gi, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => token.length >= 3);
}

function descriptionContainsTopicSignal(description: string, topic: string): boolean {
  const text = compactInlineText(description)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!text) return false;
  const topicTokens = normalizeTopicTokens(topic);
  if (topicTokens.length === 0) return false;
  return topicTokens.some((token) => text.includes(token));
}

function isGenericSmartBookDescription(description: string, topic: string): boolean {
  const compact = compactInlineText(description);
  if (!compact) return true;
  const patterns: RegExp[] = [
    /konunun temel çerçevesi,?\s*ana kavramları ve öğrenme hedefleri/i,
    /core framework,\s*key concepts,\s*and learning goals/i,
    /topic overview and study content/i,
    /temel kavramları ve önemli noktaları içeren smartbook içeriği/i,
    /^smartbook (?:içeriği|content)\.?$/i
  ];
  if (patterns.some((pattern) => pattern.test(compact))) return true;
  if (!descriptionContainsTopicSignal(compact, topic)) return true;
  return compact.length < 28;
}

function buildTopicSpecificDescription(topic: string, bookType: SmartBookBookType = 'novel', subGenre?: string): string {
  const cleanedTopic = compactInlineText(topic);
  const detected = detectLikelyLanguage(cleanedTopic);
  const genrePart = subGenre ? ` (${subGenre})` : '';

  if (detected === 'en') {
    return sanitizeSmartBookDescriptionText(
      `${cleanedTopic}${genrePart} narrative designed with coherent story flow, character motivation, thematic depth, and a meaningful progression arc.`
    );
  }
  return sanitizeSmartBookDescriptionText(
    `${cleanedTopic}${genrePart} anlatısını tutarlı olay örgüsü, karakter motivasyonu, tematik derinlik ve güçlü bir ilerleyiş kurgusuyla ele alan Fortale.`
  );
}

function deriveSmartBookDescription(
  topic: string,
  nodes: TimelineNode[],
  bookType: SmartBookBookType = 'novel',
  subGenre?: string
): string {
  const candidates = [
    nodes.find((node) => node.type === 'lecture' && node.description?.trim())?.description,
    nodes.find((node) => node.type === 'reinforce' && node.description?.trim())?.description,
    nodes.find((node) => node.description?.trim())?.description
  ]
    .map((value) => compactInlineText(String(value || '')))
    .filter(Boolean);

  for (const candidate of candidates) {
    if (!isGenericSmartBookDescription(candidate, topic)) {
      return sanitizeSmartBookDescriptionText(candidate);
    }
  }

  return buildTopicSpecificDescription(topic, bookType, subGenre);
}

function buildSmartBookSearchTags(params: {
  topic: string;
  description?: string;
  category?: string;
  aiTags?: unknown;
  nodes?: TimelineNode[];
}): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const pushTag = (value: unknown) => {
    if (typeof value !== 'string') return;
    const cleaned = compactInlineText(value).replace(/[.,;:!?]+$/g, '').trim();
    if (!cleaned) return;
    const key = cleaned.toLocaleLowerCase('tr-TR');
    if (seen.has(key)) return;
    seen.add(key);
    result.push(cleaned);
  };

  if (Array.isArray(params.aiTags)) {
    params.aiTags.forEach(pushTag);
  }

  pushTag(params.topic);
  pushTag(params.category);
  pushTag(params.description);

  (params.nodes || []).slice(0, 6).forEach((node) => {
    pushTag(node.title);
  });

  return result.slice(0, 16);
}

function normalizeTopicForMatch(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ğüşıöç\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const GENERIC_NARRATIVE_TITLE_TOKENS = new Set([
  'masal', 'hikaye', 'oyku', 'roman', 'kitap', 'book', 'story', 'novel', 'fairy', 'tale',
  'anlati', 'narrative', 'kategori', 'category', 'genre', 'tur', 'turu', 'subgenre', 'alt',
  'taslak', 'taslagi', 'draft', 'edebiyat', 'literature',
  'klasik', 'modern', 'macera', 'masali', 'mitolojik', 'esintili', 'egitici',
  'dram', 'komedi', 'korku', 'bilim', 'kurgu', 'distopik', 'utopik', 'gizem', 'psikolojik',
  'romantik', 'aile', 'gerilim', 'tarihsel', 'polisiye', 'fantastik', 'mizah'
]);

const NARRATIVE_SUBGENRE_TITLE_KEYS = new Set(
  Object.values(SMARTBOOK_SUBGENRE_OPTIONS)
    .flat()
    .map((item) => normalizeTopicForMatch(item))
    .filter(Boolean)
);

function getNarrativeBookTypeTitleKeys(bookType: SmartBookBookType): Set<string> {
  if (bookType === 'fairy_tale') {
    return new Set([
      normalizeTopicForMatch('masal'),
      normalizeTopicForMatch('fairy tale'),
      normalizeTopicForMatch('fairytale')
    ]);
  }
  if (bookType === 'story') {
    return new Set([
      normalizeTopicForMatch('hikaye'),
      normalizeTopicForMatch('öykü'),
      normalizeTopicForMatch('story')
    ]);
  }
  return new Set([
    normalizeTopicForMatch('roman'),
    normalizeTopicForMatch('novel')
  ]);
}

function isNarrativeBookTitleTooGeneric(
  title: string,
  options: { bookType: SmartBookBookType; subGenre?: string; topic?: string }
): boolean {
  const normalizedTitle = normalizeTopicForMatch(title);
  if (!normalizedTitle || normalizedTitle.length < 3) return true;
  if (/\b(?:taslak|taslagi|draft)\b/u.test(normalizedTitle)) return true;

  const tokens = normalizedTitle.split(' ').filter(Boolean);
  if (tokens.length > 0 && tokens.length <= 4 && tokens.every((token) => GENERIC_NARRATIVE_TITLE_TOKENS.has(token))) {
    return true;
  }
  if (NARRATIVE_SUBGENRE_TITLE_KEYS.has(normalizedTitle)) return true;

  const normalizedTopic = normalizeTopicForMatch(options.topic || '');
  if (normalizedTopic && normalizedTopic === normalizedTitle) return true;
  const normalizedSubGenre = normalizeTopicForMatch(options.subGenre || '');
  if (normalizedSubGenre && normalizedSubGenre === normalizedTitle) return true;
  if (getNarrativeBookTypeTitleKeys(options.bookType).has(normalizedTitle)) return true;

  return false;
}

function bookTypeToLabel(bookType?: SmartBookBookType): string {
  if (bookType === 'fairy_tale') return 'Masal';
  if (bookType === 'story') return 'Hikaye';
  if (bookType === 'novel') return 'Roman';
  return 'Kitap';
}

function estimateCourseReadingDuration(course: CourseData, t: (key: string) => string): string {
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

    if (totalMinutes > 0) return `${Math.max(1, totalMinutes)} ${t('dk')}`;
  }

  const totalMinutes = course.nodes.reduce((sum, node) => {
    const match = String(node.duration || '').match(/\d+/);
    return sum + (match ? Number.parseInt(match[0], 10) : 0);
  }, 0);
  return `${Math.max(10, totalMinutes || course.nodes.length * 8)} ${t('dk')}`;
}

function resolveAutoNarrativeBookTitle(params: {
  bookType: SmartBookBookType;
  subGenre?: string;
  topicTitle: string;
  aiTitle?: string;
  outlineTitle?: string;
  generatedSectionTitles?: string[];
}): string {
  const sectionTitleHints = Array.isArray(params.generatedSectionTitles)
    ? params.generatedSectionTitles.slice(0, 6)
    : [];
  const candidates = [params.aiTitle, params.outlineTitle, ...sectionTitleHints, params.topicTitle]
    .map((value) => toTitleCaseTr(compactInlineText(String(value || ''))))
    .filter(Boolean);
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const dedupeKey = normalizeTopicForMatch(candidate);
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    if (!isNarrativeBookTitleTooGeneric(candidate, {
      bookType: params.bookType,
      subGenre: params.subGenre,
      topic: params.topicTitle
    })) {
      return candidate;
    }
  }

  return '';
}

const MATCH_STOP_WORDS = new Set([
  've', 'ile', 'bir', 'bu', 'su', 'şu', 'da', 'de', 'mi', 'mu', 'mü', 'midir', 'nedir', 'icin', 'için',
  'the', 'and', 'for', 'with', 'from', 'into', 'about', 'that', 'this', 'is', 'are', 'of', 'to'
]);

function buildMatchTokenSet(value: string): Set<string> {
  const keepShortTokens = new Set(['ai', 'yz']);
  const tokens = normalizeTopicForMatch(value)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !MATCH_STOP_WORDS.has(token))
    .filter((token) => token.length >= 3 || keepShortTokens.has(token));
  return new Set(tokens);
}

function topicTokenOverlap(query: string, candidate: string): { ratio: number; overlapCount: number; queryTokenCount: number } {
  const queryTokens = buildMatchTokenSet(query);
  const candidateTokens = buildMatchTokenSet(candidate);
  if (queryTokens.size === 0 || candidateTokens.size === 0) {
    return { ratio: 0, overlapCount: 0, queryTokenCount: queryTokens.size };
  }

  let overlapCount = 0;
  queryTokens.forEach((token) => {
    if (candidateTokens.has(token)) overlapCount += 1;
  });

  return {
    ratio: overlapCount / Math.max(queryTokens.size, candidateTokens.size),
    overlapCount,
    queryTokenCount: queryTokens.size
  };
}

function findLibraryMatchesByTopic(queryTopic: string, courses: CourseData[]): CourseData[] {
  const normalizedQuery = normalizeTopicForMatch(queryTopic);
  if (!normalizedQuery) return [];

  const queryLanguage = detectLikelyLanguage(queryTopic);
  const scored = courses
    .map((course) => {
      const normalizedCourseTopic = normalizeTopicForMatch(course.topic || '');
      if (!normalizedCourseTopic) return null;
      const normalizedHaystack = normalizeTopicForMatch([
        course.topic || '',
        course.description || '',
        course.category || '',
        Array.isArray(course.searchTags) ? course.searchTags.join(' ') : ''
      ].join(' '));

      const storedCourseLanguage = normalizeStoredLanguageCode(course.language);
      const courseLanguage = storedCourseLanguage !== 'unknown'
        ? storedCourseLanguage
        : detectLikelyLanguage(`${course.topic || ''} ${course.description || ''}`);
      if (
        queryLanguage !== 'unknown' &&
        courseLanguage !== 'unknown' &&
        queryLanguage !== courseLanguage
      ) {
        return null;
      }

      let score = 0;
      if (normalizedCourseTopic === normalizedQuery) score = 1;
      else if (
        normalizedCourseTopic.includes(normalizedQuery) ||
        normalizedQuery.includes(normalizedCourseTopic)
      ) {
        score = 0.78;
      } else if (
        normalizedHaystack.includes(normalizedQuery) ||
        normalizedQuery.includes(normalizedHaystack)
      ) {
        score = 0.62;
      } else {
        const overlapOnTopic = topicTokenOverlap(normalizedQuery, normalizedCourseTopic);
        const overlapOnHaystack = topicTokenOverlap(normalizedQuery, normalizedHaystack);
        const overlap = overlapOnTopic.ratio >= overlapOnHaystack.ratio ? overlapOnTopic : overlapOnHaystack;
        const shouldMatch =
          overlap.overlapCount >= 2
          || overlap.ratio >= 0.42
          || (overlap.queryTokenCount === 1 && overlap.overlapCount === 1);
        if (shouldMatch) score = 0.34 + overlap.ratio * 0.46;
      }

      if (score <= 0) return null;
      return { course, score };
    })
    .filter((item): item is { course: CourseData; score: number } => Boolean(item))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.course.lastActivity).getTime() - new Date(a.course.lastActivity).getTime();
    });

  return scored.slice(0, 6).map((item) => item.course);
}

export default function HomeView({
  onNavigate: _onNavigate,
  onCourseCreate,
  savedCourses,
  publicCourses,
  onCourseSelect,
  stickyNotes,
  onCreateStickyNote,
  onUpdateStickyNote,
  onDeleteStickyNote,
  onRequireCredit,
  onConsumeCredit,
  isBootstrapping = false,
  bootstrapMessage = 'Kitaplar senkronize ediliyor...',
  defaultBookLanguage = 'Turkish'
}: HomeViewProps) {
  const { locale, t } = useUiI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<SmartBookAgeGroup>('general');
  const [bookLanguageInput, setBookLanguageInput] = useState<string>(defaultBookLanguage);
  const [selectedBookType, setSelectedBookType] = useState<SmartBookBookType>('novel');
  const [selectedSubGenre, setSelectedSubGenre] = useState<string>(SMARTBOOK_SUBGENRE_OPTIONS.novel[0]);
  const [selectedEndingStyle, setSelectedEndingStyle] = useState<SmartBookEndingStyle>('happy');
  const [creatorNameInput, setCreatorNameInput] = useState('');
  const [heroNamesInput, setHeroNamesInput] = useState('');
  const [storyInputMode, setStoryInputMode] = useState<StoryInputMode>(null);
  const [storyBlueprintInput, setStoryBlueprintInput] = useState('');
  const [settingPlaceInput, setSettingPlaceInput] = useState('');
  const [settingTimeInput, setSettingTimeInput] = useState('');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [creationStep, setCreationStep] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [sourceNotice, setSourceNotice] = useState<string | null>(null);
  const [isStickyRowExpanded, setIsStickyRowExpanded] = useState(false);
  const [isStickySaving, setIsStickySaving] = useState(false);
  const [stickyNotice, setStickyNotice] = useState<string | null>(null);
  const [isStickyCopyConfirmed, setIsStickyCopyConfirmed] = useState(false);
  const [isReminderPickerOpen, setIsReminderPickerOpen] = useState(false);
  const [reminderDraft, setReminderDraft] = useState('');
  const sourceFileInputRef = useRef<HTMLInputElement | null>(null);
  const stickyRowContainerRef = useRef<HTMLElement | null>(null);
  const stickyCopyTimerRef = useRef<number | null>(null);
  const stickyNoticeTimerRef = useRef<number | null>(null);
  const lastDefaultBookLanguageRef = useRef(defaultBookLanguage);
  const [stickyModal, setStickyModal] = useState<StickyModalState>({
    isOpen: false,
    noteId: null,
    title: '',
    text: '',
    reminderAt: null,
    createdAt: new Date().toISOString()
  });

  useEffect(() => {
    setBookLanguageInput((previous) => {
      const trimmedPrevious = previous.trim();
      const previousDefault = lastDefaultBookLanguageRef.current;
      lastDefaultBookLanguageRef.current = defaultBookLanguage;
      if (!trimmedPrevious || trimmedPrevious === previousDefault) {
        return defaultBookLanguage;
      }
      return previous;
    });
  }, [defaultBookLanguage]);

  const sortedCourses = useMemo(() => {
    return [...savedCourses].sort((a, b) =>
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
  }, [savedCourses]);

  const sortedStickyNotes = useMemo(() => {
    return [...stickyNotes].sort((a, b) =>
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
  }, [stickyNotes]);

  const stickyTintById = useMemo(() => {
    const assigned = new Map<string, StickyTint>();
    const total = stickyTintPalette.length;
    sortedStickyNotes.forEach((note, index) => {
      assigned.set(note.id, stickyTintPalette[index % total]);
    });
    return assigned;
  }, [sortedStickyNotes]);

  const activeStickyTint = useMemo(() => {
    if (!stickyModal.noteId) return stickyTintPalette[0];
    return stickyTintById.get(stickyModal.noteId) || stickyTintPalette[0];
  }, [stickyModal.noteId, stickyTintById]);

  const homeShelfCourses = sortedCourses.slice(0, 4);

  useEffect(() => {
    const options = SMARTBOOK_SUBGENRE_OPTIONS[selectedBookType] || [];
    if (options.length === 0) {
      setSelectedSubGenre('');
      return;
    }
    if (!options.includes(selectedSubGenre)) {
      setSelectedSubGenre(options[0]);
    }
  }, [selectedBookType, selectedSubGenre]);

  const openStickyModal = (note?: StickyNoteData) => {
    if (note) {
      setStickyModal({
        isOpen: true,
        noteId: note.id,
        title: note.title || '',
        text: note.text || '',
        reminderAt: note.reminderAt ?? null,
        createdAt: note.createdAt.toISOString()
      });
      setReminderDraft(toLocalDateTimeValue(note.reminderAt ?? null));
      setStickyNotice(null);
      setIsStickyCopyConfirmed(false);
      setIsReminderPickerOpen(false);
      return;
    }

    setStickyModal({
      isOpen: true,
      noteId: null,
      title: '',
      text: '',
      reminderAt: null,
      createdAt: new Date().toISOString()
    });
    setReminderDraft('');
    setStickyNotice(null);
    setIsStickyCopyConfirmed(false);
    setIsReminderPickerOpen(false);
  };

  const closeStickyModal = () => {
    if (isStickySaving) return;
    setStickyModal({
      isOpen: false,
      noteId: null,
      title: '',
      text: '',
      reminderAt: null,
      createdAt: new Date().toISOString()
    });
    setReminderDraft('');
    setIsStickyCopyConfirmed(false);
    setIsReminderPickerOpen(false);
    setStickyNotice(null);
  };

  const pushStickyNotice = (message: string) => {
    setStickyNotice(message);
    if (stickyNoticeTimerRef.current !== null) {
      window.clearTimeout(stickyNoticeTimerRef.current);
    }
    stickyNoticeTimerRef.current = window.setTimeout(() => {
      setStickyNotice(null);
      stickyNoticeTimerRef.current = null;
    }, 1800);
  };

  useEffect(() => {
    if (!stickyModal.isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeStickyModal();
      }
    };
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    return () => {
      body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [stickyModal.isOpen, isStickySaving]);

  useEffect(() => () => {
    if (stickyCopyTimerRef.current !== null) {
      window.clearTimeout(stickyCopyTimerRef.current);
    }
    if (stickyNoticeTimerRef.current !== null) {
      window.clearTimeout(stickyNoticeTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!isStickyRowExpanded) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (stickyRowContainerRef.current?.contains(target)) return;
      setIsStickyRowExpanded(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isStickyRowExpanded]);

  const handleStickySave = async () => {
    if (isStickySaving) return;
    const title = stickyModal.title.trim();
    const text = stickyModal.text.trim();
    const reminderAt = stickyModal.reminderAt;
    if (!title && !text) {
      closeStickyModal();
      return;
    }

    setIsStickySaving(true);
    try {
      if (stickyModal.noteId) {
        await onUpdateStickyNote(stickyModal.noteId, { title, text, reminderAt });
      } else {
        await onCreateStickyNote({ title, text, reminderAt });
      }
      closeStickyModal();
    } catch (error) {
      console.error('Sticky note save failed:', error);
      pushStickyNotice('Kaydetme başarısız.');
    } finally {
      setIsStickySaving(false);
    }
  };

  const handleStickyDelete = async () => {
    if (!stickyModal.noteId || isStickySaving) {
      closeStickyModal();
      return;
    }
    const isConfirmed = window.confirm('Yapışkan not silinsin mi?');
    if (!isConfirmed) return;

    setIsStickySaving(true);
    try {
      await onDeleteStickyNote(stickyModal.noteId);
      closeStickyModal();
    } catch (error) {
      console.error('Sticky note delete failed:', error);
      pushStickyNotice('Silme başarısız.');
    } finally {
      setIsStickySaving(false);
    }
  };

  const handleStickyCopy = async () => {
    const content = buildStickyContent(stickyModal.title, stickyModal.text);
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setIsStickyCopyConfirmed(true);
      if (stickyCopyTimerRef.current !== null) {
        window.clearTimeout(stickyCopyTimerRef.current);
      }
      stickyCopyTimerRef.current = window.setTimeout(() => {
        setIsStickyCopyConfirmed(false);
        stickyCopyTimerRef.current = null;
      }, 1800);
      pushStickyNotice('Kopyalandı.');
    } catch (error) {
      console.error('Sticky note copy failed:', error);
      pushStickyNotice('Kopyalama başarısız.');
    }
  };

  const handleStickyDownload = () => {
    const content = buildStickyContent(stickyModal.title, stickyModal.text);
    if (!content) return;
    const fileName = buildStickyDownloadName(stickyModal.title || 'yapiskan-not');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    pushStickyNotice('Dosya indirildi.');
  };

  const handleStickyShare = async () => {
    const content = buildStickyContent(stickyModal.title, stickyModal.text);
    if (!content) return;
    const title = stickyModal.title.trim() || 'Yapışkan Not';
    try {
      if (navigator.share) {
        await navigator.share({ title, text: content });
      } else {
        await navigator.clipboard.writeText(content);
        pushStickyNotice('Paylaşım desteklenmiyor, metin kopyalandı.');
        return;
      }
      pushStickyNotice('Paylaşıldı.');
    } catch (error) {
      if ((error as { name?: string } | null)?.name === 'AbortError') return;
      console.error('Sticky note share failed:', error);
      pushStickyNotice('Paylaşım başarısız.');
    }
  };

  const persistStickyReminder = async (nextReminderAt: string | null) => {
    if (!stickyModal.noteId) return;
    setIsStickySaving(true);
    try {
      await onUpdateStickyNote(stickyModal.noteId, {
        title: stickyModal.title.trim(),
        text: stickyModal.text.trim(),
        reminderAt: nextReminderAt
      });
    } catch (error) {
      console.error('Sticky reminder update failed:', error);
      pushStickyNotice('Hatırlatıcı kaydedilemedi.');
    } finally {
      setIsStickySaving(false);
    }
  };

  const handleReminderApply = async () => {
    const isoValue = toIsoDateTimeValue(reminderDraft);
    if (!isoValue) {
      pushStickyNotice('Geçerli bir tarih seçin.');
      return;
    }
    setStickyModal((prev) => ({ ...prev, reminderAt: isoValue }));
    setIsReminderPickerOpen(false);
    await persistStickyReminder(isoValue);
    pushStickyNotice('Hatırlatıcı ayarlandı.');
  };

  const handleReminderClear = async () => {
    setReminderDraft('');
    setStickyModal((prev) => ({ ...prev, reminderAt: null }));
    setIsReminderPickerOpen(false);
    await persistStickyReminder(null);
    pushStickyNotice('Hatırlatıcı kaldırıldı.');
  };

  const handleSourceFilePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';

    if (!file) return;

    if (file.size > MAX_SOURCE_FILE_SIZE_BYTES) {
      setSourceNotice('Dosya boyutu 8 MB sınırını aşıyor.');
      setSourceFile(null);
      return;
    }

    setSourceFile(file);
    setSourceNotice(null);
  };

  const clearSourceFile = () => {
    setSourceFile(null);
    setSourceNotice(null);
    if (sourceFileInputRef.current) {
      sourceFileInputRef.current.value = '';
    }
  };

  const pageRange = getPageRangeByBookType(selectedBookType, selectedAgeGroup);
  const selectedCreateCreditCost = getBookTypeCreateCreditCost(selectedBookType);
  const targetPageCountPreview = buildTargetPageFromBrief({
    bookType: selectedBookType,
    targetPageMin: pageRange.min,
    targetPageMax: pageRange.max
  }, selectedAgeGroup);

  const buildCreativeBriefPayload = (): SmartBookCreativeBrief => {
    const normalizedStoryBlueprint = compactInlineText(storyBlueprintInput);
    const normalizedHeroNames = compactInlineText(heroNamesInput);
    const manualStoryBlueprint = storyInputMode === 'manual' ? normalizedStoryBlueprint : '';
    const normalizedPlace = compactInlineText(settingPlaceInput);
    const normalizedTime = compactInlineText(settingTimeInput);
    const normalizedLanguageText = compactInlineText(bookLanguageInput);
    const characterHints = [
      normalizedHeroNames ? `Kahraman isimleri: ${normalizedHeroNames}.` : undefined,
      manualStoryBlueprint || undefined
    ].filter(Boolean) as string[];
    const customInstructionParts = [
      manualStoryBlueprint || undefined,
      normalizedLanguageText ? `Üretim dili zorunluluğu: ${normalizedLanguageText}.` : undefined
    ].filter(Boolean) as string[];
    return {
      bookType: selectedBookType,
      subGenre: selectedSubGenre || undefined,
      languageText: normalizedLanguageText || undefined,
      characters: characterHints.join(' ').trim() || undefined,
      settingPlace: normalizedPlace || undefined,
      settingTime: normalizedTime || undefined,
      endingStyle: selectedBookType === 'fairy_tale' ? 'happy' : selectedEndingStyle,
      customInstructions: customInstructionParts.join(' '),
      targetPageMin: pageRange.min,
      targetPageMax: pageRange.max
    };
  };

  const handleCreateSmartBook = async () => {
    const isAutoStoryMode = storyInputMode === 'auto';
    const heroNamesHint = compactInlineText(heroNamesInput);
    const bookTypeLabel = selectedBookType === 'fairy_tale'
      ? 'Masal'
      : selectedBookType === 'story'
        ? 'Hikaye'
        : 'Roman';
    const topicHint = searchTerm.trim();
    const detailHint = storyInputMode === 'manual'
      ? compactInlineText(storyBlueprintInput)
      : (heroNamesHint ? `Kahraman isimleri: ${heroNamesHint}.` : '');
    const selectedFile = sourceFile;
    const creativeBrief = buildCreativeBriefPayload();

    if (!topicHint && !isAutoStoryMode) {
      setSourceNotice('Kitabın adını yazın.');
      return;
    }

    if (
      !isAutoStoryMode &&
      !detailHint &&
      !creativeBrief.characters &&
      !creativeBrief.settingPlace &&
      !creativeBrief.settingTime &&
      !creativeBrief.customInstructions
    ) {
      setSourceNotice('Masal/hikaye/roman üretimi için en az kurgu notu, mekan veya zaman girin.');
      return;
    }

    const localViolation = findRestrictedBookTopicInTexts([
      topicHint,
      detailHint,
      selectedSubGenre,
      bookLanguageInput,
      storyBlueprintInput,
      heroNamesInput,
      settingPlaceInput,
      settingTimeInput,
      creativeBrief?.characters,
      creativeBrief?.settingPlace,
      creativeBrief?.settingTime,
      creativeBrief?.customInstructions
    ]);
    if (localViolation) {
      setSourceNotice(BOOK_CONTENT_SAFETY_MESSAGE);
      return;
    }

    if (!onRequireCredit('create', selectedCreateCreditCost)) {
      setSourceNotice(`${t('Fortale oluşturmak için')} ${selectedCreateCreditCost} ${t('oluşturma kredisi gerekiyor.')}`);
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(5);
    setSourceNotice(null);
    try {
      let resolvedTopic = topicHint;
      let sourceContent: string | undefined = detailHint || undefined;

      if (selectedFile) {
        setGenerationStatus('Doküman analiz ediliyor...');
        setGenerationProgress(18);
        const base64 = await readFileAsBase64(selectedFile);
        const context = await extractDocumentContext(
          base64,
          selectedFile.type || 'application/octet-stream',
          selectedFile.name,
          topicHint || undefined
        );
        if (!resolvedTopic) {
          resolvedTopic = context.topic;
        }
        const mergedSourceContent = [detailHint, context.sourceContent].filter(Boolean).join('\n\n').trim();
        sourceContent = mergedSourceContent || sourceContent;

        const extractedViolation = findRestrictedBookTopicInTexts([
          context.topic,
          context.sourceContent,
          mergedSourceContent
        ]);
        if (extractedViolation) {
          setSourceNotice(BOOK_CONTENT_SAFETY_MESSAGE);
          return;
        }
      }

      if (!resolvedTopic) {
        if (isAutoStoryMode) {
          resolvedTopic = '';
        } else {
          throw new Error('Konu çıkarılamadı.');
        }
      }

      const normalizedTopic = toTitleCaseTr(resolvedTopic);
      setGenerationStatus('Fortale akışı planlanıyor...');
      setGenerationProgress(34);
      const { outline, courseMeta } = await generateCourseOutline(
        normalizedTopic,
        sourceContent,
        selectedAgeGroup,
        {
          bookType: selectedBookType,
          subGenre: selectedSubGenre,
          targetPageCount: targetPageCountPreview,
          creativeBrief,
          allowAiBookTitleGeneration: isAutoStoryMode && !searchTerm.trim()
        }
      );
      const aiTargetPageCount = Number(courseMeta?.targetPageCount);
      const aiSuggestedBookTitle = toTitleCaseTr(compactInlineText(String(courseMeta?.bookTitle || '')));
      const outlineLeadTitle = toTitleCaseTr(compactInlineText(String(
        outline.find((node) => node.type === 'lecture' && String(node.title || '').trim())?.title || ''
      )));
      const workingBookTitle = (isAutoStoryMode && !searchTerm.trim())
        ? (resolveAutoNarrativeBookTitle({
          bookType: selectedBookType,
          subGenre: selectedSubGenre,
          topicTitle: normalizedTopic,
          aiTitle: aiSuggestedBookTitle,
          outlineTitle: outlineLeadTitle
        }) || aiSuggestedBookTitle || outlineLeadTitle)
        : normalizedTopic;
      if (isAutoStoryMode && !searchTerm.trim() && !workingBookTitle) {
        throw new Error('AI kitap adı üretemedi.');
      }
      const finalBookType: SmartBookBookType = selectedBookType;
      const finalSubGenre = selectedSubGenre;
      const finalPageRange = getPageRangeByBookType(finalBookType, selectedAgeGroup);
      const targetPageCount = Number.isFinite(aiTargetPageCount)
        ? Math.max(finalPageRange.min, Math.min(finalPageRange.max, Math.floor(aiTargetPageCount)))
        : targetPageCountPreview;
      const rawAiBookDescription = sanitizeSmartBookDescriptionText(String(courseMeta?.bookDescription || ''));
      const aiBookDescription = !isGenericSmartBookDescription(rawAiBookDescription, workingBookTitle)
        ? rawAiBookDescription
        : '';
      const expectedLectureCount = finalBookType === 'novel' ? 6 : 5;
      const defaultLectureDuration = finalBookType === 'fairy_tale' ? `4 ${t('dk')}` : finalBookType === 'story' ? `8 ${t('dk')}` : `12 ${t('dk')}`;
      const fairyStageDescriptions = [
        'Tekerlemeyle başlayan kapıda masal dünyası açılır.',
        'Kahraman, mekan ve başlangıç düzeni kurulur.',
        'Sorun başlar, kötü unsur görünür olur ve ilk engeller kurulur.',
        'Yolculuk üçleme motifiyle derinleşir, gerilim yükselir.',
        'Sorun çözülür, ders verilir ve iyi dilek kapanışı yapılır.'
      ];
      const storyStageDescriptions = [
        'Karakter, mekan-zaman ve atmosfer netleşir.',
        'Düzeni bozan olayla çatışma ve engeller büyür.',
        'Kahramanın kaybedip kazanacağı kritik doruk yaşanır.',
        'Doruk sonrası sorular yanıtlanır ve çatışma çözülür.',
        'Finalde kahramanın ve dünyanın nasıl değiştiği görünür.'
      ];
      const novelStageDescriptions = [
        'Tema, dünya kuralları ve karakterin arzu-korku ekseni kurulur.',
        'I. Perde kurulumunda sıradan dünya, tetikleyici olay ve eşiği geçiş yazılır.',
        'II. Perdede müttefik-düşman dengesi ve midpoint kırılması belirginleşir.',
        'II. Perdede stratejik baskı artar, riskler geri döndürülemez hale gelir.',
        'Kahraman en alt noktaya iner ve doruk öncesi belirleyici bir karar vermek zorunda kalır.',
        'III. Perdede doruk hesaplaşma çözülür, yeni denge kurulur.'
      ];
      const sanitizeFairySectionTitle = (value: string): string => String(value || '')
        .replace(/^(?:bölüm|chapter|kısım|kisim|part)\s*\d+\s*[:\-–]?\s*/iu, '')
        .replace(/^(?:d[öo]şeme|serim|d[üu]ğüm|dugum|ç[öo]züm|cozum|dilek|giriş|introduction|masal)\s*(?:bölümü|bolumu|kısmı|kismi|section)?\s*[:\-–]?\s*/iu, '')
        .replace(/\s*(?:[-–:]\s*)?(?:d[öo]şeme|serim|d[üu]ğüm|dugum|ç[öo]züm|cozum|dilek)\s*(?:bölümü|bolumu|kısmı|kismi|section)?$/iu, '')
        .replace(/\s+/g, ' ')
        .trim();
      const sanitizeStorySectionTitle = (value: string): string => String(value || '')
        .replace(/^(?:bölüm|chapter|kısım|kisim|part)\s*\d+\s*[:\-–]?\s*/iu, '')
        .replace(/^(?:giriş|serim|geli[şs]me|d[üu]ğ[üu]m|dugum|doruk(?:\s*noktası| noktasi)?|kritik\s*an|ç[öo]z[üu]m|cozum|final|sonu[çc])\s*(?:bölümü|bolumu|kısmı|kismi|section)?\s*[:\-–]?\s*/iu, '')
        .replace(/\s*(?:[-–:]\s*)?(?:giriş|serim|geli[şs]me|d[üu]ğ[üu]m|dugum|doruk(?:\s*noktası| noktasi)?|kritik\s*an|ç[öo]z[üu]m|cozum|final|sonu[çc])\s*(?:bölümü|bolumu|kısmı|kismi|section)?$/iu, '')
        .replace(/\s+/g, ' ')
        .trim();
      const sanitizeNovelSectionTitle = (value: string): string => String(value || '')
        .replace(/^(?:bölüm|chapter|kısım|kisim|part|perde|act)\s*(?:\d+|[ivxlcdm]+)?\s*[:\-–]?\s*/iu, '')
        .replace(/^(?:hazırlık(?:\s*aşaması)?|hazirlik(?:\s*asamasi)?|dünya\s*inşası|dunya\s*insasi|kurulum|y[üu]zle[şs]me(?:\s*[12iıivx]+)?|midpoint|en\s*alt\s*nokta|doruk(?:\s*noktası| noktasi)?|kritik\s*an|ç[öo]z[üu]m|cozum|final|sonu[çc]|giriş|introduction|roman|novel)\s*(?:bölümü|bolumu|kısmı|kismi|section)?\s*[:\-–]?\s*/iu, '')
        .replace(/\s*(?:[-–:]\s*)?(?:hazırlık(?:\s*aşaması)?|hazirlik(?:\s*asamasi)?|dünya\s*inşası|dunya\s*insasi|kurulum|y[üu]zle[şs]me(?:\s*[12iıivx]+)?|midpoint|en\s*alt\s*nokta|doruk(?:\s*noktası| noktasi)?|kritik\s*an|ç[öo]z[üu]m|cozum|final|sonu[çc])\s*(?:bölümü|bolumu|kısmı|kismi|section)?$/iu, '')
        .replace(/\s+/g, ' ')
        .trim();
      const ensureMainBookTitleHeading = (content: string, title: string): string => {
        const cleanTitle = compactInlineText(title);
        const cleanContent = String(content || '').trim();
        if (!cleanTitle) return cleanContent;
        if (!cleanContent) return `# ${cleanTitle}`;
        const firstLine = cleanContent.split(/\r?\n/, 1)[0].trim();
        const headingMatch = firstLine.match(/^#{1,6}\s+(.+)$/);
        const firstLineText = (headingMatch ? headingMatch[1] : firstLine).replace(/\s+/g, ' ').trim();
        if (firstLineText.toLocaleLowerCase('tr-TR') === cleanTitle.toLocaleLowerCase('tr-TR')) {
          return cleanContent;
        }
        return `# ${cleanTitle}\n\n${cleanContent}`;
      };
      const buildLectureTitle = (index: number, rawTitle?: string): string => {
        if (finalBookType === 'fairy_tale') {
          const cleaned = sanitizeFairySectionTitle(rawTitle || '');
          return cleaned;
        }
        if (finalBookType === 'story') {
          const cleaned = sanitizeStorySectionTitle(rawTitle || '');
          return cleaned;
        }
        const cleaned = sanitizeNovelSectionTitle(rawTitle || '');
        return cleaned;
      };

      const lectureOutline = outline.filter((node) => node.type === 'lecture');
      const normalizedLectureOutline: TimelineNode[] = Array.from({ length: expectedLectureCount }, (_, index) => {
        const base = lectureOutline[index];
        const fallbackDescription = finalBookType === 'fairy_tale'
          ? fairyStageDescriptions[index]
          : finalBookType === 'story'
            ? storyStageDescriptions[index]
            : novelStageDescriptions[index] || 'Anlatı akışı bu bölümde devam ediyor.';

        return {
          id: base?.id || `lecture-${index + 1}`,
          type: 'lecture',
          title: buildLectureTitle(index, base?.title) || compactInlineText(String(base?.title || '')) || '',
          description: base?.description || fallbackDescription,
          status: index === 0 ? 'current' : 'locked',
          duration: base?.duration || defaultLectureDuration
        };
      });

      let formattedNodes = normalizedLectureOutline.map((node, index) => ({
        ...node,
        status: index === 0 ? 'current' : 'locked',
      }));

      // Kurgusal eserlerde TÜM bölümleri sırasıyla oluştur (Kullanıcı tamamen yazılmış bir kitap bekliyor)
      for (let i = 0; i < formattedNodes.length; i++) {
        const node = formattedNodes[i];
        if (node.type === 'lecture' && !node.content?.trim()) {
          try {
            setGenerationStatus(`${node.title} içeriği hazırlanıyor...`);
            setGenerationProgress(68 + Math.floor((i / formattedNodes.length) * 20));

            const totalLectures = formattedNodes.filter(n => n.type === 'lecture').length;
            const currentLectureIndex = formattedNodes.slice(0, i + 1).filter(n => n.type === 'lecture').length;

            const previousLectureNodes = formattedNodes
              .slice(0, i)
              .filter((chapter) => chapter.type === 'lecture' && Boolean(chapter.content?.trim()));
            const normalizeContextChapterText = (value: string | undefined): string => String(value || '')
              .replace(/!\[[^\]]*]\(\s*<?(?:data:image\/[^)]+|https?:\/\/[^)]+)>?\s*\)/gi, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            const isFairyTaleFlow = finalBookType === 'fairy_tale';
            const previousChapterContent = previousLectureNodes.length > 0
              ? (() => {
                const raw = normalizeContextChapterText(previousLectureNodes[previousLectureNodes.length - 1].content);
                return isFairyTaleFlow ? raw : raw.slice(-2800);
              })()
              : undefined;
            const storySoFarContent = previousLectureNodes.length > 0
              ? (() => {
                const raw = previousLectureNodes
                  .map((chapter, chapterIndex) => {
                    const chapterText = normalizeContextChapterText(chapter.content);
                    if (!chapterText) return '';
                    return `[Bölüm ${chapterIndex + 1} - ${chapter.title}]\n${isFairyTaleFlow ? chapterText : chapterText.slice(0, 1800)}`;
                  })
                  .filter(Boolean)
                  .join('\n\n')
                  .trim();
                return isFairyTaleFlow ? raw : raw.slice(-8200).trim();
              })()
              : undefined;

            const chapterContent = await generateLectureContent(
              workingBookTitle,
              node.title,
              selectedAgeGroup,
              {
                bookType: finalBookType,
                subGenre: finalSubGenre || undefined,
                targetPageCount,
                creativeBrief: {
                  ...creativeBrief,
                  bookType: finalBookType,
                  subGenre: finalSubGenre || undefined
                },
                narrativeContext: {
                  outlinePositions: { current: currentLectureIndex, total: totalLectures },
                  previousChapterContent,
                  storySoFarContent
                },
                deferImageGeneration: true
              }
            );
            const chapterContentWithBookTitle = currentLectureIndex === 1
              ? ensureMainBookTitleHeading(chapterContent, workingBookTitle)
              : chapterContent;
            let chapterContentWithImages = chapterContentWithBookTitle;
            try {
              setGenerationStatus(`${node.title} görselleri hazırlanıyor...`);
              chapterContentWithImages = await generateLectureImages(
                workingBookTitle,
                node.title,
                chapterContentWithBookTitle,
                selectedAgeGroup,
                {
                  bookType: finalBookType,
                  subGenre: finalSubGenre || undefined,
                  targetPageCount,
                  creativeBrief: {
                    ...creativeBrief,
                    bookType: finalBookType,
                    subGenre: finalSubGenre || undefined
                  },
                  narrativeContext: {
                    outlinePositions: { current: currentLectureIndex, total: totalLectures },
                    previousChapterContent,
                    storySoFarContent
                  }
                }
              );
            } catch (imageError) {
              console.warn(`Bölüm ${i + 1} image generation failed:`, imageError);
            }
            const chapterMinutes = Math.max(1, Math.min(15, estimateReadingMinutesFromText(chapterContentWithImages)));
            formattedNodes[i] = {
              ...node,
              content: chapterContentWithImages,
              duration: `${chapterMinutes} ${t('dk')}`,
              status: 'current'
            };
          } catch (error) {
            console.warn(`Bölüm ${i + 1} generation failed:`, error);
          }
        }
      }
      const generatedSectionTitleHints = formattedNodes
        .filter((item) => item.type === 'lecture')
        .map((item) => compactInlineText(item.title))
        .filter(Boolean);
      const finalBookTitle = (() => {
        const aiResolvedTitle = resolveAutoNarrativeBookTitle({
          bookType: finalBookType,
          subGenre: finalSubGenre,
          topicTitle: normalizedTopic,
          aiTitle: aiSuggestedBookTitle,
          outlineTitle: outlineLeadTitle,
          generatedSectionTitles: generatedSectionTitleHints
        });
        if (isAutoStoryMode && !searchTerm.trim()) {
          if (!aiResolvedTitle) {
            throw new Error('AI son kitap adını üretemedi.');
          }
          return aiResolvedTitle;
        }

        const userTitleCandidate = toTitleCaseTr(compactInlineText(normalizedTopic));
        const userTitleIsGeneric = isNarrativeBookTitleTooGeneric(userTitleCandidate, {
          bookType: finalBookType,
          subGenre: finalSubGenre,
          topic: ''
        });
        return userTitleIsGeneric ? (aiResolvedTitle || userTitleCandidate) : userTitleCandidate;
      })();
      const firstLectureWithContentIndex = formattedNodes.findIndex(
        (item) => item.type === 'lecture' && Boolean(item.content?.trim())
      );
      if (firstLectureWithContentIndex >= 0) {
        const firstLectureNode = formattedNodes[firstLectureWithContentIndex];
        formattedNodes[firstLectureWithContentIndex] = {
          ...firstLectureNode,
          content: ensureMainBookTitleHeading(String(firstLectureNode.content || ''), finalBookTitle)
        };
      }
      setGenerationProgress(88);

      const courseDescription = aiBookDescription || deriveSmartBookDescription(
        finalBookTitle,
        formattedNodes,
        finalBookType,
        finalSubGenre
      );
      const languageProbe = [
        compactInlineText(bookLanguageInput),
        finalBookTitle,
        courseDescription,
        typeof sourceContent === 'string' ? sourceContent.slice(0, 1800) : ''
      ]
        .filter(Boolean)
        .join(' ');
      const detectedCourseLanguage = detectLikelyLanguage(languageProbe);
      const requestedCourseLanguage = normalizeAppLanguageCode(compactInlineText(bookLanguageInput));
      const courseLanguage = requestedCourseLanguage || (detectedCourseLanguage !== 'unknown' ? detectedCourseLanguage : undefined);

      const totalMinutes = formattedNodes.reduce((sum, node) => {
        const match = node.duration?.match(/\d+/);
        return sum + (match ? parseInt(match[0], 10) : 0);
      }, 0);

      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      const durationStr = hours > 0
        ? `${hours} ${t('saat')} ${mins > 0 ? `${mins} ${t('dk')} ` : ''}${t('toplam çalışma')}`
        : `${totalMinutes} ${t('dk')} ${t('toplam çalışma')}`;

      const derivedCategory = 'Edebiyat';
      const searchTags = buildSmartBookSearchTags({
        topic: finalBookTitle,
        description: courseDescription,
        category: derivedCategory,
        aiTags: courseMeta?.searchTags,
        nodes: formattedNodes as TimelineNode[]
      });
      if (finalSubGenre) {
        searchTags.unshift(finalSubGenre);
      }

      const coverContextText = formattedNodes
        .filter((node) => node.type === 'lecture')
        .map((node) => {
          const body = compactInlineText(String(node.content || '')).slice(0, 700);
          return body ? `[${node.title}] ${body}` : '';
        })
        .filter(Boolean)
        .join('\n\n')
        .slice(0, 6500);

      setGenerationStatus('Kapak görseli içerikten üretiliyor...');
      setGenerationProgress(90);
      const coverImageUrl = await generateCourseCover(
        finalBookTitle,
        selectedAgeGroup,
        {
          bookType: finalBookType,
          subGenre: finalSubGenre || undefined,
          creativeBrief: {
            ...creativeBrief,
            bookType: finalBookType,
            subGenre: finalSubGenre || undefined
          },
          coverContext: [
            `Tür: ${finalBookType}`,
            finalSubGenre ? `Alt Tür: ${finalSubGenre}` : '',
            `Özet: ${courseDescription}`,
            coverContextText,
            typeof sourceContent === 'string' ? sourceContent.slice(0, 1200) : ''
          ]
            .filter(Boolean)
            .join('\n\n')
            .slice(0, 8000)
        }
      );

      setGenerationStatus('Fortale paketleniyor...');
      setGenerationProgress(92);
      onCourseCreate({
        id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : Date.now().toString(),
        topic: finalBookTitle,
        description: courseDescription,
        creatorName: compactInlineText(creatorNameInput) || undefined,
        language: courseLanguage,
        ageGroup: selectedAgeGroup,
        bookType: finalBookType,
        subGenre: finalSubGenre || undefined,
        creativeBrief: {
          ...creativeBrief,
          bookType: finalBookType,
          subGenre: finalSubGenre || undefined
        },
        targetPageCount,
        category: derivedCategory,
        searchTags,
        totalDuration: durationStr,
        coverImageUrl,
        isPublic: true,
        nodes: formattedNodes as any,
        createdAt: new Date(),
        lastActivity: new Date()
      });
      setGenerationProgress(100);
      setSearchTerm('');
      setHeroNamesInput('');
      setStoryInputMode(null);
      setStoryBlueprintInput('');
      setSettingPlaceInput('');
      setSettingTimeInput('');
      setCreatorNameInput('');
      setBookLanguageInput(defaultBookLanguage);
      setCreationStep(1);
      clearSourceFile();
    } catch (error) {
      console.error('Course generation failed', error);
      setSourceNotice(getUserFacingError(error, 'Fortale oluşturulurken bir hata oluştu.'));
    } finally {
      setIsGenerating(false);
      window.setTimeout(() => {
        setGenerationStatus('');
        setGenerationProgress(0);
      }, 500);
    }
  };

  const getNextStep = (course: CourseData): TimelineNode | undefined => {
    return course.nodes.find((n) => n.status === 'current') || course.nodes.find((n) => n.status === 'locked');
  };

  const getProgress = (course: CourseData) => {
    const nodes = Array.isArray(course.nodes) ? course.nodes : [];
    if (nodes.length === 0) return 0;
    const completed = nodes.filter((n) => n.status === 'completed').length;
    const rawProgress = Math.round((completed / nodes.length) * 100);
    if (!Number.isFinite(rawProgress)) return 0;
    return Math.max(0, Math.min(100, rawProgress));
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
    if (diffInSeconds < 60) return t('Az önce');
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} ${t('dk önce')}`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ${t('saat önce')}`;
    return `${Math.floor(diffInSeconds / 86400)} ${t('gün önce')}`;
  };

  const renderStickyCard = (note: StickyNoteData, fullWidth = false) => {
    const tint = stickyTintById.get(note.id) || stickyTintPalette[0];
    return (
      <button
        key={note.id}
        onClick={() => openStickyModal(note)}
        className={`${fullWidth ? 'w-full' : 'shrink-0'} min-h-[58px] rounded-xl border border-dashed px-3 py-2 text-left transition-colors hover:border-white/60`}
        style={fullWidth
          ? { backgroundColor: tint.bg, borderColor: tint.border }
          : {
            flex: '0 0 clamp(128px, 30vw, 220px)',
            backgroundColor: tint.bg,
            borderColor: tint.border
          }}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[12px] font-semibold text-white truncate">
            {note.title || t('Yapışkan Not')}
          </span>
          <StickyNote size={12} className="text-zinc-300 shrink-0" />
        </div>
        <p className={`text-[11px] text-zinc-300/85 ${fullWidth ? 'line-clamp-2' : 'truncate'}`}>
          {note.text || t('Boş not')}
        </p>
        {fullWidth && (
          <span className="mt-2 block text-[10px] text-zinc-400 text-right">
            {formatStickyDate(note.lastActivity, locale)}
          </span>
        )}
      </button>
    );
  };

  const renderHomeCourseCard = (course: CourseData) => {
    const progress = getProgress(course);
    const nextStep = getNextStep(course);

    return (
      <button
        key={course.id}
        onClick={() => onCourseSelect(course.id)}
        className="group h-full rounded-[24px] border border-dashed p-3 text-left transition-all active:scale-[0.99] md:p-3.5"
        style={{
          background: 'rgba(17, 22, 29, 0.42)',
          borderColor: 'rgba(188, 194, 203, 0.1)',
          boxShadow: 'inset 0 0 0 1px rgba(188, 194, 203, 0.06)'
        }}
      >
        <div className="flex items-start gap-3.5">
          <div
            className="relative shrink-0 h-[92px] w-[69px] overflow-hidden rounded-[4px] md:h-[104px] md:w-[78px]"
            style={course.coverImageUrl
              ? { background: 'transparent' }
              : { background: 'rgba(44, 48, 53, 0.86)' }}
          >
            {course.coverImageUrl ? (
              <img
                src={course.coverImageUrl}
                alt={`${course.topic} ${t('Fortale kapağı')}`}
                className="h-full w-full object-contain object-center border-0"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <BookOpen size={20} className="text-zinc-500" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="line-clamp-2 text-[13px] font-bold leading-[1.25] text-white">
                  {course.topic}
                </p>
                <p className="mt-1 line-clamp-1 text-[10px] text-zinc-300">
                  {nextStep?.title || t('Fortale Tamamlandı')}
                </p>
              </div>

              <div className="relative flex h-[42px] w-[42px] shrink-0 items-center justify-center md:h-[46px] md:w-[46px]">
                <svg className="h-full w-full -rotate-90 transform">
                  <circle cx="21" cy="21" r="16" stroke="rgba(79,107,141,0.28)" strokeWidth="3" fill="transparent" />
                  <circle
                    cx="21"
                    cy="21"
                    r="16"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 16}
                    strokeDashoffset={2 * Math.PI * 16 * (1 - progress / 100)}
                    className="text-accent-green transition-all duration-700 ease-out"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-[8px] font-black text-accent-green">%{progress}</span>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-semibold text-[#b9cde8]"
                style={{ background: 'rgba(23, 38, 58, 0.9)', boxShadow: 'inset 0 0 0 1px rgba(55,80,111,0.22)' }}
              >
                {t(bookTypeToLabel(course.bookType))}
              </span>
              {course.subGenre?.trim() && (
                <span
                  className="inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-semibold text-[#b9cde8]"
                  style={{ background: 'rgba(23, 38, 58, 0.9)', boxShadow: 'inset 0 0 0 1px rgba(55,80,111,0.22)' }}
                >
                  {t(course.subGenre.trim())}
                </span>
              )}
              <span
                className="inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-semibold text-[#b9cde8]"
                style={{ background: 'rgba(23, 38, 58, 0.9)', boxShadow: 'inset 0 0 0 1px rgba(55,80,111,0.22)' }}
              >
                {t(getSmartBookAgeGroupLabel(course.ageGroup))}
              </span>
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#17263a] px-2 py-1" title={t('Tahmini okuma süresi')}>
                <Clock3 size={10} className="text-[#7fb1ec]" />
                <span className="text-[10px] text-[#b9cde8]">
                  {estimateCourseReadingDuration(course, t)}
                </span>
              </div>
            </div>

            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-[#233246]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #5aa9ff 0%, #3b82f6 100%)'
                  }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[10px] text-[#9cb9d7]">{formatTimeAgo(course.lastActivity)}</span>
                <span className="inline-flex items-center rounded-xl border border-dashed border-[#7da9d7]/35 bg-[#163052] px-2.5 py-1 text-[10px] font-bold text-white transition-transform group-active:scale-95">
                  {t('Devam Et')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </button>
    );
  };

  const hasStickyContent = Boolean(stickyModal.title.trim() || stickyModal.text.trim());
  const isCreationStepComplete = (step: number): boolean => {
    if (step === 1) return Boolean(selectedBookType);
    if (step === 2) return Boolean(selectedSubGenre);
    if (step === 3) return Boolean(selectedAgeGroup);
    if (step === 4) return Boolean(bookLanguageInput.trim());
    if (step === 5) return storyInputMode === 'auto' || (storyInputMode === 'manual' && Boolean(storyBlueprintInput.trim()));
    if (storyInputMode === 'auto' && [6, 7, 8].includes(step)) return true;
    if (step === 6) return Boolean(settingTimeInput.trim());
    if (step === 7) return Boolean(settingPlaceInput.trim());
    if (step === 8) return Boolean(searchTerm.trim());
    if (step === 9) return Boolean(creatorNameInput.trim());
    return false;
  };
  const getNextCreationStep = (step: number): number => {
    if (step === 5 && storyInputMode === 'auto') return 9;
    return Math.min(CREATION_STEP_COUNT, step + 1);
  };
  const getPreviousCreationStep = (step: number): number => {
    if (step === 9 && storyInputMode === 'auto') return 5;
    return Math.max(1, step - 1);
  };
  const isCurrentStepComplete = isCreationStepComplete(creationStep);
  const isAllStepsComplete = Array.from({ length: CREATION_STEP_COUNT }, (_, index) => isCreationStepComplete(index + 1)).every(Boolean);
  const stepProgressPercent = Math.round((creationStep / CREATION_STEP_COUNT) * 100);
  const currentStepTitle = t(CREATION_STEP_TITLES[Math.max(0, Math.min(CREATION_STEP_COUNT - 1, creationStep - 1))]);
  const canMoveNext = creationStep < CREATION_STEP_COUNT && isCurrentStepComplete && !isGenerating;
  const canCreateOnFinalStep = creationStep === CREATION_STEP_COUNT && isAllStepsComplete && !isGenerating;
  const creationStepPalette = ['#f3d156', '#82d96a', '#67d6ff', '#7fa8ff', '#c8a4ff', '#f08d7f', '#f7d37b', '#78e0c3', '#9ec4ff'];
  const wizardFieldClass = 'mt-1 h-10 w-full rounded-xl border border-dashed px-2.5 text-[13px] text-zinc-100 placeholder:text-[#8ca7c6] focus:outline-none';
  const wizardFieldStyle = {
    borderColor: 'rgba(118,170,226,0.48)',
    background: 'linear-gradient(180deg, rgba(21,35,54,0.92) 0%, rgba(17,27,40,0.95) 100%)',
    boxShadow: 'inset 0 0 0 1px rgba(88,123,163,0.24)'
  };
  const wizardTextareaClass = 'mt-1 w-full rounded-xl border border-dashed px-2.5 py-2.5 text-[13px] text-zinc-100 placeholder:text-[#8ca7c6] resize-none focus:outline-none';
  const wizardOptionPanelStyle = {
    background: 'linear-gradient(160deg, rgba(19,33,50,0.76) 0%, rgba(16,24,35,0.86) 100%)',
    borderColor: 'rgba(104,152,205,0.3)',
    boxShadow: 'inset 0 0 0 1px rgba(86,130,181,0.16)'
  };
  const wizardOptionButtonStyle = (isSelected: boolean) => ({
    background: isSelected ? 'linear-gradient(135deg, rgba(35,67,103,0.98) 0%, rgba(25,47,72,0.96) 100%)' : 'rgba(14,21,31,0.42)',
    boxShadow: isSelected
      ? 'inset 0 0 0 1px rgba(165,207,255,0.45), 0 0 16px rgba(95,141,197,0.24)'
      : 'inset 0 0 0 1px rgba(86,133,190,0.22)'
  });
  const showStickyNotes = false;
  const stickyModalTop =
    stickyRowContainerRef.current
      ? `${Math.round(stickyRowContainerRef.current.getBoundingClientRect().bottom)}px`
      : STICKY_MODAL_TOP_INSET;

  return (
    <div
      className="view-container"
      style={{
        background:
          'radial-gradient(circle at 12% 7%, rgba(154, 172, 191, 0.11), transparent 44%), radial-gradient(circle at 88% 11%, rgba(118, 132, 148, 0.1), transparent 42%), linear-gradient(180deg, #2d353d 0%, #232a31 100%)'
      }}
    >
      <div className="app-content-width space-y-6">
        {showStickyNotes && (
          <section ref={stickyRowContainerRef} className="relative">
            {isStickyRowExpanded && (
              <div
                className="absolute left-0 right-0 top-full z-30 rounded-2xl border border-dashed border-zinc-500/45 p-2 shadow-[0_20px_30px_-24px_rgba(0,0,0,0.75)]"
                style={{ background: 'rgba(17, 22, 29, 0.94)' }}
              >
                <div className="max-h-[58vh] overflow-y-auto hide-scrollbar space-y-2">
                  {sortedStickyNotes.length === 0 ? (
                    <div className="text-[11px] text-zinc-400 px-2 py-1">{t('Henüz yapışkan not yok.')}</div>
                  ) : (
                    sortedStickyNotes.map((note) => renderStickyCard(note, true))
                  )}
                </div>
              </div>
            )}

            <div className="overflow-x-auto overflow-y-hidden pb-1 hide-scrollbar">
              <div className="flex items-stretch gap-2 min-w-full">
                <div
                  className="shrink-0 min-h-[58px] rounded-xl border border-dashed border-zinc-500/65 bg-white/[0.04] overflow-hidden flex"
                  style={{ flex: '0 0 clamp(128px, 30vw, 220px)' }}
                >
                  <button
                    onClick={() => setIsStickyRowExpanded((prev) => !prev)}
                    className={`flex-1 border-r border-dashed transition-colors flex items-center justify-center ${isStickyRowExpanded
                      ? 'border-[#6287b3]/60 bg-[#1d3855]/22 text-[#c4dbf5]'
                      : 'border-[#5a7aa0]/45 text-[#abc7e7] hover:bg-[#1d3855]/16'
                      }`}
                    title={isStickyRowExpanded ? t('Kapat') : t('Genişlet')}
                    aria-label={isStickyRowExpanded ? t('Kapat') : t('Genişlet')}
                  >
                    <ChevronDown size={16} className={isStickyRowExpanded ? 'rotate-180' : ''} />
                  </button>
                  <button
                    onClick={() => openStickyModal()}
                    className="flex-[1.6] text-accent-green hover:bg-accent-green/10 transition-colors flex items-center justify-center"
                    title={t('Yapışkan not ekle')}
                    aria-label={t('Yapışkan not ekle')}
                  >
                    <Plus size={18} />
                  </button>
                </div>
                {sortedStickyNotes.map((note) => renderStickyCard(note))}
              </div>
            </div>
          </section>
        )}

        {isBootstrapping && savedCourses.length === 0 && (
          <section>
            <div
              className="rounded-2xl border border-dashed p-4 text-center"
              style={{
                background: 'rgba(17, 22, 29, 0.42)',
                borderColor: 'rgba(120,171,226,0.28)',
                boxShadow: 'inset 0 0 0 1px rgba(54,79,108,0.18)'
              }}
            >
              <div className="flex flex-col items-center gap-3">
                <FaviconSpinner size={28} />
                <div>
                  <h3 className="text-[13px] font-bold text-white">{t('Kitaplar senkronize ediliyor')}</h3>
                  <p className="mt-1 text-[11px] text-text-secondary">{bootstrapMessage}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="relative">
          <input
            ref={sourceFileInputRef}
            type="file"
            accept={DOCUMENT_ACCEPT}
            onChange={handleSourceFilePick}
            className="hidden"
          />

          <form
            onSubmit={(event) => event.preventDefault()}
            className="relative z-10 rounded-2xl"
          >
            <div
              className="rounded-2xl border border-dashed p-2.5 overflow-hidden"
              style={{
                background: 'linear-gradient(160deg, rgba(24,38,57,0.94) 0%, rgba(17,22,29,0.94) 55%, rgba(14,24,38,0.95) 100%)',
                borderColor: 'rgba(120,171,226,0.34)',
                boxShadow: 'inset 0 0 0 1px rgba(93,128,168,0.18)'
              }}
            >
              <div className="px-1.5 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold tracking-wide text-[#d4e6fa]">{t('Kitabınızı Oluşturun')}</span>
                  <span className="text-[11px] font-semibold text-[#afcbed]">{t('Adım')} {creationStep}/{CREATION_STEP_COUNT}</span>
                </div>
                <p className="mt-1 text-[15px] font-bold text-white">{currentStepTitle}</p>
                <div className="mt-2 h-1.5 rounded-full bg-[#152131] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${stepProgressPercent}%`,
                      background: 'linear-gradient(90deg, #f3d156 0%, #82d96a 35%, #67d6ff 70%, #7fa8ff 100%)'
                    }}
                  />
                </div>
                <div className="mt-2 grid grid-cols-9 gap-1">
                  {Array.from({ length: CREATION_STEP_COUNT }, (_, index) => {
                    const stepNo = index + 1;
                    const isDone = stepNo < creationStep;
                    const isCurrent = stepNo === creationStep;
                    const stepAccent = creationStepPalette[index % creationStepPalette.length];
                    return (
                      <span
                        key={stepNo}
                        className={`h-7 rounded-md border border-dashed flex items-center justify-center text-[11px] font-bold ${isCurrent
                          ? 'text-white'
                          : isDone
                            ? 'text-[#e7f3ff]'
                            : 'text-[#7f97b3]'
                          }`}
                        style={isCurrent
                          ? {
                            borderColor: 'rgba(172,208,243,0.56)',
                            background: 'linear-gradient(135deg, rgba(36,68,104,0.95) 0%, rgba(24,44,70,0.92) 100%)',
                            boxShadow: 'inset 0 0 0 1px rgba(165,207,255,0.38), 0 0 12px rgba(100,151,214,0.2)'
                          }
                          : isDone
                            ? {
                              borderColor: `${stepAccent}aa`,
                              background: 'rgba(18,31,45,0.92)',
                              boxShadow: `inset 0 0 0 1px ${stepAccent}66, 0 0 12px ${stepAccent}33`
                            }
                            : {
                              borderColor: 'rgba(70,95,124,0.34)',
                              background: 'rgba(18,28,40,0.65)'
                            }}
                      >
                        {stepNo}
                      </span>
                    );
                  })}
                </div>
              </div>

              <fieldset disabled={isGenerating} className="px-1.5 pb-1">
                {creationStep === 1 && (
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold tracking-wide text-[#cfe2f7]">{t('Kitap Türünü Seç')}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-dashed p-1" style={wizardOptionPanelStyle}>
                      {SMARTBOOK_BOOK_TYPE_OPTIONS.map((option) => {
                        const isSelected = selectedBookType === option.value;
                        const createCost = getBookTypeCreateCreditCost(option.value);
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setSelectedBookType(option.value);
                              if (option.value === 'fairy_tale') {
                                setSelectedEndingStyle('happy');
                              }
                              if (option.value === 'fairy_tale' && !['4-6', '7-9'].includes(selectedAgeGroup)) {
                                setSelectedAgeGroup('4-6');
                              } else if (option.value !== 'fairy_tale' && ['4-6', '7-9'].includes(selectedAgeGroup)) {
                                setSelectedAgeGroup('general');
                              }
                            }}
                            className="rounded-xl px-2 py-1.5 text-left transition-colors"
                            style={wizardOptionButtonStyle(isSelected)}
                            aria-pressed={isSelected}
                            title={t(option.hint)}
                          >
                            <span className="block text-[12px] font-bold text-white">{t(option.label)}</span>
                            <span className="mt-0.5 block text-[10px] font-semibold text-[#b9d2f1]/95">{createCost} {t('kredi')}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {creationStep === 3 && (
                  <div>
                    <p className="mb-1 text-[12px] font-semibold tracking-wide text-[#cfe2f7]">{t('Yaş Grubunu Seç')}</p>
                    <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-dashed p-1" style={wizardOptionPanelStyle}>
                      {SMARTBOOK_AGE_GROUP_OPTIONS.filter((opt) => selectedBookType === 'fairy_tale' ? ['4-6', '7-9'].includes(opt.value) : !['4-6', '7-9'].includes(opt.value)).map((option) => {
                        const isSelected = selectedAgeGroup === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setSelectedAgeGroup(option.value)}
                            className="rounded-xl px-2 py-1.5 text-left transition-colors"
                            style={wizardOptionButtonStyle(isSelected)}
                            aria-pressed={isSelected}
                            title={t(option.hint)}
                          >
                            <span className="block text-[12px] font-bold text-white">{t(option.label)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {creationStep === 4 && (
                  <div>
                    <label className="text-[12px] text-[#cfe2f7] font-semibold tracking-wide">{t('Kitap Dili')}</label>
                    <input
                      value={bookLanguageInput}
                      onChange={(event) => setBookLanguageInput(event.target.value)}
                      maxLength={64}
                      placeholder={t('Örn: Türkçe, English, Español')}
                      className={wizardFieldClass}
                      style={wizardFieldStyle}
                    />
                  </div>
                )}

                {creationStep === 2 && (
                  <div>
                    <p className="mb-1 text-[12px] font-semibold tracking-wide text-[#cfe2f7]">{t('Alt Tür Seç')}</p>
                    <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-dashed p-1" style={wizardOptionPanelStyle}>
                      {(SMARTBOOK_SUBGENRE_OPTIONS[selectedBookType] || []).map((sub) => {
                        const isSelected = selectedSubGenre === sub;
                        return (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => setSelectedSubGenre(sub)}
                            className="rounded-xl px-2 py-1.5 text-left transition-colors text-[12px] font-bold"
                            style={{
                              color: isSelected ? '#ffffff' : '#c6d9ef',
                              ...wizardOptionButtonStyle(isSelected)
                            }}
                          >
                            {t(sub)}
                          </button>
                        );
                      })}
                    </div>

                    {selectedBookType !== 'fairy_tale' && (
                      <>
                        <p className="mt-2 mb-1 text-[12px] font-semibold tracking-wide text-[#cfe2f7]">{t('Final Tercihi')}</p>
                        <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-dashed p-1" style={wizardOptionPanelStyle}>
                          {SMARTBOOK_ENDING_OPTIONS.map((option) => {
                            const isSelected = selectedEndingStyle === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => setSelectedEndingStyle(option.value)}
                                className="rounded-xl px-2 py-1.5 text-[12px] font-bold transition-colors"
                                style={{
                                  color: isSelected ? '#ffffff' : '#c6d9ef',
                                  ...wizardOptionButtonStyle(isSelected)
                                }}
                                title={t(option.hint)}
                              >
                                {t(option.label)}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {creationStep === 5 && (
                  <div className="space-y-2">
                    <div>
                      <p className="mb-1 text-[12px] font-semibold tracking-wide text-[#cfe2f7]">{t('Kurgu Modu')}</p>
                      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-dashed p-1" style={wizardOptionPanelStyle}>
                        <button
                          type="button"
                          onClick={() => {
                            setStoryInputMode('auto');
                            setCreationStep(9);
                          }}
                          className="rounded-xl px-2 py-1.5 text-left transition-colors text-[12px] font-bold"
                          style={{
                            color: storyInputMode === 'auto' ? '#ffffff' : '#c6d9ef',
                            ...wizardOptionButtonStyle(storyInputMode === 'auto')
                          }}
                        >
                          {t('Otomatik Oluştur')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setStoryInputMode('manual')}
                          className="rounded-xl px-2 py-1.5 text-left transition-colors text-[12px] font-bold"
                          style={{
                            color: storyInputMode === 'manual' ? '#ffffff' : '#c6d9ef',
                            ...wizardOptionButtonStyle(storyInputMode === 'manual')
                          }}
                        >
                          {t('Detay Gireceğim')}
                        </button>
                      </div>
                    </div>

                    <div>
                      {storyInputMode === 'manual' ? (
                        <>
                          <label className="text-[12px] text-[#cfe2f7] font-semibold tracking-wide">{t('Karakterler ve Detaylar')}</label>
                          <textarea
                            value={storyBlueprintInput}
                            onChange={(event) => setStoryBlueprintInput(event.target.value)}
                            maxLength={1600}
                            rows={5}
                            placeholder={t('Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın')}
                            className={wizardTextareaClass}
                            style={wizardFieldStyle}
                          />
                        </>
                      ) : (
                        <p className="text-[12px] text-[#a8c4e6]">
                          {t('Otomatik modda model kurgu detaylarını kendisi oluşturur. Seçimden sonra doğrudan Oluşturucu adımına geçilir.')}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {creationStep === 6 && (
                  <div>
                    <label className="text-[12px] text-[#cfe2f7] font-semibold tracking-wide">{t('Hikayenin Zamanı')}</label>
                    <input
                      value={settingTimeInput}
                      onChange={(event) => setSettingTimeInput(event.target.value)}
                      maxLength={120}
                      placeholder={t("Örn: 1800'ler, günümüz, 2090 sonrası")}
                      className={wizardFieldClass}
                      style={wizardFieldStyle}
                    />
                  </div>
                )}

                {creationStep === 7 && (
                  <div>
                    <label className="text-[12px] text-[#cfe2f7] font-semibold tracking-wide">{t('Hikayenin Mekanı')}</label>
                    <input
                      value={settingPlaceInput}
                      onChange={(event) => setSettingPlaceInput(event.target.value)}
                      maxLength={120}
                      placeholder={t('Örn: İstanbul, antik kent, Mars kolonisi')}
                      className={wizardFieldClass}
                      style={wizardFieldStyle}
                    />
                  </div>
                )}

                {creationStep === 8 && (
                  <div>
                    <label className="text-[12px] text-[#cfe2f7] font-semibold tracking-wide">{t('Kitabın Adı')}</label>
                    <input
                      value={searchTerm}
                      onChange={(event) => {
                        setSearchTerm(event.target.value);
                        if (sourceNotice) setSourceNotice(null);
                      }}
                      maxLength={140}
                      placeholder={t('Örn: Albert Einstein ve Kuramları')}
                      className={wizardFieldClass}
                      style={wizardFieldStyle}
                    />
                  </div>
                )}

                {creationStep === 9 && (
                  <div>
                    <label className="block text-[12px] text-[#cfe2f7] font-semibold tracking-wide">{t('Kahraman İsimleri (Opsiyonel)')}</label>
                    <input
                      value={heroNamesInput}
                      onChange={(event) => setHeroNamesInput(event.target.value)}
                      maxLength={180}
                      placeholder={t('Örn: Elara, Aras, Mira')}
                      className={wizardFieldClass}
                      style={wizardFieldStyle}
                    />
                    <label className="mt-2 block text-[12px] text-[#cfe2f7] font-semibold tracking-wide">{t('Oluşturucu (Ad Soyad)')}</label>
                    <input
                      value={creatorNameInput}
                      onChange={(event) => setCreatorNameInput(event.target.value)}
                      maxLength={90}
                      placeholder={t('Örn: Ayşe Demir')}
                      className={wizardFieldClass}
                      style={wizardFieldStyle}
                    />
                  </div>
                )}
              </fieldset>

              {sourceNotice && (
                <div className="mt-2 px-1">
                  <p className="text-[11px] text-red-300">{sourceNotice}</p>
                </div>
              )}

              {isGenerating ? (
                <div className="mt-3 rounded-2xl border border-dashed border-[#6c90ba]/35 bg-[rgba(19,33,51,0.86)] p-3">
                  <div className="mx-auto fortale-book-shell">
                    <div className="fortale-book-silhouette" />
                    <div className="fortale-book-sheen" />
                    <div className="fortale-book-scan-line" />
                  </div>
                  <p className="mt-2 text-center text-[11px] font-bold text-white">
                    {generationStatus || t('Fortale oluşturuluyor...')}
                  </p>
                  <div className="mt-2 h-2 rounded-full bg-[#102033] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#4b82bc] transition-all duration-300"
                      style={{ width: `${Math.max(4, Math.min(100, generationProgress || 0))}%` }}
                    />
                  </div>
                  <p className="mt-1 text-center text-[10px] text-[#b6cde8]">%{Math.max(4, Math.min(100, Math.round(generationProgress || 0)))}</p>
                  <div className="mt-1 flex items-center justify-center">
                    <FaviconSpinner size={26} />
                  </div>
                </div>
              ) : (
                <div className={`mt-3 flex items-center gap-2 ${creationStep === 1 ? 'justify-end' : 'justify-between'}`}>
                  {creationStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setCreationStep((prev) => getPreviousCreationStep(prev))}
                      className="h-10 px-3.5 rounded-2xl border border-dashed text-[12px] font-semibold inline-flex items-center gap-1.5 border-[#759fd0]/48 text-[#d0e4fb] bg-[#163052] hover:bg-[#1a3a63]"
                    >
                      <ArrowLeft size={14} />
                      {t('Geri')}
                    </button>
                  )}

                  {creationStep < CREATION_STEP_COUNT ? (
                    <button
                      type="button"
                      onClick={() => setCreationStep((prev) => getNextCreationStep(prev))}
                      disabled={!canMoveNext}
                      className={`h-10 px-4 rounded-2xl border border-dashed text-[12px] font-bold inline-flex items-center gap-1.5 ${canMoveNext
                        ? 'border-[#8cc9ff]/50 text-white bg-gradient-to-r from-[#1b4f86] via-[#2a67a4] to-[#2c5a9a] active:scale-95'
                        : 'border-[#3f556f]/30 text-[#7288a2] bg-[#172233]'
                        }`}
                    >
                      {t('İleri')}
                      <ArrowRight size={14} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleCreateSmartBook()}
                      disabled={!canCreateOnFinalStep}
                      className={`h-10 px-4 rounded-2xl border border-dashed text-[12px] font-bold inline-flex items-center gap-1.5 ${canCreateOnFinalStep
                        ? 'border-[#ffd97a]/82 text-white bg-gradient-to-r from-[#1f5c97] via-[#2f70b4] to-[#3a87ca] active:scale-95'
                        : 'border-[#3f556f]/30 text-[#7288a2] bg-[#172233]'
                        }`}
                    >
                      <BookPlus size={15} />
                      {`${t('Fortale Oluştur')} (${selectedCreateCreditCost} ${t('kredi')})`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </form>
        </section>

        {homeShelfCourses.length > 0 ? (
          <section className="pb-4">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div>
                <h2 className="text-[10px] font-bold tracking-[0.24em] text-text-secondary opacity-70">{t('Kitap Rafın')}</h2>
                <p className="mt-1 text-[12px] font-semibold text-white">{t('Son açtığın kitaplar burada.')}</p>
              </div>
              <span className="rounded-full border border-dashed border-[rgba(120,171,226,0.22)] bg-[rgba(18,31,48,0.84)] px-2.5 py-1 text-[10px] font-bold text-[#cfe4fb]">
                {sortedCourses.length} {t('kitap')}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {homeShelfCourses.map((course) => renderHomeCourseCard(course))}
            </div>
          </section>
        ) : (
          <div className="glass-panel p-6 rounded-2xl border-white/10 flex flex-col items-center text-center space-y-4">
            {isBootstrapping ? (
              <>
                <FaviconSpinner size={28} />
                <div>
                  <h3 className="text-sm font-bold text-white">{t('Kitaplar senkronize ediliyor')}</h3>
                  <p className="text-[10px] text-text-secondary max-w-[240px] mt-1">{bootstrapMessage}</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 glass-icon text-accent-green">
                  <Plus size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{t('Yeni Bir Fortale Başlat')}</h3>
                  <p className="text-[10px] text-[#d2e6ff] mt-1">{t('Build Your Epic')}</p>
                  <p className="text-[10px] text-text-secondary max-w-[220px] mt-1">{t('Konu yazarak veya doküman yükleyerek hemen başlayabilirsin.')}</p>
                </div>
              </>
            )}
          </div>
        )}

      </div>

      {showStickyNotes && stickyModal.isOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-transparent"
            onClick={closeStickyModal}
            aria-label={t('Kapat')}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 w-[min(42rem,calc(100vw-1rem))]"
            style={{
              top: stickyModalTop,
              bottom: STICKY_MODAL_BOTTOM_INSET
            }}
          >
            <div
              className="h-full rounded-2xl border border-dashed shadow-[0_24px_36px_-24px_rgba(0,0,0,0.78)] overflow-hidden flex flex-col"
              style={{
                borderColor: activeStickyTint.border,
                backgroundColor: APP_SURFACE_COLOR
              }}
            >
              <div
                className="px-4 py-3 border-b border-dashed flex items-center gap-3"
                style={{
                  borderColor: activeStickyTint.border,
                  backgroundColor: APP_SURFACE_COLOR
                }}
              >
                <input
                  value={stickyModal.title}
                  onChange={(event) => setStickyModal((prev) => ({ ...prev, title: event.target.value.slice(0, 80) }))}
                  placeholder={t('Başlık ekle')}
                  className="sticky-modal-title-input flex-1 text-sm text-white placeholder:text-zinc-500 outline-none ring-0 focus:!ring-0"
                />
                <div className="text-right shrink-0">
                  <span className="block text-[11px] text-zinc-400">
                    {formatStickyDate(stickyModal.createdAt, locale)}
                  </span>
                  {stickyModal.reminderAt && (
                    <span className="block text-[10px] text-zinc-300">
                      {formatStickyReminder(stickyModal.reminderAt, locale)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={closeStickyModal}
                  className="w-7 h-7 rounded-lg border border-zinc-600/70 text-zinc-300 hover:bg-white/10 transition-colors flex items-center justify-center"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 px-4 pb-4 pt-0" style={{ backgroundColor: APP_SURFACE_COLOR }}>
                <textarea
                  value={stickyModal.text}
                  onChange={(event) => setStickyModal((prev) => ({ ...prev, text: event.target.value }))}
                  placeholder={t('Yapışkan notunu yaz...')}
                  className="w-full h-full resize-none !border-0 !bg-transparent !shadow-none text-[14px] leading-relaxed text-white placeholder:text-zinc-500 outline-none ring-0 focus:!border-0 focus:!ring-0"
                />
              </div>

              {isReminderPickerOpen && (
                <div
                  className="px-3 py-3 border-t border-dashed"
                  style={{
                    borderColor: activeStickyTint.border,
                    backgroundColor: APP_SURFACE_COLOR
                  }}
                >
                  <label className="block text-[11px] text-zinc-300 mb-2">{t('Hatırlatıcı zamanı')}</label>
                  <input
                    type="datetime-local"
                    value={reminderDraft}
                    onChange={(event) => setReminderDraft(event.target.value)}
                    className="w-full h-10 rounded-lg border border-zinc-600/70 bg-black/25 px-2 text-[13px] text-zinc-200 outline-none focus:border-emerald-400/70"
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void handleReminderClear();
                      }}
                      disabled={!stickyModal.reminderAt && !reminderDraft}
                      className="px-3 h-8 rounded-lg border border-dashed border-red-500/70 text-[11px] text-red-400 hover:bg-red-500/10 disabled:opacity-45 disabled:hover:bg-transparent transition-colors"
                    >
                      {t('Kaldır')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleReminderApply();
                      }}
                      disabled={!reminderDraft}
                      className="px-3 h-8 rounded-lg border border-dashed border-emerald-400/70 text-[11px] text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-45 disabled:hover:bg-transparent transition-colors"
                    >
                      {t('Kaydet')}
                    </button>
                  </div>
                </div>
              )}

              <div
                className="px-3 py-2 border-t border-dashed flex items-center justify-between gap-2"
                style={{
                  borderColor: activeStickyTint.border,
                  backgroundColor: APP_SURFACE_COLOR
                }}
              >
                <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar pr-1">
                  {stickyModal.noteId && (
                    <button
                      type="button"
                      onClick={handleStickyDelete}
                      disabled={isStickySaving}
                      className="w-8 h-8 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center disabled:opacity-50"
                      title={t('Sil')}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleStickyDownload}
                    disabled={!hasStickyContent}
                    className="w-8 h-8 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-zinc-300"
                    title={t('İndir')}
                  >
                    <Download size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleStickyCopy();
                    }}
                    disabled={!hasStickyContent}
                    className={`w-8 h-8 rounded-lg transition-colors flex items-center justify-center disabled:opacity-45 disabled:hover:bg-transparent ${isStickyCopyConfirmed ? 'text-emerald-400 bg-emerald-500/15' : 'text-zinc-300 hover:text-white hover:bg-white/10'}`}
                    title={isStickyCopyConfirmed ? t('Kopyalandı.') : t('Kopyala')}
                  >
                    {isStickyCopyConfirmed ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleStickyShare();
                    }}
                    disabled={!hasStickyContent}
                    className="w-8 h-8 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-zinc-300"
                    title={t('Paylaş')}
                  >
                    <Share2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isReminderPickerOpen) {
                        setIsReminderPickerOpen(false);
                        return;
                      }
                      setReminderDraft(toLocalDateTimeValue(stickyModal.reminderAt));
                      setIsReminderPickerOpen(true);
                    }}
                    className={`w-8 h-8 rounded-lg transition-colors flex items-center justify-center ${stickyModal.reminderAt ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-300 hover:text-white hover:bg-white/10'}`}
                    title={stickyModal.reminderAt ? t('Hatırlatıcıyı düzenle') : t('Hatırlatıcı ekle')}
                  >
                    <Bell size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {stickyNotice && <span className="text-[11px] text-zinc-300">{stickyNotice}</span>}
                  <button
                    type="button"
                    onClick={handleStickySave}
                    disabled={isStickySaving || !hasStickyContent}
                    className="btn-glass-primary px-4 py-2 text-[12px] disabled:opacity-50"
                  >
                    {isStickySaving ? <FaviconSpinner size={14} /> : (
                      <>
                        <Check size={14} />
                        {t('Kaydet')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
