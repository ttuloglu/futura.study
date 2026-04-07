import React, { lazy, startTransition, Suspense, useEffect, useRef, useState } from 'react';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import {
  ViewState,
  CourseData,
  TimelineNode,
  StickyNoteData,
  SmartBookAgeGroup,
  CreditActionType,
  CreditWallet,
  CourseOpenUiState
} from './types';
import { normalizeSmartBookAgeGroup } from './utils/smartbookAgeGroup';
import BottomNav from './components/BottomNav';
import GlobalHeader from './components/GlobalHeader';
import AppLanguageSetupModal from './components/AppLanguageSetupModal';
import FaviconSpinner from './components/FaviconSpinner';
import type { CreditPackOption } from './components/CreditPaywallModal';
import { UiI18nProvider } from './i18n/uiI18n';
import {
  DEFAULT_APP_LANGUAGE,
  getAppLanguageLabel,
  normalizeAppLanguageCode,
  type AppLanguageCode
} from './data/appLanguages';
import { LEGAL_CONSENT_VERSION, defaultPrivacyPolicy, defaultTermsPolicy } from './data/policies';
import { appCheckReady, auth, db, functions } from './firebaseConfig';
import { collection, getDoc, getDocs, doc, setDoc, query, orderBy, deleteDoc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { deleteUser, onAuthStateChanged, signOut, updateProfile, type User as FirebaseUser } from 'firebase/auth';
import { getBlob, getDownloadURL, getStorage, listAll, ref as storageRef, uploadBytes, uploadString } from 'firebase/storage';
import JSZip from 'jszip';
import {
  CREDIT_EXHAUSTED_EVENT,
  CREDIT_WALLET_UPDATED_EVENT,
  generateCourseCover,
  generateLectureContent,
  generateRemedialContent,
  generateSummaryCard
} from './ai';
import {
  ensureRevenueCatConfigured,
  isRevenueCatEnabled,
  isRevenueCatPurchaseCancelledError,
  purchaseRevenueCatCreditPack
} from './utils/revenueCat';

const HomeView = lazy(() => import('./views/HomeView'));
const CourseFlowView = lazy(() => import('./views/CourseFlowView'));
const PersonalGrowthView = lazy(() => import('./views/PersonalGrowthView'));
const ProfileView = lazy(() => import('./views/ProfileView'));
const PrivacyView = lazy(() => import('./views/PrivacyView'));
const TermsView = lazy(() => import('./views/TermsView'));
const LoginView = lazy(() => import('./views/LoginView'));
const OnboardingView = lazy(() => import('./views/OnboardingView'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const LegalConsentModal = lazy(() => import('./components/LegalConsentModal'));
const CreditPaywallModal = lazy(() => import('./components/CreditPaywallModal'));

const LOCAL_COURSE_KEY_PREFIX = 'f-study-courses';
const LOCAL_FULL_COURSE_CACHE_KEY_PREFIX = 'f-study-full-courses';
const LOCAL_COURSE_COVER_CACHE_KEY_PREFIX = 'f-study-course-cover-cache';
const NATIVE_FULL_COURSE_CACHE_DIR = 'smartbook-cache';
const LOCAL_STICKY_KEY_PREFIX = 'f-study-sticky-notes';
const LOCAL_LIKED_COURSES_KEY_PREFIX = 'f-study-liked-courses';
const LOCAL_CREDIT_WALLET_KEY_PREFIX = 'f-study-credit-wallet';
const LOCAL_APP_LANGUAGE_KEY = 'f-study-app-language';
const LOCAL_APP_LANGUAGE_SOURCE_KEY = 'f-study-app-language-source';
const GUEST_SESSION_KEY = 'f-study-guest-session';
const LAST_AUTH_UID_KEY = 'f-study-last-auth-uid';
const GUEST_LOCAL_UID = 'guest';
const COURSE_CLOUD_SYNC_DEBOUNCE_MS = 1300;
const COURSE_LOCAL_CACHE_DEBOUNCE_MS = 180;
const MAX_LOCAL_COURSE_CACHE_ITEMS = 10;
const MAX_LOCAL_FULL_COURSE_CACHE_ITEMS = 6;
const MAX_LOCAL_INLINE_COVER_CACHE_ITEMS = 4;
const BACKGROUND_SMARTBOOK_POLL_MS = 300;
const SMARTBOOK_PREFETCH_RETRY_COOLDOWN_MS = 15_000;
const SMARTBOOK_COVER_REPAIR_RETRY_COOLDOWN_MS = 3500;
const SMARTBOOK_HYDRATION_PREFETCH_CONCURRENCY = 4;
const SMARTBOOK_EXPORT_HYDRATION_WAIT_MS = 5000;
const SMARTBOOK_PACKAGE_FETCH_TIMEOUT_MS = 40_000;
const SMARTBOOK_STORAGE_BLOB_TIMEOUT_MS = 30_000;
const SMARTBOOK_STORAGE_URL_TIMEOUT_MS = 20_000;
const SMARTBOOK_BACKEND_TIMEOUT_MS = 45_000;
const SMARTBOOK_OPEN_HYDRATION_TIMEOUT_MS = 65_000;
const READING_WORDS_PER_MINUTE = 180;
const CREDIT_WEBHOOK_SYNC_TIMEOUT_MS = 45_000;
const CREDIT_WEBHOOK_SYNC_POLL_MS = 1_250;
const SMARTBOOK_SHARE_QUERY_KEY = 'smartbook';
const SMARTBOOK_SHARE_SOURCE_QUERY_KEY = 'source';
const SMARTBOOK_SHARE_SOURCE_VALUE = 'library';
const PRIVACY_PAGE_PATH = '/privacy';
const LEGAL_PAGE_PATH = '/legal';
const APP_DEEP_LINK_SCHEMES = ['fstudy', 'com.company.fstudy'] as const;
const ANDROID_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.company.fstudy';
const IOS_APP_STORE_URL = (import.meta.env.VITE_IOS_APP_STORE_URL as string | undefined)?.trim()
  || 'https://apps.apple.com/tr/search?term=fortale';
const SHARE_DEEP_LINK_FALLBACK_MS = 1400;
const SHARE_DEEP_LINK_SECONDARY_SCHEME_DELAY_MS = 350;
const FREE_STARTER_CREDITS: CreditWallet = { createCredits: 3 };
const DEFAULT_ACTION_CREDIT_COST: Record<CreditActionType, number> = { create: 1 };
const CREDIT_PACKS: CreditPackOption[] = [
  { id: 'pack-5', createCredits: 5, priceUsd: 4.99 },
  { id: 'pack-15', createCredits: 15, priceUsd: 12.99 },
  { id: 'pack-30', createCredits: 30, priceUsd: 19.99 }
];

function FullScreenFallback({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <FaviconSpinner size={44} />
        <p className="text-[12px] font-semibold text-white/78">{message}</p>
      </div>
    </div>
  );
}

function markRetriableAttemptWithCooldown(target: Set<string>, key: string, cooldownMs: number): boolean {
  if (target.has(key)) return false;
  target.add(key);
  window.setTimeout(() => {
    target.delete(key);
  }, Math.max(500, cooldownMs));
  return true;
}

async function runTasksWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  let currentIndex = 0;

  await Promise.all(
    Array.from({ length: safeConcurrency }, async () => {
      while (true) {
        const nextIndex = currentIndex;
        currentIndex += 1;
        if (nextIndex >= items.length) return;
        await worker(items[nextIndex]);
      }
    })
  );
}

function withPromiseTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(message));
    }, Math.max(1, timeoutMs));

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

type StoredCourse = Omit<CourseData, 'createdAt' | 'lastActivity'> & {
  createdAt: string;
  lastActivity: string;
};

type StoredStickyNote = Omit<StickyNoteData, 'createdAt' | 'lastActivity'> & {
  createdAt: string;
  lastActivity: string;
};

type StoredCreditWallet = CreditWallet & {
  updatedAt: string;
};

type CreditGatewayOperation = 'getWallet' | 'consume' | 'refund';

type CreditGatewayRequest = {
  operation: CreditGatewayOperation;
  action?: CreditActionType;
  cost?: number;
  receiptId?: string;
};

type CreditGatewayResponse = {
  success?: boolean;
  wallet?: CreditWallet;
  error?: string;
  receiptId?: string;
};

type ListMySmartBookCoursesResponse = {
  success?: boolean;
  books?: Record<string, unknown>[];
};

type LegalConsentState = 'unknown' | 'required' | 'accepted';
type AppLanguagePreferenceSource = 'device_auto' | 'manual_selection';

type InitialAppLanguageSetup = {
  language: AppLanguageCode;
  source: AppLanguagePreferenceSource;
  requiresSelection: boolean;
};

type LocalCourseCoverCacheEntry = {
  courseId: string;
  coverImageUrl: string;
  updatedAt: string;
};

const DATA_IMAGE_URL_PREFIX_RE = /^data:image\//i;
const MARKDOWN_DATA_IMAGE_RE = /!\[[^\]]*]\(\s*data:image\/[^)]+\)\s*/gi;
const MARKDOWN_DATA_IMAGE_CAPTURE_RE = /!\[([^\]]*)\]\(\s*(data:image\/[^)\s]+)\s*\)/gi;
const pendingLocalCourseWrites = new Map<string, CourseData[]>();
const localCourseWriteTimers = new Map<string, number>();
const localCourseCacheWarned = new Set<string>();
const localCourseCacheDisabledByQuota = new Set<string>();
const missingNativeFullCourseCachePaths = new Set<string>();
const missingNativeFullCourseCacheDirs = new Set<string>();
const nativeFullCourseCacheRevisionByPath = new Map<string, string>();
const nativeFullCourseCacheWritePromiseByPath = new Map<string, Promise<void>>();
const creditGateway = httpsCallable<CreditGatewayRequest, CreditGatewayResponse>(functions, 'creditGateway', {
  timeout: 45_000
});
const listMySmartBookCourses = httpsCallable<Record<string, never>, ListMySmartBookCoursesResponse>(
  functions,
  'listMySmartBookCourses',
  { timeout: 45_000 }
);

function sortCoursesByLastActivity(courses: CourseData[]): CourseData[] {
  return [...courses].sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
}

const PLACEHOLDER_COURSE_TOPICS = new Set([
  'smartbook',
  'fortale',
  'smart book',
  'fortale'
]);

function normalizeCourseTopicCandidate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || undefined;
}

function isPlaceholderCourseTopic(value: unknown): boolean {
  const normalized = normalizeCourseTopicCandidate(value);
  if (!normalized) return true;
  return PLACEHOLDER_COURSE_TOPICS.has(normalized.toLocaleLowerCase('tr-TR'));
}

function resolveOptionalCourseTopic(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    const normalized = normalizeCourseTopicCandidate(candidate);
    if (!normalized) continue;
    if (isPlaceholderCourseTopic(normalized)) continue;
    return normalized;
  }
  return undefined;
}

function resolveCourseTopic(...candidates: unknown[]): string {
  return resolveOptionalCourseTopic(...candidates) || 'İsimsiz Kitap';
}

function detectDeviceAppLanguage(): AppLanguageCode | null {
  if (typeof window === 'undefined') return null;
  const candidates = Array.from(
    new Set([
      ...(Array.isArray(window.navigator.languages) ? window.navigator.languages : []),
      window.navigator.language
    ].filter(Boolean))
  );

  for (const candidate of candidates) {
    const normalized = normalizeAppLanguageCode(candidate);
    if (normalized) return normalized;
  }

  return null;
}

function normalizeAppLanguageSource(value: unknown): AppLanguagePreferenceSource | null {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'device_auto') return 'device_auto';
  if (raw === 'manual_selection') return 'manual_selection';
  return null;
}

function resolveInitialAppLanguageSetup(): InitialAppLanguageSetup {
  if (typeof window === 'undefined') {
    return {
      language: DEFAULT_APP_LANGUAGE,
      source: 'device_auto',
      requiresSelection: false
    };
  }

  const storedLanguage = normalizeAppLanguageCode(window.localStorage.getItem(LOCAL_APP_LANGUAGE_KEY));
  const storedSource = normalizeAppLanguageSource(window.localStorage.getItem(LOCAL_APP_LANGUAGE_SOURCE_KEY));
  if (storedLanguage) {
    return {
      language: storedLanguage,
      source: storedSource || 'manual_selection',
      requiresSelection: false
    };
  }

  const deviceLanguage = detectDeviceAppLanguage();
  if (deviceLanguage) {
    return {
      language: deviceLanguage,
      source: 'device_auto',
      requiresSelection: false
    };
  }

  return {
    language: DEFAULT_APP_LANGUAGE,
    source: 'manual_selection',
    requiresSelection: true
  };
}

function buildCourseMetadataPayload(course: CourseData): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    topic: resolveCourseTopic(course.topic),
    lastActivity: course.lastActivity,
    createdAt: course.createdAt
  };

  if (typeof course.description === 'string') payload.description = course.description;
  if (typeof course.creatorName === 'string') payload.creatorName = course.creatorName;
  if (typeof course.language === 'string') payload.language = course.language;
  if (course.ageGroup) payload.ageGroup = course.ageGroup;
  if (course.bookType) payload.bookType = course.bookType;
  if (typeof course.subGenre === 'string') payload.subGenre = course.subGenre;
  if (course.creativeBrief) payload.creativeBrief = course.creativeBrief;
  if (Number.isFinite(course.targetPageCount)) payload.targetPageCount = course.targetPageCount;
  if (typeof course.category === 'string') payload.category = course.category;
  if (Array.isArray(course.searchTags) && course.searchTags.length > 0) payload.searchTags = course.searchTags;
  if (typeof course.totalDuration === 'string') payload.totalDuration = course.totalDuration;
  if (typeof course.coverImageUrl === 'string') payload.coverImageUrl = course.coverImageUrl;
  if (typeof course.contentPackageUrl === 'string') payload.contentPackageUrl = course.contentPackageUrl;
  if (typeof course.contentPackagePath === 'string') payload.contentPackagePath = course.contentPackagePath;
  if (course.contentPackageUpdatedAt instanceof Date && !Number.isNaN(course.contentPackageUpdatedAt.getTime())) {
    payload.contentPackageUpdatedAt = course.contentPackageUpdatedAt;
  }
  if (typeof course.userId === 'string') payload.userId = course.userId;

  return payload;
}

function extractBundleVersionFromPath(path: string | undefined): number {
  const rawPath = String(path || '').trim();
  const match = rawPath.match(/\/v(\d+)\/book\.zip$/i);
  const parsed = match ? Number.parseInt(match[1], 10) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function isBookZipStoragePath(value: unknown): boolean {
  return typeof value === 'string' && /\/book\.zip$/i.test(value.trim());
}

function normalizeStorageObjectPath(value: unknown): string | undefined {
  const normalized = String(value || '').trim().replace(/^\/+/, '');
  return normalized || undefined;
}

function getBookPackagePathCandidates(value: unknown): string[] {
  const normalized = normalizeStorageObjectPath(value);
  if (!normalized) return [];
  const candidates: string[] = [];
  const push = (nextValue: string | undefined) => {
    const next = normalizeStorageObjectPath(nextValue);
    if (!next || candidates.includes(next)) return;
    candidates.push(next);
  };

  if (/\/package\.json$/i.test(normalized)) {
    const withoutFile = normalized.replace(/\/package\.json$/i, '');
    if (/\/v\d+$/i.test(withoutFile)) {
      push(`${withoutFile}/book.zip`);
    } else {
      push(`${withoutFile}/v1/book.zip`);
      push(`${withoutFile}/book.zip`);
    }
    // Keep legacy JSON fallback last for old snapshots.
    push(normalized);
    return candidates;
  }

  if (/\/book\.json$/i.test(normalized)) {
    const withoutFile = normalized.replace(/\/book\.json$/i, '');
    if (/\/v\d+$/i.test(withoutFile)) {
      push(`${withoutFile}/book.zip`);
    } else {
      push(`${withoutFile}/v1/book.zip`);
    }
    push(normalized);
    return candidates;
  }

  push(normalized);
  return candidates;
}

function resolvePreferredBookZipStoragePath(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    const candidates = getBookPackagePathCandidates(value);
    const zipCandidate = candidates.find((candidate) => isBookZipStoragePath(candidate));
    if (zipCandidate) return zipCandidate;
  }
  return undefined;
}

function normalizeCourseStatus(value: unknown): CourseData['status'] | undefined {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'processing' || normalized === 'ready' || normalized === 'failed') {
    return normalized;
  }
  return undefined;
}

function hasBookZipBundlePath(course: CourseData | null | undefined): boolean {
  if (!course) return false;
  if (isBookZipStoragePath(course.bundle?.path)) return true;
  if (isBookZipStoragePath(course.contentPackagePath)) return true;
  return false;
}

function shouldKeepSingleBundleStoredCourse(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const item = raw as Record<string, unknown>;
  if (isBookZipStoragePath(item.contentPackagePath)) return true;
  const bundle = item.bundle;
  if (bundle && typeof bundle === 'object' && isBookZipStoragePath((bundle as Record<string, unknown>).path)) {
    return true;
  }
  const status = normalizeCourseStatus(item.status);
  if (status === 'processing' || status === 'failed') return true;

  // Safety valve: keep private "ready" entries even if bundle metadata is
  // temporarily missing, so hard refresh does not permanently drop newly
  // generated books before metadata backfill completes.
  if (status === 'ready') {
    const hasOwner = typeof item.userId === 'string' && item.userId.trim().length > 0;
    return hasOwner;
  }

  return false;
}

function buildBookDocumentPayload(
  uid: string,
  courseId: string,
  course: CourseData
): Record<string, unknown> {
  const now = new Date();
  const title = resolveCourseTopic(course.topic);
  const packagePath = resolvePreferredBookZipStoragePath(course.bundle?.path, course.contentPackagePath) || '';
  const generatedAt = (
    course.contentPackageUpdatedAt instanceof Date &&
    !Number.isNaN(course.contentPackageUpdatedAt.getTime())
  )
    ? course.contentPackageUpdatedAt
    : now;
  const existingBundleVersion = Number.isFinite(course.bundle?.version)
    ? Math.max(1, Math.floor(Number(course.bundle?.version)))
    : undefined;
  const bundleVersion = existingBundleVersion || extractBundleVersionFromPath(packagePath);
  const includesPodcast = Array.isArray(course.nodes)
    ? course.nodes.some((node) => Boolean(node.podcastAudioUrl?.trim()))
    : false;
  const nextCover: Record<string, unknown> = {};
  if (typeof course.cover?.path === 'string' && course.cover.path.trim()) {
    nextCover.path = course.cover.path.trim();
  }
  if (typeof course.cover?.url === 'string' && course.cover.url.trim()) {
    nextCover.url = course.cover.url.trim();
  } else if (typeof course.coverImageUrl === 'string' && course.coverImageUrl.trim()) {
    nextCover.url = course.coverImageUrl.trim();
  }

  const bundle = packagePath
    ? {
      path: packagePath,
      version: bundleVersion,
      checksumSha256: typeof course.bundle?.checksumSha256 === 'string' ? course.bundle.checksumSha256 : undefined,
      sizeBytes: Number.isFinite(course.bundle?.sizeBytes) ? course.bundle?.sizeBytes : undefined,
      includesPodcast: course.bundle?.includesPodcast ?? includesPodcast,
      generatedAt
    }
    : undefined;
  const normalizedStatus = normalizeCourseStatus(course.status);
  const status: CourseData['status'] = bundle
    ? (normalizedStatus || 'ready')
    : (normalizedStatus === 'failed' ? 'failed' : 'processing');

  return {
    id: courseId,
    userId: uid,
    title,
    description: course.description,
    creatorName: course.creatorName,
    language: course.language,
    ageGroup: course.ageGroup,
    bookType: course.bookType,
    subGenre: course.subGenre,
    targetPageCount: Number.isFinite(course.targetPageCount) ? course.targetPageCount : undefined,
    category: course.category,
    searchTags: Array.isArray(course.searchTags) ? course.searchTags : undefined,
    totalDuration: course.totalDuration,
    status,
    cover: Object.keys(nextCover).length > 0 ? nextCover : undefined,
    bundle,
    createdAt: course.createdAt,
    updatedAt: now,
    lastActivity: course.lastActivity
  };
}

function stripUndefinedDeepForFirestore<T>(value: T): T {
  if (value === undefined) return undefined as T;
  if (value === null) return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeepForFirestore(item))
      .filter((item) => item !== undefined) as T;
  }
  if (typeof value === 'object') {
    const next: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
      const cleaned = stripUndefinedDeepForFirestore(nested);
      if (cleaned !== undefined) next[key] = cleaned;
    });
    return next as T;
  }
  return value;
}

type ClientPlatform = 'ios' | 'android' | 'desktop' | 'other-mobile';

function detectClientPlatform(): ClientPlatform {
  if (typeof window === 'undefined') return 'desktop';
  const ua = window.navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  if (isAndroid) return 'android';
  if (isIOS) return 'ios';
  const isMobileLike = /Mobi|Mobile|Tablet/i.test(ua);
  return isMobileLike ? 'other-mobile' : 'desktop';
}

function isCapacitorNativeRuntime(): boolean {
  const cap = (window as any)?.Capacitor;
  if (!cap) return false;
  try {
    if (typeof cap.isNativePlatform === 'function') return Boolean(cap.isNativePlatform());
  } catch {
    // ignore
  }
  const platform = typeof cap.getPlatform === 'function' ? cap.getPlatform() : undefined;
  return platform === 'ios' || platform === 'android';
}

function readSharedSmartBookIdFromUrl(): string | null {
  // Legacy community/library deep-link flow is disabled.
  return null;
}

function normalizeAppPathname(pathname: string): string {
  const normalized = String(pathname || '/').trim() || '/';
  if (normalized === '/') return '/';
  return normalized.replace(/\/+$/, '') || '/';
}

function viewFromPathname(pathname: string): ViewState | null {
  const normalized = normalizeAppPathname(pathname).toLocaleLowerCase('en-US');
  if (normalized === PRIVACY_PAGE_PATH) return 'PRIVACY';
  if (normalized === LEGAL_PAGE_PATH || normalized === '/terms') return 'TERMS';
  return null;
}

function pathnameForView(view: ViewState): string | null {
  if (view === 'PRIVACY') return PRIVACY_PAGE_PATH;
  if (view === 'TERMS') return LEGAL_PAGE_PATH;
  return null;
}

function readInitialViewFromUrl(): ViewState {
  if (typeof window === 'undefined') return 'HOME';
  return viewFromPathname(window.location.pathname) || 'HOME';
}

function removeSharedSmartBookQueryFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const hadSmartBook = url.searchParams.has(SMARTBOOK_SHARE_QUERY_KEY);
    url.searchParams.delete(SMARTBOOK_SHARE_QUERY_KEY);
    url.searchParams.delete(SMARTBOOK_SHARE_SOURCE_QUERY_KEY);
    if (!hadSmartBook) return;
    const query = url.searchParams.toString();
    const nextUrl = `${url.pathname}${query ? `?${query}` : ''}${url.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
  } catch {
    // ignore
  }
}

function buildSmartBookLibraryShareUrl(courseId: string): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.set(SMARTBOOK_SHARE_QUERY_KEY, courseId);
  url.searchParams.set(SMARTBOOK_SHARE_SOURCE_QUERY_KEY, SMARTBOOK_SHARE_SOURCE_VALUE);
  return `${url.origin}${url.pathname}?${url.searchParams.toString()}`;
}

function buildSmartBookDeepLink(courseId: string, scheme: string = APP_DEEP_LINK_SCHEMES[0]): string {
  return `${scheme}://library?smartbook=${encodeURIComponent(courseId)}`;
}

function getStoreFallbackUrlForPlatform(platform: ClientPlatform): string | null {
  if (platform === 'android') return ANDROID_PLAY_STORE_URL;
  if (platform === 'ios') return IOS_APP_STORE_URL;
  return null;
}

function sortStickyNotesByLastActivity(stickyNotes: StickyNoteData[]): StickyNoteData[] {
  return [...stickyNotes].sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
}

function estimateReadingMinutesFromText(text: string): number {
  const clean = String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\((?:data:image\/[^)]+|https?:\/\/[^)]+)\)/gi, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const wordCount = clean ? clean.split(/\s+/).filter(Boolean).length : 0;
  if (!wordCount) return 3;
  return Math.max(1, Math.ceil(wordCount / READING_WORDS_PER_MINUTE));
}

function calculateCourseTotalDuration(nodes: TimelineNode[]): string {
  const totalMinutes = nodes.reduce((sum, node) => {
    if (node.type === 'exam' || node.type === 'quiz') {
      return sum;
    }
    const text = String(node.duration || '').toLowerCase();
    const minutesMatch = text.match(/(\d+)\s*dk/);
    const secondsMatch = text.match(/(\d+)\s*sn/);
    const fallbackMatch = text.match(/\d+/);
    let m = 0;
    if (minutesMatch || secondsMatch) {
      const mins = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
      const secs = secondsMatch ? parseInt(secondsMatch[1], 10) : 0;
      m = mins + (secs >= 30 ? 1 : 0);
    } else if (fallbackMatch) {
      m = parseInt(fallbackMatch[0], 10) || 0;
    }
    if (!Number.isFinite(m) || m <= 0) {
      const defaults: Record<string, number> = {
        lecture: 14,
        podcast: 4,
        reinforce: 9,
        retention: 4,
        quiz: 9
      };
      m = defaults[node.type] || 5;
    }
    return sum + Math.max(1, m);
  }, 0);

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0) {
    return `${hours} saat ${mins > 0 ? `${mins} dk ` : ''}toplam çalışma`;
  }
  return `${Math.max(1, totalMinutes)} dk toplam çalışma`;
}

function getLocalCoursesKey(uid: string): string {
  return `${LOCAL_COURSE_KEY_PREFIX}:${uid}`;
}

function getLocalFullCoursesKey(uid: string): string {
  return `${LOCAL_FULL_COURSE_CACHE_KEY_PREFIX}:${uid}`;
}

function getLocalCourseCoverCacheKey(uid: string): string {
  return `${LOCAL_COURSE_COVER_CACHE_KEY_PREFIX}:${uid}`;
}

function getLocalStickyNotesKey(uid: string): string {
  return `${LOCAL_STICKY_KEY_PREFIX}:${uid}`;
}

function getLocalLikedCoursesKey(uid: string): string {
  return `${LOCAL_LIKED_COURSES_KEY_PREFIX}:${uid}`;
}

