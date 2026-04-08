import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ViewState,
  CourseData,
  TimelineNode,
  StickyNoteData,
  SmartBookAgeGroup,
  CreditActionType,
  SmartBookBookType,
  SmartBookCreativeBrief,
  SmartBookEndingStyle,
  CourseOpenUiState
} from '../types';
import { Plus, BookOpen, Clock3, ChevronDown, StickyNote, X, Trash2, Check, Download, Copy, Share2, Bell, BookPlus, ArrowRight, ArrowLeft } from 'lucide-react';
import { extractDocumentContext, getBookGenerationJob, startBookGenerationJob, type BookGenerationJobResult } from '../ai';
import { FREE_PLAN_LIMITS } from '../planLimits';
import FaviconSpinner from '../components/FaviconSpinner';
import { SMARTBOOK_AGE_GROUP_OPTIONS, getSmartBookAgeGroupLabel } from '../utils/smartbookAgeGroup';
import { BOOK_CONTENT_SAFETY_MESSAGE, findRestrictedBookTopicInTexts } from '../utils/contentSafety';
import {
  SMARTBOOK_BOOK_TYPE_OPTIONS,
  SMARTBOOK_SUBGENRE_OPTIONS,
  SMARTBOOK_ENDING_OPTIONS,
  buildTargetPageFromBrief,
  getEstimatedGenerationMinutes,
  getPageRangeByBookType
} from '../utils/bookGeneration';
import { getBookTypeCreateCreditCost } from '../utils/creditCosts';
import { useUiI18n } from '../i18n/uiI18n';

interface HomeViewProps {
  onNavigate: (view: ViewState) => void;
  onCourseCreate: (data: CourseData) => void;
  onDeleteCourse: (courseId: string) => Promise<void>;
  savedCourses: CourseData[];
  onCourseSelect: (id: string) => void;
  canDeleteCourse?: (course: CourseData) => boolean;
  stickyNotes: StickyNoteData[];
  onCreateStickyNote: (payload: { title?: string; text: string; reminderAt?: string | null }) => Promise<StickyNoteData | undefined>;
  onUpdateStickyNote: (noteId: string, payload: { title?: string; text: string; reminderAt?: string | null }) => Promise<StickyNoteData | undefined>;
  onDeleteStickyNote: (noteId: string) => Promise<void>;
  onRequireCredit: (action: CreditActionType, costOverride?: number) => boolean;
  onConsumeCredit: (action: CreditActionType, costOverride?: number) => Promise<boolean> | boolean;
  isBootstrapping?: boolean;
  bootstrapMessage?: string;
  defaultBookLanguage?: string;
  courseOpenStates?: Record<string, CourseOpenUiState>;
  isLoggedIn?: boolean;
  onRequestLogin?: () => void;
}

type StickyModalState = {
  isOpen: boolean;
  noteId: string | null;
  title: string;
  text: string;
  reminderAt: string | null;
  createdAt: string;
};

type CourseDeleteModalState = {
  isOpen: boolean;
  courseId: string | null;
  courseTitle: string;
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
const BOOK_CREATING_LOOP_VIDEO_SRC = '/animations/book-creating-loop.mp4';
const PENDING_BOOK_GENERATION_JOB_STORAGE_KEY = 'f-study-pending-book-generation-job';
const GENERIC_TRANSIENT_ERROR_MESSAGE = 'Bir sorun oluştu. Lütfen kısa bir süre sonra tekrar deneyin.';
const GENERIC_AUTH_REQUIRED_MESSAGE = 'Oturum doğrulanamadı. Lütfen tekrar giriş yapın.';

type StoryInputMode = 'auto' | 'manual' | null;
type WizardTone = {
  border: string;
  fill: string;
  glow: string;
};

type BookTypeTheme = {
  tone: WizardTone;
  progress: string;
  actionBackground: string;
  actionBorder: string;
  actionGlow: string;
};

const WIZARD_TONES: WizardTone[] = [
  { border: 'rgba(245, 158, 11, 0.62)', fill: 'rgba(245, 158, 11, 0.16)', glow: 'rgba(245, 158, 11, 0.22)' },
  { border: 'rgba(16, 185, 129, 0.62)', fill: 'rgba(16, 185, 129, 0.16)', glow: 'rgba(16, 185, 129, 0.22)' },
  { border: 'rgba(56, 189, 248, 0.62)', fill: 'rgba(56, 189, 248, 0.16)', glow: 'rgba(56, 189, 248, 0.22)' },
  { border: 'rgba(244, 63, 94, 0.62)', fill: 'rgba(244, 63, 94, 0.16)', glow: 'rgba(244, 63, 94, 0.22)' },
  { border: 'rgba(168, 85, 247, 0.62)', fill: 'rgba(168, 85, 247, 0.16)', glow: 'rgba(168, 85, 247, 0.22)' },
  { border: 'rgba(59, 130, 246, 0.62)', fill: 'rgba(59, 130, 246, 0.16)', glow: 'rgba(59, 130, 246, 0.22)' }
];

const BOOK_TYPE_THEMES: Record<SmartBookBookType, BookTypeTheme> = {
  fairy_tale: {
    tone: { border: 'rgba(245, 158, 11, 0.68)', fill: 'rgba(245, 158, 11, 0.2)', glow: 'rgba(245, 158, 11, 0.28)' },
    progress: 'linear-gradient(90deg, #f59e0b 0%, #facc15 100%)',
    actionBackground: 'linear-gradient(135deg, rgba(168,104,22,0.94) 0%, rgba(133,79,14,0.94) 100%)',
    actionBorder: 'rgba(251, 191, 36, 0.7)',
    actionGlow: 'rgba(245, 158, 11, 0.28)'
  },
  story: {
    tone: { border: 'rgba(16, 185, 129, 0.68)', fill: 'rgba(16, 185, 129, 0.2)', glow: 'rgba(16, 185, 129, 0.28)' },
    progress: 'linear-gradient(90deg, #10b981 0%, #22d3ee 100%)',
    actionBackground: 'linear-gradient(135deg, rgba(18,126,102,0.94) 0%, rgba(14,101,91,0.94) 100%)',
    actionBorder: 'rgba(16, 185, 129, 0.7)',
    actionGlow: 'rgba(16, 185, 129, 0.28)'
  },
  novel: {
    tone: { border: 'rgba(217, 82, 96, 0.66)', fill: 'rgba(217, 82, 96, 0.18)', glow: 'rgba(217, 82, 96, 0.24)' },
    progress: 'linear-gradient(90deg, #d95b68 0%, #e79a9f 100%)',
    actionBackground: 'linear-gradient(135deg, rgba(138,48,59,0.94) 0%, rgba(166,68,79,0.94) 100%)',
    actionBorder: 'rgba(232, 146, 156, 0.74)',
    actionGlow: 'rgba(217, 82, 96, 0.26)'
  }
};

function resolveWizardTone(index: number): WizardTone {
  return WIZARD_TONES[((index % WIZARD_TONES.length) + WIZARD_TONES.length) % WIZARD_TONES.length];
}

function resolveBookTypeTheme(bookType?: SmartBookBookType): BookTypeTheme {
  if (bookType === 'fairy_tale') return BOOK_TYPE_THEMES.fairy_tale;
  if (bookType === 'story') return BOOK_TYPE_THEMES.story;
  return BOOK_TYPE_THEMES.novel;
}

type PendingBookGenerationJob = {
  jobId: string;
  bookType: SmartBookBookType;
  topic?: string;
  startedAt: string;
};

function readPendingBookGenerationJob(): PendingBookGenerationJob | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PENDING_BOOK_GENERATION_JOB_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingBookGenerationJob>;
    if (typeof parsed.jobId !== 'string' || !parsed.jobId.trim()) return null;
    if (
      parsed.bookType !== 'fairy_tale' &&
      parsed.bookType !== 'story' &&
      parsed.bookType !== 'novel'
    ) {
      return null;
    }
    return {
      jobId: parsed.jobId.trim(),
      bookType: parsed.bookType,
      topic: typeof parsed.topic === 'string' ? parsed.topic : undefined,
      startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : new Date().toISOString()
    };
  } catch {
    return null;
  }
}