function getLocalCreditWalletKey(uid: string): string {
  return `${LOCAL_CREDIT_WALLET_KEY_PREFIX}:${uid}`;
}

function clearLocalUserDataCaches(uid: string): void {
  const timer = localCourseWriteTimers.get(uid);
  if (typeof timer === 'number') {
    window.clearTimeout(timer);
  }
  localCourseWriteTimers.delete(uid);
  pendingLocalCourseWrites.delete(uid);
  localCourseCacheWarned.delete(uid);
  localCourseCacheDisabledByQuota.delete(uid);

  const nativeCachePathPrefix = `${getNativeFullCourseCacheDir(uid)}/`;
  for (const cachePath of Array.from(missingNativeFullCourseCachePaths)) {
    if (cachePath.startsWith(nativeCachePathPrefix)) {
      missingNativeFullCourseCachePaths.delete(cachePath);
    }
  }
  for (const cacheDir of Array.from(missingNativeFullCourseCacheDirs)) {
    if (cacheDir.startsWith(nativeCachePathPrefix)) {
      missingNativeFullCourseCacheDirs.delete(cacheDir);
    }
  }
  for (const cachePath of Array.from(nativeFullCourseCacheRevisionByPath.keys())) {
    if (cachePath.startsWith(nativeCachePathPrefix)) {
      nativeFullCourseCacheRevisionByPath.delete(cachePath);
    }
  }
  for (const [cachePath, writePromise] of Array.from(nativeFullCourseCacheWritePromiseByPath.entries())) {
    if (cachePath.startsWith(nativeCachePathPrefix)) {
      void writePromise.catch(() => {
        // Ignore in-flight write failures while clearing cache state.
      });
      nativeFullCourseCacheWritePromiseByPath.delete(cachePath);
    }
  }

  try {
    window.localStorage.removeItem(getLocalCoursesKey(uid));
    window.localStorage.removeItem(getLocalFullCoursesKey(uid));
    window.localStorage.removeItem(getLocalCourseCoverCacheKey(uid));
    window.localStorage.removeItem(getLocalStickyNotesKey(uid));
    window.localStorage.removeItem(getLocalLikedCoursesKey(uid));
    window.localStorage.removeItem(getLocalCreditWalletKey(uid));
  } catch {
    // Ignore local cleanup failures.
  }
}

function resolveDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'seconds' in value && typeof (value as { seconds?: unknown }).seconds === 'number') {
    return new Date(((value as { seconds: number }).seconds) * 1000);
  }
  const parsed = new Date(String(value ?? ''));
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function resolveOptionalIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value && typeof (value as { seconds?: unknown }).seconds === 'number') {
    return new Date(((value as { seconds: number }).seconds) * 1000).toISOString();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function buildStickyTitle(title: string | undefined, text: string): string {
  const trimmedTitle = String(title || '').trim();
  if (trimmedTitle) return trimmedTitle.slice(0, 80);
  const compactText = text.replace(/\s+/g, ' ').trim();
  if (!compactText) return 'Yapışkan Not';
  return compactText.slice(0, 80);
}

function readGuestSessionFromLocal(): boolean {
  try {
    // Guest access is session-only; always restart unauthenticated users from onboarding on refresh/reopen.
    window.localStorage.removeItem(GUEST_SESSION_KEY);
    return false;
  } catch (error) {
    console.warn('Failed to read guest session state:', error);
    return false;
  }
}

function writeGuestSessionToLocal(enabled: boolean): void {
  try {
    if (enabled) {
      window.localStorage.setItem(GUEST_SESSION_KEY, '1');
      return;
    }

    window.localStorage.removeItem(GUEST_SESSION_KEY);
  } catch (error) {
    console.warn('Failed to persist guest session state:', error);
  }
}

function readLastAuthenticatedUidFromLocal(): string | null {
  try {
    const raw = String(window.localStorage.getItem(LAST_AUTH_UID_KEY) || '').trim();
    return raw || null;
  } catch (error) {
    console.warn('Failed to read last authenticated uid:', error);
    return null;
  }
}

function writeLastAuthenticatedUidToLocal(uid: string | null): void {
  try {
    if (uid && uid.trim()) {
      window.localStorage.setItem(LAST_AUTH_UID_KEY, uid.trim());
      return;
    }
    window.localStorage.removeItem(LAST_AUTH_UID_KEY);
  } catch (error) {
    console.warn('Failed to persist last authenticated uid:', error);
  }
}

function stripEmbeddedDataImagesFromMarkdown(markdown: string): string {
  if (!markdown || !markdown.includes('data:image/')) return markdown;

  return markdown
    .replace(MARKDOWN_DATA_IMAGE_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function simpleStableHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function inferImageExtensionFromDataUrl(dataUrl: string): { ext: string; mimeType: string } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/i);
  const mimeType = (match?.[1] || 'image/png').toLowerCase();
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return { ext: 'jpg', mimeType: 'image/jpeg' };
  if (mimeType.includes('webp')) return { ext: 'webp', mimeType: 'image/webp' };
  if (mimeType.includes('gif')) return { ext: 'gif', mimeType: 'image/gif' };
  return { ext: 'png', mimeType: mimeType.startsWith('image/') ? mimeType : 'image/png' };
}

function inferFileExtensionFromMimeType(mimeTypeRaw: string | undefined): string {
  const mimeType = String(mimeTypeRaw || '').toLowerCase();
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('aac')) return 'aac';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('gif')) return 'gif';
  if (mimeType.includes('png')) return 'png';
  return 'bin';
}

function isSmartBookStorageUrl(url: string): boolean {
  return /\/smartbooks\//i.test(url) || /%2Fsmartbooks%2F/i.test(url);
}

function isFirebaseStorageDownloadUrl(url: string): boolean {
  return (
    /https?:\/\/firebasestorage\.googleapis\.com\//i.test(url) ||
    /https?:\/\/[^/]*firebasestorage\.app\//i.test(url) ||
    /https?:\/\/storage\.googleapis\.com\//i.test(url)
  );
}

function tryParseFirebaseStorageObjectPath(url: string): string | null {
  try {
    const parsed = new URL(url);
    const objectMatch = parsed.pathname.match(/\/o\/([^/]+)$/);
    if (objectMatch?.[1]) {
      return decodeURIComponent(objectMatch[1]);
    }
    if (/^storage\.googleapis\.com$/i.test(parsed.hostname)) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return decodeURIComponent(parts.slice(1).join('/'));
      }
    }
    return null;
  } catch {
    return null;
  }
}

function inferMimeTypeFromAssetPath(pathValue: string): string {
  const normalized = String(pathValue || '').toLowerCase();
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.webp')) return 'image/webp';
  if (normalized.endsWith('.gif')) return 'image/gif';
  if (normalized.endsWith('.svg')) return 'image/svg+xml';
  if (normalized.endsWith('.mp3')) return 'audio/mpeg';
  if (normalized.endsWith('.wav')) return 'audio/wav';
  if (normalized.endsWith('.ogg')) return 'audio/ogg';
  if (normalized.endsWith('.aac')) return 'audio/aac';
  if (normalized.endsWith('.m4a')) return 'audio/mp4';
  if (normalized.endsWith('.webm')) return 'audio/webm';
  if (normalized.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

async function hydrateCourseFromBundleBlob(
  courseId: string,
  bundleBlob: Blob,
  urlOverride?: string,
  pathOverride?: string
): Promise<CourseData | null> {
  const zip = await JSZip.loadAsync(await bundleBlob.arrayBuffer());
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) return null;

  const manifestRaw = JSON.parse(await manifestFile.async('string')) as Record<string, unknown>;
  const imageAssetCache = new Map<string, string>();
  const audioAssetCache = new Map<string, string>();

  const resolveAssetImageDataUrl = async (rawPath: string): Promise<string | undefined> => {
    const normalizedPath = String(rawPath || '').trim().replace(/^\.?\//, '');
    if (!normalizedPath) return undefined;
    const cached = imageAssetCache.get(normalizedPath);
    if (cached) return cached;
    const assetFile = zip.file(normalizedPath);
    if (!assetFile) return undefined;
    const base64 = await assetFile.async('base64');
    const mimeType = inferMimeTypeFromAssetPath(normalizedPath);
    const dataUrl = `data:${mimeType};base64,${base64}`;
    imageAssetCache.set(normalizedPath, dataUrl);
    return dataUrl;
  };

  const resolveAssetAudioUrl = async (rawPath: string): Promise<string | undefined> => {
    const normalizedPath = String(rawPath || '').trim().replace(/^\.?\//, '');
    if (!normalizedPath) return undefined;
    const cached = audioAssetCache.get(normalizedPath);
    if (cached) return cached;
    const assetFile = zip.file(normalizedPath);
    if (!assetFile) return undefined;
    const blob = await assetFile.async('blob');
    const objectUrl = URL.createObjectURL(blob);
    audioAssetCache.set(normalizedPath, objectUrl);
    return objectUrl;
  };

  const rewriteMarkdownImageUrls = async (markdown: string | undefined): Promise<string | undefined> => {
    if (typeof markdown !== 'string' || !markdown.trim()) return markdown;
    const regex = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?\s*\)/g;
    let output = '';
    let cursor = 0;
    let match: RegExpExecArray | null = regex.exec(markdown);
    while (match) {
      const full = match[0];
      const alt = match[1] || '';
      const source = match[2] || '';
      let replacement = full;
      if (
        source &&
        !/^data:/i.test(source) &&
        !/^https?:\/\//i.test(source) &&
        !source.startsWith('blob:')
      ) {
        const assetUrl = await resolveAssetImageDataUrl(source);
        if (assetUrl) {
          const escapedAlt = alt.replace(/]/g, '\\]');
          replacement = `![${escapedAlt}](${assetUrl})`;
        }
      }
      output += markdown.slice(cursor, match.index) + replacement;
      cursor = match.index + full.length;
      match = regex.exec(markdown);
    }
    output += markdown.slice(cursor);
    return output;
  };

  const normalizedNodes = Array.isArray(manifestRaw.nodes)
    ? await Promise.all(manifestRaw.nodes.map(async (rawNode, index) => {
      const node = (rawNode && typeof rawNode === 'object')
        ? rawNode as Record<string, unknown>
        : {};
      const podcastAudioUrlRaw = typeof node.podcastAudioUrl === 'string' ? node.podcastAudioUrl : undefined;
      const resolvedPodcastAudioUrl = (
        podcastAudioUrlRaw &&
        !/^https?:\/\//i.test(podcastAudioUrlRaw) &&
        !/^data:/i.test(podcastAudioUrlRaw) &&
        !podcastAudioUrlRaw.startsWith('blob:')
      )
        ? await resolveAssetAudioUrl(podcastAudioUrlRaw)
        : podcastAudioUrlRaw;
      return {
        id: typeof node.id === 'string' ? node.id : `node-${index + 1}`,
        title: typeof node.title === 'string' ? node.title : '',
        description: typeof node.description === 'string' ? node.description : '',
        type: node.type,
        status: node.status,
        duration: typeof node.duration === 'string' ? node.duration : undefined,
        content: await rewriteMarkdownImageUrls(typeof node.content === 'string' ? node.content : undefined),
        podcastScript: typeof node.podcastScript === 'string' ? node.podcastScript : undefined,
        podcastAudioUrl: resolvedPodcastAudioUrl,
        questions: Array.isArray(node.questions) ? node.questions : undefined
      } as TimelineNode;
    }))
    : [];

  const rawCover = (manifestRaw.cover && typeof manifestRaw.cover === 'object')
    ? manifestRaw.cover as Record<string, unknown>
    : null;
  const coverPath = typeof rawCover?.path === 'string' ? rawCover.path : undefined;
  const coverDataUrl = coverPath ? await resolveAssetImageDataUrl(coverPath) : undefined;

  const materializedRawCourse: Record<string, unknown> = {
    ...manifestRaw,
    id: typeof manifestRaw.id === 'string' ? manifestRaw.id : courseId,
    topic: resolveCourseTopic(manifestRaw.topic, manifestRaw.title, manifestRaw.bookTitle),
    coverImageUrl: coverDataUrl,
    contentPackagePath: pathOverride,
    contentPackageUrl: urlOverride,
    contentPackageUpdatedAt: typeof manifestRaw.generatedAt === 'string'
      ? manifestRaw.generatedAt
      : new Date().toISOString(),
    status: 'ready',
    createdAt: typeof manifestRaw.createdAt === 'string' ? manifestRaw.createdAt : new Date().toISOString(),
    lastActivity: typeof manifestRaw.lastActivity === 'string'
      ? manifestRaw.lastActivity
      : (typeof manifestRaw.generatedAt === 'string' ? manifestRaw.generatedAt : new Date().toISOString()),
    nodes: normalizedNodes
  };

  return fromStoredCourse(materializedRawCourse);
}

function sanitizeNodeForLocalStorage(node: TimelineNode): TimelineNode {
  const nextNode: TimelineNode = { ...node };

  if (typeof nextNode.content === 'string') {
    nextNode.content = stripEmbeddedDataImagesFromMarkdown(nextNode.content);
  }

  return nextNode;
}

function hasRichNodeContent(node: TimelineNode | null | undefined): boolean {
  if (!node) return false;
  return (
    (typeof node.content === 'string' && node.content.trim().length > 0) ||
    (typeof node.podcastScript === 'string' && node.podcastScript.trim().length > 0) ||
    (typeof node.podcastAudioUrl === 'string' && node.podcastAudioUrl.trim().length > 0) ||
    (Array.isArray(node.questions) && node.questions.length > 0)
  );
}

function hasCompleteLectureContent(course: CourseData | null | undefined): boolean {
  if (!course || !Array.isArray(course.nodes) || course.nodes.length === 0) return false;
  const lectureNodes = course.nodes.filter((node) => node.type === 'lecture');
  if (lectureNodes.length === 0) {
    return course.nodes.some((node) => hasRichNodeContent(node));
  }
  return lectureNodes.every((node) => typeof node.content === 'string' && node.content.trim().length > 0);
}

function hasPersistableCourseContent(course: CourseData | null | undefined): boolean {
  return hasCompleteLectureContent(course);
}

function courseNeedsFullContentRepair(course: CourseData | null | undefined): boolean {
  if (!course || !Array.isArray(course.nodes) || course.nodes.length === 0) return true;
  return !hasPersistableCourseContent(course);
}

function hasMissingPrimaryNodeContent(course: CourseData | null | undefined): boolean {
  if (!course || !Array.isArray(course.nodes) || course.nodes.length === 0) return true;
  const lectureNodes = course.nodes.filter((node) => node.type === 'lecture');
  if (lectureNodes.length === 0) return false;
  return lectureNodes.some((node) => !(typeof node.content === 'string' && node.content.trim().length > 0));
}

function courseNeedsHydration(course: CourseData | null | undefined): boolean {
  return (
    isCourseProgressOnly(course) ||
    !course?.coverImageUrl ||
    courseNeedsFullContentRepair(course) ||
    hasMissingPrimaryNodeContent(course)
  );
}

function courseNeedsContentHydration(course: CourseData | null | undefined): boolean {
  return (
    isCourseProgressOnly(course) ||
    courseNeedsFullContentRepair(course) ||
    hasMissingPrimaryNodeContent(course)
  );
}

function toCompactStoredNode(node: TimelineNode): TimelineNode {
  return {
    ...sanitizeNodeForLocalStorage(node),
    content: undefined,
    podcastScript: undefined,
    podcastAudioUrl: undefined,
    questions: undefined,
    isLoading: undefined
  };
}

function toQuotaSafeStoredNode(node: TimelineNode): TimelineNode {
  return {
    id: node.id,
    title: node.title,
    description: node.description,
    type: node.type,
    status: node.status,
    score: node.score,
    duration: node.duration
  };
}

function toStoredCourse(course: CourseData): StoredCourse {
  return {
    ...course,
    coverImageUrl:
      typeof course.coverImageUrl === 'string' && DATA_IMAGE_URL_PREFIX_RE.test(course.coverImageUrl)
        ? undefined
        : course.coverImageUrl,
    nodes: Array.isArray(course.nodes) ? course.nodes.map(sanitizeNodeForLocalStorage) : [],
    createdAt: course.createdAt.toISOString(),
    lastActivity: course.lastActivity.toISOString()
  };
}

function toStoragePackageCourse(course: CourseData): StoredCourse {
  return {
    ...course,
    nodes: Array.isArray(course.nodes) ? course.nodes.map((node) => ({ ...node })) : [],
    createdAt: course.createdAt.toISOString(),
    lastActivity: course.lastActivity.toISOString()
  };
}

function toCompactStoredCourse(course: CourseData): StoredCourse {
  return {
    ...course,
    coverImageUrl:
      typeof course.coverImageUrl === 'string' && DATA_IMAGE_URL_PREFIX_RE.test(course.coverImageUrl)
        ? undefined
        : course.coverImageUrl,
    nodes: Array.isArray(course.nodes) ? course.nodes.map(toCompactStoredNode) : [],
    createdAt: course.createdAt.toISOString(),
    lastActivity: course.lastActivity.toISOString()
  };
}

function toQuotaSafeStoredCourse(course: CourseData): StoredCourse {
  return {
    ...course,
    description: undefined,
    language: course.language,
    ageGroup: course.ageGroup,
    category: course.category,
    searchTags: Array.isArray(course.searchTags)
      ? course.searchTags.filter((tag) => typeof tag === 'string').slice(0, 24)
      : undefined,
    totalDuration: course.totalDuration,
    coverImageUrl:
      typeof course.coverImageUrl === 'string' && DATA_IMAGE_URL_PREFIX_RE.test(course.coverImageUrl)
        ? undefined
        : course.coverImageUrl,
    nodes: Array.isArray(course.nodes) ? course.nodes.map(toQuotaSafeStoredNode) : [],
    createdAt: course.createdAt.toISOString(),
    lastActivity: course.lastActivity.toISOString()
  };
}

function writeFullCoursesToLocal(uid: string, courses: CourseData[]): void {
  if (localCourseCacheDisabledByQuota.has(uid)) return;
  const storageKey = getLocalFullCoursesKey(uid);
  const candidates = sortCoursesByLastActivity(courses)
    .filter((course) => hasPersistableCourseContent(course))
    .slice(0, MAX_LOCAL_FULL_COURSE_CACHE_ITEMS)
    .map(toStoredCourse);

  if (candidates.length === 0) {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore cleanup failures.
    }
    return;
  }

  for (let count = candidates.length; count >= 1; count -= 1) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(candidates.slice(0, count)));
      return;
    } catch (error) {
      if (!isQuotaExceededLocalStorageError(error)) {
        console.warn('Full book local cache write skipped.');
        return;
      }
    }
  }

  localCourseCacheDisabledByQuota.add(uid);
  if (!localCourseCacheWarned.has(uid)) {
    localCourseCacheWarned.add(uid);
    console.warn('Book local cache disabled (storage quota exceeded). Firebase sync continues.');
  }

  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore cleanup failures.
  }
}

function getNativeFullCourseCacheSafeUid(uid: string): string {
  return String(uid || '').replace(/[^a-zA-Z0-9_-]/g, '_').trim();
}

function getNativeFullCourseCacheSafeCourseId(courseId: string): string {
  return String(courseId || '').replace(/[^a-zA-Z0-9_-]/g, '_').trim();
}

function getNativeFullCourseCacheDir(uid: string): string {
  return `${NATIVE_FULL_COURSE_CACHE_DIR}/${getNativeFullCourseCacheSafeUid(uid)}`;
}

function getNativeFullCourseLegacyCachePath(uid: string, courseId: string): string {
  return `${getNativeFullCourseCacheDir(uid)}/${getNativeFullCourseCacheSafeCourseId(courseId)}.json`;
}

function getNativeFullCourseCachePath(uid: string, courseId: string, version: number): string {
  const safeVersion = Number.isFinite(version) ? Math.max(1, Math.floor(version)) : 1;
  return `${getNativeFullCourseCacheDir(uid)}/${getNativeFullCourseCacheSafeCourseId(courseId)}/v${safeVersion}/book.json`;
}

function resolveNativeCourseCacheVersionFromPath(path: string | undefined): number {
  const rawPath = String(path || '').trim();
  const match = rawPath.match(/\/v(\d+)\/book\.zip$/i);
  const parsed = match ? Number.parseInt(match[1], 10) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function resolveNativeCourseCacheVersion(course: CourseData): number {
  if (Number.isFinite(course.bundle?.version)) {
    return Math.max(1, Math.floor(Number(course.bundle?.version)));
  }
  return resolveNativeCourseCacheVersionFromPath(course.contentPackagePath);
}

function getNativeFullCourseNodeRevision(node: TimelineNode): string {
  const normalizedContent = typeof node.content === 'string'
    ? stripEmbeddedDataImagesFromMarkdown(node.content).trim()
    : '';
  const normalizedPodcastScript = typeof node.podcastScript === 'string'
    ? node.podcastScript.trim()
    : '';
  const normalizedPodcastAudioUrl = typeof node.podcastAudioUrl === 'string'
    ? node.podcastAudioUrl.trim()
    : '';
  const questionCount = Array.isArray(node.questions) ? node.questions.length : 0;

  return [
    node.id,
    node.type,
    node.title || '',
    node.description || '',
    node.duration || '',
    normalizedContent ? simpleStableHash(normalizedContent) : '',
    normalizedPodcastScript ? simpleStableHash(normalizedPodcastScript) : '',
    normalizedPodcastAudioUrl ? simpleStableHash(normalizedPodcastAudioUrl) : '',
    String(questionCount)
  ].join(':');
}

function getNativeFullCourseCacheRevision(course: CourseData): string {
  const normalizedCover = (
    typeof course.coverImageUrl === 'string' &&
    !DATA_IMAGE_URL_PREFIX_RE.test(course.coverImageUrl)
  )
    ? course.coverImageUrl.trim()
    : '';
  const packageUpdatedAt = (
    course.contentPackageUpdatedAt instanceof Date &&
    !Number.isNaN(course.contentPackageUpdatedAt.getTime())
  )
    ? course.contentPackageUpdatedAt.toISOString()
    : '';
  const packageMarker = [
    course.contentPackagePath || '',
    course.contentPackageUrl || '',
    packageUpdatedAt,
    normalizedCover
  ].join('|');
  const nodeMarker = Array.isArray(course.nodes)
    ? course.nodes.map(getNativeFullCourseNodeRevision).join('|')
    : '';

  return simpleStableHash(`${packageMarker}|${nodeMarker}`);
}

function isNativeFilesystemMissingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return (
    /OS-PLUG-FILE-0008/i.test(message) ||
    /does not exist/i.test(message) ||
    /failed because file/i.test(message)
  );
}

function isNativeFilesystemAlreadyExistsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return (
    /OS-PLUG-FILE-0010/i.test(message) ||
    /already exists/i.test(message)
  );
}

async function writeFullCourseToNativeCache(uid: string, course: CourseData): Promise<void> {
  if (!isCapacitorNativeRuntime()) return;
  if (!hasPersistableCourseContent(course)) return;
  const cacheVersion = resolveNativeCourseCacheVersion(course);
  const cachePath = getNativeFullCourseCachePath(uid, course.id, cacheVersion);
  const courseCacheDir = `${getNativeFullCourseCacheDir(uid)}/${getNativeFullCourseCacheSafeCourseId(course.id)}`;
  const nextRevision = getNativeFullCourseCacheRevision(course);

  if (nativeFullCourseCacheRevisionByPath.get(cachePath) === nextRevision) {
    return;
  }

  const existingWrite = nativeFullCourseCacheWritePromiseByPath.get(cachePath);
  if (existingWrite) {
    try {
      await existingWrite;
    } catch {
      // Ignore in-flight write failures and retry if needed.
    }
    if (nativeFullCourseCacheRevisionByPath.get(cachePath) === nextRevision) {
      return;
    }
  }

  const serializedCourse = JSON.stringify(toStoredCourse(course));
  const writePromise = (async () => {
    try {
      await Filesystem.writeFile({
        path: cachePath,
        data: serializedCourse,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
        recursive: true
      });
      missingNativeFullCourseCachePaths.delete(cachePath);
      missingNativeFullCourseCacheDirs.delete(courseCacheDir);
      nativeFullCourseCacheRevisionByPath.set(cachePath, nextRevision);
    } catch {
      // Ignore native cache failures.
    }
  })();

  nativeFullCourseCacheWritePromiseByPath.set(cachePath, writePromise);
  try {
    await writePromise;
  } finally {
    if (nativeFullCourseCacheWritePromiseByPath.get(cachePath) === writePromise) {
      nativeFullCourseCacheWritePromiseByPath.delete(cachePath);
    }
  }
}

async function listNativeFullCourseCacheVersions(uid: string, courseId: string): Promise<number[]> {
  if (!isCapacitorNativeRuntime()) return [];
  const courseCacheDir = `${getNativeFullCourseCacheDir(uid)}/${getNativeFullCourseCacheSafeCourseId(courseId)}`;
  if (missingNativeFullCourseCacheDirs.has(courseCacheDir)) return [];
  try {
    const result = await Filesystem.readdir({
      path: courseCacheDir,
      directory: Directory.Data
    });
    const versions = (result.files || [])
      .map((entry) => (typeof entry === 'string' ? entry : entry?.name || ''))
      .map((name) => {
        const match = String(name).match(/^v(\d+)$/i);
        return match ? Number.parseInt(match[1], 10) : Number.NaN;
      })
      .filter((value) => Number.isFinite(value) && value >= 1)
      .map((value) => Math.floor(value));
    versions.sort((left, right) => right - left);
    missingNativeFullCourseCacheDirs.delete(courseCacheDir);
    return versions;
  } catch (error) {
    if (isNativeFilesystemMissingError(error)) {
      missingNativeFullCourseCacheDirs.add(courseCacheDir);
    }
    return [];
  }
}

async function readFullCourseFromNativeCache(uid: string, courseId: string, versionHint?: number): Promise<CourseData | null> {
  if (!isCapacitorNativeRuntime()) return null;
  const candidatePaths: string[] = [];
  const pushCandidate = (path: string) => {
    if (!path || candidatePaths.includes(path)) return;
    candidatePaths.push(path);
  };

  const hintedVersion = Number.isFinite(versionHint) ? Math.max(1, Math.floor(Number(versionHint))) : undefined;
  if (hintedVersion) {
    pushCandidate(getNativeFullCourseCachePath(uid, courseId, hintedVersion));
  }

  const knownVersions = await listNativeFullCourseCacheVersions(uid, courseId);
  for (const version of knownVersions) {
    pushCandidate(getNativeFullCourseCachePath(uid, courseId, version));
  }

  // Backward compatibility: old single-file cache layout.
  pushCandidate(getNativeFullCourseLegacyCachePath(uid, courseId));

  for (const cachePath of candidatePaths) {
    if (missingNativeFullCourseCachePaths.has(cachePath)) continue;
    try {
      const result = await Filesystem.readFile({
        path: cachePath,
        directory: Directory.Data,
        encoding: Encoding.UTF8
      });
      const raw = typeof result.data === 'string' ? result.data : '';
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const course = fromStoredCourse(parsed);
      if (!course || !hasPersistableCourseContent(course)) continue;
      missingNativeFullCourseCachePaths.delete(cachePath);
      return course;
    } catch (error) {
      if (isNativeFilesystemMissingError(error)) {
        missingNativeFullCourseCachePaths.add(cachePath);
        nativeFullCourseCacheRevisionByPath.delete(cachePath);
      }
    }
  }
  return null;
}

async function readFullCoursesFromNativeCache(uid: string, courseIds: string[]): Promise<Map<string, CourseData>> {
  const next = new Map<string, CourseData>();
  for (const courseId of Array.from(new Set(courseIds.filter(Boolean)))) {
    const course = await readFullCourseFromNativeCache(uid, courseId);
    if (course) next.set(courseId, course);
  }
  return next;
}

function readFullCoursesFromLocal(uid: string): Map<string, CourseData> {
  try {
    const raw = window.localStorage.getItem(getLocalFullCoursesKey(uid));
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Map();

    return new Map(
      parsed
        .filter((item) => shouldKeepSingleBundleStoredCourse(item))
        .map(fromStoredCourse)
        .filter((course): course is CourseData => (
          course !== null &&
          hasPersistableCourseContent(course) &&
          hasBookZipBundlePath(course)
        ))
        .map((course) => [course.id, course] as const)
    );
  } catch {
    return new Map();
  }
}

function isQuotaExceededLocalStorageError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'QuotaExceededError' || error.code === 22 || error.code === 1014;
  }
  if (error instanceof Error) {
    return /quota/i.test(error.name) || /quota/i.test(error.message);
  }
  return false;
}

function fromStoredCourse(raw: unknown): CourseData | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const item = raw as Partial<StoredCourse> & Record<string, unknown>;
  if (!item.id || !item.createdAt || !item.lastActivity) return null;
  const bundlePayload = (item.bundle && typeof item.bundle === 'object')
    ? item.bundle as Record<string, unknown>
    : null;
  const coverPayload = (item.cover && typeof item.cover === 'object')
    ? item.cover as Record<string, unknown>
    : null;
  const resolvedBundlePath = resolvePreferredBookZipStoragePath(
    bundlePayload?.path,
    item.contentPackagePath
  );
  const resolvedContentPackagePath = resolvedBundlePath
    || normalizeStorageObjectPath(item.contentPackagePath)
    || normalizeStorageObjectPath(bundlePayload?.path);
  const resolvedCoverImageUrl = (
    typeof item.coverImageUrl === 'string'
      ? item.coverImageUrl
      : (typeof coverPayload?.url === 'string' ? coverPayload.url : undefined)
  );

  const normalizedNodes = Array.isArray(item.nodes)
    ? item.nodes.filter(
      (node): node is TimelineNode =>
        Boolean(node) &&
        typeof (node as TimelineNode).id === 'string' &&
        (node as TimelineNode).type !== 'exam' &&
        (node as TimelineNode).type !== 'quiz'
    )
    : [];
  const bundleVersion = Number(bundlePayload?.version);
  const bundleGeneratedAtRaw = bundlePayload?.generatedAt;
  const bundleGeneratedAt = (
    bundleGeneratedAtRaw instanceof Date
      ? bundleGeneratedAtRaw
      : (bundleGeneratedAtRaw ? new Date(bundleGeneratedAtRaw as string) : undefined)
  );
  const normalizedBundle = (
    resolvedBundlePath
  )
    ? {
      path: resolvedBundlePath,
      version: Number.isFinite(bundleVersion) ? Math.max(1, Math.floor(bundleVersion)) : extractBundleVersionFromPath(resolvedBundlePath),
      checksumSha256: typeof bundlePayload?.checksumSha256 === 'string' ? bundlePayload.checksumSha256 : undefined,
      sizeBytes: Number.isFinite(Number(bundlePayload?.sizeBytes))
        ? Math.max(0, Math.floor(Number(bundlePayload?.sizeBytes)))
        : undefined,
      includesPodcast: bundlePayload?.includesPodcast === true,
      generatedAt: bundleGeneratedAt && !Number.isNaN(bundleGeneratedAt.getTime())
        ? bundleGeneratedAt
        : new Date(item.contentPackageUpdatedAt as string || item.lastActivity)
    }
    : undefined;
  const normalizedCover = (
    typeof coverPayload?.path === 'string' ||
    typeof coverPayload?.url === 'string' ||
    typeof resolvedCoverImageUrl === 'string'
  )
    ? {
      path: typeof coverPayload?.path === 'string' ? coverPayload.path : undefined,
      url: typeof coverPayload?.url === 'string'
        ? coverPayload.url
        : (typeof resolvedCoverImageUrl === 'string' ? resolvedCoverImageUrl : undefined)
    }
    : undefined;

  return {
    id: item.id,
    topic: resolveCourseTopic(
      item.topic,
      item.title,
      (item as unknown as Record<string, unknown>).bookTitle,
      (item as unknown as Record<string, unknown>).title
    ),
    description: typeof item.description === 'string' ? item.description : undefined,
    creatorName: typeof item.creatorName === 'string' ? item.creatorName : undefined,
    language: typeof item.language === 'string' ? item.language : undefined,
    ageGroup: normalizeSmartBookAgeGroup(item.ageGroup),
    bookType: typeof item.bookType === 'string' ? item.bookType : undefined,
    subGenre: typeof item.subGenre === 'string' ? item.subGenre : undefined,
    creativeBrief: typeof item.creativeBrief === 'object' && item.creativeBrief !== null
      ? item.creativeBrief
      : undefined,
    targetPageCount: Number.isFinite(item.targetPageCount) ? Number(item.targetPageCount) : undefined,
    category: typeof item.category === 'string' ? item.category : undefined,
    searchTags: Array.isArray(item.searchTags)
      ? item.searchTags.filter((tag): tag is string => typeof tag === 'string')
      : undefined,
    totalDuration: typeof item.totalDuration === 'string' ? item.totalDuration : undefined,
    coverImageUrl: resolvedCoverImageUrl,
    contentPackageUrl: typeof item.contentPackageUrl === 'string' ? item.contentPackageUrl : undefined,
    contentPackagePath: resolvedContentPackagePath,
    contentPackageUpdatedAt: item.contentPackageUpdatedAt ? new Date(item.contentPackageUpdatedAt) : undefined,
    bundle: normalizedBundle,
    cover: normalizedCover,
    status: normalizeCourseStatus(item.status),
    userId: typeof item.userId === 'string' ? item.userId : undefined,
    nodes: normalizedNodes,
    createdAt: new Date(item.createdAt),
    lastActivity: new Date(item.lastActivity)
  };
}

function toIsoStringForBookMetadata(value: unknown, fallback: string): string {
  const resolved = resolveOptionalIsoDate(value);
  return resolved || fallback;
}

function fromUserBookDocument(
  bookId: string,
  raw: Record<string, unknown>,
  fallbackUserId: string
): CourseData | null {
  const nowIso = new Date().toISOString();
  const createdAtIso = toIsoStringForBookMetadata(raw.createdAt, nowIso);
  const lastActivityIso = toIsoStringForBookMetadata(raw.lastActivity, createdAtIso);
  const contentPackageUpdatedAtIso = resolveOptionalIsoDate(raw.contentPackageUpdatedAt)
    || resolveOptionalIsoDate(raw.updatedAt)
    || undefined;
  const bundlePayload = raw.bundle && typeof raw.bundle === 'object'
    ? raw.bundle as Record<string, unknown>
    : undefined;
  const coverPayload = raw.cover && typeof raw.cover === 'object'
    ? raw.cover as Record<string, unknown>
    : undefined;

  const normalized: Record<string, unknown> = {
    ...raw,
    id: bookId,
    userId: typeof raw.userId === 'string' ? raw.userId : fallbackUserId,
    createdAt: createdAtIso,
    lastActivity: lastActivityIso,
    contentPackageUpdatedAt: contentPackageUpdatedAtIso,
    bundle: bundlePayload
      ? {
        ...bundlePayload,
        generatedAt: resolveOptionalIsoDate(bundlePayload.generatedAt) || contentPackageUpdatedAtIso || lastActivityIso
      }
      : undefined,
    cover: coverPayload
      ? {
        ...coverPayload,
        url: typeof coverPayload.url === 'string'
          ? coverPayload.url
          : (typeof raw.coverImageUrl === 'string' ? raw.coverImageUrl : undefined)
      }
      : undefined
  };

  return fromStoredCourse(normalized);
}

type UserCourseProgressDoc = {
  id: string;
  userId?: string;
  topic?: string;
  description?: string;
  creatorName?: string;
  language?: string;
  ageGroup?: SmartBookAgeGroup;
  bookType?: CourseData['bookType'];
  subGenre?: string;
  creativeBrief?: CourseData['creativeBrief'];
  targetPageCount?: number;
  category?: string;
  searchTags?: string[];
  totalDuration?: string;
  coverImageUrl?: string;
  contentPackageUrl?: string;
  contentPackagePath?: string;
  contentPackageUpdatedAt?: Date;
  nodes: TimelineNode[];
  createdAt: Date;
  lastActivity: Date;
};

function isNodeProgressOnlyShape(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false;
  const value = node as Record<string, unknown>;
  return !('content' in value) && !('podcastScript' in value) && !('podcastAudioUrl' in value) && !('questions' in value);
}

function toUserProgressNode(node: TimelineNode): TimelineNode {
  const progressNode: TimelineNode = {
    id: node.id,
    title: node.title,
    type: node.type,
    status: node.status
  };
  if (typeof node.description === 'string') progressNode.description = node.description;
  if (typeof node.score === 'number') progressNode.score = node.score;
  if (typeof node.duration === 'string') progressNode.duration = node.duration;
  return progressNode;
}

function mergeSharedCourseWithUserProgress(sharedCourse: CourseData, progress: UserCourseProgressDoc): CourseData {
  const progressNodeMap = new Map(progress.nodes.map((node) => [node.id, node] as const));
  const mergedProgressNodes = sharedCourse.nodes.map((node) => {
    const progressNode = progressNodeMap.get(node.id);
    if (!progressNode) return node;
    return {
      ...node,
      status: progressNode.status || node.status,
      score: typeof progressNode.score === 'number' ? progressNode.score : node.score
    };
  });
  return {
    ...sharedCourse,
    topic: resolveCourseTopic(sharedCourse.topic, progress.topic),
    description: sharedCourse.description || progress.description,
    creatorName: sharedCourse.creatorName || progress.creatorName,
    language: sharedCourse.language || progress.language,
    ageGroup: sharedCourse.ageGroup || progress.ageGroup,
    bookType: sharedCourse.bookType || progress.bookType,
    subGenre: sharedCourse.subGenre || progress.subGenre,
    creativeBrief: sharedCourse.creativeBrief || progress.creativeBrief,
    targetPageCount: sharedCourse.targetPageCount || progress.targetPageCount,
    category: sharedCourse.category || progress.category,
    searchTags: sharedCourse.searchTags || progress.searchTags,
    totalDuration: sharedCourse.totalDuration || progress.totalDuration,
    coverImageUrl: sharedCourse.coverImageUrl || progress.coverImageUrl,
    contentPackageUrl: sharedCourse.contentPackageUrl || progress.contentPackageUrl,
    contentPackagePath: sharedCourse.contentPackagePath || progress.contentPackagePath,
    contentPackageUpdatedAt: sharedCourse.contentPackageUpdatedAt || progress.contentPackageUpdatedAt,
    nodes: mergedProgressNodes,
    lastActivity: progress.lastActivity || sharedCourse.lastActivity
  };
}

function isCourseProgressOnly(course: CourseData | undefined | null): boolean {
  if (!course || !Array.isArray(course.nodes) || course.nodes.length === 0) return true;
  return course.nodes.every((node) => isNodeProgressOnlyShape(node));
}

function toProgressDocFromCourseSnapshot(course: CourseData): UserCourseProgressDoc {
  return {
    id: course.id,
    userId: course.userId,
    topic: course.topic,
    description: course.description,
    creatorName: course.creatorName,
    language: course.language,
    ageGroup: course.ageGroup,
    bookType: course.bookType,
    subGenre: course.subGenre,
    creativeBrief: course.creativeBrief,
    targetPageCount: course.targetPageCount,
    category: course.category,
    searchTags: course.searchTags,
    totalDuration: course.totalDuration,
    coverImageUrl: course.coverImageUrl,
    contentPackageUrl: course.contentPackageUrl,
    contentPackagePath: course.contentPackagePath,
    contentPackageUpdatedAt: course.contentPackageUpdatedAt,
    nodes: Array.isArray(course.nodes) ? course.nodes.map((node) => ({ ...toUserProgressNode(node) })) : [],
    createdAt: course.createdAt,
    lastActivity: course.lastActivity
  };
}

function toStoredStickyNote(stickyNote: StickyNoteData): StoredStickyNote {
  return {
    ...stickyNote,
    createdAt: stickyNote.createdAt.toISOString(),
    lastActivity: stickyNote.lastActivity.toISOString()
  };
}

function fromStoredStickyNote(raw: unknown): StickyNoteData | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const item = raw as Partial<StoredStickyNote>;
  if (!item.id || !item.createdAt || !item.lastActivity) return null;

  return {
    id: item.id,
    title: String(item.title || 'Yapışkan Not'),
    text: String(item.text || ''),
    noteType: 'sticky',
    reminderAt: resolveOptionalIsoDate(item.reminderAt),
    createdAt: new Date(item.createdAt),
    lastActivity: new Date(item.lastActivity)
  };
}

function readCourseCoverCacheFromLocal(uid: string): Map<string, string> {
  try {
    const raw = window.localStorage.getItem(getLocalCourseCoverCacheKey(uid));
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Map();

    return new Map(
      parsed
        .filter((entry): entry is LocalCourseCoverCacheEntry => (
          Boolean(entry) &&
          typeof entry.courseId === 'string' &&
          typeof entry.coverImageUrl === 'string' &&
          DATA_IMAGE_URL_PREFIX_RE.test(entry.coverImageUrl)
        ))
        .map((entry) => [entry.courseId, entry.coverImageUrl] as const)
    );
  } catch {
    return new Map();
  }
}

function writeCourseCoverCacheToLocal(uid: string, courses: CourseData[]): void {
  try {
    const entries: LocalCourseCoverCacheEntry[] = courses
      .filter((course) => typeof course.coverImageUrl === 'string' && DATA_IMAGE_URL_PREFIX_RE.test(course.coverImageUrl))
      .slice(0, MAX_LOCAL_INLINE_COVER_CACHE_ITEMS)
      .map((course) => ({
        courseId: course.id,
        coverImageUrl: course.coverImageUrl as string,
        updatedAt: course.lastActivity.toISOString()
      }));

    if (entries.length === 0) {
      window.localStorage.removeItem(getLocalCourseCoverCacheKey(uid));
      return;
    }

    window.localStorage.setItem(getLocalCourseCoverCacheKey(uid), JSON.stringify(entries));
  } catch {
    // Ignore: cover cache is a best-effort recovery layer for freshly created books.
  }
}

function persistCoursesToLocal(uid: string, courses: CourseData[]): void {
  if (localCourseCacheDisabledByQuota.has(uid)) {
    pendingLocalCourseWrites.delete(uid);
    return;
  }

  writeCourseCoverCacheToLocal(uid, courses);
  writeFullCoursesToLocal(uid, courses);
  if (localCourseCacheDisabledByQuota.has(uid)) {
    pendingLocalCourseWrites.delete(uid);
    return;
  }

  pendingLocalCourseWrites.set(uid, [...courses]);
  const latestCourses = pendingLocalCourseWrites.get(uid);
  if (!latestCourses) return;

  const storageKey = getLocalCoursesKey(uid);
  const writePlans: Array<{
    maxItems: number;
    mapper: (course: CourseData) => StoredCourse;
  }> = [
      { maxItems: Math.min(4, MAX_LOCAL_COURSE_CACHE_ITEMS), mapper: toCompactStoredCourse },
      { maxItems: Math.min(8, MAX_LOCAL_COURSE_CACHE_ITEMS), mapper: toQuotaSafeStoredCourse },
      { maxItems: MAX_LOCAL_COURSE_CACHE_ITEMS, mapper: toQuotaSafeStoredCourse }
    ];

  let quotaExceeded = false;
  for (const plan of writePlans) {
    try {
      const payload = JSON.stringify(
        latestCourses
          .slice(0, plan.maxItems)
          .map(plan.mapper)
      );
      window.localStorage.setItem(storageKey, payload);
      return;
    } catch (error) {
      if (isQuotaExceededLocalStorageError(error)) {
        quotaExceeded = true;
        continue;
      }

      if (!localCourseCacheWarned.has(uid)) {
        localCourseCacheWarned.add(uid);
        console.warn('Book local cache write skipped.');
      }
      return;
    }
  }

  if (quotaExceeded) {
    localCourseCacheDisabledByQuota.add(uid);
    pendingLocalCourseWrites.delete(uid);
    if (!localCourseCacheWarned.has(uid)) {
      localCourseCacheWarned.add(uid);
      console.warn('Book local cache disabled (storage quota exceeded). Firebase sync continues.');
    }
  }
}

function flushCoursesToLocalNow(uid: string, courses?: CourseData[]): void {
  const existingTimer = localCourseWriteTimers.get(uid);
  if (typeof existingTimer === 'number') {
    window.clearTimeout(existingTimer);
    localCourseWriteTimers.delete(uid);
  }

  if (courses) {
    pendingLocalCourseWrites.set(uid, [...courses]);
  }

  persistCoursesToLocal(uid, pendingLocalCourseWrites.get(uid) || []);
  pendingLocalCourseWrites.delete(uid);
}

function writeCoursesToLocal(uid: string, courses: CourseData[]): void {
  if (localCourseCacheDisabledByQuota.has(uid)) return;
  pendingLocalCourseWrites.set(uid, [...courses]);
  const existingTimer = localCourseWriteTimers.get(uid);
  if (typeof existingTimer === 'number') {
    window.clearTimeout(existingTimer);
  }

  const timerId = window.setTimeout(() => {
    localCourseWriteTimers.delete(uid);
    if (!pendingLocalCourseWrites.has(uid)) return;
    flushCoursesToLocalNow(uid);
  }, COURSE_LOCAL_CACHE_DEBOUNCE_MS);

  localCourseWriteTimers.set(uid, timerId);
}

function writeStickyNotesToLocal(uid: string, stickyNotes: StickyNoteData[]): void {
  try {
    window.localStorage.setItem(
      getLocalStickyNotesKey(uid),
      JSON.stringify(stickyNotes.map(toStoredStickyNote))
    );
  } catch (error) {
    console.warn('Failed to persist sticky notes to local storage:', error);
  }
}