function writePendingBookGenerationJob(payload: PendingBookGenerationJob | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!payload) {
      window.localStorage.removeItem(PENDING_BOOK_GENERATION_JOB_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(PENDING_BOOK_GENERATION_JOB_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures in constrained runtimes.
  }
}

function formatStickyDate(date: Date | string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
}

function formatCourseCreatedDate(date: Date | string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
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
  if (!rawMessage || typeof rawMessage !== 'string') return fallback || GENERIC_TRANSIENT_ERROR_MESSAGE;
  if (rawMessage.trim() === BOOK_CONTENT_SAFETY_MESSAGE) return BOOK_CONTENT_SAFETY_MESSAGE;
  const normalized = rawMessage.toLocaleLowerCase('tr-TR');
  if (
    normalized.includes('permission-denied') ||
    normalized.includes('unauthenticated') ||
    normalized.includes('auth/') ||
    normalized.includes('oturum') ||
    normalized.includes('giriş')
  ) {
    return GENERIC_AUTH_REQUIRED_MESSAGE;
  }
  if (
    normalized.includes('resource_exhausted') ||
    normalized.includes('resource exhausted') ||
    normalized.includes('quota') ||
    normalized.includes('rate limit') ||
    normalized.includes('"code":429') ||
    normalized.includes('http 4') ||
    normalized.includes('http 5') ||
    normalized.includes('functions/') ||
    normalized.includes('internal') ||
    normalized.includes('unavailable') ||
    normalized.includes('failed-precondition') ||
    normalized.includes('deadline-exceeded')
  ) {
    return fallback || GENERIC_TRANSIENT_ERROR_MESSAGE;
  }
  return fallback || GENERIC_TRANSIENT_ERROR_MESSAGE;
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
  if (/^(?:[a-z0-9ğüşıöç]+)\s+(?:ve|ile)\s+(?:[a-z0-9ğüşıöç]+)(?:\s|$)/u.test(normalizedTitle)) return true;
  if (/^(?:[a-z0-9ğüşıöç]+)(?:nin|nın|nun|nün|in|ın|un|ün)\s+/u.test(normalizedTitle)) return true;

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
  onDeleteCourse,
  savedCourses,
  onCourseSelect,
  canDeleteCourse,
  stickyNotes,
  onCreateStickyNote,
  onUpdateStickyNote,
  onDeleteStickyNote,
  onRequireCredit,
  onConsumeCredit,
  isBootstrapping = false,
  bootstrapMessage = 'Kitaplar senkronize ediliyor...',
  defaultBookLanguage = 'Turkish',
  courseOpenStates = {},
  isLoggedIn = true,
  onRequestLogin
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
  const [storyInputMode, setStoryInputMode] = useState<StoryInputMode>('manual');
  const [storyBlueprintInput, setStoryBlueprintInput] = useState('');
  const [settingPlaceInput, setSettingPlaceInput] = useState('');
  const [settingTimeInput, setSettingTimeInput] = useState('');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [creationStep, setCreationStep] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [activeGeneratingBookType, setActiveGeneratingBookType] = useState<SmartBookBookType | null>(null);
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
  const sourceNoticeTimerRef = useRef<number | null>(null);
  const lastDefaultBookLanguageRef = useRef(defaultBookLanguage);
  const generationJobPollTimerRef = useRef<number | null>(null);
  const activeGenerationJobIdRef = useRef<string | null>(null);
  const activeGenerationBookTypeRef = useRef<SmartBookBookType | null>(null);
  const generationProgressRef = useRef<number>(0);
  const loggedGenerationUsageEntryKeysRef = useRef<Set<string>>(new Set());
  const loggedGenerationUsageFinalKeysRef = useRef<Set<string>>(new Set());
  const [stickyModal, setStickyModal] = useState<StickyModalState>({
    isOpen: false,
    noteId: null,
    title: '',
    text: '',
    reminderAt: null,
    createdAt: new Date().toISOString()
  });
  const [courseDeleteModal, setCourseDeleteModal] = useState<CourseDeleteModalState>({
    isOpen: false,
    courseId: null,
    courseTitle: ''
  });
  const [isCourseDeleting, setIsCourseDeleting] = useState(false);
  const [isLoginRequiredModalOpen, setLoginRequiredModalOpen] = useState(false);

  const requireLoginForGeneration = (): boolean => {
    if (isLoggedIn) return false;
    setLoginRequiredModalOpen(true);
    return true;
  };

  const resetGenerationProgress = (next: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(next)));
    generationProgressRef.current = clamped;
    setGenerationProgress(clamped);
  };

  const raiseGenerationProgress = (next: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(next)));
    const monotonic = Math.max(generationProgressRef.current, clamped);
    generationProgressRef.current = monotonic;
    setGenerationProgress(monotonic);
  };

  function stopBookGenerationPolling(clearActiveJob = false) {
    if (generationJobPollTimerRef.current !== null) {
      window.clearTimeout(generationJobPollTimerRef.current);
      generationJobPollTimerRef.current = null;
    }
    if (clearActiveJob) {
      activeGenerationJobIdRef.current = null;
      activeGenerationBookTypeRef.current = null;
      loggedGenerationUsageEntryKeysRef.current.clear();
      loggedGenerationUsageFinalKeysRef.current.clear();
    }
  }

  function logGenerationJobUsage(job: BookGenerationJobResult) {
    const usageEntries = Array.isArray(job.usageEntries) ? job.usageEntries : [];
    const seen = loggedGenerationUsageEntryKeysRef.current;
    let loggedNewEntry = false;
    for (const entry of usageEntries) {
      const key = [
        entry.label,
        entry.provider,
        entry.model,
        entry.inputTokens,
        entry.outputTokens,
        entry.totalTokens,
        entry.estimatedCostUsd
      ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      loggedNewEntry = true;
      console.info(
        `[BOOK AI COST] ${entry.label}: ${entry.provider} ${entry.model} in ${entry.inputTokens} out ${entry.outputTokens} total ${entry.totalTokens} price ${Number(entry.estimatedCostUsd || 0).toFixed(6)} usd`
      );
    }
    if (job.status === 'completed' || job.status === 'failed') {
      const finalKey = [
        job.jobId,
        job.usage.inputTokens,
        job.usage.outputTokens,
        job.usage.totalTokens,
        Number(job.usage.estimatedCostUsd || 0).toFixed(6)
      ].join('|');
      if (loggedGenerationUsageFinalKeysRef.current.has(finalKey)) return;
      loggedGenerationUsageFinalKeysRef.current.add(finalKey);
      console.info(
        `[BOOK AI COST] final in ${job.usage.inputTokens} out ${job.usage.outputTokens} total ${job.usage.totalTokens} price ${Number(job.usage.estimatedCostUsd || 0).toFixed(6)} usd`
      );
      return;
    }

    if (!loggedNewEntry) return;
  }

  function resetSmartBookCreationForm() {
    setSearchTerm('');
    setHeroNamesInput('');
    setStoryInputMode('manual');
    setStoryBlueprintInput('');
    setSettingPlaceInput('');
    setSettingTimeInput('');
    setCreatorNameInput('');
    setBookLanguageInput(defaultBookLanguage);
    setCreationStep(1);
    clearSourceFile();
  }

  function resolvePreferredBookZipPath(...values: Array<unknown>): string | undefined {
    const normalized: string[] = [];
    for (const value of values) {
      const current = String(value || '').trim().replace(/^\/+/, '');
      if (!current || normalized.includes(current)) continue;
      normalized.push(current);
      if (/\/book\.zip$/i.test(current)) return current;
      if (/\/package\.json$/i.test(current)) {
        const withoutFile = current.replace(/\/package\.json$/i, '');
        if (/\/v\d+$/i.test(withoutFile)) return `${withoutFile}/book.zip`;
        return `${withoutFile}/v1/book.zip`;
      }
    }
    return normalized[0];
  }

  function syncGenerationUiFromJob(
    job: {
      status: 'queued' | 'processing' | 'completed' | 'failed';
      totalSections: number;
      completedSections: number;
      currentStepLabel: string | null;
    },
    fallbackBookType?: SmartBookBookType | null
  ) {
    const nextBookType = fallbackBookType || activeGenerationBookTypeRef.current || selectedBookType;
    activeGenerationBookTypeRef.current = nextBookType;
    setActiveGeneratingBookType(nextBookType);

    const totalSections = Math.max(1, job.totalSections || 1);
    const completedSections = Math.max(0, Math.min(totalSections, job.completedSections || 0));
    const progress = job.status === 'completed'
      ? 100
      : job.status === 'queued'
        ? 6
        : 10 + Math.round((completedSections / totalSections) * 86);

    raiseGenerationProgress(progress);
    setGenerationStatus(
      job.currentStepLabel?.trim()
      || (job.status === 'queued'
        ? 'Kitap üretim sırasına alındı...'
        : 'Kitap sunucuda hazırlanıyor...')
    );
  }

  function completeGeneratedBook(course: CourseData) {
    writePendingBookGenerationJob(null);
    stopBookGenerationPolling(true);
    setGenerationStatus('Kitap açılıyor...');
    raiseGenerationProgress(100);
    setActiveGeneratingBookType(null);
    resetSmartBookCreationForm();
    setIsGenerating(false);
    onCourseCreate(course);
    window.setTimeout(() => {
      setGenerationStatus('');
      resetGenerationProgress(0);
    }, 500);
  }

  function failGenerationJob(message: string) {
    writePendingBookGenerationJob(null);
    stopBookGenerationPolling(true);
    setIsGenerating(false);
    setActiveGeneratingBookType(null);
    setGenerationStatus('');
    resetGenerationProgress(0);
    setSourceNotice(getUserFacingError({ message }, GENERIC_TRANSIENT_ERROR_MESSAGE));
  }

  function startBookGenerationPolling(
    jobId: string,
    fallbackBookType?: SmartBookBookType | null,
    immediate = false
  ) {
    if (!jobId) return;
    if (activeGenerationJobIdRef.current !== jobId) {
      loggedGenerationUsageEntryKeysRef.current.clear();
      loggedGenerationUsageFinalKeysRef.current.clear();
    }
    stopBookGenerationPolling(false);
    activeGenerationJobIdRef.current = jobId;
    activeGenerationBookTypeRef.current = fallbackBookType || activeGenerationBookTypeRef.current || selectedBookType;
    if (fallbackBookType) {
      setActiveGeneratingBookType(fallbackBookType);
    }

    const poll = async () => {
      if (activeGenerationJobIdRef.current !== jobId) return;
      try {
        const job = await getBookGenerationJob(jobId);
        if (activeGenerationJobIdRef.current !== jobId) return;

        syncGenerationUiFromJob(job, fallbackBookType);
        logGenerationJobUsage(job);

        if (job.status === 'failed') {
          failGenerationJob(job.error || 'Fortale oluşturulurken bir hata oluştu.');
          return;
        }

        if (job.status === 'completed' && job.course) {
          const preferredPackagePath = resolvePreferredBookZipPath(
            job.bundle?.path,
            job.course.bundle?.path,
            job.course.contentPackagePath
          );
          const normalizedCompletedCourse: CourseData = {
            ...job.course,
            contentPackagePath: preferredPackagePath,
            contentPackageUpdatedAt: job.course.contentPackageUpdatedAt || job.bundle?.generatedAt,
            bundle: job.bundle || job.course.bundle || undefined,
            status: job.course.status || (job.bundle ? 'ready' : 'processing')
          };
          completeGeneratedBook(normalizedCompletedCourse);
          return;
        }
      } catch (error) {
        if (activeGenerationJobIdRef.current !== jobId) return;
        const rawMessage = String((error as { message?: string } | null)?.message || '');
        if (/permission|denied|auth|giriş|login|unauth/i.test(rawMessage.toLocaleLowerCase('tr-TR'))) {
          failGenerationJob(GENERIC_AUTH_REQUIRED_MESSAGE);
          return;
        }
        setGenerationStatus('Üretim durumu yeniden kontrol ediliyor...');
      }

      generationJobPollTimerRef.current = window.setTimeout(() => {
        void poll();
      }, 1800);
    };

    if (immediate) {
      void poll();
      return;
    }

    generationJobPollTimerRef.current = window.setTimeout(() => {
      void poll();
    }, 1200);
  }

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

  useEffect(() => {
    if (!sourceNotice) return;
    if (sourceNoticeTimerRef.current !== null) {
      window.clearTimeout(sourceNoticeTimerRef.current);
    }
    sourceNoticeTimerRef.current = window.setTimeout(() => {
      setSourceNotice(null);
      sourceNoticeTimerRef.current = null;
    }, 2600);
  }, [sourceNotice]);

  useEffect(() => {
    return () => {
      if (sourceNoticeTimerRef.current !== null) {
        window.clearTimeout(sourceNoticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const pendingJob = readPendingBookGenerationJob();
    if (!pendingJob) return;

    setIsGenerating(true);
    setSourceNotice(null);
    setActiveGeneratingBookType(pendingJob.bookType);
    setGenerationStatus('Üretim durumu kontrol ediliyor...');
    resetGenerationProgress(1);
    startBookGenerationPolling(pendingJob.jobId, pendingJob.bookType, true);
  }, []);

  useEffect(() => {
    if (!isGenerating || !activeGenerationJobIdRef.current) return;

    const resumePolling = () => {
      if (document.visibilityState !== 'hidden' && activeGenerationJobIdRef.current) {
        startBookGenerationPolling(
          activeGenerationJobIdRef.current,
          activeGenerationBookTypeRef.current,
          true
        );
      }
    };

    window.addEventListener('focus', resumePolling);
    document.addEventListener('visibilitychange', resumePolling);
    return () => {
      window.removeEventListener('focus', resumePolling);
      document.removeEventListener('visibilitychange', resumePolling);
    };
  }, [isGenerating]);

  useEffect(() => {
    return () => {
      stopBookGenerationPolling(true);
    };
  }, []);

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
  const renderBootstrapShelf = () => (
    <div
      className="relative overflow-hidden rounded-[28px] border p-5 text-center"
      style={{
        background: 'linear-gradient(160deg, rgba(18,31,48,0.96) 0%, rgba(14,24,38,0.95) 58%, rgba(11,18,29,0.98) 100%)',
        borderColor: 'rgba(120,171,226,0.24)',
        boxShadow: '0 24px 60px rgba(4, 10, 18, 0.34), inset 0 1px 0 rgba(205, 231, 255, 0.08)'
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-[-12%] top-0 h-24 blur-3xl"
        style={{ background: 'linear-gradient(90deg, rgba(94,151,215,0) 0%, rgba(94,151,215,0.2) 48%, rgba(94,151,215,0) 100%)' }}
      />
      <div className="relative flex flex-col items-center gap-4">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
          <FaviconSpinner size={26} />
          <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#d5e9ff]">{t('Kitaplar yükleniyor...')}</span>
        </div>

        <p className="mx-auto max-w-[260px] text-[11px] leading-5 text-[#a8c0db]">{bootstrapMessage}</p>

        <div className="grid w-full grid-cols-3 gap-3">
          {[0, 1, 2].map((index) => (
            <div
              key={`bootstrap-book-${index}`}
              className="relative overflow-hidden rounded-[22px] border px-3 pb-4 pt-5"
              style={{
                background: 'linear-gradient(180deg, rgba(32,52,77,0.92) 0%, rgba(17,29,44,0.92) 100%)',
                borderColor: 'rgba(122,165,213,0.18)',
                animation: `smartbook-loading-dot 1.6s ease-in-out ${index * 0.18}s infinite`
              }}
            >
              <div
                className="absolute inset-x-0 top-0 h-14"
                style={{ background: 'linear-gradient(180deg, rgba(143,191,245,0.18) 0%, rgba(143,191,245,0) 100%)' }}
              />
              <div className="relative mx-auto h-20 w-14 rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(120,171,226,0.34),rgba(53,89,127,0.18))]" />
              <div className="relative mt-4 space-y-2">
                <div className="mx-auto h-2.5 w-16 rounded-full bg-white/12" />
                <div className="mx-auto h-2 w-10 rounded-full bg-white/8" />
              </div>
            </div>
          ))}
        </div>

        <div className="smartbook-loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );

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
    if (!courseDeleteModal.isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isCourseDeleting) {
        setCourseDeleteModal({ isOpen: false, courseId: null, courseTitle: '' });
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [courseDeleteModal.isOpen, isCourseDeleting]);

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

  const openCourseDeleteModal = (course: CourseData) => {
    setCourseDeleteModal({
      isOpen: true,
      courseId: course.id,
      courseTitle: course.topic || 'İsimsiz Kitap'
    });
  };

  const closeCourseDeleteModal = () => {
    if (isCourseDeleting) return;
    setCourseDeleteModal({ isOpen: false, courseId: null, courseTitle: '' });
  };

  const handleCourseDeleteConfirm = async () => {
    if (!courseDeleteModal.courseId || isCourseDeleting) return;
    setIsCourseDeleting(true);
    try {
      await onDeleteCourse(courseDeleteModal.courseId);
      setCourseDeleteModal({ isOpen: false, courseId: null, courseTitle: '' });
    } catch (error) {
      console.error('Book delete failed:', error);
      setSourceNotice('Kitap silinirken bir hata oluştu.');
    } finally {
      setIsCourseDeleting(false);
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
  const estimatedGenerationMinutes = getEstimatedGenerationMinutes(selectedBookType);
  const displayedGenerationMinutes = getEstimatedGenerationMinutes(activeGeneratingBookType || selectedBookType);

  const buildCreativeBriefPayload = (): SmartBookCreativeBrief => {
    const normalizedStoryBlueprint = compactInlineText(storyBlueprintInput);
    const normalizedHeroNames = compactInlineText(heroNamesInput);
    const manualStoryBlueprint = storyInputMode === 'manual' ? normalizedStoryBlueprint : '';
    const normalizedPlace = compactInlineText(settingPlaceInput);
    const normalizedTime = compactInlineText(settingTimeInput);
    const normalizedCreatorName = compactInlineText(creatorNameInput);
    const normalizedBookTitleInput = compactInlineText(searchTerm);
    const normalizedLanguageText = compactInlineText(bookLanguageInput);
    const characterHints = [
      normalizedHeroNames ? `Kahraman isimleri: ${normalizedHeroNames}.` : undefined,
      manualStoryBlueprint || undefined
    ].filter(Boolean) as string[];
    const promptFacts = [
      `Tur: ${selectedBookType}`,
      selectedSubGenre ? `Alt tur: ${selectedSubGenre}` : undefined,
      normalizedBookTitleInput ? `Kitap adi: ${normalizedBookTitleInput}` : undefined,
      normalizedHeroNames ? `Kahraman isimleri: ${normalizedHeroNames}` : undefined,
      normalizedPlace ? `Mekan: ${normalizedPlace}` : undefined,
      normalizedTime ? `Zaman: ${normalizedTime}` : undefined,
      normalizedCreatorName ? `Kurgulayan: ${normalizedCreatorName}` : undefined
    ].filter(Boolean) as string[];
    const promptFactsBlock = promptFacts.length > 0
      ? `Kullanici baglami (zorunlu): ${promptFacts.join(' | ')}.`
      : undefined;
    const customInstructionParts = [
      promptFactsBlock,
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
    if (requireLoginForGeneration()) return;

    const isAutoStoryMode = storyInputMode === 'auto';
    const heroNamesHint = compactInlineText(heroNamesInput);
    const topicHint = searchTerm.trim();
    const detailHint = storyInputMode === 'manual'
      ? compactInlineText(storyBlueprintInput)
      : (heroNamesHint ? `Kahraman isimleri: ${heroNamesHint}.` : '');
    const selectedFile = sourceFile;
    const creativeBrief = buildCreativeBriefPayload();

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

    stopBookGenerationPolling(true);
    writePendingBookGenerationJob(null);
    setIsGenerating(true);
    setActiveGeneratingBookType(selectedBookType);
    resetGenerationProgress(1);
    setSourceNotice(null);
    try {
      let resolvedTopic = topicHint;
      let sourceContent: string | undefined = detailHint || undefined;

      if (selectedFile) {
        setGenerationStatus('Doküman analiz ediliyor...');
        raiseGenerationProgress(4);
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
          throw new Error(BOOK_CONTENT_SAFETY_MESSAGE);
        }
      }

      if (!resolvedTopic) resolvedTopic = '';

      const normalizedTopic = isAutoStoryMode
        ? toTitleCaseTr(resolvedTopic)
        : compactInlineText(resolvedTopic);
      const allowAiBookTitleGeneration = !topicHint;
      setActiveGeneratingBookType(selectedBookType);
      setGenerationStatus('Sunucuda üretim başlatılıyor...');
      raiseGenerationProgress(6);

      const jobState = await startBookGenerationJob({
        topic: normalizedTopic || undefined,
        sourceContent,
        creatorName: compactInlineText(creatorNameInput) || undefined,
        ageGroup: selectedAgeGroup,
        bookType: selectedBookType,
        subGenre: selectedSubGenre || undefined,
        targetPageCount: targetPageCountPreview,
        creativeBrief,
        allowAiBookTitleGeneration
      });

      writePendingBookGenerationJob({
        jobId: jobState.jobId,
        bookType: selectedBookType,
        topic: normalizedTopic || undefined,
        startedAt: new Date().toISOString()
      });

      syncGenerationUiFromJob(jobState, selectedBookType);

      if (jobState.status === 'failed') {
        throw new Error(jobState.error || 'Fortale oluşturulurken bir hata oluştu.');
      }

      if (jobState.status === 'completed' && jobState.course) {
        completeGeneratedBook(jobState.course);
        return;
      }

      startBookGenerationPolling(jobState.jobId, selectedBookType);
    } catch (error) {
      console.error('Book generation failed', error);
      failGenerationJob(getUserFacingError(error, 'Fortale oluşturulurken bir hata oluştu.'));
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
    const canDelete = canDeleteCourse ? canDeleteCourse(course) : true;
    const openState = courseOpenStates[course.id] || { status: 'idle', progress: 0, updatedAt: 0 };
    const isOpenDownloading = openState.status === 'downloading';
    const isOpenReady = openState.status === 'ready';
    const isOpenFailed = openState.status === 'failed';
    const isOpenIdle = !isOpenDownloading && !isOpenReady && !isOpenFailed;
    const openProgress = Math.max(0, Math.min(100, Math.round(openState.progress || 0)));

    const actionLabel = isOpenReady
      ? t('Oku')
      : isOpenDownloading
        ? `${t('İndiriliyor')} %${openProgress}`
        : isOpenFailed
          ? t('Tekrar dene')
          : t('İndir');

    const actionIcon = isOpenReady
      ? <Check size={11} className="mr-1" />
      : isOpenDownloading
        ? null
        : isOpenFailed
          ? null
          : <Download size={11} className="mr-1" />;

    const actionButtonStyle: React.CSSProperties = isOpenReady
      ? {
        borderColor: 'rgba(110, 231, 183, 0.55)',
        background: 'linear-gradient(135deg, rgba(16,72,46,0.85) 0%, rgba(12,58,36,0.82) 100%)',
        boxShadow: 'inset 0 0 0 1px rgba(110,231,183,0.18), 0 0 10px rgba(52,211,153,0.15)'
      }
      : isOpenDownloading
        ? {
          borderColor: 'rgba(96, 165, 250, 0.5)',
          background: 'linear-gradient(135deg, rgba(29,78,216,0.55) 0%, rgba(30,64,175,0.5) 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(96,165,250,0.2), 0 0 10px rgba(59,130,246,0.15)'
        }
        : isOpenFailed
          ? {
            borderColor: 'rgba(248, 113, 113, 0.45)',
            background: 'rgba(127, 29, 29, 0.75)'
          }
          : {
            borderColor: 'rgba(148, 163, 184, 0.4)',
            background: 'rgba(23, 38, 58, 0.78)'
          };

    return (
      <div
        key={course.id}
        role="button"
        tabIndex={0}
        onClick={() => onCourseSelect(course.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onCourseSelect(course.id);
          }
        }}
        className="group h-full cursor-pointer rounded-[24px] border border-dashed p-3 text-left transition-all active:scale-[0.99] md:p-3.5"
        style={{
          background: isOpenReady
            ? 'rgba(12, 38, 24, 0.25)'
            : 'rgba(17, 22, 29, 0.3)',
          borderColor: isOpenReady
            ? 'rgba(110, 231, 183, 0.15)'
            : 'rgba(188, 194, 203, 0.1)',
          boxShadow: isOpenReady
            ? 'inset 0 0 0 1px rgba(110, 231, 183, 0.08)'
            : 'inset 0 0 0 1px rgba(188, 194, 203, 0.06)'
        }}
      >
        <div className="flex items-start gap-3.5">
          <div
            className="relative shrink-0 h-[92px] w-[69px] overflow-hidden rounded-[4px] md:h-[104px] md:w-[78px]"
            style={course.coverImageUrl
              ? { background: 'transparent' }
              : { background: 'rgba(44, 48, 53, 0.72)' }}
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
            {/* Download progress overlay on cover */}
            {isOpenDownloading && (
              <div className="absolute inset-0 flex flex-col items-center justify-end" style={{ background: 'rgba(15,23,42,0.55)' }}>
                <div className="w-full px-1 pb-1">
                  <div className="h-[3px] w-full overflow-hidden rounded-full bg-blue-950/60">
                    <div
                      className="h-full rounded-full transition-all duration-200"
                      style={{
                        width: `${openProgress}%`,
                        background: 'linear-gradient(90deg, #60a5fa 0%, #3b82f6 100%)'
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
            {/* Ready checkmark badge on cover */}
            {isOpenReady && (
              <div
                className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full"
                style={{ background: 'rgba(16,72,46,0.92)', boxShadow: '0 0 6px rgba(52,211,153,0.35)' }}
              >
                <Check size={10} className="text-emerald-300" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="min-w-0">
              <p className="line-clamp-2 text-[13px] font-bold leading-[1.25] text-white">
                {course.topic}
              </p>
              <p className="mt-1 line-clamp-1 text-[10px] text-zinc-300">
                {nextStep?.title || t('Fortale Tamamlandı')}
              </p>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-semibold text-[#b9cde8]"
                style={{ background: 'rgba(23, 38, 58, 0.72)', boxShadow: 'inset 0 0 0 1px rgba(55,80,111,0.22)' }}
              >
                {t(bookTypeToLabel(course.bookType))}
              </span>
              {course.subGenre?.trim() && (
                <span
                  className="inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-semibold text-[#b9cde8]"
                  style={{ background: 'rgba(23, 38, 58, 0.72)', boxShadow: 'inset 0 0 0 1px rgba(55,80,111,0.22)' }}
                >
                  {t(course.subGenre.trim())}
                </span>
              )}
              <span
                className="inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-semibold text-[#b9cde8]"
                style={{ background: 'rgba(23, 38, 58, 0.72)', boxShadow: 'inset 0 0 0 1px rgba(55,80,111,0.22)' }}
              >
                {t(getSmartBookAgeGroupLabel(course.ageGroup))}
              </span>
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-[rgba(23,38,58,0.68)] px-2 py-1" title={t('Tahmini okuma süresi')}>
                <Clock3 size={10} className="text-[#7fb1ec]" />
                <span className="text-[10px] text-[#b9cde8]">
                  {estimateCourseReadingDuration(course, t)}
                </span>
              </div>
            </div>

            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(35,50,70,0.72)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #5aa9ff 0%, #3b82f6 100%)'
                  }}
                />
              </div>

              <div
                className="mt-2 flex items-center justify-between gap-2 border-t border-dashed pt-2"
                style={{ borderColor: 'rgba(96, 129, 164, 0.3)' }}
              >
                <span className="text-[10px] text-[#9cb9d7]">
                  {formatCourseCreatedDate(course.createdAt || course.lastActivity, locale)}
                </span>
                <div className="flex items-center gap-2">
                  {canDelete && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openCourseDeleteModal(course);
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-xl text-[#fca5a5] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[#fecaca]"
                      title={t('Sil')}
                      aria-label={t('Sil')}
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (isOpenDownloading) return;
                      onCourseSelect(course.id);
                    }}
                    disabled={isOpenDownloading}
                    data-no-ui-translate="true"
                    className={`inline-flex items-center rounded-xl border border-dashed px-2.5 py-1 text-[10px] font-bold transition-all group-active:scale-95 disabled:cursor-not-allowed disabled:opacity-80 ${isOpenReady ? 'text-emerald-200' : isOpenDownloading ? 'text-blue-200' : 'text-white'
                      }`}
                    style={actionButtonStyle}
                  >
                    {actionIcon}
                    {actionLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const hasStickyContent = Boolean(stickyModal.title.trim() || stickyModal.text.trim());
  const selectedBookTheme = resolveBookTypeTheme(selectedBookType);
  const activeProgressTheme = resolveBookTypeTheme(activeGeneratingBookType || selectedBookType);
  const visibleCreationSteps = useMemo<number[]>(
    () => (storyInputMode === 'auto' ? [1, 2, 3, 4] : [1, 2, 3, 4, 5, 6]),
    [storyInputMode]
  );
  const currentVisibleStepIndexRaw = visibleCreationSteps.indexOf(creationStep);
  const currentVisibleStepIndex = currentVisibleStepIndexRaw >= 0 ? currentVisibleStepIndexRaw : 0;
  const currentVisibleStepNumber = currentVisibleStepIndex + 1;
  const totalVisibleStepCount = Math.max(1, visibleCreationSteps.length);

  useEffect(() => {
    if (currentVisibleStepIndexRaw !== -1) return;
    const nextVisibleStep = visibleCreationSteps.find((step) => step > creationStep);
    const previousVisibleStep = [...visibleCreationSteps].reverse().find((step) => step < creationStep);
    setCreationStep(nextVisibleStep ?? previousVisibleStep ?? visibleCreationSteps[0] ?? 1);
  }, [creationStep, currentVisibleStepIndexRaw, visibleCreationSteps]);

  const isCreationStepComplete = (step: number): boolean => {
    if (step === 1) return Boolean(selectedBookType);
    if (step === 2) return Boolean(selectedSubGenre);
    if (step === 3) return Boolean(selectedAgeGroup) && Boolean(bookLanguageInput.trim());
    if (step === 4) return storyInputMode === 'auto' || (storyInputMode === 'manual' && Boolean(storyBlueprintInput.trim()));
    if (step === 5) return true;
    if (step === 6) return true;
    return false;
  };
  const getNextCreationStep = (step: number): number => {
    const index = visibleCreationSteps.indexOf(step);
    if (index === -1) return visibleCreationSteps[0] ?? 1;
    return visibleCreationSteps[Math.min(visibleCreationSteps.length - 1, index + 1)] ?? step;
  };
  const getPreviousCreationStep = (step: number): number => {
    const index = visibleCreationSteps.indexOf(step);
    if (index === -1) return visibleCreationSteps[0] ?? 1;
    return visibleCreationSteps[Math.max(0, index - 1)] ?? step;
  };
  const isCurrentStepComplete = isCreationStepComplete(creationStep);
  const isAllStepsComplete = visibleCreationSteps.every((step) => isCreationStepComplete(step));
  const stepProgressPercent = Math.round((currentVisibleStepNumber / totalVisibleStepCount) * 100);
  const currentStepTitle = (() => {
    const safeStep = Math.max(1, Math.min(6, creationStep));
    if (safeStep === 1) return t('Kitap Türü');
    if (safeStep === 2) return t('Alt Tür');
    if (safeStep === 3) return `${t('Yaş Grubu')} + ${t('Dil (Yazın)')}`;
    if (safeStep === 4) return t('Kurgu Modu');
    if (safeStep === 5) return `${t('Hikayenin Mekanı')} + ${t('Hikayenin Zamanı')} + ${t('Kitabın Adı')}`;
    return t('Kahramanlar ve Oluşturucu');
  })();
  const canMoveNext = currentVisibleStepIndex < totalVisibleStepCount - 1 && isCurrentStepComplete && !isGenerating;
  const canCreateOnFinalStep = currentVisibleStepIndex === totalVisibleStepCount - 1 && isAllStepsComplete && !isGenerating;
  const wizardFieldClass = 'mt-1 h-10 w-full rounded-xl border border-dashed px-2.5 text-[13px] text-zinc-100 placeholder:text-[#8ca7c6] focus:outline-none';
  const wizardFieldStyle = (tone: WizardTone = selectedBookTheme.tone): React.CSSProperties => ({
    borderColor: tone.border,
    background: 'linear-gradient(180deg, rgba(21,35,54,0.74) 0%, rgba(17,27,40,0.78) 100%)',
    boxShadow: `inset 0 0 0 1px ${tone.fill}`
  });
  const wizardTextareaClass = 'mt-1 w-full rounded-xl border border-dashed px-2.5 py-2.5 text-[13px] text-zinc-100 placeholder:text-[#8ca7c6] resize-none focus:outline-none';
  const wizardOptionButtonStyle = (isSelected: boolean, tone: WizardTone = selectedBookTheme.tone): React.CSSProperties => ({
    borderColor: tone.border,
    background: isSelected ? `linear-gradient(135deg, ${tone.fill} 0%, rgba(18,31,45,0.88) 100%)` : 'rgba(14,21,31,0.3)',
    boxShadow: isSelected
      ? `inset 0 0 0 1px ${tone.border}, 0 0 16px ${tone.glow}`
      : `inset 0 0 0 1px ${tone.fill}`
  });
  const primaryActionButtonStyle: React.CSSProperties = {
    borderColor: selectedBookTheme.actionBorder,
    background: selectedBookTheme.actionBackground,
    boxShadow: `inset 0 0 0 1px ${selectedBookTheme.tone.fill}, 0 0 14px ${selectedBookTheme.actionGlow}`
  };
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
          'radial-gradient(circle at 12% 7%, rgba(182, 223, 255, 0.24), transparent 44%), radial-gradient(circle at 88% 11%, rgba(143, 206, 255, 0.2), transparent 42%), linear-gradient(180deg, #1f3a57 0%, #162b42 100%)'
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
                background: 'linear-gradient(160deg, rgba(24,38,57,0.78) 0%, rgba(17,22,29,0.78) 55%, rgba(14,24,38,0.8) 100%)',
                borderColor: selectedBookTheme.tone.border,
                boxShadow: `inset 0 0 0 1px ${selectedBookTheme.tone.fill}`
              }}
            >
              <div className="px-1.5 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold tracking-wide text-[#d4e6fa]">{t('Kitabınızı Oluşturun')}</span>
                  {!isGenerating && (
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: selectedBookTheme.actionBorder }}
                    >
                      {currentVisibleStepNumber}/{totalVisibleStepCount}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[15px] font-bold text-white">
                  {isGenerating ? t('Fortale oluşturuluyor...') : currentStepTitle}
                </p>
                <div className="mt-2 h-1.5 rounded-full bg-[#152131] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${isGenerating ? Math.max(1, Math.min(100, generationProgress || 0)) : stepProgressPercent}%`,
                      background: isGenerating ? activeProgressTheme.progress : selectedBookTheme.progress
                    }}
                  />
                </div>
                {!isGenerating && (
                  <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${totalVisibleStepCount}, minmax(0, 1fr))` }}>
                    {visibleCreationSteps.map((_, index) => {
                      const stepNo = index + 1;
                      const isDone = index < currentVisibleStepIndex;
                      const isCurrent = index === currentVisibleStepIndex;
                      const tone = resolveWizardTone(index);
                      return (
                        <span
                          key={stepNo}
                          className="h-7 rounded-md border border-dashed flex items-center justify-center text-[11px] font-bold"
                          style={isCurrent
                            ? {
                              color: selectedBookTheme.actionBorder,
                              borderColor: selectedBookTheme.tone.border,
                              background: `linear-gradient(135deg, ${selectedBookTheme.tone.fill} 0%, rgba(24,44,70,0.92) 100%)`,
                              boxShadow: `inset 0 0 0 1px ${selectedBookTheme.tone.border}, 0 0 12px ${selectedBookTheme.actionGlow}`
                            }
                            : isDone
                              ? {
                                color: selectedBookTheme.actionBorder,
                                borderColor: selectedBookTheme.tone.border,
                                background: 'rgba(18,31,45,0.74)',
                                boxShadow: `inset 0 0 0 1px ${selectedBookTheme.tone.fill}, 0 0 12px ${selectedBookTheme.actionGlow}`
                              }
                              : {
                                color: selectedBookTheme.actionBorder,
                                borderColor: tone.border,
                                background: 'rgba(18,28,40,0.5)'
                              }}
                        >
                          {stepNo}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {!isGenerating && (
              <fieldset className="px-1.5 pb-1">
                {creationStep === 1 && (
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold tracking-wide text-[#cfe2f7]">{t('Kitap Türünü Seç')}</span>
                    </div>
                    <div className="space-y-1.5">
                      {SMARTBOOK_BOOK_TYPE_OPTIONS.map((option) => {
                        const isSelected = selectedBookType === option.value;
                        const createCost = getBookTypeCreateCreditCost(option.value);
                        const optionTheme = resolveBookTypeTheme(option.value);
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setSelectedBookType(option.value);
                              if (option.value === 'fairy_tale') {
                                setSelectedEndingStyle('happy');
                              }
                              if (option.value === 'fairy_tale' && !['1-3', '4-6', '7-9'].includes(selectedAgeGroup)) {
                                setSelectedAgeGroup('4-6');
                              } else if (option.value !== 'fairy_tale' && ['1-3', '4-6', '7-9'].includes(selectedAgeGroup)) {
                                setSelectedAgeGroup('general');
                              }
                            }}
                            className="w-full rounded-xl border border-dashed px-3 py-2 text-left transition-colors"
                            style={wizardOptionButtonStyle(isSelected, optionTheme.tone)}
                            aria-pressed={isSelected}
                            title={t(option.hint)}
                          >
                            <span className="flex items-start justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block text-[13px] font-bold text-white">{t(option.label)}</span>
                                <span className="mt-0.5 block text-[10px] text-[#bfd6f1]">{t(option.hint)}</span>
                              </span>
                              <span className="shrink-0 rounded-lg border border-dashed px-2 py-0.5 text-[10px] font-semibold text-[#d7e9ff]" style={{ borderColor: optionTheme.tone.border }}>
                                {createCost} {t('kredi')}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {creationStep === 2 && (
                  <div>
                    <p className="mb-1 text-[12px] font-semibold tracking-wide text-[#cfe2f7]">{t('Alt Tür Seç')}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(SMARTBOOK_SUBGENRE_OPTIONS[selectedBookType] || []).map((sub, index) => {
                        const isSelected = selectedSubGenre === sub;
                        return (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => setSelectedSubGenre(sub)}
                            className="rounded-xl border border-dashed px-2 py-1.5 text-left transition-colors text-[12px] font-bold"
                            style={{
                              color: isSelected ? '#ffffff' : '#c6d9ef',
                              ...wizardOptionButtonStyle(isSelected, resolveWizardTone(index))
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
                        <div className="grid grid-cols-3 gap-1.5">
                          {SMARTBOOK_ENDING_OPTIONS.map((option, index) => {
                            const isSelected = selectedEndingStyle === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => setSelectedEndingStyle(option.value)}
                                className="rounded-xl border border-dashed px-2 py-1.5 text-[12px] font-bold transition-colors"
                                style={{
                                  color: isSelected ? '#ffffff' : '#c6d9ef',
                                  ...wizardOptionButtonStyle(isSelected, resolveWizardTone(index + 2))
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

                {creationStep === 3 && (
                  <div>
                    <p className="mb-1 text-[12px] font-semibold tracking-wide text-[#cfe2f7]">{t('Yaş Grubunu Seç')}</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {SMARTBOOK_AGE_GROUP_OPTIONS.filter((opt) => selectedBookType === 'fairy_tale' ? ['1-3', '4-6', '7-9'].includes(opt.value) : !['1-3', '4-6', '7-9'].includes(opt.value)).map((option, index) => {
                        const isSelected = selectedAgeGroup === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setSelectedAgeGroup(option.value)}
                            className="rounded-xl border border-dashed px-1.5 py-1.5 text-center transition-colors"
                            style={wizardOptionButtonStyle(isSelected, resolveWizardTone(index))}
                            aria-pressed={isSelected}
                            title={t(option.hint)}
                          >
                            <span className="block text-[11px] font-bold text-white">{t(option.label)}</span>
                          </button>
                        );
                      })}
                    </div>
                    <label className="mt-2 block text-[12px] text-[#cfe2f7] font-semibold tracking-wide">{t('Kitap Dili')}</label>
                    <input
                      value={bookLanguageInput}
                      onChange={(event) => setBookLanguageInput(event.target.value)}
                      maxLength={64}
                      placeholder={t('Örn: Türkçe, English, Español')}
                      className={wizardFieldClass}
                      style={wizardFieldStyle(resolveWizardTone(4))}
                    />
                  </div>
                )}

                {creationStep === 4 && (
                  <div className="space-y-2">
                    <div>
                      <p className="mb-1 text-[12px] font-semibold tracking-wide text-[#cfe2f7]">{t('Kurgu Modu')}</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setStoryInputMode('manual')}
                          className="rounded-xl border border-dashed px-2 py-1.5 text-left transition-colors text-[12px] font-bold"
                          style={{
                            color: storyInputMode === 'manual' ? '#ffffff' : '#c6d9ef',
                            ...wizardOptionButtonStyle(storyInputMode === 'manual', resolveWizardTone(0))
                          }}
                        >
                          {t('Detay Gireceğim')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setStoryInputMode('auto')}
                          className="rounded-xl border border-dashed px-2 py-1.5 text-left transition-colors text-[12px] font-bold"
                          style={{
                            color: storyInputMode === 'auto' ? '#ffffff' : '#c6d9ef',
                            ...wizardOptionButtonStyle(storyInputMode === 'auto', resolveWizardTone(1))
                          }}
                        >
                          {t('Otomatik Oluştur')}
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
                            placeholder={t('Girdiğiniz detaylar size özgü kitap kurgulanmasını sağlayacaktır. Karakterleri, kitabın ana temasını, çatışmayı, olay örgüsünü ve odaklanılacak detayları birlikte yazın')}
                            className={wizardTextareaClass}
                            style={wizardFieldStyle(resolveWizardTone(2))}
                          />
                        </>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[12px] text-[#a8c4e6]">
                            {t('Otomatik modda model kurgu detaylarını kendisi oluşturur. Seçimden sonra doğrudan Oluşturucu adımına geçilir.')}
                          </p>
                          <label className="block text-[12px] text-[#cfe2f7] font-semibold tracking-wide">{t('Kahraman İsimleri (Opsiyonel)')}</label>
                          <input
                            value={heroNamesInput}
                            onChange={(event) => setHeroNamesInput(event.target.value)}
                            maxLength={180}
                            placeholder={t('Örn: Elara, Aras, Mira')}
                            className={wizardFieldClass}
                            style={wizardFieldStyle(resolveWizardTone(3))}
                          />
                          <label className="mt-1 block text-[12px] text-[#cfe2f7] font-semibold tracking-wide">{t('Oluşturucu (Ad Soyad)')}</label>
                          <input
                            value={creatorNameInput}
                            onChange={(event) => setCreatorNameInput(event.target.value)}
                            maxLength={90}
                            placeholder={t('Örn: Ayşe Demir')}
                            className={wizardFieldClass}
                            style={wizardFieldStyle(resolveWizardTone(4))}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {creationStep === 5 && (
                  <div className="space-y-2">
                    <label className="text-[12px] text-[#cfe2f7] font-semibold tracking-wide">{t('Hikayenin Zamanı')}</label>
                    <input
                      value={settingTimeInput}
                      onChange={(event) => setSettingTimeInput(event.target.value)}
                      maxLength={120}
                      placeholder={t("Örn: 1800'ler, günümüz, 2090 sonrası")}
                      className={wizardFieldClass}
                      style={wizardFieldStyle(resolveWizardTone(0))}
                    />
                    <label className="block text-[12px] text-[#cfe2f7] font-semibold tracking-wide">{t('Hikayenin Mekanı')}</label>
                    <input
                      value={settingPlaceInput}
                      onChange={(event) => setSettingPlaceInput(event.target.value)}
                      maxLength={120}
                      placeholder={t('Örn: İstanbul, antik kent, Mars kolonisi')}
                      className={wizardFieldClass}
                      style={wizardFieldStyle(resolveWizardTone(1))}
                    />
                    <label className="block text-[12px] text-[#cfe2f7] font-semibold tracking-wide">{t('Kitabın Adı')}</label>
                    <input
                      value={searchTerm}
                      onChange={(event) => {
                        setSearchTerm(event.target.value);
                        if (sourceNotice) setSourceNotice(null);
                      }}
                      maxLength={140}
                      placeholder={t('Örn: Albert Einstein ve Kuramları')}
                      className={wizardFieldClass}
                      style={wizardFieldStyle(resolveWizardTone(2))}
                    />
                  </div>
                )}

                {creationStep === 6 && (
                  <div>
                    <label className="block text-[12px] text-[#cfe2f7] font-semibold tracking-wide">{t('Kahraman İsimleri (Opsiyonel)')}</label>
                    <input
                      value={heroNamesInput}
                      onChange={(event) => setHeroNamesInput(event.target.value)}
                      maxLength={180}
                      placeholder={t('Örn: Elara, Aras, Mira')}
                      className={wizardFieldClass}
                      style={wizardFieldStyle(resolveWizardTone(3))}
                    />
                    <label className="mt-2 block text-[12px] text-[#cfe2f7] font-semibold tracking-wide">{t('Oluşturucu (Ad Soyad)')}</label>
                    <input
                      value={creatorNameInput}
                      onChange={(event) => setCreatorNameInput(event.target.value)}
                      maxLength={90}
                      placeholder={t('Örn: Ayşe Demir')}
                      className={wizardFieldClass}
                      style={wizardFieldStyle(resolveWizardTone(4))}
                    />
                  </div>
                )}
              </fieldset>
              )}

              {isGenerating ? (
                <div className="mt-3 rounded-2xl border border-dashed border-[#6c90ba]/35 bg-[rgba(19,33,51,0.86)] p-3">
                  <div className="mx-auto w-full max-w-[296px] overflow-hidden rounded-xl border border-dashed border-[#7da3cf]/40 bg-[#0f1b2a]">
                    <video
                      className="h-auto w-full"
                      src={BOOK_CREATING_LOOP_VIDEO_SRC}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="auto"
                    />
                  </div>
                  <p className="mt-2 text-center text-[11px] font-bold text-white">
                    {generationStatus || t('Fortale oluşturuluyor...')}
                  </p>
                  <p className="mt-1 text-center text-[10px] text-[#b6cde8]">
                    {t('Tahmini okuma süresi')}: {displayedGenerationMinutes} {t('dk')}
                  </p>
                  <div className="mt-2 h-2 rounded-full bg-[#102033] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(1, Math.min(100, generationProgress || 0))}%`,
                        background: activeProgressTheme.progress
                      }}
                    />
                  </div>
                  <p className="mt-1 text-center text-[10px] text-[#b6cde8]">%{Math.max(1, Math.min(100, Math.round(generationProgress || 0)))}</p>
                </div>
              ) : (
                <>
                <div className={`mt-3 flex items-center gap-2 ${currentVisibleStepIndex === 0 ? 'justify-end' : 'justify-between'}`}>
                  {currentVisibleStepIndex > 0 && (
                    <button
                      type="button"
                      onClick={() => setCreationStep((prev) => getPreviousCreationStep(prev))}
                      className="h-10 px-3.5 rounded-2xl border border-dashed text-[12px] font-semibold inline-flex items-center gap-1.5 border-[#759fd0]/48 text-[#d0e4fb] bg-[#163052] hover:bg-[#1a3a63]"
                    >
                      <ArrowLeft size={14} />
                      {t('Geri')}
                    </button>
                  )}

                  {currentVisibleStepIndex < totalVisibleStepCount - 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (requireLoginForGeneration()) return;
                        setCreationStep((prev) => getNextCreationStep(prev));
                      }}
                      disabled={!canMoveNext}
                      className={`h-10 px-4 rounded-2xl border border-dashed text-[12px] font-bold inline-flex items-center gap-1.5 ${canMoveNext
                        ? 'text-white active:scale-95'
                        : 'border-[#3f556f]/30 text-[#7288a2] bg-[#172233]'
                        }`}
                      style={canMoveNext ? primaryActionButtonStyle : undefined}
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
                        ? 'text-white active:scale-95'
                        : 'border-[#3f556f]/30 text-[#7288a2] bg-[#172233]'
                        }`}
                      style={canCreateOnFinalStep ? primaryActionButtonStyle : undefined}
                    >
                      <BookPlus size={15} />
                      {`${t('Fortale Oluştur')} (${selectedCreateCreditCost} ${t('kredi')})`}
                    </button>
                  )}
                </div>
                </>
              )}
            </div>
          </form>
        </section>

        {isLoginRequiredModalOpen && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[120]">
            <button
              type="button"
              className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
              onClick={() => setLoginRequiredModalOpen(false)}
              aria-label={t('Vazgeç')}
            />
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="w-full max-w-md rounded-[26px] border border-white/10 bg-[#171f29]/95 p-4 text-center shadow-[0_24px_64px_rgba(0,0,0,0.45)]">
                <p className="text-[15px] font-semibold text-white">
                  {t('Üretim için giriş gerekli')}
                </p>
                <p className="mt-1 text-[12px] text-[#b8d0ea]">
                  {t('Üretime devam etmek için lütfen giriş yapın.')}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLoginRequiredModalOpen(false)}
                    className="h-12 rounded-2xl border border-white/12 bg-[rgba(34,44,58,0.95)] text-[14px] font-semibold text-[#d6e5f4]"
                  >
                    {t('Vazgeç')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginRequiredModalOpen(false);
                      onRequestLogin?.();
                    }}
                    className="h-12 rounded-2xl border border-[#7eb3ef]/38 bg-[linear-gradient(135deg,rgba(35,87,152,0.95),rgba(29,72,128,0.95))] text-[14px] font-bold text-white"
                  >
                    {t('Giriş Yap')}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {sourceNotice && (
          <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+80px)] z-[126] -translate-x-1/2 px-4">
            <div className="rounded-2xl border border-white/45 bg-white/20 px-4 py-3 backdrop-blur-xl shadow-[0_18px_28px_-18px_rgba(0,0,0,0.85)]">
              <p className="text-[12px] font-semibold text-white">{sourceNotice}</p>
            </div>
          </div>
        )}

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
              renderBootstrapShelf()
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

      {courseDeleteModal.isOpen && (
        <div className="fixed inset-0 z-[65]">
          <button
            type="button"
            aria-label={t('Vazgeç')}
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            onClick={closeCourseDeleteModal}
          />
          <div className="absolute inset-x-0 bottom-0 p-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
            <div className="mx-auto w-full max-w-md">
              <div className="rounded-[26px] border border-white/10 bg-[#171f29]/95 p-4 text-center shadow-[0_24px_64px_rgba(0,0,0,0.45)]">
                <p className="text-[15px] font-semibold text-white">
                  {t('Bu kitabı silmek istediğine emin misin?')}
                </p>
                <p className="mt-1 text-[12px] text-[#b8d0ea] line-clamp-2">
                  {courseDeleteModal.courseTitle}
                </p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={closeCourseDeleteModal}
                  disabled={isCourseDeleting}
                  className="h-12 rounded-2xl border border-white/12 bg-[rgba(34,44,58,0.95)] text-[14px] font-semibold text-[#d6e5f4] disabled:opacity-60"
                >
                  {t('Vazgeç')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCourseDeleteConfirm()}
                  disabled={isCourseDeleting}
                  className="h-12 rounded-2xl border border-red-300/30 bg-[rgba(220,38,38,0.9)] text-[14px] font-bold text-white disabled:opacity-60"
                >
                  {isCourseDeleting ? t('İşleniyor...') : t('Sil')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