function readCoursesFromLocal(uid: string): CourseData[] {
  try {
    const raw = window.localStorage.getItem(getLocalCoursesKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const retainedStoredCourses = parsed.filter((item) => shouldKeepSingleBundleStoredCourse(item));

    const coverCache = readCourseCoverCacheFromLocal(uid);
    const fullCourseCache = readFullCoursesFromLocal(uid);

    const baseCourses = retainedStoredCourses
      .map(fromStoredCourse)
      .map((course) => {
        if (!course) return null;
        let nextCourse = course;
        if (!nextCourse.coverImageUrl) {
          const cachedCover = coverCache.get(nextCourse.id);
          if (cachedCover) {
            nextCourse = {
              ...nextCourse,
              coverImageUrl: cachedCover
            };
          }
        }

        const fullCachedCourse = fullCourseCache.get(nextCourse.id);
        if (fullCachedCourse && courseNeedsContentHydration(nextCourse)) {
          return mergeSharedCourseWithUserProgress(fullCachedCourse, toProgressDocFromCourseSnapshot(nextCourse));
        }

        return nextCourse;
      })
      .filter((course): course is CourseData => course !== null);

    const byId = new Map(baseCourses.map((course) => [course.id, course] as const));
    fullCourseCache.forEach((course, courseId) => {
      if (byId.has(courseId)) return;
      byId.set(courseId, course);
    });

    return sortCoursesByLastActivity(Array.from(byId.values()));
  } catch (error) {
    console.warn('Failed to parse books from local storage:', error);
    return [];
  }
}

function readStickyNotesFromLocal(uid: string): StickyNoteData[] {
  try {
    const raw = window.localStorage.getItem(getLocalStickyNotesKey(uid));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return sortStickyNotesByLastActivity(
      parsed
        .map(fromStoredStickyNote)
        .filter((note): note is StickyNoteData => note !== null)
    );
  } catch (error) {
    console.warn('Failed to parse sticky notes from local storage:', error);
    return [];
  }
}

function readLikedCourseIdsFromLocal(uid: string): string[] {
  try {
    const raw = window.localStorage.getItem(getLocalLikedCoursesKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

function writeLikedCourseIdsToLocal(uid: string, courseIds: string[]): void {
  try {
    window.localStorage.setItem(
      getLocalLikedCoursesKey(uid),
      JSON.stringify(Array.from(new Set(courseIds.filter((id) => typeof id === 'string'))).slice(0, 500))
    );
  } catch {
    // Ignore: likes are a local preference only.
  }
}

function normalizeCreditWallet(value: unknown): CreditWallet | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<CreditWallet>;
  const createCredits = Number(raw.createCredits);
  if (!Number.isFinite(createCredits)) return null;
  return {
    createCredits: Math.max(0, Math.floor(createCredits))
  };
}

function readCreditWalletFromLocal(uid: string): CreditWallet | null {
  try {
    const raw = window.localStorage.getItem(getLocalCreditWalletKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCreditWallet>;
    const normalized = normalizeCreditWallet(parsed);
    return normalized;
  } catch {
    return null;
  }
}

function writeCreditWalletToLocal(uid: string, wallet: CreditWallet): void {
  try {
    const payload: StoredCreditWallet = {
      ...wallet,
      updatedAt: new Date().toISOString()
    };
    window.localStorage.setItem(getLocalCreditWalletKey(uid), JSON.stringify(payload));
  } catch {
    // Ignore local cache failures for wallet updates.
  }
}

function isPermissionDeniedError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    code === 'permission-denied' ||
    message.includes('Missing or insufficient permissions') ||
    message.includes('permission-denied')
  );
}

function isFirestoreResourceExhaustedError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();
  return (
    code === 'resource-exhausted' ||
    normalized.includes('resource-exhausted') ||
    normalized.includes('resource exhausted') ||
    normalized.includes('write stream exhausted') ||
    normalized.includes('maximum allowed queued writes')
  );
}

function isStorageObjectNotFoundError(error: unknown): boolean {
  const code = String((error as { code?: string } | null)?.code || '').toLowerCase();
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase();
  return (
    code.includes('storage/object-not-found') ||
    code.includes('object-not-found') ||
    message.includes('object-not-found') ||
    message.includes('does not exist')
  );
}

function shouldRetryCreditGatewayError(error: unknown): boolean {
  const code = String((error as { code?: string } | null)?.code || '').toLowerCase();
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase();
  return (
    code.includes('internal') ||
    code.includes('unavailable') ||
    code.includes('deadline-exceeded') ||
    message.includes('internal') ||
    message.includes('service unavailable') ||
    message.includes('network request failed')
  );
}

export default function App() {
  const initialAppLanguageSetupRef = useRef<InitialAppLanguageSetup>(resolveInitialAppLanguageSetup());
  const [currentView, setCurrentView] = useState<ViewState>(() => readInitialViewFromUrl());
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [appLanguage, setAppLanguage] = useState<AppLanguageCode>(initialAppLanguageSetupRef.current.language);
  const [appLanguageSource, setAppLanguageSource] = useState<AppLanguagePreferenceSource>(initialAppLanguageSetupRef.current.source);
  const [isAppLanguageSetupOpen, setAppLanguageSetupOpen] = useState<boolean>(initialAppLanguageSetupRef.current.requiresSelection);
  const [savedCourses, setSavedCourses] = useState<CourseData[]>([]);
  const [courseOpenStateById, setCourseOpenStateById] = useState<Record<string, CourseOpenUiState>>({});
  const [stickyNotes, setStickyNotes] = useState<StickyNoteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Kitaplar yükleniyor...');
  const [hasCompletedLocalBootstrap, setHasCompletedLocalBootstrap] = useState(false);
  const [isAuthLoading, setAuthLoading] = useState(true);
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [bootstrapAuthUid, setBootstrapAuthUid] = useState<string | null>(() => {
    const currentUid = String(auth.currentUser?.uid || '').trim();
    return currentUid || readLastAuthenticatedUidFromLocal();
  });
  const [profileNameOverride, setProfileNameOverride] = useState<string | null>(null);
  const [isGuestSession, setGuestSession] = useState<boolean>(() => readGuestSessionFromLocal());
  const [isOnboardingVisible, setOnboardingVisible] = useState<boolean>(true);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [isReaderFullscreen, setIsReaderFullscreen] = useState(false);
  const [likedCourseIds, setLikedCourseIds] = useState<string[]>([]);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(true);
  const [incomingSharedSmartBookId, setIncomingSharedSmartBookId] = useState<string | null>(() => readSharedSmartBookIdFromUrl());
  const [creditWallet, setCreditWallet] = useState<CreditWallet>(FREE_STARTER_CREDITS);
  const [isCreditPaywallOpen, setCreditPaywallOpen] = useState(false);
  const [creditPaywallIntent, setCreditPaywallIntent] = useState<CreditActionType | null>(null);
  const [isCreditPurchaseBusy, setCreditPurchaseBusy] = useState(false);
  const [legalConsentState, setLegalConsentState] = useState<LegalConsentState>('unknown');
  const [isLegalConsentSaving, setIsLegalConsentSaving] = useState(false);
  const [legalConsentError, setLegalConsentError] = useState<string | null>(null);
  const appLanguageBootstrapWriteRef = useRef<string | null>(null);
  const didWarnCloudPermissionRef = useRef(false);
  const cloudCourseWriteTimerRef = useRef<number | null>(null);
  const pendingCloudCourseWriteRef = useRef<{
    uid: string;
    courseId: string;
    payload: Record<string, unknown>;
    allowMasterWrite: boolean;
  } | null>(null);
  const cloudCourseWriteInFlightRef = useRef(false);
  const courseCloudWriteRetryCountRef = useRef(0);
  const sessionCreatedCourseIdsRef = useRef<Set<string>>(new Set());
  const progressOnlyFallbackCourseIdsRef = useRef<Set<string>>(new Set());
  const savedCoursesRef = useRef<CourseData[]>([]);
  const courseOpenStateByIdRef = useRef<Record<string, CourseOpenUiState>>({});
  const courseOpenInFlightByIdRef = useRef<Set<string>>(new Set());
  const backgroundPackagingCourseIdsRef = useRef<Set<string>>(new Set());
  const backgroundPackagingStartAttemptedRef = useRef<Set<string>>(new Set());
  const backgroundNodeGenerationInFlightRef = useRef<Set<string>>(new Set());
  const backgroundCoverGenerationInFlightRef = useRef<Set<string>>(new Set());
  const backgroundGenerationSuppressedRef = useRef(false);
  const uploadedStorageAssetUrlByKeyRef = useRef<Map<string, string>>(new Map());
  const uploadingStorageAssetPromiseByKeyRef = useRef<Map<string, Promise<string>>>(new Map());
  const packageSyncAttemptedByCourseRef = useRef<Set<string>>(new Set());
  const coverRepairAttemptedByCourseRef = useRef<Set<string>>(new Set());
  const shareLinkRedirectAttemptedRef = useRef<Set<string>>(new Set());
  const shareLinkAutoOpenHandledRef = useRef<Set<string>>(new Set());
  const creditWalletRef = useRef<CreditWallet>(FREE_STARTER_CREDITS);
  const coursePackageByIdRef = useRef<Map<string, CourseData>>(new Map());
  const coursePackagePromiseByIdRef = useRef<Map<string, Promise<CourseData | null>>>(new Map());
  const coursePackagePromiseModeByIdRef = useRef<Map<string, 'storage-first' | 'backend-first'>>(new Map());
  const courseHydrationPromiseByKeyRef = useRef<Map<string, Promise<boolean>>>(new Map());

  const uploadDataImageToCourseStorage = async (
    ownerUid: string,
    courseId: string,
    relativePath: string,
    dataUrl: string
  ): Promise<string> => {
    const safeOwnerId = String(ownerUid).replace(/[^a-zA-Z0-9_-]/g, '_').trim();
    if (!safeOwnerId) {
      throw new Error('Missing owner uid for smartbook storage path.');
    }

    const cacheKey = `${safeOwnerId}:${courseId}:${simpleStableHash(relativePath)}:${simpleStableHash(dataUrl)}`;
    const cached = uploadedStorageAssetUrlByKeyRef.current.get(cacheKey);
    if (cached) return cached;

    const inFlight = uploadingStorageAssetPromiseByKeyRef.current.get(cacheKey);
    if (inFlight) return inFlight;

    const promise = (async () => {
      const { ext, mimeType } = inferImageExtensionFromDataUrl(dataUrl);
      const safeCourseId = String(courseId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeRelative = String(relativePath)
        .replace(/[^a-zA-Z0-9/_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^\/+|\/+$/g, '');
      const path = `smartbooks/${safeOwnerId}/${safeCourseId}/${safeRelative}.${ext}`;
      const fileRef = storageRef(getStorage(), path);
      await uploadString(fileRef, dataUrl, 'data_url', { contentType: mimeType });
      const downloadUrl = await getDownloadURL(fileRef);
      uploadedStorageAssetUrlByKeyRef.current.set(cacheKey, downloadUrl);
      return downloadUrl;
    })();

    uploadingStorageAssetPromiseByKeyRef.current.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      uploadingStorageAssetPromiseByKeyRef.current.delete(cacheKey);
    }
  };

  const materializeMarkdownImagesForCloud = async (
    ownerUid: string,
    courseId: string,
    nodeId: string,
    markdown: string | undefined
  ): Promise<string | undefined> => {
    if (!markdown || !markdown.includes('data:image/')) return markdown;

    const matches = Array.from(markdown.matchAll(MARKDOWN_DATA_IMAGE_CAPTURE_RE));
    if (matches.length === 0) return markdown;

    let nextContent = markdown;
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const full = match[0];
      const alt = match[1] || '';
      const dataUrl = match[2] || '';
      if (!dataUrl.startsWith('data:image/')) continue;

      try {
        const remoteUrl = await uploadDataImageToCourseStorage(ownerUid, courseId, `nodes/${nodeId}/image-${index + 1}`, dataUrl);
        const escapedAlt = alt.replace(/]/g, '\\]');
        nextContent = nextContent.replace(full, `![${escapedAlt}](${remoteUrl})`);
      } catch (error) {
        console.warn('Node image upload skipped, fallbacking to image-less cloud content:', error);
        nextContent = nextContent.replace(full, '');
      }
    }

    return nextContent.replace(/\n{3,}/g, '\n\n').trim();
  };

  const materializeNodesForCloud = async (
    ownerUid: string,
    courseId: string,
    nodes: TimelineNode[]
  ): Promise<TimelineNode[]> => {
    const safeOwnerId = String(ownerUid).replace(/[^a-zA-Z0-9_-]/g, '_').trim();
    if (!safeOwnerId) {
      throw new Error('Missing owner uid for smartbook storage path.');
    }
    const safeCourseId = String(courseId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const result: TimelineNode[] = [];
    for (const node of nodes) {
      let nextNode: TimelineNode = { ...node };
      if (typeof nextNode.content === 'string' && nextNode.content.includes('data:image/')) {
        nextNode = {
          ...nextNode,
          content: await materializeMarkdownImagesForCloud(safeOwnerId, courseId, node.id, nextNode.content)
        };
      }
      if (
        typeof nextNode.podcastAudioUrl === 'string' &&
        /^https?:\/\//i.test(nextNode.podcastAudioUrl) &&
        !isSmartBookStorageUrl(nextNode.podcastAudioUrl)
      ) {
        try {
          const sourceUrl = nextNode.podcastAudioUrl;
          if (isFirebaseStorageDownloadUrl(sourceUrl)) {
            // Already persisted in Firebase Storage. Skip browser-side copy because download URLs can be CORS-blocked.
            result.push(sanitizeNodeForLocalStorage(nextNode));
            continue;
          }
          const cacheKey = `${safeOwnerId}:${courseId}:${simpleStableHash(`nodes/${node.id}/podcast-audio`)}:${simpleStableHash(sourceUrl)}`;
          let packagedAudioUrl = uploadedStorageAssetUrlByKeyRef.current.get(cacheKey);
          if (!packagedAudioUrl) {
            const response = await fetch(sourceUrl);
            if (!response.ok) throw new Error(`Podcast audio fetch failed (${response.status})`);
            const blob = await response.blob();
            const mimeType = blob.type || 'audio/wav';
            const ext = inferFileExtensionFromMimeType(mimeType);
            const fileRef = storageRef(
              getStorage(),
              `smartbooks/${safeOwnerId}/${safeCourseId}/nodes/${node.id}/podcast-audio.${ext}`
            );
            await uploadBytes(fileRef, blob, { contentType: mimeType });
            packagedAudioUrl = await getDownloadURL(fileRef);
            uploadedStorageAssetUrlByKeyRef.current.set(cacheKey, packagedAudioUrl);
          }
          nextNode = { ...nextNode, podcastAudioUrl: packagedAudioUrl };
        } catch (error) {
          console.warn('Podcast audio package upload skipped:', error);
        }
      }
      result.push(sanitizeNodeForLocalStorage(nextNode));
    }
    return result;
  };

  const materializeCoverForCloud = async (
    ownerUid: string,
    courseId: string,
    coverImageUrl: unknown
  ): Promise<string | undefined> => {
    if (typeof coverImageUrl !== 'string' || !coverImageUrl.trim()) return undefined;
    const normalizedCoverUrl = coverImageUrl.trim();
    if (isSmartBookStorageUrl(normalizedCoverUrl) || isFirebaseStorageDownloadUrl(normalizedCoverUrl)) {
      return normalizedCoverUrl;
    }

    const safeOwnerId = String(ownerUid).replace(/[^a-zA-Z0-9_-]/g, '_').trim();
    if (!safeOwnerId) {
      throw new Error('Missing owner uid for smartbook storage path.');
    }
    const safeCourseId = String(courseId).replace(/[^a-zA-Z0-9_-]/g, '_');

    const uploadBlobCoverToStorage = async (blob: Blob): Promise<string> => {
      const mimeTypeRaw = String(blob.type || '').toLowerCase();
      const mimeType = mimeTypeRaw.startsWith('image/') ? mimeTypeRaw : 'image/png';
      const inferredExt = inferFileExtensionFromMimeType(mimeType);
      const ext = inferredExt === 'jpg' || inferredExt === 'png' || inferredExt === 'webp' || inferredExt === 'gif'
        ? inferredExt
        : 'png';
      const fileRef = storageRef(getStorage(), `smartbooks/${safeOwnerId}/${safeCourseId}/cover.${ext}`);
      await uploadBytes(fileRef, blob, { contentType: mimeType });
      return await getDownloadURL(fileRef);
    };

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        if (DATA_IMAGE_URL_PREFIX_RE.test(normalizedCoverUrl)) {
          return await uploadDataImageToCourseStorage(safeOwnerId, courseId, 'cover', normalizedCoverUrl);
        }
        if (/^https?:\/\//i.test(normalizedCoverUrl)) {
          const response = await fetch(normalizedCoverUrl);
          if (!response.ok) {
            throw new Error(`Cover image fetch failed (${response.status})`);
          }
          const blob = await response.blob();
          return await uploadBlobCoverToStorage(blob);
        }
        return normalizedCoverUrl;
      } catch (error) {
        if (attempt >= maxAttempts) {
          console.warn('Cover image upload skipped, fallbacking to original cover reference:', error);
          return normalizedCoverUrl;
        }
        await new Promise((resolve) => {
          window.setTimeout(resolve, 300 * attempt);
        });
      }
    }

    return normalizedCoverUrl;
  };

  const buildCourseCoverPathCandidates = (
    course: Pick<CourseData, 'id' | 'coverImageUrl' | 'contentPackagePath'>
  ): string[] => {
    const candidates: string[] = [];
    const pushCandidate = (value: string | null | undefined) => {
      if (!value) return;
      const normalized = value.trim().replace(/^\/+/, '');
      if (!normalized || candidates.includes(normalized)) return;
      candidates.push(normalized);
    };

    if (typeof course.coverImageUrl === 'string' && course.coverImageUrl.trim()) {
      const normalizedCoverUrl = course.coverImageUrl.trim();
      if (normalizedCoverUrl.startsWith('smartbooks/')) {
        pushCandidate(normalizedCoverUrl);
      }
      if (isFirebaseStorageDownloadUrl(normalizedCoverUrl)) {
        pushCandidate(tryParseFirebaseStorageObjectPath(normalizedCoverUrl));
      }
    }

    const packageBasePath = typeof course.contentPackagePath === 'string'
      ? course.contentPackagePath.trim().replace(/\/(?:package\.json|book\.zip)$/i, '')
      : '';
    if (packageBasePath) {
      pushCandidate(`${packageBasePath}/cover.jpg`);
      pushCandidate(`${packageBasePath}/cover.jpeg`);
      pushCandidate(`${packageBasePath}/cover.png`);
      pushCandidate(`${packageBasePath}/cover.webp`);
      pushCandidate(`${packageBasePath}/cover.gif`);
    }

    const safeCourseId = String(course.id || '').replace(/[^a-zA-Z0-9_-]/g, '_').trim();
    if (safeCourseId) {
      pushCandidate(`smartbooks/${safeCourseId}/cover.jpg`);
      pushCandidate(`smartbooks/${safeCourseId}/cover.jpeg`);
      pushCandidate(`smartbooks/${safeCourseId}/cover.png`);
      pushCandidate(`smartbooks/${safeCourseId}/cover.webp`);
      pushCandidate(`smartbooks/${safeCourseId}/cover.gif`);
    }

    return candidates;
  };

  const resolveFreshCoverUrlForCourse = async (
    course: Pick<CourseData, 'id' | 'coverImageUrl' | 'contentPackagePath'>
  ): Promise<string | undefined> => {
    const candidatePaths = buildCourseCoverPathCandidates(course);
    for (const path of candidatePaths) {
      try {
        return await getDownloadURL(storageRef(getStorage(), path));
      } catch {
        // Try the next path.
      }
    }

    if (typeof course.coverImageUrl === 'string' && /^https?:\/\//i.test(course.coverImageUrl.trim())) {
      return course.coverImageUrl.trim();
    }

    return undefined;
  };

  const uploadCoursePackageToStorage = async (
    ownerUid: string,
    courseId: string,
    course: CourseData
  ): Promise<Pick<CourseData, 'contentPackagePath' | 'contentPackageUrl' | 'contentPackageUpdatedAt'>> => {
    const safeOwnerId = String(ownerUid).replace(/[^a-zA-Z0-9_-]/g, '_').trim();
    if (!safeOwnerId) {
      throw new Error('Missing owner uid for smartbook storage path.');
    }
    const safeCourseId = String(courseId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const currentVersion = (() => {
      const match = String(course.contentPackagePath || '').match(/\/v(\d+)\/book\.zip$/i);
      const parsed = match ? Number.parseInt(match[1], 10) : 0;
      if (!Number.isFinite(parsed) || parsed < 1) return 0;
      return parsed;
    })();
    const nextVersion = Math.max(1, currentVersion + 1);
    const storagePath = `smartbooks/${safeOwnerId}/${safeCourseId}/v${nextVersion}/book.zip`;
    const manifest = {
      schemaVersion: 1,
      id: course.id,
      userId: ownerUid,
      title: course.topic,
      description: course.description,
      creatorName: course.creatorName,
      language: course.language,
      ageGroup: course.ageGroup,
      bookType: course.bookType,
      subGenre: course.subGenre,
      targetPageCount: course.targetPageCount,
      category: course.category,
      searchTags: course.searchTags,
      totalDuration: course.totalDuration,
      generatedAt: new Date().toISOString(),
      createdAt: course.createdAt.toISOString(),
      lastActivity: course.lastActivity.toISOString(),
      cover: {
        url: course.coverImageUrl
      },
      includesPodcast: course.nodes.some((node) => Boolean(node.podcastAudioUrl?.trim())),
      nodes: Array.isArray(course.nodes)
        ? course.nodes.map((node) => ({
          ...node,
          isLoading: undefined
        }))
        : []
    };
    const manifestPayload = JSON.stringify(manifest);
    const cacheKey = `${safeOwnerId}:${courseId}:bookzip:${simpleStableHash(manifestPayload)}`;
    const cachedUrl = uploadedStorageAssetUrlByKeyRef.current.get(cacheKey);

    if (cachedUrl) {
      return {
        contentPackagePath: storagePath,
        contentPackageUrl: cachedUrl,
        contentPackageUpdatedAt: new Date()
      };
    }

    const inFlight = uploadingStorageAssetPromiseByKeyRef.current.get(cacheKey);
    const uploadPromise = inFlight ?? (async () => {
      const fileRef = storageRef(getStorage(), storagePath);
      const zip = new JSZip();
      zip.file('manifest.json', manifestPayload);
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
      });
      await uploadBytes(fileRef, zipBlob, { contentType: 'application/zip' });
      const downloadUrl = await getDownloadURL(fileRef);
      uploadedStorageAssetUrlByKeyRef.current.set(cacheKey, downloadUrl);
      return downloadUrl;
    })();

    if (!inFlight) {
      uploadingStorageAssetPromiseByKeyRef.current.set(cacheKey, uploadPromise);
    }

    try {
      const downloadUrl = await uploadPromise;
      return {
        contentPackagePath: storagePath,
        contentPackageUrl: downloadUrl,
        contentPackageUpdatedAt: new Date()
      };
    } finally {
      if (!inFlight) {
        uploadingStorageAssetPromiseByKeyRef.current.delete(cacheKey);
      }
    }
  };

  const fetchCoursePackageFromStorage = async (
    courseId: string,
    ownerUid?: string,
    packageUrl?: string,
    packagePath?: string,
    options?: { preferBackend?: boolean; backendOnly?: boolean; versionHint?: number }
  ): Promise<CourseData | null> => {
    const cached = coursePackageByIdRef.current.get(courseId);
    if (cached && !courseNeedsContentHydration(cached)) return cached;

    const preferBackend = options?.preferBackend === true;
    const backendOnly = options?.backendOnly === true;
    const requestedMode: 'storage-first' | 'backend-first' = preferBackend ? 'backend-first' : 'storage-first';
    const existingPromise = coursePackagePromiseByIdRef.current.get(courseId);
    const existingMode = coursePackagePromiseModeByIdRef.current.get(courseId);
    if (existingPromise && (!preferBackend || existingMode === 'backend-first')) return existingPromise;

    const loadPromise = (async () => {
      const candidatePaths: string[] = [];
      const pushPath = (value: string | null | undefined) => {
        const normalized = String(value || '').trim().replace(/^\/+/, '');
        if (!normalized || candidatePaths.includes(normalized)) return;
        candidatePaths.push(normalized);
      };
      const pushPathCandidates = (value: string | null | undefined) => {
        for (const candidate of getBookPackagePathCandidates(value)) {
          pushPath(candidate);
        }
      };

      pushPathCandidates(packagePath);
      if (typeof packageUrl === 'string' && packageUrl.trim() && isFirebaseStorageDownloadUrl(packageUrl.trim())) {
        pushPathCandidates(tryParseFirebaseStorageObjectPath(packageUrl.trim()));
      }

      const safeOwnerId = String(ownerUid || '').replace(/[^a-zA-Z0-9_-]/g, '_').trim();
      const safeCourseId = String(courseId || '').replace(/[^a-zA-Z0-9_-]/g, '_').trim();
      const hintedVersion = Number.isFinite(Number(options?.versionHint))
        ? Math.max(1, Math.floor(Number(options?.versionHint)))
        : undefined;
      if (safeOwnerId && safeCourseId) {
        if (hintedVersion) {
          pushPath(`smartbooks/${safeOwnerId}/${safeCourseId}/v${hintedVersion}/book.zip`);
        }
        pushPath(`smartbooks/${safeOwnerId}/${safeCourseId}/v1/book.zip`);
      }
      if (safeCourseId) {
        pushPath(`smartbooks/${safeCourseId}/v1/book.zip`);
      }

      let resolvedUrl = typeof packageUrl === 'string' && packageUrl.trim() ? packageUrl.trim() : undefined;
      let resolvedPath = candidatePaths[0];
      let hydratedCourse: CourseData | null = null;
      let lastError: unknown = null;

      const tryLoadFromDownloadUrl = async (url: string): Promise<CourseData | null> => {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = window.setTimeout(() => {
          controller?.abort();
        }, SMARTBOOK_PACKAGE_FETCH_TIMEOUT_MS);
        try {
          const response = await fetch(url, {
            signal: controller?.signal,
            cache: 'no-store'
          });
          if (!response.ok) {
            throw new Error(`Book package fetch failed (${response.status})`);
          }
          const contentType = String(response.headers.get('content-type') || '').toLowerCase();
          const responseBlob = await response.blob();
          const isZipLike = /application\/zip|application\/x-zip-compressed/i.test(contentType) || /\.zip($|\?)/i.test(url);
          if (isZipLike) {
            return await hydrateCourseFromBundleBlob(courseId, responseBlob, url, resolvedPath || packagePath);
          }
          const payload = await response.json();
          const course = fromStoredCourse(payload);
          return await materializeCourse(course || null, url, resolvedPath || packagePath);
        } finally {
          window.clearTimeout(timer);
        }
      };

      const tryLoadFromStoragePath = async (path: string): Promise<CourseData | null> => {
        const packageRef = storageRef(getStorage(), path);
        const packageBlob = await withPromiseTimeout(
          getBlob(packageRef),
          SMARTBOOK_STORAGE_BLOB_TIMEOUT_MS,
          `Book package blob timeout (${path})`
        );
        const isZipLike = /\.zip$/i.test(path) || /application\/zip|application\/x-zip-compressed/i.test(String(packageBlob.type || '').toLowerCase());
        if (isZipLike) {
          return await hydrateCourseFromBundleBlob(courseId, packageBlob, resolvedUrl, path);
        }
        const payload = JSON.parse(await packageBlob.text());
        const course = fromStoredCourse(payload);
        return await materializeCourse(course || null, resolvedUrl, path);
      };

      const materializeCourse = async (
        rawCourse: CourseData | null,
        urlOverride?: string,
        pathOverride?: string
      ): Promise<CourseData | null> => {
        if (!rawCourse) return null;
        const nextCourse: CourseData = {
          ...rawCourse,
          coverImageUrl: rawCourse.coverImageUrl,
          contentPackageUrl: rawCourse.contentPackageUrl || urlOverride,
          contentPackagePath: rawCourse.contentPackagePath || pathOverride,
          contentPackageUpdatedAt: rawCourse.contentPackageUpdatedAt || new Date()
        };

        // Reject courses with 0 nodes — the source had no useful data.
        // This ensures the fallback chain continues to try Storage.
        if (!nextCourse.nodes || nextCourse.nodes.length === 0) {
          return null;
        }

        // Accept the course even if some content is still missing.
        // A course with *some* nodes is always better than null.
        coursePackageByIdRef.current.set(courseId, nextCourse);
        return nextCourse;
      };

      const tryLoadFromBackend = async (_preferFirestore = false): Promise<CourseData | null> => null;

      if (backendOnly) {
        try {
          const backendCourse = await tryLoadFromBackend(preferBackend);
          if (backendCourse) {
            return backendCourse;
          }
        } catch (backendError) {
          lastError = backendError;
        }
        try {
          const backendCourse = await tryLoadFromBackend(false);
          if (backendCourse) {
            return backendCourse;
          }
        } catch (backendError) {
          lastError = backendError;
        }
        return null;
      }

      if (preferBackend) {
        try {
          const backendCourse = await tryLoadFromBackend(true);
          if (backendCourse) {
            return backendCourse;
          }
        } catch (backendError) {
          lastError = backendError;
        }
      }

      if (resolvedUrl) {
        try {
          hydratedCourse = await tryLoadFromDownloadUrl(resolvedUrl);
          if (!resolvedPath && isFirebaseStorageDownloadUrl(resolvedUrl)) {
            resolvedPath = tryParseFirebaseStorageObjectPath(resolvedUrl) || resolvedPath;
          }
          lastError = null;
        } catch (error) {
          lastError = error;
        }
      }

      for (const candidatePath of candidatePaths) {
        if (hydratedCourse) break;
        try {
          hydratedCourse = await tryLoadFromStoragePath(candidatePath);
          resolvedPath = candidatePath;
          try {
            resolvedUrl = await withPromiseTimeout(
              getDownloadURL(storageRef(getStorage(), candidatePath)),
              SMARTBOOK_STORAGE_URL_TIMEOUT_MS,
              `Book package URL resolve timeout (${candidatePath})`
            );
          } catch {
            resolvedUrl = undefined;
          }
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          // iOS WebView may fail direct SDK blob fetch depending on CORS/runtime;
          // fallback to tokenized download URL + regular fetch for the same object.
          try {
            const candidateUrl = await withPromiseTimeout(
              getDownloadURL(storageRef(getStorage(), candidatePath)),
              SMARTBOOK_STORAGE_URL_TIMEOUT_MS,
              `Book package URL resolve timeout (${candidatePath})`
            );
            resolvedUrl = candidateUrl;
            hydratedCourse = await tryLoadFromDownloadUrl(candidateUrl);
            resolvedPath = candidatePath;
            lastError = null;
            break;
          } catch (urlFallbackError) {
            lastError = urlFallbackError;
          }
        }
      }

      if (!hydratedCourse && resolvedUrl) {
        try {
          hydratedCourse = await tryLoadFromDownloadUrl(resolvedUrl);
          if (!resolvedPath && isFirebaseStorageDownloadUrl(resolvedUrl)) {
            resolvedPath = tryParseFirebaseStorageObjectPath(resolvedUrl) || resolvedPath;
          }
        } catch (error) {
          lastError = error;
        }
      }

      if (!hydratedCourse) {
        try {
          const backendCourse = await tryLoadFromBackend(preferBackend);
          if (backendCourse) {
            return backendCourse;
          }
        } catch (backendError) {
          lastError = backendError;
        }
      }

      if (!hydratedCourse) {
        return null;
      }
      return hydratedCourse;
    })();

    coursePackagePromiseByIdRef.current.set(courseId, loadPromise);
    coursePackagePromiseModeByIdRef.current.set(courseId, requestedMode);
    try {
      return await loadPromise;
    } finally {
      if (coursePackagePromiseByIdRef.current.get(courseId) === loadPromise) {
        coursePackagePromiseByIdRef.current.delete(courseId);
      }
      if (coursePackagePromiseModeByIdRef.current.get(courseId) === requestedMode) {
        coursePackagePromiseModeByIdRef.current.delete(courseId);
      }
    }
  };

  const waitMs = (ms: number) =>
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, Math.max(0, ms));
    });

  const isTransientCourseBootstrapError = (error: unknown): boolean => {
    const message =
      error instanceof Error
        ? error.message
        : (typeof error === 'string' ? error : '');
    const normalizedMessage = message.toLowerCase();
    const code =
      typeof error === 'object' &&
        error !== null &&
        typeof (error as { code?: unknown }).code === 'string'
        ? String((error as { code?: string }).code).toLowerCase()
        : '';

    return (
      normalizedMessage.includes('response is not valid json object') ||
      normalizedMessage.includes('failed to fetch') ||
      code.includes('internal') ||
      code.includes('unavailable') ||
      code.includes('deadline-exceeded')
    );
  };

  const fetchUserBooksDirectly = async (uid: string): Promise<CourseData[]> => {
    const userBooksCollection = collection(db, 'users', uid, 'books');
    let snapshot;
    try {
      snapshot = await getDocs(query(userBooksCollection, orderBy('lastActivity', 'desc')));
    } catch {
      snapshot = await getDocs(userBooksCollection);
    }

    const courses = snapshot.docs
      .map((bookDoc) => fromUserBookDocument(
        bookDoc.id,
        bookDoc.data() as Record<string, unknown>,
        uid
      ))
      .filter((course): course is CourseData => course !== null);

    return sortCoursesByLastActivity(courses);
  };

  const fetchCourseListFromBackend = async (): Promise<CourseData[]> => {
    let lastError: unknown;
    const maxAttempts = 3;
    const fallbackUid = auth.currentUser?.uid;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await appCheckReady;
        const response = await listMySmartBookCourses({});
        const payload = Array.isArray(response.data?.books) ? response.data?.books : [];
        const callableCourses = payload
          .map(fromStoredCourse)
          .filter((course): course is CourseData => course !== null);
        if (callableCourses.length > 0) {
          let mergedCourses = callableCourses;
          if (fallbackUid) {
            try {
              const directCourses = await fetchUserBooksDirectly(fallbackUid);
              if (directCourses.length > 0) {
                const directById = new Map(directCourses.map((course) => [course.id, course] as const));
                mergedCourses = callableCourses.map((callableCourse) => {
                  const directCourse = directById.get(callableCourse.id);
                  if (!directCourse) return callableCourse;
                  return {
                    ...callableCourse,
                    contentPackageUrl: directCourse.contentPackageUrl || callableCourse.contentPackageUrl,
                    contentPackagePath: directCourse.contentPackagePath || callableCourse.contentPackagePath,
                    contentPackageUpdatedAt: directCourse.contentPackageUpdatedAt || callableCourse.contentPackageUpdatedAt,
                    bundle: directCourse.bundle || callableCourse.bundle,
                    cover: directCourse.cover || callableCourse.cover,
                    coverImageUrl: directCourse.coverImageUrl || callableCourse.coverImageUrl
                  };
                });
              }
            } catch {
              // Callable payload is enough for bootstrap when direct Firestore read fails.
            }
          }

          for (const course of mergedCourses) {
            if (hasPersistableCourseContent(course)) {
              coursePackageByIdRef.current.set(course.id, course);
            }
          }
          return sortCoursesByLastActivity(mergedCourses);
        }

        const directCourses = fallbackUid
          ? await fetchUserBooksDirectly(fallbackUid)
          : [];
        for (const course of directCourses) {
          if (hasPersistableCourseContent(course)) {
            coursePackageByIdRef.current.set(course.id, course);
          }
        }
        return sortCoursesByLastActivity(directCourses);
      } catch (error) {
        lastError = error;
        if (fallbackUid) {
          try {
            const directCourses = await fetchUserBooksDirectly(fallbackUid);
            if (directCourses.length > 0) {
              for (const course of directCourses) {
                if (hasPersistableCourseContent(course)) {
                  coursePackageByIdRef.current.set(course.id, course);
                }
              }
              return sortCoursesByLastActivity(directCourses);
            }
          } catch {
            // Keep retry loop behavior for transient callable failures.
          }
        }
        if (attempt >= maxAttempts || !isTransientCourseBootstrapError(error)) {
          throw error;
        }
        try {
          await auth.currentUser?.getIdToken(true);
        } catch {
          // Ignore token refresh errors; next retry still may recover.
        }
        await waitMs(300 * attempt);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Book bootstrap failed.');
  };

  const waitForHydratedCourseSnapshot = async (
    courseId: string,
    timeoutMs = SMARTBOOK_EXPORT_HYDRATION_WAIT_MS
  ): Promise<CourseData | null> => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const snapshot = savedCoursesRef.current.find((course) => course.id === courseId) || null;
      if (!snapshot) return null;
      if (!courseNeedsContentHydration(snapshot)) return snapshot;
      await waitMs(120);
    }

    return savedCoursesRef.current.find((course) => course.id === courseId) || null;
  };

  const resolveCourseForExport = async (courseId: string): Promise<CourseData | null> => {
    const snapshot = savedCoursesRef.current.find((course) => course.id === courseId) || null;
    if (!snapshot) return null;
    if (!courseNeedsContentHydration(snapshot)) return snapshot;

    try {
      await ensureCourseHydrated(courseId, { markNodesLoading: false });
    } catch {
      // Best-effort hydration only; export still falls back to the latest known snapshot.
    }

    const hydratedSnapshot = await waitForHydratedCourseSnapshot(courseId);
    return hydratedSnapshot || snapshot;
  };

  const disableCloudSyncForPermission = () => {
    if (didWarnCloudPermissionRef.current) return;
    didWarnCloudPermissionRef.current = true;
    console.warn('Firestore izin hatası alındı. Bulut senkronizasyonu kapatılmadı; private kullanıcı verisi için yeniden denemeler devam edecek.');
  };

  const clearPackageSyncAttemptForCourse = (courseId: string) => {
    const keyPrefix = `${courseId}:`;
    for (const key of Array.from(packageSyncAttemptedByCourseRef.current)) {
      if (key.startsWith(keyPrefix)) {
        packageSyncAttemptedByCourseRef.current.delete(key);
      }
    }
  };

  const applyCloudHydratedCourseLocally = (uid: string, cloudCourse: CourseData) => {
    setSavedCourses((prev) => {
      let changed = false;
      const nextCourses = prev.map((course) => {
        if (course.id !== cloudCourse.id) return course;
        changed = true;
        return {
          ...course,
          coverImageUrl: cloudCourse.coverImageUrl || course.coverImageUrl,
          contentPackageUrl: cloudCourse.contentPackageUrl || course.contentPackageUrl,
          contentPackagePath: cloudCourse.contentPackagePath || course.contentPackagePath,
          contentPackageUpdatedAt: cloudCourse.contentPackageUpdatedAt || course.contentPackageUpdatedAt,
          bundle: cloudCourse.bundle || course.bundle,
          cover: cloudCourse.cover || course.cover,
          status: normalizeCourseStatus(cloudCourse.status) || normalizeCourseStatus(course.status),
          nodes: Array.isArray(cloudCourse.nodes) && cloudCourse.nodes.length > 0 ? cloudCourse.nodes : course.nodes
        };
      });

      if (!changed) return prev;
      writeCoursesToLocal(uid, nextCourses);
      return nextCourses;
    });
  };

  const ensureCourseHydrated = async (
    courseId: string,
    options?: {
      markNodesLoading?: boolean;
      force?: boolean;
    }
  ): Promise<boolean> => {
    const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : null);
    if (!localUserId || !courseId) {
      return false;
    }
    const inFlightKey = `${localUserId}:${courseId}`;
    const inFlightPromise = courseHydrationPromiseByKeyRef.current.get(inFlightKey);
    if (inFlightPromise) {
      return inFlightPromise;
    }

    const snapshot = savedCoursesRef.current.find((course) => course.id === courseId);
    const markNodesLoading = options?.markNodesLoading === true;

    const applyHydratedCourseLocally = (hydrated: CourseData, progressSnapshot: CourseData) => {
      const mergedCourse = mergeSharedCourseWithUserProgress(
        hydrated,
        toProgressDocFromCourseSnapshot(progressSnapshot)
      );

      setSavedCourses((prev) => {
        let changed = false;
        const nextCourses = prev.map((course) => {
          if (course.id !== courseId) return course;
          changed = true;
          coursePackageByIdRef.current.set(courseId, mergedCourse);
          return mergedCourse;
        });
        if (!changed) return prev;
        writeCoursesToLocal(localUserId, nextCourses);
        writeFullCoursesToLocal(localUserId, nextCourses);
        void writeFullCourseToNativeCache(localUserId, mergedCourse);
        return nextCourses;
      });
    };

    if (!snapshot) {
      return false;
    }

    if (!courseNeedsContentHydration(snapshot)) {
      return true;
    }

    const nativeCachedCourse = await readFullCourseFromNativeCache(
      localUserId,
      courseId,
      resolveNativeCourseCacheVersion(snapshot)
    );
    if (nativeCachedCourse && !courseNeedsContentHydration(nativeCachedCourse)) {
      applyHydratedCourseLocally(nativeCachedCourse, snapshot);
      return true;
    }

    if (markNodesLoading) {
      patchCourseById(courseId, (course) => {
        let changed = false;
        const nextNodes = course.nodes.map((node) => {
          const shouldShowLoading = !node.content && (
            node.type === 'lecture' ||
            node.type === 'reinforce' ||
            node.type === 'retention'
          );
          if (!shouldShowLoading || node.isLoading) return node;
          changed = true;
          return { ...node, isLoading: true };
        });
        if (!changed) return course;
        return { ...course, nodes: nextNodes };
      }, false);
    }

    const hydrationPromise = (async () => {
      let hydrationSucceeded = false;
      try {
        if (authUser) {
          try {
            await authUser.getIdToken(options?.force === true);
          } catch {
            // Continue with best-effort auth state.
          }
        }

        const latestSnapshot = savedCoursesRef.current.find((course) => course.id === courseId) || snapshot;
        let ownerUid = latestSnapshot.userId || authUser?.uid;
        let packageUrl = latestSnapshot.contentPackageUrl;
        let packagePath = latestSnapshot.contentPackagePath;

        // Package metadata is now sourced directly from users/{uid}/books list payload.

        const hydrated = await fetchCoursePackageFromStorage(
          courseId,
          ownerUid,
          packageUrl,
          packagePath,
          { preferBackend: true, versionHint: latestSnapshot.bundle?.version }
        );

        if (!hydrated) {
          console.warn(`[Book Sync] No content found for book ${courseId} (owner=${ownerUid}, path=${packagePath || 'none'}, url=${packageUrl ? 'yes' : 'none'})`);
          return false;
        }

        applyHydratedCourseLocally(hydrated, latestSnapshot);
        hydrationSucceeded = true;
        return true;
      } catch (error) {
        console.warn(`[Book Sync] Hydration failed for book ${courseId}:`, error);
        if (!isStorageObjectNotFoundError(error) && !isPermissionDeniedError(error)) {
          console.warn(`Book hydration failed (${courseId}):`, error);
        }
        return false;
      } finally {
        if (!hydrationSucceeded && markNodesLoading) {
          patchCourseById(courseId, (course) => {
            let changed = false;
            const nextNodes = course.nodes.map((node) => {
              if (!node.isLoading) return node;
              changed = true;
              return { ...node, isLoading: false };
            });
            if (!changed) return course;
            return { ...course, nodes: nextNodes };
          }, false);
        }
        if (courseHydrationPromiseByKeyRef.current.get(inFlightKey) === hydrationPromise) {
          courseHydrationPromiseByKeyRef.current.delete(inFlightKey);
        }
      }
    })();

    courseHydrationPromiseByKeyRef.current.set(inFlightKey, hydrationPromise);
    return hydrationPromise;
  };

  const openCreditPaywall = (action?: CreditActionType) => {
    if (action) setCreditPaywallIntent(action);
    setCreditPaywallOpen(true);
  };

  const resolveCreditCost = (action: CreditActionType, costOverride?: number): number => {
    if (Number.isFinite(costOverride) && Number(costOverride) > 0) {
      return Math.max(1, Math.floor(Number(costOverride)));
    }
    return DEFAULT_ACTION_CREDIT_COST[action];
  };

  const persistCreditWallet = (uid: string, wallet: CreditWallet) => {
    writeCreditWalletToLocal(uid, wallet);
  };

  const applyCreditWallet = (uid: string, wallet: CreditWallet) => {
    creditWalletRef.current = wallet;
    setCreditWallet(wallet);
    persistCreditWallet(uid, wallet);
  };

  const normalizeCreditGatewayWallet = (value: unknown): CreditWallet | null => {
    return normalizeCreditWallet(value);
  };

  const runCreditGatewayOperation = async (
    localUserId: string,
    payload: CreditGatewayRequest
  ): Promise<{ wallet: CreditWallet | null; receiptId?: string }> => {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const currentUser = auth.currentUser;
        if (currentUser && currentUser.uid === localUserId) {
          await currentUser.getIdToken(attempt > 1);
        }
        await appCheckReady;
        const result = await creditGateway(payload);
        const wallet = normalizeCreditGatewayWallet(result.data?.wallet);
        if (wallet) {
          applyCreditWallet(localUserId, wallet);
        }
        const receiptId = typeof result.data?.receiptId === 'string' ? result.data.receiptId : undefined;
        return { wallet, receiptId };
      } catch (error) {
        if (isPermissionDeniedError(error)) {
          disableCloudSyncForPermission();
          throw error;
        }
        const isRetryable = attempt < maxAttempts && shouldRetryCreditGatewayError(error);
        if (!isRetryable) {
          throw error;
        }
        await new Promise((resolve) => {
          window.setTimeout(resolve, 350 * attempt);
        });
      }
    }
    return { wallet: null };
  };

  const requireCreditForAction = (action: CreditActionType, costOverride?: number): boolean => {
    const cost = resolveCreditCost(action, costOverride);
    const wallet = creditWalletRef.current;
    const amount = wallet.createCredits;
    if (amount >= cost) return true;
    openCreditPaywall(action);
    return false;
  };

  const consumeCreditForAction = async (action: CreditActionType, costOverride?: number): Promise<boolean> => {
    const localUserId = authUser?.uid
      ?? (isGuestSession ? GUEST_LOCAL_UID : (isAuthLoading ? bootstrapAuthUid : null));
    if (!localUserId) {
      openCreditPaywall(action);
      return false;
    }

    const cost = resolveCreditCost(action, costOverride);
    const wallet = creditWalletRef.current;
    const field: keyof CreditWallet = 'createCredits';
    if (wallet[field] < cost) {
      openCreditPaywall(action);
      return false;
    }

    // Create credits are charged server-side inside aiGateway for paid AI operations.
    return true;
  };

  const refundCreditForAction = async (action: CreditActionType, costOverride?: number): Promise<void> => {
    void action;
    void costOverride;
  };

  const waitForPurchasedCredits = async (
    localUserId: string,
    baselineWallet: CreditWallet,
    pack: CreditPackOption
  ): Promise<CreditWallet | null> => {
    const expectedCreateCredits = baselineWallet.createCredits + pack.createCredits;
    const deadline = Date.now() + CREDIT_WEBHOOK_SYNC_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const { wallet } = await runCreditGatewayOperation(localUserId, {
        operation: 'getWallet'
      });
      if (wallet && wallet.createCredits >= expectedCreateCredits) {
        return wallet;
      }
      await new Promise((resolve) => {
        window.setTimeout(resolve, CREDIT_WEBHOOK_SYNC_POLL_MS);
      });
    }

    return null;
  };

  const handleCreditPackPurchase = async (packId: string): Promise<void> => {
    const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : null);
    if (!localUserId) {
      setCreditPaywallOpen(false);
      return;
    }
    const pack = CREDIT_PACKS.find((item) => item.id === packId);
    if (!pack) return;

    setCreditPurchaseBusy(true);
    try {
      if (!isCapacitorNativeRuntime() || !isRevenueCatEnabled()) {
        throw new Error('Kredi satın alma yalnızca mobil uygulama içinde destekleniyor.');
      }

      const baselineWallet = creditWalletRef.current;
      await ensureRevenueCatConfigured({
        appUserId: authUser?.uid ?? null,
        email: authUser?.email ?? null,
        displayName: authUser?.displayName ?? null
      });
      await purchaseRevenueCatCreditPack({
        packId: pack.id as 'pack-5' | 'pack-15' | 'pack-30',
        targetPrice: pack.priceUsd
      });

      const nextWallet = await waitForPurchasedCredits(localUserId, baselineWallet, pack);
      if (!nextWallet) {
        throw new Error('Ödeme alındı fakat kredi yükleme gecikti. Lütfen birkaç saniye sonra tekrar kontrol edin.');
      }
      setCreditPaywallOpen(false);
      setCreditPaywallIntent(null);
    } catch (error) {
      if (isRevenueCatPurchaseCancelledError(error)) {
        return;
      }
      console.warn('Credit purchase sync failed:', error);
    } finally {
      setCreditPurchaseBusy(false);
    }
  };

  const flushPendingCourseCloudWrite = async (): Promise<void> => {
    if (cloudCourseWriteInFlightRef.current) return;
    const pending = pendingCloudCourseWriteRef.current;
    if (!pending || !cloudSyncEnabled) return;

    cloudCourseWriteInFlightRef.current = true;
    pendingCloudCourseWriteRef.current = null;
    let queuedBackoffRetry = false;

    try {
      const cloudPayload = { ...pending.payload };
      let courseForPackage: CourseData = {
        id: pending.courseId,
        topic: resolveCourseTopic(cloudPayload.topic),
        description: typeof cloudPayload.description === 'string' ? cloudPayload.description : undefined,
        creatorName: typeof cloudPayload.creatorName === 'string' ? cloudPayload.creatorName : undefined,
        language: typeof cloudPayload.language === 'string' ? cloudPayload.language : undefined,
        ageGroup: normalizeSmartBookAgeGroup(cloudPayload.ageGroup),
        bookType: typeof cloudPayload.bookType === 'string' ? cloudPayload.bookType : undefined,
        subGenre: typeof cloudPayload.subGenre === 'string' ? cloudPayload.subGenre : undefined,
        creativeBrief: typeof cloudPayload.creativeBrief === 'object' && cloudPayload.creativeBrief !== null
          ? cloudPayload.creativeBrief as CourseData['creativeBrief']
          : undefined,
        targetPageCount: Number.isFinite(cloudPayload.targetPageCount) ? Number(cloudPayload.targetPageCount) : undefined,
        category: typeof cloudPayload.category === 'string' ? cloudPayload.category : undefined,
        searchTags: Array.isArray(cloudPayload.searchTags)
          ? cloudPayload.searchTags.filter((tag): tag is string => typeof tag === 'string')
          : undefined,
        totalDuration: typeof cloudPayload.totalDuration === 'string' ? cloudPayload.totalDuration : undefined,
        coverImageUrl: typeof cloudPayload.coverImageUrl === 'string' ? cloudPayload.coverImageUrl : undefined,
        status: normalizeCourseStatus(cloudPayload.status),
        userId: pending.uid,
        nodes: Array.isArray(cloudPayload.nodes) ? cloudPayload.nodes as TimelineNode[] : [],
        createdAt: cloudPayload.createdAt instanceof Date ? cloudPayload.createdAt : resolveDate(cloudPayload.createdAt),
        lastActivity: cloudPayload.lastActivity instanceof Date ? cloudPayload.lastActivity : resolveDate(cloudPayload.lastActivity)
      };
      let packageMetadata: Partial<Pick<CourseData, 'contentPackagePath' | 'contentPackageUrl' | 'contentPackageUpdatedAt'>> = {
        contentPackagePath: typeof cloudPayload.contentPackagePath === 'string' ? cloudPayload.contentPackagePath : undefined,
        contentPackageUrl: typeof cloudPayload.contentPackageUrl === 'string' ? cloudPayload.contentPackageUrl : undefined,
        contentPackageUpdatedAt: cloudPayload.contentPackageUpdatedAt instanceof Date ? cloudPayload.contentPackageUpdatedAt : undefined
      };

      const shouldUploadBundle = (
        (!packageMetadata.contentPackagePath || !String(packageMetadata.contentPackagePath).trim()) &&
        courseForPackage.nodes.length > 0 &&
        hasPersistableCourseContent(courseForPackage)
      );

      if (shouldUploadBundle) {
        const materializedNodes = await materializeNodesForCloud(
          pending.uid,
          pending.courseId,
          courseForPackage.nodes
        );
        const materializedCoverImageUrl = await materializeCoverForCloud(
          pending.uid,
          pending.courseId,
          courseForPackage.coverImageUrl
        );
        const packageSourceCourse: CourseData = {
          ...courseForPackage,
          nodes: materializedNodes,
          coverImageUrl: materializedCoverImageUrl
        };
        packageMetadata = await uploadCoursePackageToStorage(pending.uid, pending.courseId, packageSourceCourse);
        courseForPackage = packageSourceCourse;
      }

      const cloudCourse = {
        ...courseForPackage,
        ...packageMetadata,
        status: normalizeCourseStatus(courseForPackage.status) || (packageMetadata.contentPackagePath ? 'ready' : 'processing'),
        bundle: packageMetadata.contentPackagePath
          ? {
            path: packageMetadata.contentPackagePath,
            version: extractBundleVersionFromPath(packageMetadata.contentPackagePath),
            includesPodcast: courseForPackage.nodes.some((node) => Boolean(node.podcastAudioUrl?.trim())),
            generatedAt: packageMetadata.contentPackageUpdatedAt || new Date()
          }
          : courseForPackage.bundle
      };
      coursePackageByIdRef.current.set(pending.courseId, cloudCourse);
      applyCloudHydratedCourseLocally(pending.uid, cloudCourse);

      const bookDocPayload = buildBookDocumentPayload(pending.uid, pending.courseId, cloudCourse);
      const safeBookDocPayload = stripUndefinedDeepForFirestore(bookDocPayload);
      await setDoc(
        doc(db, 'users', pending.uid, 'books', pending.courseId),
        safeBookDocPayload,
        { merge: true }
      );
      courseCloudWriteRetryCountRef.current = 0;
    } catch (error) {
      const isPermissionError = isPermissionDeniedError(error);
      const shouldRetryCloudWrite = !isPermissionError && courseCloudWriteRetryCountRef.current < 7;
      if (shouldRetryCloudWrite) {
        pendingCloudCourseWriteRef.current = pending;
        courseCloudWriteRetryCountRef.current += 1;
        clearPackageSyncAttemptForCourse(pending.courseId);
        const delayMs = Math.min(
          20_000,
          COURSE_CLOUD_SYNC_DEBOUNCE_MS * (2 ** Math.min(5, courseCloudWriteRetryCountRef.current))
        );
        queueCloudFlush(delayMs);
        queuedBackoffRetry = true;
      } else if (isPermissionError) {
        console.error('Error writing private book package to Firebase:', error);
      } else {
        courseCloudWriteRetryCountRef.current = 0;
        console.error('Error updating private book metadata in Firebase:', error);
      }
    } finally {
      cloudCourseWriteInFlightRef.current = false;
      if (pendingCloudCourseWriteRef.current && cloudSyncEnabled && !queuedBackoffRetry) {
        queueCloudFlush();
      }
    }
  };

  const scheduleCourseCloudWrite = (
    uid: string,
    courseId: string,
    payload: Record<string, unknown>,
    options?: { allowMasterWrite?: boolean }
  ) => {
    if (!cloudSyncEnabled) return;
    const currentCourse = savedCoursesRef.current.find((course) => course.id === courseId);
    const mergedPayload = currentCourse
      ? { ...currentCourse, ...payload }
      : payload;

    pendingCloudCourseWriteRef.current = {
      uid,
      courseId,
      payload: mergedPayload,
      allowMasterWrite: options?.allowMasterWrite ?? true
    };

    queueCloudFlush();
  };

  const queueCloudFlush = (delayMs: number = COURSE_CLOUD_SYNC_DEBOUNCE_MS) => {
    if (cloudCourseWriteTimerRef.current !== null) {
      window.clearTimeout(cloudCourseWriteTimerRef.current);
    }
    cloudCourseWriteTimerRef.current = window.setTimeout(() => {
      cloudCourseWriteTimerRef.current = null;
      const runFlush = () => {
        void flushPendingCourseCloudWrite();
      };
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void })
          .requestIdleCallback(runFlush, { timeout: 350 });
      } else {
        runFlush();
      }
    }, Math.max(COURSE_CLOUD_SYNC_DEBOUNCE_MS, delayMs));
  };

  useEffect(() => {
    return () => {
      if (cloudCourseWriteTimerRef.current !== null) {
        window.clearTimeout(cloudCourseWriteTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : null);
    if (!localUserId) return;

    const flushPendingLocalCourseCache = () => {
      const pendingCourses = pendingLocalCourseWrites.get(localUserId);
      if (pendingCourses && pendingCourses.length > 0) {
        flushCoursesToLocalNow(localUserId, pendingCourses);
        return;
      }
      if (savedCoursesRef.current.length > 0) {
        flushCoursesToLocalNow(localUserId, savedCoursesRef.current);
      }
    };

    const flushPendingCloudCourseCache = () => {
      if (!authUser || !cloudSyncEnabled) return;
      if (!pendingCloudCourseWriteRef.current) return;
      void flushPendingCourseCloudWrite();
    };

    const handlePageHide = () => {
      flushPendingLocalCourseCache();
      flushPendingCloudCourseCache();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingLocalCourseCache();
        flushPendingCloudCourseCache();
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      flushPendingLocalCourseCache();
      flushPendingCloudCourseCache();
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authUser, bootstrapAuthUid, cloudSyncEnabled, isAuthLoading, isGuestSession]);

  useEffect(() => {
    savedCoursesRef.current = savedCourses;
  }, [authUser?.uid, savedCourses]);

  useEffect(() => {
    courseOpenStateByIdRef.current = courseOpenStateById;
  }, [courseOpenStateById]);

  useEffect(() => {
    setCourseOpenStateById((prev) => {
      let changed = false;
      const next: Record<string, CourseOpenUiState> = {};

      for (const course of savedCourses) {
        const previous = prev[course.id];
        const isReady = !courseNeedsContentHydration(course);

        if (isReady) {
          if (previous?.status === 'ready' && previous.progress === 100) {
            next[course.id] = previous;
          } else {
            next[course.id] = { status: 'ready', progress: 100, updatedAt: Date.now() };
            changed = true;
          }
          continue;
        }

        // Preserve any explicitly-set state (downloading / ready / failed).
        // Only reset to idle if there was no previous state at all.
        // This prevents the effect from overriding a "ready" state set by
        // ensureCourseReadyForOpen after successful backend hydration.
        if (previous) {
          next[course.id] = previous;
        } else {
          next[course.id] = { status: 'idle', progress: 0, updatedAt: Date.now() };
          changed = true;
        }
      }

      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (!changed && prevKeys.length !== nextKeys.length) {
        changed = true;
      }
      if (!changed) {
        for (const key of nextKeys) {
          if (prev[key] !== next[key]) {
            changed = true;
            break;
          }
        }
      }

      return changed ? next : prev;
    });
  }, [savedCourses]);

  useEffect(() => {
    if (!authUser?.uid) return;
    if (!savedCourses.length) return;

    const localUserId = authUser.uid;
    const repairTargets = savedCourses.flatMap((course) => {
      const hasStorageBackedCover = typeof course.coverImageUrl === 'string' && (
        isFirebaseStorageDownloadUrl(course.coverImageUrl) ||
        course.coverImageUrl.trim().startsWith('smartbooks/')
      );
      const needsCoverFromPackage = !course.coverImageUrl && Boolean(course.contentPackagePath);
      const needsLegacyCoverLookup = !course.coverImageUrl;
      if (!hasStorageBackedCover && !needsCoverFromPackage && !needsLegacyCoverLookup) return [];

      const repairKey = `${course.id}:${course.coverImageUrl || ''}:${course.contentPackagePath || ''}`;
      if (!markRetriableAttemptWithCooldown(
        coverRepairAttemptedByCourseRef.current,
        repairKey,
        SMARTBOOK_COVER_REPAIR_RETRY_COOLDOWN_MS
      )) {
        return [];
      }

      return [{ course, repairKey }];
    });

    if (repairTargets.length === 0) return;

    let isCancelled = false;

    const repairCourseCovers = async () => {
      const resolvedCovers = await Promise.all(
        repairTargets.map(async ({ course, repairKey }) => ({
          courseId: course.id,
          repairKey,
          coverImageUrl: await resolveFreshCoverUrlForCourse(course)
        }))
      );

      if (isCancelled) return;

      const repairedById = new Map(
        resolvedCovers
          .filter((entry) => typeof entry.coverImageUrl === 'string' && entry.coverImageUrl.trim())
          .map((entry) => {
            const repairedCover = entry.coverImageUrl!.trim();
            coverRepairAttemptedByCourseRef.current.delete(entry.repairKey);
            return [entry.courseId, repairedCover] as const;
          })
      );
      if (repairedById.size === 0) return;

      setSavedCourses((prev) => {
        let changed = false;
        const nextCourses = prev.map((course) => {
          const repairedCoverImageUrl = repairedById.get(course.id);
          if (!repairedCoverImageUrl || repairedCoverImageUrl === course.coverImageUrl) return course;
          changed = true;

          const cachedCourse = coursePackageByIdRef.current.get(course.id);
          if (cachedCourse) {
            coursePackageByIdRef.current.set(course.id, {
              ...cachedCourse,
              coverImageUrl: repairedCoverImageUrl
            });
          }

          return {
            ...course,
            coverImageUrl: repairedCoverImageUrl
          };
        });

        if (!changed) return prev;
        writeCoursesToLocal(localUserId, nextCourses);
        return nextCourses;
      });
    };

    void repairCourseCovers();

    return () => {
      isCancelled = true;
    };
  }, [authUser?.uid, savedCourses]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      const routedView = viewFromPathname(window.location.pathname);
      if (routedView) {
        setCurrentView(routedView);
        return;
      }
      setCurrentView((prev) => (prev === 'PRIVACY' || prev === 'TERMS' ? 'HOME' : prev));
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentPath = normalizeAppPathname(window.location.pathname);
    const targetPath = pathnameForView(currentView);

    if (targetPath) {
      if (currentPath === targetPath) return;
      window.history.pushState({}, document.title, `${targetPath}${window.location.search}${window.location.hash}`);
      return;
    }

    if (viewFromPathname(currentPath)) {
      window.history.pushState({}, document.title, `/${window.location.search}${window.location.hash}`);
    }
  }, [currentView]);

  useEffect(() => {
    if (!authUser?.uid) return;
    const fullCourses = savedCourses.filter((course) => hasPersistableCourseContent(course));
    if (fullCourses.length === 0) return;

    let cancelled = false;
    void runTasksWithConcurrency(fullCourses, 2, async (course) => {
      if (cancelled) return;
      await writeFullCourseToNativeCache(authUser.uid, course);
    });

    return () => {
      cancelled = true;
    };
  }, [authUser?.uid, savedCourses]);

  useEffect(() => {
    creditWalletRef.current = creditWallet;
  }, [creditWallet]);

  const clearGuestSession = () => {
    setGuestSession(false);
    writeGuestSessionToLocal(false);
  };

  const handleContinueWithoutLogin = () => {
    setGuestSession(true);
    setOnboardingVisible(false);
    setCurrentView('HOME');
  };

  const handleOnboardingFinish = () => {
    setOnboardingVisible(false);
  };

  const handleOpenLoginScreen = () => {
    clearGuestSession();
    setOnboardingVisible(false);
    setCurrentView('HOME');
    setSettingsOpen(false);
  };

  const handleToggleSettings = () => {
    setSettingsOpen((prev) => !prev);
  };

  const handleContactSupport = () => {
    const subject = encodeURIComponent('Fortale Destek');
    const mailtoUrl = `mailto:admin@futurumapps.online?subject=${subject}`;
    window.location.href = mailtoUrl;
  };

  useEffect(() => {
    let didResolveInitialAuthState = false;
    const authBootstrapTimeout = window.setTimeout(() => {
      if (didResolveInitialAuthState) return;
      console.warn('Firebase auth initial state timed out; continuing without blocking the UI.');
      setAuthLoading(false);
    }, 4000);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      didResolveInitialAuthState = true;
      window.clearTimeout(authBootstrapTimeout);
      setAuthUser(user);
      const nextUid = typeof user?.uid === 'string' ? user.uid : null;
      setBootstrapAuthUid(nextUid);
      writeLastAuthenticatedUidToLocal(nextUid);
      setProfileNameOverride(null);
      if (user) {
        clearGuestSession();
      }
      setAuthLoading(false);
    });

    return () => {
      didResolveInitialAuthState = true;
      window.clearTimeout(authBootstrapTimeout);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LOCAL_APP_LANGUAGE_KEY, appLanguage);
    window.localStorage.setItem(LOCAL_APP_LANGUAGE_SOURCE_KEY, appLanguageSource);
    document.documentElement.lang = appLanguage;
  }, [appLanguage, appLanguageSource]);

  useEffect(() => {
    if (!authUser || isGuestSession) {
      appLanguageBootstrapWriteRef.current = null;
      setLegalConsentState('accepted');
      setLegalConsentError(null);
      setIsLegalConsentSaving(false);
      return;
    }

    let cancelled = false;
    const loadLegalConsent = async () => {
      setLegalConsentState('unknown');
      setLegalConsentError(null);
      try {
        const snapshot = await getDoc(doc(db, 'users', authUser.uid));
        const data = snapshot.data() as Record<string, unknown> | undefined;
        const storedAppLanguage = normalizeAppLanguageCode(data?.appLanguage);
        const storedAppLanguageSource = normalizeAppLanguageSource(data?.appLanguageSource);
        const localAppLanguage = normalizeAppLanguageCode(window.localStorage.getItem(LOCAL_APP_LANGUAGE_KEY));
        const localAppLanguageSource = normalizeAppLanguageSource(window.localStorage.getItem(LOCAL_APP_LANGUAGE_SOURCE_KEY));
        const deviceAppLanguage = detectDeviceAppLanguage();
        const shouldRequireManualSelection = !storedAppLanguage && !localAppLanguage && !deviceAppLanguage;
        const resolvedAppLanguage = storedAppLanguage || localAppLanguage || deviceAppLanguage || DEFAULT_APP_LANGUAGE;
        const resolvedAppLanguageSource = storedAppLanguage
          ? (storedAppLanguageSource || 'manual_selection')
          : (localAppLanguage
            ? (localAppLanguageSource || 'manual_selection')
            : (deviceAppLanguage ? 'device_auto' : 'manual_selection'));
        const acceptedVersion = String(data?.legalConsentVersion || '').trim();
        const acceptedAt = data?.legalConsentAcceptedAt;
        const hasAcceptedCurrentVersion = acceptedVersion === LEGAL_CONSENT_VERSION && Boolean(acceptedAt);
        if (!cancelled) {
          setAppLanguage(resolvedAppLanguage);
          setAppLanguageSource(resolvedAppLanguageSource);
          setAppLanguageSetupOpen(shouldRequireManualSelection);
          setLegalConsentState(hasAcceptedCurrentVersion ? 'accepted' : 'required');
        }

        if (!storedAppLanguage && !shouldRequireManualSelection) {
          const syncKey = `${authUser.uid}:${resolvedAppLanguage}:${resolvedAppLanguageSource}`;
          if (appLanguageBootstrapWriteRef.current !== syncKey) {
            appLanguageBootstrapWriteRef.current = syncKey;
            try {
              await persistAppLanguagePreference(authUser.uid, resolvedAppLanguage, resolvedAppLanguageSource);
            } catch (error) {
              console.error('Initial app language save failed:', error);
            }
          }
        }
      } catch (error) {
        console.error('Legal consent state could not be loaded:', error);
        if (!cancelled) {
          setLegalConsentState('required');
          setLegalConsentError('Onay durumu yüklenemedi. Lütfen şartları onaylayarak devam edin.');
        }
      }
    };

    void loadLegalConsent();
    return () => {
      cancelled = true;
    };
  }, [authUser?.uid, isGuestSession]);

  useEffect(() => {
    if (legalConsentState !== 'required') return;
    setSettingsOpen(false);
    if (currentView !== 'HOME') {
      setCurrentView('HOME');
    }
  }, [currentView, legalConsentState]);

  useEffect(() => {
    if (!isAppLanguageSetupOpen) return;
    setSettingsOpen(false);
  }, [isAppLanguageSetupOpen]);

  useEffect(() => {
    const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : null);
    if (!localUserId) {
      creditWalletRef.current = FREE_STARTER_CREDITS;
      setCreditWallet(FREE_STARTER_CREDITS);
      return;
    }

    const localWallet = readCreditWalletFromLocal(localUserId);
    const seededWallet = localWallet || FREE_STARTER_CREDITS;
    creditWalletRef.current = seededWallet;
    setCreditWallet(seededWallet);
    if (!localWallet) {
      writeCreditWalletToLocal(localUserId, seededWallet);
    }

    if (!authUser || !cloudSyncEnabled) return;

    let cancelled = false;
    const syncWallet = async () => {
      try {
        const { wallet: remoteWallet } = await runCreditGatewayOperation(localUserId, {
          operation: 'getWallet'
        });
        if (cancelled) return;
        if (remoteWallet) {
          applyCreditWallet(localUserId, remoteWallet);
        }
      } catch (error) {
        if (isPermissionDeniedError(error)) {
          disableCloudSyncForPermission();
        } else {
          console.warn('Credit wallet bootstrap skipped (will retry):', error);
          if (shouldRetryCreditGatewayError(error)) {
            window.setTimeout(() => {
              if (cancelled) return;
              void syncWallet();
            }, 4_000);
          }
        }
      }
    };

    void syncWallet();
    return () => {
      cancelled = true;
    };
  }, [authUser?.uid, cloudSyncEnabled, isGuestSession]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : null);
    if (!localUserId) return;

    const handleCreditWalletUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<unknown>;
      const wallet = normalizeCreditWallet(customEvent.detail);
      if (!wallet) return;
      applyCreditWallet(localUserId, wallet);
    };

    window.addEventListener(CREDIT_WALLET_UPDATED_EVENT, handleCreditWalletUpdated as EventListener);
    return () => {
      window.removeEventListener(CREDIT_WALLET_UPDATED_EVENT, handleCreditWalletUpdated as EventListener);
    };
  }, [authUser?.uid, isGuestSession]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : null);
    if (!localUserId) return;

    const handleCreditExhausted = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: unknown }>).detail;
      void detail;
      setCreditPaywallIntent('create');
      setCreditPaywallOpen(true);
      void runCreditGatewayOperation(localUserId, { operation: 'getWallet' }).catch(() => {
        // Ignore wallet refresh failures while opening paywall.
      });
    };

    window.addEventListener(CREDIT_EXHAUSTED_EVENT, handleCreditExhausted as EventListener);
    return () => {
      window.removeEventListener(CREDIT_EXHAUSTED_EVENT, handleCreditExhausted as EventListener);
    };
  }, [authUser?.uid, isGuestSession]);

  useEffect(() => {
    const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : null);

    if (!localUserId) {
      progressOnlyFallbackCourseIdsRef.current.clear();
      setSavedCourses([]);
      setStickyNotes([]);
      setLikedCourseIds([]);
      setActiveCourseId(null);
      setLoadingMessage('Kitaplar yükleniyor...');
      setIsLoading(false);
      setHasCompletedLocalBootstrap(true);
      return;
    }

    const fetchCourses = async () => {
      setLoadingMessage('Kitaplar yükleniyor...');
      setIsLoading(true);
      setHasCompletedLocalBootstrap(false);
      const mergeNativeFullCoursesIntoState = async (courseIds: string[]) => {
        if (courseIds.length === 0) return;
        try {
          const nativeFullCourseCache = await readFullCoursesFromNativeCache(localUserId, courseIds);
          if (nativeFullCourseCache.size === 0) return;

          setSavedCourses((prev) => {
            let changed = false;
            const nextCourses = sortCoursesByLastActivity(
              prev.map((course) => {
                const fullCachedCourse = nativeFullCourseCache.get(course.id);
                if (!fullCachedCourse) return course;
                if (!courseNeedsContentHydration(course)) return course;

                changed = true;
                const mergedCourse = mergeSharedCourseWithUserProgress(
                  fullCachedCourse,
                  toProgressDocFromCourseSnapshot(course)
                );
                coursePackageByIdRef.current.set(course.id, mergedCourse);
                return mergedCourse;
              })
            );

            if (!changed) return prev;
            writeCoursesToLocal(localUserId, nextCourses);
            writeFullCoursesToLocal(localUserId, nextCourses);
            return nextCourses;
          });
        } catch {
          // Ignore native cache read failures during bootstrap.
        }
      };
      const stickyNotesBootstrapPromise = (async () => {
        if (!authUser || !cloudSyncEnabled) return;

        const userStickyCollection = collection(db, 'users', authUser.uid, 'stickyNotes');
        let stickySnapshot;
        try {
          stickySnapshot = await getDocs(query(userStickyCollection, orderBy('lastActivity', 'desc')));
        } catch {
          stickySnapshot = await getDocs(userStickyCollection);
        }

        const fetchedStickyNotes: StickyNoteData[] = [];
        stickySnapshot.forEach((stickyDoc) => {
          const data = stickyDoc.data();
          const text = String(data.text ?? data.stickyText ?? '').trim();
          fetchedStickyNotes.push({
            id: stickyDoc.id,
            title: buildStickyTitle(String(data.title || ''), text),
            text,
            noteType: 'sticky',
            reminderAt: resolveOptionalIsoDate(data.reminderAt ?? data.stickyReminderAt),
            createdAt: resolveDate(data.createdAt),
            lastActivity: resolveDate(data.lastActivity ?? data.updatedAt ?? data.createdAt)
          });
        });

        const sortedStickyNotes = sortStickyNotesByLastActivity(fetchedStickyNotes);
        if (sortedStickyNotes.length > 0) {
          setStickyNotes(sortedStickyNotes);
          writeStickyNotesToLocal(localUserId, sortedStickyNotes);
        } else if (localStickyNotes.length === 0) {
          setStickyNotes([]);
        }
      })().catch((error) => {
        console.warn('Sticky notes bootstrap skipped:', error);
      });

      const localCourses = readCoursesFromLocal(localUserId);
      const localStickyNotes = readStickyNotesFromLocal(localUserId);
      const localLikedCourseIds = readLikedCourseIdsFromLocal(localUserId);
      const progressOnlyFallbackCourseIds = new Set<string>();
      setSavedCourses(localCourses);
      savedCoursesRef.current = localCourses;
      setStickyNotes(localStickyNotes);
      setLikedCourseIds(localLikedCourseIds);
      setActiveCourseId((prev) => {
        if (localCourses.length === 0) return null;
        if (prev && localCourses.some((course) => course.id === prev)) return prev;
        return localCourses[0].id;
      });
      setHasCompletedLocalBootstrap(true);
      if (localCourses.length > 0) {
        setIsLoading(false);
        void mergeNativeFullCoursesIntoState(localCourses.map((course) => course.id));
      } else {
        setLoadingMessage('Kitaplar senkronize ediliyor...');
      }

      if (!authUser || !cloudSyncEnabled) {
        progressOnlyFallbackCourseIdsRef.current.clear();
        setIsLoading(false);
        void stickyNotesBootstrapPromise;
        return;
      }

      try {
        await authUser.getIdToken();
      } catch {
        // Existing auth state is enough for callable/bootstrap attempts.
      }

      let backendBootstrapCourses: CourseData[] = [];
      let didLoadBackendBootstrap = false;
      try {
        setLoadingMessage('Kitaplar senkronize ediliyor...');
        backendBootstrapCourses = await fetchCourseListFromBackend();
        didLoadBackendBootstrap = true;
      } catch (backendBootstrapError) {
        console.warn('Server-side book bootstrap skipped:', backendBootstrapError);
      }

      try {
        const byId = new Map<string, CourseData>();

        if (didLoadBackendBootstrap) {
          backendBootstrapCourses.forEach((course) => {
            byId.set(course.id, course);
            if (courseNeedsContentHydration(course)) {
              progressOnlyFallbackCourseIds.add(course.id);
            }
          });
        }

        localCourses.forEach((localCourse) => {
          const existing = byId.get(localCourse.id);
          if (!existing) {
            byId.set(localCourse.id, localCourse);
            return;
          }

          if (isCourseProgressOnly(existing) && !isCourseProgressOnly(localCourse)) {
            byId.set(localCourse.id, mergeSharedCourseWithUserProgress(
              localCourse,
              toProgressDocFromCourseSnapshot(existing)
            ));
            return;
          }

          if (localCourse.lastActivity > existing.lastActivity && !isCourseProgressOnly(localCourse)) {
            byId.set(localCourse.id, localCourse);
          }
        });

        savedCoursesRef.current
          .filter((course) => sessionCreatedCourseIdsRef.current.has(course.id))
          .forEach((memoryCourse) => {
            const existing = byId.get(memoryCourse.id);
            if (!existing) {
              byId.set(memoryCourse.id, memoryCourse);
              return;
            }

            if (isCourseProgressOnly(existing) && !isCourseProgressOnly(memoryCourse)) {
              byId.set(memoryCourse.id, mergeSharedCourseWithUserProgress(
                memoryCourse,
                toProgressDocFromCourseSnapshot(existing)
              ));
              return;
            }

            if (memoryCourse.lastActivity > existing.lastActivity && !isCourseProgressOnly(memoryCourse)) {
              byId.set(memoryCourse.id, memoryCourse);
            }
          });

        progressOnlyFallbackCourseIdsRef.current = new Set(
          Array.from(progressOnlyFallbackCourseIds).filter((courseId) => {
            const snapshot = byId.get(courseId);
            return Boolean(snapshot && courseNeedsContentHydration(snapshot));
          })
        );

        const courses = Array.from(byId.values());
        const sortedCourses = sortCoursesByLastActivity(courses);
        if (sortedCourses.length > 0) {
          setSavedCourses(sortedCourses);
          savedCoursesRef.current = sortedCourses;
          setActiveCourseId((prev) =>
            prev && sortedCourses.some((course) => course.id === prev)
              ? prev
              : sortedCourses[0].id
          );
          writeCoursesToLocal(localUserId, sortedCourses);
          writeFullCoursesToLocal(localUserId, sortedCourses);
          void runTasksWithConcurrency(
            sortedCourses.filter((course) => hasPersistableCourseContent(course)),
            2,
            async (course) => {
              await writeFullCourseToNativeCache(localUserId, course);
            }
          );
          setIsLoading(false);
          void mergeNativeFullCoursesIntoState(sortedCourses.map((course) => course.id));
        } else if (localCourses.length === 0) {
          setSavedCourses([]);
          savedCoursesRef.current = [];
          setActiveCourseId(null);
        }
        await stickyNotesBootstrapPromise;
      } catch (error) {
        progressOnlyFallbackCourseIdsRef.current.clear();
        if (isPermissionDeniedError(error)) {
          console.error('Error fetching private book documents from Firebase:', error);
        } else {
          console.error("Error fetching books from Firebase:", error);
        }
        await stickyNotesBootstrapPromise;
      } finally {
        setLoadingMessage('Kitaplar yükleniyor...');
        setHasCompletedLocalBootstrap(true);
        setIsLoading(false);
      }
    };

    fetchCourses();
  }, [authUser, cloudSyncEnabled, isGuestSession]);

  useEffect(() => {
    if (!authUser?.uid || !cloudSyncEnabled) return;

    const uid = authUser.uid;
    const userBooksCollection = collection(db, 'users', uid, 'books');
    let unsubscribe: (() => void) | null = null;
    let fallbackAttached = false;

    const applyBooksSnapshot = (snapshot: { docs: Array<{ id: string; data: () => unknown }> }) => {
      const cloudBooks = snapshot.docs
        .map((bookDoc) => fromUserBookDocument(
          bookDoc.id,
          (bookDoc.data() as Record<string, unknown>) || {},
          uid
        ))
        .filter((course): course is CourseData => course !== null);

      setSavedCourses((prev) => {
        const byId = new Map<string, CourseData>();

        for (const cloudBook of cloudBooks) {
          const localBook = prev.find((course) => course.id === cloudBook.id) || savedCoursesRef.current.find((course) => course.id === cloudBook.id);
          if (!localBook) {
            byId.set(cloudBook.id, cloudBook);
            continue;
          }

          const mergedBook: CourseData = {
            ...localBook,
            ...cloudBook,
            topic: resolveCourseTopic(cloudBook.topic, localBook.topic),
            description: cloudBook.description || localBook.description,
            creatorName: cloudBook.creatorName || localBook.creatorName,
            language: cloudBook.language || localBook.language,
            ageGroup: cloudBook.ageGroup || localBook.ageGroup,
            bookType: cloudBook.bookType || localBook.bookType,
            subGenre: cloudBook.subGenre || localBook.subGenre,
            category: cloudBook.category || localBook.category,
            searchTags: cloudBook.searchTags || localBook.searchTags,
            totalDuration: cloudBook.totalDuration || localBook.totalDuration,
            coverImageUrl: cloudBook.coverImageUrl || localBook.coverImageUrl,
            contentPackagePath: cloudBook.contentPackagePath || localBook.contentPackagePath,
            contentPackageUrl: cloudBook.contentPackageUrl || localBook.contentPackageUrl,
            contentPackageUpdatedAt: cloudBook.contentPackageUpdatedAt || localBook.contentPackageUpdatedAt,
            bundle: cloudBook.bundle || localBook.bundle,
            cover: cloudBook.cover || localBook.cover,
            status: normalizeCourseStatus(cloudBook.status) || normalizeCourseStatus(localBook.status),
            nodes: localBook.nodes.length > 0 ? localBook.nodes : cloudBook.nodes
          };
          byId.set(cloudBook.id, mergedBook);
        }

        for (const localBook of prev) {
          if (!byId.has(localBook.id) && sessionCreatedCourseIdsRef.current.has(localBook.id)) {
            byId.set(localBook.id, localBook);
          }
        }

        const nextCourses = sortCoursesByLastActivity(Array.from(byId.values()));
        savedCoursesRef.current = nextCourses;
        writeCoursesToLocal(uid, nextCourses);
        writeFullCoursesToLocal(uid, nextCourses);
        return nextCourses;
      });
    };

    const attachFallbackListener = () => {
      if (fallbackAttached) return;
      fallbackAttached = true;
      if (unsubscribe) unsubscribe();
      unsubscribe = onSnapshot(
        userBooksCollection,
        (snapshot) => applyBooksSnapshot(snapshot as unknown as { docs: Array<{ id: string; data: () => unknown }> }),
        (error) => {
          console.warn('Book metadata realtime sync error:', error);
        }
      );
    };

    unsubscribe = onSnapshot(
      query(userBooksCollection, orderBy('lastActivity', 'desc')),
      (snapshot) => applyBooksSnapshot(snapshot as unknown as { docs: Array<{ id: string; data: () => unknown }> }),
      () => {
        attachFallbackListener();
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [authUser?.uid, cloudSyncEnabled]);

  useEffect(() => {
    if (!incomingSharedSmartBookId) return;
    if (currentView !== 'EXPLORE' && currentView !== 'COURSE_FLOW') {
      setCurrentView('EXPLORE');
    }
  }, [incomingSharedSmartBookId, currentView]);

  useEffect(() => {
    if (currentView !== 'COURSE_FLOW' && isReaderFullscreen) {
      setIsReaderFullscreen(false);
    }
  }, [currentView, isReaderFullscreen]);

  useEffect(() => {
    const sharedBookId = incomingSharedSmartBookId;
    if (!sharedBookId) return;
    if (typeof window === 'undefined') return;
    if (isCapacitorNativeRuntime()) return;

    const platform = detectClientPlatform();
    if (platform === 'desktop') return;

    const storeFallbackUrl = getStoreFallbackUrlForPlatform(platform);
    if (!storeFallbackUrl) return;

    const attemptKey = `${platform}:${sharedBookId}`;
    if (shareLinkRedirectAttemptedRef.current.has(attemptKey)) return;
    shareLinkRedirectAttemptedRef.current.add(attemptKey);

    let hidden = document.visibilityState === 'hidden';
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') hidden = true;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    let secondaryTimer: number | null = null;
    const storeTimer = window.setTimeout(() => {
      if (hidden) return;
      window.location.href = storeFallbackUrl;
    }, SHARE_DEEP_LINK_FALLBACK_MS);

    try {
      window.location.href = buildSmartBookDeepLink(sharedBookId, APP_DEEP_LINK_SCHEMES[0]);
      if (APP_DEEP_LINK_SCHEMES.length > 1) {
        secondaryTimer = window.setTimeout(() => {
          if (hidden) return;
          try {
            window.location.href = buildSmartBookDeepLink(sharedBookId, APP_DEEP_LINK_SCHEMES[1]);
          } catch {
            // ignore
          }
        }, SHARE_DEEP_LINK_SECONDARY_SCHEME_DELAY_MS);
      }
    } catch {
      // ignore and let store fallback trigger
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearTimeout(storeTimer);
      if (secondaryTimer !== null) window.clearTimeout(secondaryTimer);
    };
  }, [incomingSharedSmartBookId]);

  useEffect(() => {
    if (savedCourses.length === 0) {
      setActiveCourseId(null);
      return;
    }

    setActiveCourseId((prev) => {
      if (prev && savedCourses.some((course) => course.id === prev)) {
        return prev;
      }
      return savedCourses[0].id;
    });
  }, [savedCourses]);

  const activeCourse = savedCourses.find(c => c.id === activeCourseId) || savedCourses[0] || null;
  const allowOpenAutoGenerationForActiveCourse = Boolean(
    activeCourse && sessionCreatedCourseIdsRef.current.has(activeCourse.id)
  );

  useEffect(() => {
    backgroundGenerationSuppressedRef.current = false;
  }, [currentView]);

  useEffect(() => {
    if (!activeCourseId || !allowOpenAutoGenerationForActiveCourse) return;

    let retryTimer: number | null = null;
    const resumeBackgroundPackaging = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      startBackgroundSmartBookPackaging(activeCourseId);
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
      retryTimer = window.setTimeout(() => {
        startBackgroundSmartBookPackaging(activeCourseId);
        retryTimer = null;
      }, 1200);
    };

    resumeBackgroundPackaging();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resumeBackgroundPackaging();
      }
    };

    window.addEventListener('focus', resumeBackgroundPackaging);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', resumeBackgroundPackaging);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [activeCourseId, allowOpenAutoGenerationForActiveCourse]);

  useEffect(() => {
    if (savedCourses.length === 0) return;
    if (backgroundGenerationSuppressedRef.current) return;

    const pendingSessionCourses = sortCoursesByLastActivity(
      savedCourses.filter((course) => (
        sessionCreatedCourseIdsRef.current.has(course.id) &&
        courseNeedsContentHydration(course)
      ))
    );
    if (pendingSessionCourses.length === 0) return;

    let cancelled = false;

    const warmSessionCreatedCourses = async () => {
      for (const course of pendingSessionCourses) {
        if (cancelled || backgroundGenerationSuppressedRef.current) return;
        startBackgroundSmartBookPackaging(course.id);
        await waitMs(40);
      }
    };

    void warmSessionCreatedCourses();

    return () => {
      cancelled = true;
    };
  }, [savedCourses]);

  // Eager background hydration: after bootstrap, silently download content for all courses
  // so that book cards transition to green "Oku" without requiring user taps.
  const eagerHydrationAttemptedRef = useRef(false);
  useEffect(() => {
    if (!hasCompletedLocalBootstrap) return;
    if (eagerHydrationAttemptedRef.current) return;
    if (savedCourses.length === 0) return;

    eagerHydrationAttemptedRef.current = true;

    const coursesNeedingHydration = savedCourses.filter((course) => {
      const openState = courseOpenStateByIdRef.current[course.id];
      return (
        courseNeedsContentHydration(course) &&
        (!openState || openState.status === 'idle') &&
        !courseOpenInFlightByIdRef.current.has(course.id)
      );
    });

    if (coursesNeedingHydration.length === 0) return;

    void runTasksWithConcurrency(coursesNeedingHydration.slice(0, 6), 3, async (course) => {
      try {
        await ensureCourseReadyForOpen(course.id, course);
      } catch {
        // Best-effort background hydration; failures are silently ignored.
      }
    });
  }, [hasCompletedLocalBootstrap, savedCourses]);

  const userName = profileNameOverride?.trim()
    || authUser?.displayName?.trim()
    || authUser?.email?.split('@')[0]
    || (isGuestSession ? 'Misafir' : 'Kullanıcı');

  useEffect(() => {
    if (!authUser || !cloudSyncEnabled || !activeCourse) return;

    const hasUnpackagedCover =
      typeof activeCourse.coverImageUrl === 'string' &&
      DATA_IMAGE_URL_PREFIX_RE.test(activeCourse.coverImageUrl);

    let hasUnpackagedNodeAssets = false;
    for (const node of activeCourse.nodes || []) {
      if (typeof node.content === 'string' && node.content.includes('data:image/')) {
        hasUnpackagedNodeAssets = true;
        break;
      }
      if (
        typeof node.podcastAudioUrl === 'string' &&
        /^https?:\/\//i.test(node.podcastAudioUrl) &&
        !isSmartBookStorageUrl(node.podcastAudioUrl) &&
        !isFirebaseStorageDownloadUrl(node.podcastAudioUrl)
      ) {
        hasUnpackagedNodeAssets = true;
        break;
      }
    }

    if (!hasUnpackagedCover && !hasUnpackagedNodeAssets) return;

    const packageSyncKey = `${activeCourse.id}:${hasUnpackagedCover ? 'c1' : 'c0'}:${hasUnpackagedNodeAssets ? 'n1' : 'n0'}`;
    if (packageSyncAttemptedByCourseRef.current.has(packageSyncKey)) return;
    packageSyncAttemptedByCourseRef.current.add(packageSyncKey);

    scheduleCourseCloudWrite(authUser.uid, activeCourse.id, {
      coverImageUrl: activeCourse.coverImageUrl,
      nodes: activeCourse.nodes,
      lastActivity: activeCourse.lastActivity
    }, {
      allowMasterWrite: !activeCourse.userId || activeCourse.userId === authUser.uid
    });
  }, [activeCourse, authUser, cloudSyncEnabled]);

  useEffect(() => {
    if (!authUser || !cloudSyncEnabled || !activeCourse) return;
    if (!hasPersistableCourseContent(activeCourse)) return;

    const contentSyncKey = `${activeCourse.id}:content-backfill`;
    if (packageSyncAttemptedByCourseRef.current.has(contentSyncKey)) return;
    packageSyncAttemptedByCourseRef.current.add(contentSyncKey);

    scheduleCourseCloudWrite(authUser.uid, activeCourse.id, {
      nodes: activeCourse.nodes,
      coverImageUrl: activeCourse.coverImageUrl,
      lastActivity: activeCourse.lastActivity
    }, {
      allowMasterWrite: !activeCourse.userId || activeCourse.userId === authUser.uid
    });
  }, [activeCourse, authUser, cloudSyncEnabled]);

  const getSavedCourseSnapshotById = (courseId: string): CourseData | undefined =>
    savedCoursesRef.current.find((course) => course.id === courseId);

  const patchCourseById = (
    courseId: string,
    updater: (course: CourseData) => CourseData,
    options?: { touchLastActivity?: boolean }
  ): CourseData | null => {
    const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : null);
    if (!localUserId) return null;

    const touchLastActivity = Boolean(options?.touchLastActivity);
    let updatedCourse: CourseData | null = null;

    setSavedCourses((prev) => {
      let changed = false;
      const nextCourses = prev.map((course) => {
        if (course.id !== courseId) return course;
        const patched = updater(course);
        const nextCourse = touchLastActivity ? { ...patched, lastActivity: new Date() } : patched;
        if (nextCourse !== course) changed = true;
        updatedCourse = nextCourse;
        return nextCourse;
      });

      if (!changed) return prev;

      const finalCourses = touchLastActivity ? sortCoursesByLastActivity(nextCourses) : nextCourses;
      writeCoursesToLocal(localUserId, finalCourses);
      return finalCourses;
    });

    if (updatedCourse && authUser && cloudSyncEnabled) {
      scheduleCourseCloudWrite(authUser.uid, courseId, {
        nodes: updatedCourse.nodes,
        totalDuration: updatedCourse.totalDuration ?? null,
        lastActivity: updatedCourse.lastActivity
      }, {
        allowMasterWrite: !updatedCourse.userId || updatedCourse.userId === authUser.uid
      });
    }

    return updatedCourse;
  };

  const markCourseNodeLoading = (courseId: string, nodeId: string, isLoading: boolean) => {
    patchCourseById(courseId, (course) => {
      let changed = false;
      const nextNodes = course.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        if (Boolean(node.isLoading) === isLoading) return node;
        changed = true;
        return { ...node, isLoading };
      });
      if (!changed) return course;
      return { ...course, nodes: nextNodes };
    });
  };

  const updateCourseNodeGeneratedData = (
    courseId: string,
    nodeId: string,
    updater: (node: TimelineNode, course: CourseData) => TimelineNode
  ) => {
    patchCourseById(courseId, (course) => {
      let changed = false;
      const nextNodes = course.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const nextNode = updater(node, course);
        if (nextNode !== node) changed = true;
        return nextNode;
      });
      if (!changed) return course;
      return {
        ...course,
        nodes: nextNodes,
        totalDuration: calculateCourseTotalDuration(nextNodes)
      };
    });
  };

  const buildCourseSourceForBackgroundGeneration = (course: CourseData): string | undefined => {
    const blocks = course.nodes
      .map((node) => {
        const body = (node.content || node.podcastScript || '').trim();
        if (!body) return '';
        return `${node.title}\n${body}`;
      })
      .filter(Boolean);
    const merged = blocks.join('\n\n').trim();
    return merged ? merged.slice(0, 22000) : undefined;
  };

  const buildDetailsSourceForBackgroundGeneration = (course: CourseData): string | undefined => {
    const prioritizedBlocks = course.nodes
      .filter((node) => node.type === 'lecture' || node.type === 'podcast')
      .map((node) => {
        const body = (node.content || node.podcastScript || '').trim();
        if (!body) return '';
        return `${node.title}\n${body}`;
      })
      .filter(Boolean);

    if (prioritizedBlocks.length > 0) {
      return prioritizedBlocks.join('\n\n').slice(0, 22000);
    }

    return buildCourseSourceForBackgroundGeneration(course);
  };

  const buildGenerationPayloadForCourse = (course: CourseData) => ({
    bookType: course.bookType,
    subGenre: course.subGenre,
    targetPageCount: course.targetPageCount,
    creativeBrief: course.creativeBrief
  });

  const ensureBackgroundCourseCover = async (courseId: string): Promise<void> => {
    if (backgroundGenerationSuppressedRef.current) return;
    if (backgroundCoverGenerationInFlightRef.current.has(courseId)) return;

    const course = getSavedCourseSnapshotById(courseId);
    if (!course) return;
    if (typeof course.coverImageUrl === 'string' && course.coverImageUrl.trim()) return;

    const lectureNodes = course.nodes.filter((node) => node.type === 'lecture' && Boolean(node.content?.trim()));
    if (!lectureNodes.length) return;

    backgroundCoverGenerationInFlightRef.current.add(courseId);

    try {
      const latestCourse = getSavedCourseSnapshotById(courseId) || course;
      if (typeof latestCourse.coverImageUrl === 'string' && latestCourse.coverImageUrl.trim()) return;

      const compactCoverContextText = (value: string | undefined): string => String(value || '')
        .replace(/!\[[^\]]*]\(\s*<?(?:data:image\/[^)]+|https?:\/\/[^)]+)>?\s*\)/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const coverContext = latestCourse.nodes
        .filter((node) => node.type === 'lecture' && Boolean(node.content?.trim()))
        .map((node) => {
          const body = compactCoverContextText(node.content).slice(0, 700);
          return body ? `[${node.title}] ${body}` : '';
        })
        .filter(Boolean)
        .join('\n\n')
        .slice(0, 6500);

      const coverImageUrl = await generateCourseCover(
        latestCourse.topic || '',
        latestCourse.ageGroup,
        {
          bookType: latestCourse.bookType,
          subGenre: latestCourse.subGenre || undefined,
          creativeBrief: latestCourse.creativeBrief,
          coverContext: [
            latestCourse.bookType ? `Tür: ${latestCourse.bookType}` : '',
            latestCourse.subGenre ? `Alt Tür: ${latestCourse.subGenre}` : '',
            latestCourse.description ? `Özet: ${latestCourse.description}` : '',
            coverContext
          ]
            .filter(Boolean)
            .join('\n\n')
            .slice(0, 8000)
        }
      );

      const normalizedCoverImageUrl = typeof coverImageUrl === 'string' ? coverImageUrl.trim() : '';
      if (!normalizedCoverImageUrl) return;

      const updatedCourse = patchCourseById(courseId, (currentCourse) => {
        if (typeof currentCourse.coverImageUrl === 'string' && currentCourse.coverImageUrl.trim()) {
          return currentCourse;
        }
        return {
          ...currentCourse,
          coverImageUrl: normalizedCoverImageUrl
        };
      });

      if (updatedCourse && authUser && cloudSyncEnabled) {
        scheduleCourseCloudWrite(authUser.uid, courseId, {
          coverImageUrl: normalizedCoverImageUrl,
          lastActivity: updatedCourse.lastActivity
        }, {
          allowMasterWrite: !updatedCourse.userId || updatedCourse.userId === authUser.uid
        });
      }
    } catch (error) {
      console.error('Background book cover generation failed:', error);
    } finally {
      backgroundCoverGenerationInFlightRef.current.delete(courseId);
    }
  };

  const ensureBackgroundNodePackage = async (courseId: string, nodeId: string): Promise<void> => {
    if (backgroundGenerationSuppressedRef.current) return;
    const inFlightKey = `${courseId}:${nodeId}`;
    if (backgroundNodeGenerationInFlightRef.current.has(inFlightKey)) return;

    const course = getSavedCourseSnapshotById(courseId);
    if (!course) return;
    const node = course.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    const seededLectureLoadingWithoutContent =
      node.type === 'lecture' &&
      Boolean(node.isLoading) &&
      !node.content?.trim();
    if (node.isLoading && !seededLectureLoadingWithoutContent) return;

    backgroundNodeGenerationInFlightRef.current.add(inFlightKey);

    try {

      if (node.type === 'lecture' || node.type === 'reinforce') {
        if (node.content?.trim()) return;
        if (node.type === 'reinforce') {
          const latestCourseForGate = getSavedCourseSnapshotById(courseId) || course;
          const lectureNode = latestCourseForGate.nodes.find((n) => n.type === 'lecture');
          if (!lectureNode?.content?.trim()) {
            return;
          }
        }
        markCourseNodeLoading(courseId, nodeId, true);
        try {
          const latestCourse = getSavedCourseSnapshotById(courseId) || course;
          const detailsSource = node.type === 'reinforce'
            ? buildDetailsSourceForBackgroundGeneration(latestCourse)
            : undefined;
          const lectureNodesInOrder = latestCourse.nodes.filter((item) => item.type === 'lecture');
          const lecturePosition = lectureNodesInOrder.findIndex((item) => item.id === nodeId);
          const sanitizeNarrativeContextText = (value: string | undefined): string => String(value || '')
            .replace(/!\[[^\]]*]\(\s*<?(?:data:image\/[^)]+|https?:\/\/[^)]+)>?\s*\)/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          let previousChapterContent: string | undefined;
          if (lecturePosition > 0) {
            for (let idx = lecturePosition - 1; idx >= 0; idx -= 1) {
              const prevContent = sanitizeNarrativeContextText(lectureNodesInOrder[idx].content);
              if (prevContent) {
                previousChapterContent = prevContent;
                break;
              }
            }
          }
          const lecturePayload = {
            ...buildGenerationPayloadForCourse(latestCourse),
            narrativeContext: lecturePosition >= 0
              ? {
                outlinePositions: {
                  current: lecturePosition + 1,
                  total: Math.max(1, lectureNodesInOrder.length)
                },
                previousChapterContent
              }
              : undefined
          };
          const content = node.type === 'reinforce'
            ? await generateRemedialContent(
              course.topic || '',
              detailsSource,
              course.ageGroup,
              buildGenerationPayloadForCourse(course)
            )
            : await generateLectureContent(
              course.topic || '',
              node.title,
              course.ageGroup,
              lecturePayload
            );

          updateCourseNodeGeneratedData(courseId, nodeId, (currentNode, currentCourse) => {
            let minutes = estimateReadingMinutesFromText(content);
            if (currentNode.type === 'reinforce') {
              const lectureNode = currentCourse.nodes.find((n) => n.type === 'lecture');
              const lectureMinutes = lectureNode?.duration ? parseInt(lectureNode.duration, 10) || 0 : 0;
              if (lectureMinutes > 0 && minutes > lectureMinutes) {
                minutes = Math.max(2, lectureMinutes - 1);
              }
            }
            return {
              ...currentNode,
              content,
              duration: `${Math.max(1, minutes)} dk`,
              isLoading: false
            };
          });
        } catch (error) {
          console.error(`Background ${node.type} generation failed:`, error);
          markCourseNodeLoading(courseId, nodeId, false);
        }
        return;
      }

      if (node.type === 'podcast') {
        // Podcast package is generated on-demand during podcast download.
        return;
      }

      if (node.type === 'retention') {
        if (node.content?.trim()) return;
        const latestCourseForGate = getSavedCourseSnapshotById(courseId) || course;
        const lectureNode = latestCourseForGate.nodes.find((n) => n.type === 'lecture');
        const reinforceNode = latestCourseForGate.nodes.find((n) => n.type === 'reinforce');
        if (!lectureNode?.content?.trim() || !reinforceNode?.content?.trim()) {
          return;
        }
        markCourseNodeLoading(courseId, nodeId, true);
        try {
          const latestCourse = getSavedCourseSnapshotById(courseId) || course;
          const sourceContent = buildCourseSourceForBackgroundGeneration(latestCourse);
          if (!sourceContent) {
            markCourseNodeLoading(courseId, nodeId, false);
            return;
          }
          const summary = await generateSummaryCard(
            course.topic || '',
            sourceContent,
            course.ageGroup,
            buildGenerationPayloadForCourse(course)
          );
          updateCourseNodeGeneratedData(courseId, nodeId, (currentNode) => ({
            ...currentNode,
            content: summary,
            duration: `${Math.max(3, Math.min(6, estimateReadingMinutesFromText(summary)))} dk`,
            isLoading: false
          }));
        } catch (error) {
          console.error('Background retention summary generation failed:', error);
          markCourseNodeLoading(courseId, nodeId, false);
        }
        return;
      }

      if (node.type === 'quiz' || node.type === 'exam') return;
    } finally {
      backgroundNodeGenerationInFlightRef.current.delete(inFlightKey);
    }
  };

  const ensureBackgroundRetentionSummary = async (courseId: string): Promise<void> => {
    if (backgroundGenerationSuppressedRef.current) return;
    const course = getSavedCourseSnapshotById(courseId);
    if (!course) return;
    const retentionNode = course.nodes.find((node) => node.type === 'retention');
    if (!retentionNode || retentionNode.content?.trim()) return;
    const lectureNode = course.nodes.find((node) => node.type === 'lecture');
    const reinforceNode = course.nodes.find((node) => node.type === 'reinforce');
    if (!lectureNode?.content?.trim() || !reinforceNode?.content?.trim()) return;

    const sourceContent = buildCourseSourceForBackgroundGeneration(course);
    if (!sourceContent) return;

    markCourseNodeLoading(courseId, retentionNode.id, true);
    try {
      const summary = await generateSummaryCard(
        course.topic || '',
        sourceContent,
        course.ageGroup,
        buildGenerationPayloadForCourse(course)
      );
      updateCourseNodeGeneratedData(courseId, retentionNode.id, (currentNode) => ({
        ...currentNode,
        content: summary,
        isLoading: false
      }));
    } catch (error) {
      console.error('Background summary card generation failed:', error);
      markCourseNodeLoading(courseId, retentionNode.id, false);
    }
  };

  const startBackgroundSmartBookPackaging = (courseId: string) => {
    if (!courseId) return;
    if (!sessionCreatedCourseIdsRef.current.has(courseId)) return;
    if (backgroundGenerationSuppressedRef.current) return;
    if (backgroundPackagingCourseIdsRef.current.has(courseId)) return;

    backgroundPackagingStartAttemptedRef.current.add(courseId);
    backgroundPackagingCourseIdsRef.current.add(courseId);

    void (async () => {
      try {
        let lectureGenerationFailed = false;
        let course = getSavedCourseSnapshotById(courseId);
        for (let attempt = 0; attempt < 30 && !course; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, BACKGROUND_SMARTBOOK_POLL_MS));
          course = getSavedCourseSnapshotById(courseId);
        }
        if (!course) return;
        if (backgroundGenerationSuppressedRef.current) return;
        if (
          progressOnlyFallbackCourseIdsRef.current.has(courseId) &&
          course.nodes.every((node) => isNodeProgressOnlyShape(node))
        ) {
          return;
        }
        progressOnlyFallbackCourseIdsRef.current.delete(courseId);

        for (const nodeId of course.nodes.map((node) => node.id)) {
          if (backgroundGenerationSuppressedRef.current) break;
          await ensureBackgroundNodePackage(courseId, nodeId);
          const latestCourse = getSavedCourseSnapshotById(courseId);
          if (!latestCourse) break;
          const lectureNode = latestCourse.nodes.find((node) => node.type === 'lecture');
          if (lectureNode && !lectureNode.content?.trim() && !lectureNode.isLoading) {
            lectureGenerationFailed = true;
            break;
          }
        }

        if (!lectureGenerationFailed) {
          if (backgroundGenerationSuppressedRef.current) return;
          await ensureBackgroundCourseCover(courseId);
          if (backgroundGenerationSuppressedRef.current) return;
          await ensureBackgroundRetentionSummary(courseId);
        }
      } finally {
        backgroundPackagingCourseIdsRef.current.delete(courseId);
      }
    })();
  };

  const openCourseFlow = (courseId: string) => {
    if (!courseId) return;
    const allowBackgroundPackaging = sessionCreatedCourseIdsRef.current.has(courseId);
    if (allowBackgroundPackaging) {
      startBackgroundSmartBookPackaging(courseId);
    }
    startTransition(() => {
      setActiveCourseId(courseId);
      setCurrentView('COURSE_FLOW');
    });
  };

  const purgeCourseRuntimeState = (courseId: string) => {
    if (!courseId) return;
    coursePackageByIdRef.current.delete(courseId);
    coursePackagePromiseByIdRef.current.delete(courseId);
    coursePackagePromiseModeByIdRef.current.delete(courseId);
    sessionCreatedCourseIdsRef.current.delete(courseId);
    progressOnlyFallbackCourseIdsRef.current.delete(courseId);
    backgroundPackagingCourseIdsRef.current.delete(courseId);
    backgroundCoverGenerationInFlightRef.current.delete(courseId);

    for (const key of Array.from(backgroundNodeGenerationInFlightRef.current)) {
      if (key.startsWith(`${courseId}:`)) {
        backgroundNodeGenerationInFlightRef.current.delete(key);
      }
    }
    for (const key of Array.from(packageSyncAttemptedByCourseRef.current)) {
      if (key.startsWith(`${courseId}:`)) {
        packageSyncAttemptedByCourseRef.current.delete(key);
      }
    }
  };

  const handleCourseCreate = async (data: CourseData) => {
    const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : null);
    if (!localUserId) return;
    const flowNodes = data.nodes.filter((node) => node.type !== 'exam' && node.type !== 'quiz');
    const sanitizedNodes = flowNodes.length > 0 ? flowNodes : data.nodes;
    const firstLectureId = sanitizedNodes.find((node) => node.type === 'lecture' && !node.content?.trim())?.id;
    const baseSeededCourse: CourseData = firstLectureId
      ? {
        ...data,
        nodes: sanitizedNodes.map((node) => (node.id === firstLectureId ? { ...node, isLoading: true } : node))
      }
      : {
        ...data,
        nodes: sanitizedNodes
      };
    const seededCourse: CourseData = {
      ...baseSeededCourse,
      status: normalizeCourseStatus(baseSeededCourse.status) || 'processing',
      userId: authUser?.uid ?? baseSeededCourse.userId
    };

    sessionCreatedCourseIdsRef.current.add(seededCourse.id);

    setSavedCourses(prev => {
      const nextCourses = sortCoursesByLastActivity([seededCourse, ...prev.filter((course) => course.id !== seededCourse.id)]);
      savedCoursesRef.current = nextCourses;
      flushCoursesToLocalNow(localUserId, nextCourses);
      return nextCourses;
    });
    openCourseFlow(seededCourse.id);
    if (seededCourse.nodes.length > 0) {
      startBackgroundSmartBookPackaging(seededCourse.id);
    } else {
      void ensureCourseReadyForOpen(seededCourse.id, seededCourse);
    }

    if (!authUser || !cloudSyncEnabled) return;

    try {
      const privatePayload = {
        ...seededCourse,
        userId: authUser.uid,
        createdAt: seededCourse.createdAt,
        lastActivity: seededCourse.lastActivity
      };
      let cloudCourse: CourseData = privatePayload;
      if (
        privatePayload.nodes.length > 0 &&
        !privatePayload.contentPackagePath &&
        hasPersistableCourseContent(privatePayload)
      ) {
        const materializedNodes = await materializeNodesForCloud(authUser.uid, seededCourse.id, privatePayload.nodes);
        const materializedCoverImageUrl = await materializeCoverForCloud(
          authUser.uid,
          seededCourse.id,
          privatePayload.coverImageUrl
        );
        const courseForPackage: CourseData = {
          ...privatePayload,
          nodes: materializedNodes,
          coverImageUrl: materializedCoverImageUrl
        };
        const packageMetadata = await uploadCoursePackageToStorage(authUser.uid, seededCourse.id, courseForPackage);
        cloudCourse = {
          ...courseForPackage,
          ...packageMetadata,
          status: packageMetadata.contentPackagePath ? 'ready' : (normalizeCourseStatus(courseForPackage.status) || 'processing'),
          bundle: packageMetadata.contentPackagePath
            ? {
              path: packageMetadata.contentPackagePath,
              version: extractBundleVersionFromPath(packageMetadata.contentPackagePath),
              includesPodcast: courseForPackage.nodes.some((node) => Boolean(node.podcastAudioUrl?.trim())),
              generatedAt: packageMetadata.contentPackageUpdatedAt || new Date()
            }
            : courseForPackage.bundle
        };
      }
      coursePackageByIdRef.current.set(seededCourse.id, cloudCourse);
      applyCloudHydratedCourseLocally(authUser.uid, cloudCourse);
      const bookDocPayload = buildBookDocumentPayload(authUser.uid, seededCourse.id, cloudCourse);
      await setDoc(
        doc(db, 'users', authUser.uid, 'books', seededCourse.id),
        stripUndefinedDeepForFirestore(bookDocPayload),
        { merge: true }
      );
    } catch (error) {
      if (isFirestoreResourceExhaustedError(error)) {
        scheduleCourseCloudWrite(authUser.uid, seededCourse.id, {
          ...seededCourse,
          userId: authUser.uid,
          coverImageUrl: seededCourse.coverImageUrl,
          nodes: seededCourse.nodes,
          lastActivity: seededCourse.lastActivity
        }, { allowMasterWrite: false });
      } else if (isPermissionDeniedError(error)) {
        console.error("Error saving private book package to Firebase:", error);
      } else {
        console.error("Error saving book metadata to Firebase:", error);
      }
    }
  };

  const handleCourseDelete = async (courseId: string): Promise<void> => {
    const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : null);
    if (!localUserId) return;

    const targetCourse = savedCourses.find((course) => course.id === courseId);
    if (!targetCourse) return;

    purgeCourseRuntimeState(courseId);

    setSavedCourses((prev) => {
      const nextCourses = prev.filter((course) => course.id !== courseId);
      flushCoursesToLocalNow(localUserId, nextCourses);
      return nextCourses;
    });
    setLikedCourseIds((prev) => {
      const nextIds = prev.filter((id) => id !== courseId);
      if (nextIds.length !== prev.length) {
        writeLikedCourseIdsToLocal(localUserId, nextIds);
      }
      return nextIds;
    });

    if (activeCourseId === courseId) {
      setActiveCourseId(null);
      if (currentView === 'COURSE_FLOW') {
        setCurrentView('HOME');
      }
    }

    if (!authUser || !cloudSyncEnabled) return;

    let privateDeleteError: unknown = null;
    try {
      await deleteDoc(doc(db, 'users', authUser.uid, 'books', courseId));
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        disableCloudSyncForPermission();
      } else {
        privateDeleteError = error;
      }
    }
    if (privateDeleteError) {
      throw privateDeleteError;
    }
  };

  const canDeleteCourse = (course: CourseData): boolean => {
    if (isGuestSession) return true;
    if (!authUser) return true;
    return !course.userId || course.userId === authUser.uid;
  };

  const updateCourseOpenState = (
    courseId: string,
    nextState: { status: CourseOpenUiState['status']; progress: number }
  ) => {
    const clampedProgress = Math.max(0, Math.min(100, Math.round(nextState.progress)));
    setCourseOpenStateById((prev) => {
      const previous = prev[courseId];
      if (
        previous &&
        previous.status === nextState.status &&
        previous.progress === clampedProgress
      ) {
        return prev;
      }
      return {
        ...prev,
        [courseId]: {
          status: nextState.status,
          progress: clampedProgress,
          updatedAt: Date.now()
        }
      };
    });
  };

  const ensureCourseReadyForOpen = async (
    courseId: string,
    snapshotHint?: CourseData | null
  ): Promise<boolean> => {
    if (!courseId) return false;

    const snapshot = savedCoursesRef.current.find((course) => course.id === courseId) || snapshotHint || null;
    if (!snapshot) return false;

    if (!courseNeedsContentHydration(snapshot)) {
      updateCourseOpenState(courseId, { status: 'ready', progress: 100 });
      return true;
    }

    if (courseOpenInFlightByIdRef.current.has(courseId)) {
      return false;
    }

    courseOpenInFlightByIdRef.current.add(courseId);
    let visualProgress = Math.max(6, Math.min(95, courseOpenStateByIdRef.current[courseId]?.progress || 0));
    updateCourseOpenState(courseId, { status: 'downloading', progress: visualProgress });

    const timer = window.setInterval(() => {
      const remaining = 99 - visualProgress;
      if (remaining <= 0) return;
      const step = remaining > 50 ? 5 : remaining > 25 ? 3 : 1;
      visualProgress = Math.min(99, visualProgress + step);
      updateCourseOpenState(courseId, { status: 'downloading', progress: visualProgress });
    }, 220);

    try {
      const hydrated = await withPromiseTimeout(
        ensureCourseHydrated(courseId, { markNodesLoading: false }),
        SMARTBOOK_OPEN_HYDRATION_TIMEOUT_MS,
        `Course open hydration timed out (${courseId}).`
      );
      window.clearInterval(timer);

      if (!hydrated) {
        updateCourseOpenState(courseId, { status: 'failed', progress: Math.max(visualProgress, 6) });
        return false;
      }

      updateCourseOpenState(courseId, { status: 'downloading', progress: 100 });
      await waitMs(90);
      updateCourseOpenState(courseId, { status: 'ready', progress: 100 });
      return true;
    } catch (error) {
      console.warn(`Book open hydration failed (${courseId}):`, error);
      window.clearInterval(timer);
      updateCourseOpenState(courseId, { status: 'failed', progress: Math.max(visualProgress, 6) });
      return false;
    } finally {
      window.clearInterval(timer);
      courseOpenInFlightByIdRef.current.delete(courseId);
    }
  };

  const handleCourseSelect = (courseId: string) => {
    void (async () => {
      const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : null);
      let selectedSnapshot: CourseData | null = null;
      const existing = savedCoursesRef.current.find((course) => course.id === courseId)
        || savedCourses.find((course) => course.id === courseId)
        || null;

      if (!existing) return;
      selectedSnapshot = existing;
      const needsMetadataSync = (
        isPlaceholderCourseTopic(existing.topic) ||
        !existing.coverImageUrl ||
        !existing.contentPackagePath ||
        !existing.bookType ||
        !existing.subGenre ||
        !existing.ageGroup ||
        !existing.creatorName ||
        !existing.totalDuration
      );
      if (needsMetadataSync && authUser && cloudSyncEnabled) {
        scheduleCourseCloudWrite(authUser.uid, existing.id, {});
      }

      if (!selectedSnapshot) return;

      // If course already has nodes and content, open immediately.
      if (selectedSnapshot.nodes.length > 0 && !courseNeedsContentHydration(selectedSnapshot)) {
        updateCourseOpenState(courseId, { status: 'ready', progress: 100 });
        openCourseFlow(courseId);
        return;
      }

      // Course has 0 nodes or missing content — fetch full content from Storage/backend.
      try {
        updateCourseOpenState(courseId, { status: 'downloading', progress: 10 });

        // fetchCoursePackageFromStorage tries: backend → Storage URL → Storage paths → backend fallback
        const hydrated = await fetchCoursePackageFromStorage(
          courseId,
          selectedSnapshot.userId || authUser?.uid,
          selectedSnapshot.contentPackageUrl,
          selectedSnapshot.contentPackagePath,
          { preferBackend: false, versionHint: selectedSnapshot.bundle?.version }
        );

        if (hydrated && hydrated.nodes.length > 0) {
          const mergedCourse = mergeSharedCourseWithUserProgress(
            hydrated,
            toProgressDocFromCourseSnapshot(selectedSnapshot)
          );
          setSavedCourses((prev) => {
            const nextCourses = prev.map((c) => (c.id === courseId ? mergedCourse : c));
            savedCoursesRef.current = nextCourses;
            if (localUserId) {
              writeCoursesToLocal(localUserId, nextCourses);
              writeFullCoursesToLocal(localUserId, nextCourses);
            }
            return nextCourses;
          });
          coursePackageByIdRef.current.set(courseId, mergedCourse);
          updateCourseOpenState(courseId, { status: 'ready', progress: 100 });
          openCourseFlow(courseId);
          return;
        }

        updateCourseOpenState(courseId, { status: 'failed', progress: 0 });
        openCourseFlow(courseId);
      } catch (error) {
        updateCourseOpenState(courseId, { status: 'failed', progress: 0 });
        openCourseFlow(courseId);
      }
    })();
  };

  useEffect(() => {
    const sharedBookId = incomingSharedSmartBookId;
    if (!sharedBookId) return;
    if (shareLinkAutoOpenHandledRef.current.has(sharedBookId)) return;

    const existsInSaved = savedCourses.some((course) => course.id === sharedBookId);
    if (!existsInSaved) return;

    shareLinkAutoOpenHandledRef.current.add(sharedBookId);
    handleCourseSelect(sharedBookId);
    removeSharedSmartBookQueryFromUrl();
    setIncomingSharedSmartBookId(null);
  }, [incomingSharedSmartBookId, savedCourses]);

  const handleShareSmartBook = async (course: CourseData) => {
    const shareUrl = buildSmartBookLibraryShareUrl(course.id);
    const title = `${course.topic} | Fortale`;
    const text = `${course.topic} kitabını Fortale'de aç.`;

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      console.info('Book share link copied:', shareUrl);
    } catch (error) {
      if ((error as { name?: string } | null)?.name === 'AbortError') return;

      try {
        await navigator.clipboard.writeText(shareUrl);
        console.info('Book share link copied (fallback):', shareUrl);
      } catch (clipboardError) {
        console.error('Book share failed:', error, clipboardError);
      }
    }
  };

  const handleToggleCourseLike = (courseId: string) => {
    const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : null);
    if (!localUserId) return;

    setLikedCourseIds((prev) => {
      const next = prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [courseId, ...prev];
      writeLikedCourseIdsToLocal(localUserId, next);
      return next;
    });
  };

  const handleLogout = async () => {
    setSettingsOpen(false);

    if (!authUser) {
      clearGuestSession();
      setCurrentView('HOME');
      setSavedCourses([]);
      setStickyNotes([]);
      setActiveCourseId(null);
      return;
    }

    try {
      await signOut(auth);
      setCurrentView('HOME');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleProfileNameUpdate = async (nextName: string): Promise<void> => {
    if (!authUser) throw new Error('İsim güncellemek için giriş yapmalısınız.');
    const normalized = String(nextName || '').trim().replace(/\s+/g, ' ');
    if (!normalized) throw new Error('İsim Soyisim boş olamaz.');

    await updateProfile(authUser, { displayName: normalized });
    setProfileNameOverride(normalized);

    if (!cloudSyncEnabled) return;
    try {
      await setDoc(
        doc(db, 'users', authUser.uid),
        {
          displayName: normalized,
          lastProfileUpdateAt: new Date()
        },
        { merge: true }
      );
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        disableCloudSyncForPermission();
      } else {
        console.warn('Profile name sync skipped:', error);
      }
    }
  };

  const handleAcceptLegalConsent = async (): Promise<void> => {
    if (!authUser || isLegalConsentSaving) return;
    setIsLegalConsentSaving(true);
    setLegalConsentError(null);

    try {
      await setDoc(
        doc(db, 'users', authUser.uid),
        {
          email: authUser.email ?? null,
          displayName: authUser.displayName ?? null,
          appLanguage,
          appLanguageLabel: getAppLanguageLabel(appLanguage),
          legalConsentAcceptedAt: new Date(),
          legalConsentVersion: LEGAL_CONSENT_VERSION,
          legalConsentSource: 'home_modal',
          legalTermsLastUpdated: defaultTermsPolicy.lastUpdatedDate,
          legalPrivacyLastUpdated: defaultPrivacyPolicy.lastUpdatedDate
        },
        { merge: true }
      );
      setLegalConsentState('accepted');
    } catch (error) {
      console.error('Legal consent save failed:', error);
      setLegalConsentError('Onay kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.');
    } finally {
      setIsLegalConsentSaving(false);
    }
  };

  const persistAppLanguagePreference = async (
    uid: string,
    language: AppLanguageCode,
    source: AppLanguagePreferenceSource
  ): Promise<void> => {
    await setDoc(
      doc(db, 'users', uid),
      {
        appLanguage: language,
        appLanguageLabel: getAppLanguageLabel(language),
        appLanguageSource: source,
        appLanguageUpdatedAt: new Date()
      },
      { merge: true }
    );
  };

  const handleAppLanguageChange = async (
    nextLanguage: AppLanguageCode,
    source: AppLanguagePreferenceSource = 'manual_selection'
  ): Promise<void> => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCAL_APP_LANGUAGE_KEY, nextLanguage);
      window.localStorage.setItem(LOCAL_APP_LANGUAGE_SOURCE_KEY, source);
    }
    setAppLanguage(nextLanguage);
    setAppLanguageSource(source);
    setAppLanguageSetupOpen(false);

    if (authUser) {
      try {
        await persistAppLanguagePreference(authUser.uid, nextLanguage, source);
      } catch (error) {
        console.error('App language save failed:', error);
      }
    }
  };

  const handleDeleteMyData = async (): Promise<void> => {
    const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : null);
    if (!localUserId) return;

    if (authUser && cloudSyncEnabled) {
      try {
        const [userBooksSnap, stickySnap] = await Promise.all([
          getDocs(collection(db, 'users', authUser.uid, 'books')),
          getDocs(collection(db, 'users', authUser.uid, 'stickyNotes'))
        ]);

        await Promise.all([
          ...userBooksSnap.docs.map((snapshot) => deleteDoc(snapshot.ref)),
          ...stickySnap.docs.map((snapshot) => deleteDoc(snapshot.ref))
        ]);
      } catch (error) {
        if (isPermissionDeniedError(error)) {
          disableCloudSyncForPermission();
        } else {
          throw error;
        }
      }
    }

    clearLocalUserDataCaches(localUserId);
    setSavedCourses([]);
    setStickyNotes([]);
    setLikedCourseIds([]);
    setActiveCourseId(null);
  };

  const handleDeleteAccount = async (): Promise<void> => {
    if (!authUser) throw new Error('Hesap silmek için giriş yapmalısınız.');
    const uid = authUser.uid;

    await handleDeleteMyData();

    try {
      await deleteUser(authUser);
      clearLocalUserDataCaches(uid);
      setCurrentView('HOME');
    } catch (error) {
      const code = (error as { code?: string } | null)?.code || '';
      if (code === 'auth/requires-recent-login') {
        throw new Error('Hesabı silmek için yeniden giriş yapmanız gerekiyor.');
      }
      throw error;
    }
  };

  const handleCourseUpdate = async (updatedNodes: TimelineNode[]) => {
    const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : null);
    if (!activeCourseId || !localUserId) return;

    const now = new Date();
    let updatedCourse: CourseData | null = null;

    setSavedCourses(prev => {
      const nextCourses = sortCoursesByLastActivity(
        prev.map((course) => {
          if (course.id !== activeCourseId) return course;
          updatedCourse = { ...course, nodes: updatedNodes, lastActivity: now };
          return updatedCourse;
        })
      );
      writeCoursesToLocal(localUserId, nextCourses);
      return nextCourses;
    });

    const lectureReady = updatedNodes.some((node) => node.type === 'lecture' && Boolean(node.content?.trim()));
    const hasMissingBackgroundContent = updatedNodes.some((node) => {
      if (node.type !== 'reinforce' && node.type !== 'retention') return false;
      return !node.content?.trim();
    });
    if (lectureReady && hasMissingBackgroundContent) {
      startBackgroundSmartBookPackaging(activeCourseId);
    }

    if (!updatedCourse || !authUser || !cloudSyncEnabled) return;

    const payload = {
      nodes: updatedNodes,
      lastActivity: now
    };

    scheduleCourseCloudWrite(authUser.uid, activeCourseId, payload, {
      allowMasterWrite: !updatedCourse.userId || updatedCourse.userId === authUser.uid
    });
  };

  const handleStickyNoteCreate = async (payload: { title?: string; text: string; reminderAt?: string | null }): Promise<StickyNoteData | undefined> => {
    const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : null);
    if (!localUserId) return undefined;

    const text = String(payload.text || '').trim();
    const title = buildStickyTitle(payload.title, text);
    const reminderAt = resolveOptionalIsoDate(payload.reminderAt);
    const now = new Date();
    const newStickyNote: StickyNoteData = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `sticky-${Date.now()}`,
      title,
      text,
      noteType: 'sticky',
      reminderAt,
      createdAt: now,
      lastActivity: now
    };

    setStickyNotes((prev) => {
      const nextStickyNotes = sortStickyNotesByLastActivity([
        newStickyNote,
        ...prev.filter((note) => note.id !== newStickyNote.id)
      ]);
      writeStickyNotesToLocal(localUserId, nextStickyNotes);
      return nextStickyNotes;
    });

    if (!authUser || !cloudSyncEnabled) return newStickyNote;

    try {
      await setDoc(
        doc(db, 'users', authUser.uid, 'stickyNotes', newStickyNote.id),
        {
          userId: authUser.uid,
          title: newStickyNote.title,
          text: newStickyNote.text,
          stickyText: newStickyNote.text,
          noteType: 'sticky',
          reminderAt: newStickyNote.reminderAt ?? null,
          createdAt: newStickyNote.createdAt,
          lastActivity: newStickyNote.lastActivity
        },
        { merge: true }
      );
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        disableCloudSyncForPermission();
      } else {
        console.error('Error saving sticky note to Firebase:', error);
      }
    }

    return newStickyNote;
  };

  const handleStickyNoteUpdate = async (
    noteId: string,
    payload: { title?: string; text: string; reminderAt?: string | null }
  ): Promise<StickyNoteData | undefined> => {
    const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : null);
    if (!localUserId) return undefined;

    const currentStickyNote = stickyNotes.find((note) => note.id === noteId);
    if (!currentStickyNote) return undefined;

    const text = String(payload.text ?? currentStickyNote.text).trim();
    const title = buildStickyTitle(payload.title ?? currentStickyNote.title, text);
    const reminderAt = payload.reminderAt === undefined
      ? (currentStickyNote.reminderAt ?? null)
      : resolveOptionalIsoDate(payload.reminderAt);
    const now = new Date();
    const updatedStickyNote: StickyNoteData = {
      ...currentStickyNote,
      title,
      text,
      reminderAt,
      lastActivity: now
    };

    setStickyNotes((prev) => {
      const nextStickyNotes = sortStickyNotesByLastActivity(
        prev.map((note) => (note.id === noteId ? updatedStickyNote : note))
      );
      writeStickyNotesToLocal(localUserId, nextStickyNotes);
      return nextStickyNotes;
    });

    if (!authUser || !cloudSyncEnabled) return updatedStickyNote;

    try {
      await setDoc(
        doc(db, 'users', authUser.uid, 'stickyNotes', noteId),
        {
          userId: authUser.uid,
          title: updatedStickyNote.title,
          text: updatedStickyNote.text,
          stickyText: updatedStickyNote.text,
          noteType: 'sticky',
          reminderAt: updatedStickyNote.reminderAt ?? null,
          createdAt: updatedStickyNote.createdAt,
          lastActivity: updatedStickyNote.lastActivity
        },
        { merge: true }
      );
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        disableCloudSyncForPermission();
      } else {
        console.error('Error updating sticky note in Firebase:', error);
      }
    }

    return updatedStickyNote;
  };

  const handleStickyNoteDelete = async (noteId: string): Promise<void> => {
    const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : null);
    if (!localUserId) return;

    setStickyNotes((prev) => {
      const nextStickyNotes = prev.filter((note) => note.id !== noteId);
      writeStickyNotesToLocal(localUserId, nextStickyNotes);
      return nextStickyNotes;
    });

    if (!authUser || !cloudSyncEnabled) return;

    try {
      await deleteDoc(doc(db, 'users', authUser.uid, 'stickyNotes', noteId));
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        disableCloudSyncForPermission();
      } else {
        console.error('Error deleting sticky note from Firebase:', error);
      }
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'HOME':
        return (
          <HomeView
            onNavigate={setCurrentView}
            onCourseCreate={handleCourseCreate}
            onDeleteCourse={handleCourseDelete}
            savedCourses={savedCourses}
            onCourseSelect={handleCourseSelect}
            canDeleteCourse={canDeleteCourse}
            stickyNotes={stickyNotes}
            onCreateStickyNote={handleStickyNoteCreate}
            onUpdateStickyNote={handleStickyNoteUpdate}
            onDeleteStickyNote={handleStickyNoteDelete}
            onRequireCredit={requireCreditForAction}
            onConsumeCredit={consumeCreditForAction}
            isBootstrapping={Boolean(isLoading && savedCourses.length === 0)}
            bootstrapMessage={loadingMessage}
            defaultBookLanguage={getAppLanguageLabel(appLanguage)}
            courseOpenStates={courseOpenStateById}
            isLoggedIn={Boolean(authUser && !isGuestSession)}
            onRequestLogin={handleOpenLoginScreen}
          />
        );
      case 'COURSE_FLOW': {
        return (
          <CourseFlowView
            onBack={() => setCurrentView('HOME')}
            onNavigate={setCurrentView}
            courseData={activeCourse}
            onUpdateCourse={handleCourseUpdate}
            onResolveCourseForExport={resolveCourseForExport}
            allowOpenAutoGeneration={allowOpenAutoGenerationForActiveCourse}
            onReadingFullscreenChange={setIsReaderFullscreen}
            onRequireCredit={requireCreditForAction}
            onConsumeCredit={consumeCreditForAction}
            onRefundCredit={refundCreditForAction}
          />
        );
      }
      case 'AI_CHAT':
        return (
          <PersonalGrowthView
            savedCourses={savedCourses}
            onCourseSelect={handleCourseSelect}
            onDeleteCourse={handleCourseDelete}
            isBootstrapping={Boolean(isLoading && savedCourses.length === 0)}
            bootstrapMessage={loadingMessage}
            courseOpenStates={courseOpenStateById}
          />
        );
      case 'EXPLORE':
        return (
          <HomeView
            onNavigate={setCurrentView}
            onCourseCreate={handleCourseCreate}
            onDeleteCourse={handleCourseDelete}
            savedCourses={savedCourses}
            onCourseSelect={handleCourseSelect}
            canDeleteCourse={canDeleteCourse}
            stickyNotes={stickyNotes}
            onCreateStickyNote={handleStickyNoteCreate}
            onUpdateStickyNote={handleStickyNoteUpdate}
            onDeleteStickyNote={handleStickyNoteDelete}
            onRequireCredit={requireCreditForAction}
            onConsumeCredit={consumeCreditForAction}
            isBootstrapping={Boolean(isLoading && savedCourses.length === 0)}
            bootstrapMessage={loadingMessage}
            defaultBookLanguage={getAppLanguageLabel(appLanguage)}
            courseOpenStates={courseOpenStateById}
            isLoggedIn={Boolean(authUser && !isGuestSession)}
            onRequestLogin={handleOpenLoginScreen}
          />
        );
      case 'PROFILE':
        return (
          <ProfileView
            userName={userName}
            userEmail={authUser?.email || (isGuestSession ? 'Misafir oturumu' : undefined)}
            isGuestSession={isGuestSession}
            onLogout={handleLogout}
            onUpdateProfileName={handleProfileNameUpdate}
            onDeleteMyData={handleDeleteMyData}
            onDeleteAccount={handleDeleteAccount}
          />
        );
      case 'PRIVACY':
        return <PrivacyView />;
      case 'TERMS':
        return <TermsView />;
      default:
        return (
          <HomeView
            onNavigate={setCurrentView}
            onCourseCreate={handleCourseCreate}
            onDeleteCourse={handleCourseDelete}
            savedCourses={savedCourses}
            onCourseSelect={handleCourseSelect}
            canDeleteCourse={canDeleteCourse}
            stickyNotes={stickyNotes}
            onCreateStickyNote={handleStickyNoteCreate}
            onUpdateStickyNote={handleStickyNoteUpdate}
            onDeleteStickyNote={handleStickyNoteDelete}
            onRequireCredit={requireCreditForAction}
            onConsumeCredit={consumeCreditForAction}
            isBootstrapping={Boolean(isLoading && savedCourses.length === 0)}
            bootstrapMessage={loadingMessage}
            defaultBookLanguage={getAppLanguageLabel(appLanguage)}
            isLoggedIn={Boolean(authUser && !isGuestSession)}
            onRequestLogin={handleOpenLoginScreen}
          />
        );
    }
  };

  const canRenderHomeWhileAuthBootstraps = Boolean(
    isAuthLoading &&
    currentView === 'HOME' &&
    (isGuestSession || bootstrapAuthUid || savedCourses.length > 0)
  );

  if (isAuthLoading && !canRenderHomeWhileAuthBootstraps) {
    return (
      <UiI18nProvider key={appLanguage} language={appLanguage}>
        <FullScreenFallback message={loadingMessage} />
      </UiI18nProvider>
    );
  }

  if (!isAuthLoading && !authUser && !isGuestSession && currentView !== 'PRIVACY' && currentView !== 'TERMS') {
    if (isOnboardingVisible) {
      return (
        <UiI18nProvider key={appLanguage} language={appLanguage}>
          <Suspense fallback={<FullScreenFallback message={loadingMessage} />}>
            <OnboardingView onFinish={handleOnboardingFinish} />
          </Suspense>
        </UiI18nProvider>
      );
    }

    return (
      <UiI18nProvider key={appLanguage} language={appLanguage}>
        <Suspense fallback={<FullScreenFallback message={loadingMessage} />}>
          <LoginView
            onContinueWithoutLogin={handleContinueWithoutLogin}
            onNavigate={setCurrentView}
          />
        </Suspense>
      </UiI18nProvider>
    );
  }

  return (
    <UiI18nProvider key={appLanguage} language={appLanguage}>
      <Suspense fallback={<FullScreenFallback message={loadingMessage} />}>
        <div className="fixed inset-0 bg-[#1A1F26] text-text-primary font-sans antialiased flex justify-center">
          <div className="app-shell-width relative h-full overflow-hidden bg-transparent flex flex-col md:border-x md:border-white/5">
            <CreditPaywallModal
              isOpen={isCreditPaywallOpen}
              onClose={() => {
                setCreditPaywallOpen(false);
                setCreditPaywallIntent(null);
              }}
              wallet={creditWallet}
              packs={CREDIT_PACKS}
              insufficientAction={creditPaywallIntent}
              isPurchasing={isCreditPurchaseBusy}
              onPurchase={handleCreditPackPurchase}
            />

            <SettingsModal
              isOpen={isSettingsOpen}
              onClose={() => setSettingsOpen(false)}
              userName={userName}
              userEmail={authUser?.email || (isGuestSession ? 'Misafir oturumu' : undefined)}
              isLoggedIn={Boolean(authUser)}
              credits={creditWallet}
              appLanguage={appLanguage}
              onOpenPaywall={() => openCreditPaywall()}
              onNavigate={setCurrentView}
              onContact={handleContactSupport}
              onAppLanguageChange={handleAppLanguageChange}
              onAuthAction={authUser ? handleLogout : handleOpenLoginScreen}
            />

            <LegalConsentModal
              isOpen={Boolean(authUser && currentView === 'HOME' && legalConsentState === 'required')}
              isSaving={isLegalConsentSaving}
              error={legalConsentError}
              onAccept={handleAcceptLegalConsent}
            />

            <AppLanguageSetupModal
              isOpen={Boolean(!isAuthLoading && isAppLanguageSetupOpen)}
              selectedLanguage={appLanguage}
              onSelectLanguage={(language) => {
                setAppLanguage(language);
                setAppLanguageSource('manual_selection');
              }}
              onConfirm={() => handleAppLanguageChange(appLanguage, 'manual_selection')}
            />

            {!isReaderFullscreen && (
              <GlobalHeader
                onToggleSettings={handleToggleSettings}
                isSettingsOpen={isSettingsOpen}
                credits={creditWallet}
                onOpenPaywall={() => openCreditPaywall()}
              />
            )}

            <main className="flex-1 relative overflow-hidden">
              <div className="absolute inset-0 w-full h-full">
                <div className="w-full h-full">
                  {renderView()}
                </div>
              </div>
            </main>

            {!isReaderFullscreen && (
              <BottomNav
                currentView={currentView}
                onViewChange={setCurrentView}
              />
            )}
          </div>
        </div>
      </Suspense>
    </UiI18nProvider>
  );
}
