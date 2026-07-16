import React, { lazy, startTransition, Suspense, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
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
import { collection, getDoc, getDocs, doc, setDoc, query, orderBy, deleteDoc, onSnapshot, deleteField } from 'firebase/firestore';
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
  getRevenueCatCreditPackPriceStrings,
  isRevenueCatEnabled,
  isRevenueCatPurchaseCancelledError,
  purchaseRevenueCatCreditPack
} from './utils/revenueCat';
import { normalizeMarkdownNarrativeLayout } from './utils/markdownLayout';

import HomeView from './views/HomeView';
import CommunityView from './views/CommunityView';
import CourseFlowView from './views/CourseFlowView';
import PersonalGrowthView from './views/PersonalGrowthView';
import ProfileView from './views/ProfileView';
import PrivacyView from './views/PrivacyView';
import TermsView from './views/TermsView';
import LoginView from './views/LoginView';
import OnboardingView from './views/OnboardingView';
import SettingsModal from './components/SettingsModal';
import CreditPaywallModal from './components/CreditPaywallModal';
import LoginPromptModal from './components/LoginPromptModal';

const LOCAL_COURSE_KEY_PREFIX = 'f-study-courses';
const LOCAL_FULL_COURSE_CACHE_KEY_PREFIX = 'f-study-full-courses';
const LOCAL_COURSE_COVER_CACHE_KEY_PREFIX = 'f-study-course-cover-cache';
const NATIVE_FULL_COURSE_CACHE_DIR = 'smartbook-cache';
const NATIVE_COURSE_COVER_CACHE_DIR = 'smartbook-covers';
const NATIVE_BOOK_PACKAGE_CACHE_DIR = 'smartbook-packages';
const NATIVE_BOOK_ASSET_CACHE_DIR = 'smartbook-assets';
const WEB_BOOK_PACKAGE_DB_NAME = 'fortale-smartbook-cache-v1';
const WEB_BOOK_PACKAGE_DB_VERSION = 1;
const WEB_BOOK_PACKAGE_STORE = 'bookPackages';
const WEB_BOOK_COURSE_STORE = 'bookCourses';
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
const BACKGROUND_SMARTBOOK_POLL_MS = 300;
const SMARTBOOK_PREFETCH_RETRY_COOLDOWN_MS = 15_000;
const SMARTBOOK_COVER_REPAIR_RETRY_COOLDOWN_MS = 3500;
const SMARTBOOK_HYDRATION_PREFETCH_CONCURRENCY = 4;
const SMARTBOOK_EXPORT_HYDRATION_WAIT_MS = 5000;
const SMARTBOOK_PACKAGE_FETCH_TIMEOUT_MS = 120_000;
const SMARTBOOK_STORAGE_BLOB_TIMEOUT_MS = 120_000;
const SMARTBOOK_STORAGE_URL_TIMEOUT_MS = 20_000;
const SMARTBOOK_BACKEND_TIMEOUT_MS = 45_000;
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
const FREE_STARTER_CREDITS: CreditWallet = {
  purchasedCredits: 3,
  communityEarnedCredits: 0,
  createCredits: 3
};
const DEFAULT_ACTION_CREDIT_COST: Record<CreditActionType, number> = { create: 1, community_download: 0.5 };
const autoPublishToCommunity = httpsCallable<
  { bookId: string; isPublic: true; autoPublish: true; rightsAccepted: true; termsAccepted: true; ageConfirmed: true },
  { communityBookId: string }
>(functions, 'publishToCommunity');
const CREDIT_PACKS: CreditPackOption[] = [
  { id: 'pack-5', createCredits: 10, priceUsd: 4.99 },
  { id: 'pack-15', createCredits: 25, priceUsd: 12.99 },
  { id: 'pack-30', createCredits: 50, priceUsd: 19.99 }
];

function FullScreenFallback({ message }: { message: string }) {
  return (
    <div className="fortale-loading-screen fixed inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <div className="fortale-loading-spinner-shell">
          <FaviconSpinner size={44} />
        </div>
        <p className="text-[12px] font-semibold text-white">{message}</p>
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

type NativeLibraryIndexPayload = {
  schemaVersion: number;
  updatedAt: string;
  courses: StoredCourse[];
};

type NativeCourseCoverCachePayload = {
  schemaVersion: number;
  courseId: string;
  sourceKey: string;
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

type RepairSmartBookCoverResponse = {
  success?: boolean;
  coverImageUrl?: string;
};

type LegalConsentState = 'unknown' | 'accepted';
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
const MARKDOWN_IMAGE_URL_CAPTURE_RE = /!\[[^\]]*]\(\s*<?([^)\s>]+)>?\s*\)/i;
const SMARTBOOK_IMAGE_OPTIMIZE_MAX_DIMENSION_PX = 1800;
const SMARTBOOK_IMAGE_JPEG_QUALITY = 0.9;
const SMARTBOOK_IMAGE_MIN_BYTES_FOR_OPTIMIZATION = 280 * 1024;
const SMARTBOOK_IMAGE_MIN_SAVINGS_RATIO = 0.97;

function blobToDataUrlInApp(blob: Blob): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function blobToBase64InApp(blob: Blob): Promise<string | null> {
  const dataUrl = await blobToDataUrlInApp(blob);
  const marker = 'base64,';
  const markerIndex = dataUrl?.indexOf(marker) ?? -1;
  return markerIndex >= 0 ? dataUrl!.slice(markerIndex + marker.length) : null;
}

function base64ToBlobInApp(base64: string, mimeType: string): Blob | null {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mimeType });
  } catch {
    return null;
  }
}

function isOptimizableSmartbookImageMimeType(mimeType: string): boolean {
  const normalized = String(mimeType || '').toLowerCase();
  return (
    normalized === 'image/jpeg' ||
    normalized === 'image/jpg' ||
    normalized === 'image/png' ||
    normalized === 'image/webp'
  );
}

function loadImageFromBlobInApp(blob: Blob): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || typeof URL === 'undefined') {
      resolve(null);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    image.src = objectUrl;
  });
}

async function optimizeImageBlobForSmartbook(blob: Blob): Promise<Blob> {
  if (typeof document === 'undefined') return blob;
  const sourceType = String(blob.type || '').split(';')[0].trim().toLowerCase();
  if (!isOptimizableSmartbookImageMimeType(sourceType)) return blob;

  const image = await loadImageFromBlobInApp(blob);
  if (!image) return blob;

  const sourceWidth = image.naturalWidth || image.width || 0;
  const sourceHeight = image.naturalHeight || image.height || 0;
  if (!sourceWidth || !sourceHeight) return blob;

  const longestEdge = Math.max(sourceWidth, sourceHeight);
  const shouldResize = longestEdge > SMARTBOOK_IMAGE_OPTIMIZE_MAX_DIMENSION_PX;
  const shouldReencode = shouldResize || blob.size >= SMARTBOOK_IMAGE_MIN_BYTES_FOR_OPTIMIZATION || sourceType !== 'image/jpeg';
  if (!shouldReencode) return blob;

  const scale = shouldResize ? SMARTBOOK_IMAGE_OPTIMIZE_MAX_DIMENSION_PX / longestEdge : 1;
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return blob;

  // Flatten to white background to preserve predictable output when source has alpha.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  const optimized = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), 'image/jpeg', SMARTBOOK_IMAGE_JPEG_QUALITY);
  });
  if (!optimized) return blob;

  if (!shouldResize && sourceType === 'image/jpeg' && optimized.size >= blob.size * SMARTBOOK_IMAGE_MIN_SAVINGS_RATIO) {
    return blob;
  }
  if (!shouldResize && optimized.size >= blob.size) {
    return blob;
  }
  return optimized;
}

async function optimizeDataImageUrlForSmartbook(dataUrl: string): Promise<string> {
  const normalized = String(dataUrl || '').trim();
  if (!DATA_IMAGE_URL_PREFIX_RE.test(normalized)) return normalized;
  try {
    const response = await fetch(normalized);
    if (!response.ok) return normalized;
    const blob = await response.blob();
    const optimizedBlob = await optimizeImageBlobForSmartbook(blob);
    const optimizedDataUrl = await blobToDataUrlInApp(optimizedBlob);
    return optimizedDataUrl || normalized;
  } catch {
    return normalized;
  }
}
const pendingLocalCourseWrites = new Map<string, CourseData[]>();
const localCourseWriteTimers = new Map<string, number>();
const localCourseCacheWarned = new Set<string>();
const localCourseCacheDisabledByQuota = new Set<string>();
const missingNativeFullCourseCachePaths = new Set<string>();
const missingNativeFullCourseCacheDirs = new Set<string>();
const missingNativeBookPackageCachePaths = new Set<string>();
const missingNativeBookPackageCacheDirs = new Set<string>();
const nativeInstalledCourseIdsByUid = new Map<string, Set<string>>();
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
const repairSmartBookCover = httpsCallable<{ bookId: string }, RepairSmartBookCoverResponse>(
  functions,
  'repairSmartBookCover',
  { timeout: 120_000 }
);
const deleteMyCommunityData = httpsCallable<Record<string, never>, { ok: boolean }>(functions, 'deleteMyCommunityData');

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
  const zipCandidates: string[] = [];
  for (const value of values) {
    const candidates = getBookPackagePathCandidates(value);
    for (const candidate of candidates) {
      if (!isBookZipStoragePath(candidate) || zipCandidates.includes(candidate)) continue;
      zipCandidates.push(candidate);
    }
  }
  if (zipCandidates.length === 0) return undefined;
  return zipCandidates.reduce((best, candidate) => {
    const bestVersion = extractBundleVersionFromPath(best);
    const candidateVersion = extractBundleVersionFromPath(candidate);
    return candidateVersion > bestVersion ? candidate : best;
  }, zipCandidates[0]);
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
  const packagePath = resolvePreferredBookZipStoragePath(course.contentPackagePath, course.bundle?.path) || '';
  const generatedAt = (
    course.contentPackageUpdatedAt instanceof Date &&
    !Number.isNaN(course.contentPackageUpdatedAt.getTime())
  )
    ? course.contentPackageUpdatedAt
    : now;
  const existingBundleVersion = Number.isFinite(course.bundle?.version)
    ? Math.max(1, Math.floor(Number(course.bundle?.version)))
    : undefined;
  const bundleVersion = extractBundleVersionFromPath(packagePath) || existingBundleVersion;
  const includesPodcast = Array.isArray(course.nodes)
    ? course.nodes.some((node) => Boolean(node.podcastAudioUrl?.trim()))
    : false;
  const includesVisualStoryAudio =
    Boolean(course.coverNarrationAudioUrl?.trim()) ||
    (Array.isArray(course.nodes)
      ? course.nodes.some((node) => Boolean(node.pageAudioUrl?.trim()))
      : false);
  const nextCover: Record<string, unknown> = {};
  if (typeof course.cover?.path === 'string' && course.cover.path.trim()) {
    nextCover.path = course.cover.path.trim();
  }
  const coverUrlCandidate = (typeof course.cover?.url === 'string' && course.cover.url.trim())
    ? course.cover.url.trim()
    : (typeof course.coverImageUrl === 'string' && course.coverImageUrl.trim())
      ? course.coverImageUrl.trim()
      : null;
  if (coverUrlCandidate && !DATA_IMAGE_URL_PREFIX_RE.test(coverUrlCandidate) && !coverUrlCandidate.startsWith('blob:')) {
    nextCover.url = coverUrlCandidate;
  }

  const bundle = packagePath
    ? {
      path: packagePath,
      version: bundleVersion,
      checksumSha256: typeof course.bundle?.checksumSha256 === 'string' ? course.bundle.checksumSha256 : undefined,
      sizeBytes: Number.isFinite(course.bundle?.sizeBytes) ? course.bundle?.sizeBytes : undefined,
      includesPodcast: course.bundle?.includesPodcast ?? (includesPodcast || includesVisualStoryAudio),
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
    visualStoryMode: course.visualStoryMode === true,
    visualStoryAudioStatus: course.visualStoryAudioStatus,
    coverNarrationText: course.coverNarrationText,
    coverNarrationAudioUrl: isAudioDataOrBlobUrl(course.coverNarrationAudioUrl) ? undefined : course.coverNarrationAudioUrl,
    coverNarrationAudioStoragePath: course.coverNarrationAudioStoragePath,
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

function getNativeCourseCoverCacheDir(uid: string): string {
  return `${NATIVE_COURSE_COVER_CACHE_DIR}/${getNativeFullCourseCacheSafeUid(uid)}`;
}

function getNativeCourseCoverCachePath(uid: string, courseId: string): string {
  return `${getNativeCourseCoverCacheDir(uid)}/${getNativeFullCourseCacheSafeCourseId(courseId)}.json`;
}

function getNativeCourseCoverImageFilePath(uid: string, courseId: string): string {
  return `${getNativeCourseCoverCacheDir(uid)}/${getNativeFullCourseCacheSafeCourseId(courseId)}.img`;
}

function getNativeBookPackageCacheDir(uid: string): string {
  return `${NATIVE_BOOK_PACKAGE_CACHE_DIR}/${getNativeFullCourseCacheSafeUid(uid)}`;
}

function getNativeBookPackageCourseCacheDir(uid: string, courseId: string): string {
  return `${getNativeBookPackageCacheDir(uid)}/${getNativeFullCourseCacheSafeCourseId(courseId)}`;
}

function getNativeBookPackageCachePath(uid: string, courseId: string, version: number): string {
  const safeVersion = Number.isFinite(version) ? Math.max(1, Math.floor(version)) : 1;
  return `${getNativeBookPackageCourseCacheDir(uid, courseId)}/v${safeVersion}/book.zip`;
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
  nativeInstalledCourseIdsByUid.delete(uid);

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

function getCourseCoverSourceUrl(course: CourseData | null | undefined): string | undefined {
  const coverUrl = typeof course?.coverImageUrl === 'string' ? course.coverImageUrl.trim() : '';
  if (coverUrl) return coverUrl;
  const descriptorUrl = typeof course?.cover?.url === 'string' ? course.cover.url.trim() : '';
  return descriptorUrl || undefined;
}

function getCourseCoverCacheSourceKey(course: CourseData | null | undefined): string | undefined {
  const coverPath = normalizeStorageObjectPath(course?.cover?.path);
  if (coverPath) return `path:${coverPath}`;

  const coverUrl = getCourseCoverSourceUrl(course);
  if (!coverUrl) return undefined;
  if (DATA_IMAGE_URL_PREFIX_RE.test(coverUrl)) return `data:${simpleStableHash(coverUrl)}`;
  if (isFirebaseStorageDownloadUrl(coverUrl)) {
    const objectPath = tryParseFirebaseStorageObjectPath(coverUrl);
    if (objectPath) return `path:${objectPath}`;
  }
  return `url:${coverUrl}`;
}

async function fetchCourseCoverAsDataUrl(course: CourseData): Promise<string | null> {
  const sourceUrl = getCourseCoverSourceUrl(course);
  if (!sourceUrl) return null;
  if (DATA_IMAGE_URL_PREFIX_RE.test(sourceUrl)) return sourceUrl;
  if (!/^https?:\/\//i.test(sourceUrl)) return null;

  const response = await fetch(sourceUrl, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Cover fetch failed (${response.status})`);
  const blob = await response.blob();
  const optimizedBlob = await optimizeImageBlobForSmartbook(blob);
  return blobToDataUrlInApp(optimizedBlob);
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

type BookBundleHydrationOptions = {
  localUserId?: string;
  versionHint?: number;
  persistAssets?: boolean;
};

type WebBookPackageRecord = {
  key: string;
  uid: string;
  courseId: string;
  version: number;
  packageUrl?: string;
  packagePath?: string;
  updatedAt: string;
  blob: Blob;
};

type WebBookCourseRecord = {
  key: string;
  uid: string;
  courseId: string;
  version: number;
  updatedAt: string;
  course: StoredCourse;
};

function normalizeBundleAssetPath(rawPath: string): string | undefined {
  const normalized = String(rawPath || '')
    .trim()
    .replace(/^\.?\//, '')
    .replace(/\\/g, '/');
  if (!normalized || normalized.includes('..') || normalized.startsWith('/')) return undefined;
  return normalized;
}

function getInstalledBookVersion(course: Pick<CourseData, 'bundle' | 'contentPackagePath'> | null | undefined): number {
  if (Number.isFinite(Number(course?.bundle?.version))) {
    return Math.max(1, Math.floor(Number(course?.bundle?.version)));
  }
  const pathVersion = extractBundleVersionFromPath(course?.contentPackagePath);
  return Math.max(1, pathVersion || 1);
}

function getNativeBookAssetCourseCacheDir(uid: string, courseId: string, version: number): string {
  const safeVersion = Number.isFinite(version) ? Math.max(1, Math.floor(version)) : 1;
  return `${NATIVE_BOOK_ASSET_CACHE_DIR}/${getNativeFullCourseCacheSafeUid(uid)}/${getNativeFullCourseCacheSafeCourseId(courseId)}/v${safeVersion}`;
}

function getNativeBookAssetCachePath(uid: string, courseId: string, version: number, assetPath: string): string {
  return `${getNativeBookAssetCourseCacheDir(uid, courseId, version)}/${assetPath}`;
}

function extractNativeBookAssetPath(
  uid: string,
  courseId: string,
  version: number,
  rawValue: unknown
): string | undefined {
  const raw = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!raw) return undefined;

  const directPath = normalizeBundleAssetPath(raw);
  if (directPath?.startsWith('assets/')) return directPath;

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Keep the original value when a URL contains malformed escapes.
  }

  const safeVersion = Number.isFinite(version) ? Math.max(1, Math.floor(version)) : 1;
  const marker = `/${NATIVE_BOOK_ASSET_CACHE_DIR}/${getNativeFullCourseCacheSafeUid(uid)}/${getNativeFullCourseCacheSafeCourseId(courseId)}/v${safeVersion}/`;
  const markerIndex = decoded.indexOf(marker);
  if (markerIndex < 0) return undefined;
  const assetPath = normalizeBundleAssetPath(decoded.slice(markerIndex + marker.length).split(/[?#]/, 1)[0]);
  return assetPath?.startsWith('assets/') ? assetPath : undefined;
}

function stabilizeNativeBookAssetUrl(
  uid: string,
  courseId: string,
  version: number,
  rawValue: unknown
): string | undefined {
  const assetPath = extractNativeBookAssetPath(uid, courseId, version, rawValue);
  if (assetPath) return assetPath;
  return typeof rawValue === 'string' && rawValue.trim() ? rawValue.trim() : undefined;
}

function stabilizeNativeMarkdownAssetUrls(
  uid: string,
  courseId: string,
  version: number,
  markdown: string | undefined
): string | undefined {
  if (typeof markdown !== 'string' || !markdown.trim()) return markdown;
  return markdown.replace(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?\s*\)/g, (full, alt: string, source: string) => {
    const assetPath = extractNativeBookAssetPath(uid, courseId, version, source);
    return assetPath ? `![${alt}](${assetPath})` : full;
  });
}

function toNativeStoredCourse(uid: string, course: CourseData): StoredCourse {
  const version = resolveNativeCourseCacheVersion(course);
  const stored = toStoredCourse(course);
  const stableCoverImageUrl = stabilizeNativeBookAssetUrl(uid, course.id, version, stored.coverImageUrl);
  return {
    ...stored,
    coverImageUrl: stableCoverImageUrl,
    coverNarrationAudioUrl: stabilizeNativeBookAssetUrl(uid, course.id, version, stored.coverNarrationAudioUrl),
    cover: stored.cover
      ? {
        ...stored.cover,
        url: stabilizeNativeBookAssetUrl(uid, course.id, version, stored.cover.url) || stableCoverImageUrl
      }
      : stored.cover,
    nodes: stored.nodes.map((node) => ({
      ...node,
      content: stabilizeNativeMarkdownAssetUrls(uid, course.id, version, node.content),
      podcastAudioUrl: stabilizeNativeBookAssetUrl(uid, course.id, version, node.podcastAudioUrl),
      pageImageUrl: stabilizeNativeBookAssetUrl(uid, course.id, version, node.pageImageUrl),
      pageAudioUrl: stabilizeNativeBookAssetUrl(uid, course.id, version, node.pageAudioUrl)
    }))
  };
}

async function resolveNativeInstalledAssetUrl(
  uid: string,
  courseId: string,
  version: number,
  rawValue: unknown
): Promise<{ url?: string; local: boolean; valid: boolean }> {
  const raw = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!raw) return { local: false, valid: true };
  const assetPath = extractNativeBookAssetPath(uid, courseId, version, raw);
  if (!assetPath) return { url: raw, local: false, valid: false };
  const filePath = getNativeBookAssetCachePath(uid, courseId, version, assetPath);
  try {
    const stat = await Filesystem.stat({ path: filePath, directory: Directory.Data });
    if (stat.type === 'directory' || Number(stat.size || 0) <= 0) {
      return { local: true, valid: false };
    }
    const uriResult = await Filesystem.getUri({ path: filePath, directory: Directory.Data });
    return {
      url: Capacitor.convertFileSrc(uriResult.uri),
      local: true,
      valid: true
    };
  } catch {
    return { local: true, valid: false };
  }
}

async function materializeNativeInstalledCourseAssets(
  uid: string,
  course: CourseData,
  versionHint?: number
): Promise<CourseData | null> {
  if (!isCapacitorNativeRuntime()) return course;
  const version = Number.isFinite(versionHint)
    ? Math.max(1, Math.floor(Number(versionHint)))
    : resolveNativeCourseCacheVersion(course);

  const coverImage = await resolveNativeInstalledAssetUrl(uid, course.id, version, course.coverImageUrl);
  const coverAudio = await resolveNativeInstalledAssetUrl(uid, course.id, version, course.coverNarrationAudioUrl);
  if (!coverImage.valid || !coverAudio.valid) return null;

  let invalidAsset = false;
  const nodes = await Promise.all((course.nodes || []).map(async (node) => {
    const [podcastAudio, pageImage, pageAudio] = await Promise.all([
      resolveNativeInstalledAssetUrl(uid, course.id, version, node.podcastAudioUrl),
      resolveNativeInstalledAssetUrl(uid, course.id, version, node.pageImageUrl),
      resolveNativeInstalledAssetUrl(uid, course.id, version, node.pageAudioUrl)
    ]);
    if (!podcastAudio.valid || !pageImage.valid || !pageAudio.valid) invalidAsset = true;

    let content = node.content;
    if (typeof content === 'string' && content.trim()) {
      const imageRegex = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?\s*\)/g;
      let output = '';
      let cursor = 0;
      let match: RegExpExecArray | null = imageRegex.exec(content);
      while (match) {
        const resolved = await resolveNativeInstalledAssetUrl(uid, course.id, version, match[2]);
        if (!resolved.valid || !resolved.url) {
          invalidAsset = true;
        } else {
          output += content.slice(cursor, match.index) + `![${match[1] || ''}](${resolved.url})`;
          cursor = match.index + match[0].length;
        }
        match = imageRegex.exec(content);
      }
      if (cursor > 0) content = `${output}${content.slice(cursor)}`;
    }

    return {
      ...node,
      content,
      podcastAudioUrl: podcastAudio.url,
      pageImageUrl: pageImage.url,
      pageAudioUrl: pageAudio.url
    };
  }));

  const lectureNodes = nodes.filter((node) => node.type === 'lecture');
  if (course.visualStoryMode === true) {
    if (!coverImage.url || lectureNodes.length === 0 || lectureNodes.some((node) => !node.pageImageUrl)) {
      invalidAsset = true;
    }
    if (course.visualStoryAudioStatus === 'ready') {
      if (!coverAudio.url || lectureNodes.some((node) => !node.pageAudioUrl)) invalidAsset = true;
    }
  }
  if (invalidAsset) return null;

  return {
    ...course,
    coverImageUrl: coverImage.url,
    coverNarrationAudioUrl: coverAudio.url,
    cover: course.cover
      ? { ...course.cover, url: coverImage.url || course.cover.url }
      : course.cover,
    nodes
  };
}

async function writeBundleAssetToNativeCache(
  uid: string,
  courseId: string,
  version: number,
  assetPath: string,
  blob: Blob
): Promise<string | undefined> {
  if (!isCapacitorNativeRuntime()) return undefined;
  const normalizedPath = normalizeBundleAssetPath(assetPath);
  if (!normalizedPath) return undefined;
  const base64 = await blobToBase64InApp(blob);
  if (!base64) return undefined;
  const filePath = getNativeBookAssetCachePath(uid, courseId, version, normalizedPath);
  await Filesystem.writeFile({
    path: filePath,
    data: base64,
    directory: Directory.Data,
    recursive: true
  });
  const uriResult = await Filesystem.getUri({ path: filePath, directory: Directory.Data });
  return Capacitor.convertFileSrc(uriResult.uri);
}

function getWebBookCacheKey(uid: string, courseId: string, version: number): string {
  const safeVersion = Number.isFinite(version) ? Math.max(1, Math.floor(version)) : 1;
  return `${uid}:${courseId}:v${safeVersion}`;
}

function openWebBookPackageDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(WEB_BOOK_PACKAGE_DB_NAME, WEB_BOOK_PACKAGE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WEB_BOOK_PACKAGE_STORE)) {
        const packageStore = db.createObjectStore(WEB_BOOK_PACKAGE_STORE, { keyPath: 'key' });
        packageStore.createIndex('uid', 'uid', { unique: false });
      }
      if (!db.objectStoreNames.contains(WEB_BOOK_COURSE_STORE)) {
        const courseStore = db.createObjectStore(WEB_BOOK_COURSE_STORE, { keyPath: 'key' });
        courseStore.createIndex('uid', 'uid', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function runWebBookStoreOperation<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T> | T
): Promise<T | null> {
  return new Promise((resolve) => {
    void openWebBookPackageDb().then((db) => {
      if (!db) {
        resolve(null);
        return;
      }
      try {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const result = operation(store);
        if (result && typeof (result as IDBRequest<T>).onsuccess !== 'undefined') {
          const request = result as IDBRequest<T>;
          request.onsuccess = () => resolve(request.result ?? null);
          request.onerror = () => resolve(null);
          return;
        }
        transaction.oncomplete = () => resolve(result as T);
        transaction.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  });
}

async function writeBookPackageToWebCache(
  uid: string,
  courseId: string,
  version: number,
  blob: Blob,
  course: CourseData,
  packageUrl?: string,
  packagePath?: string
): Promise<void> {
  if (isCapacitorNativeRuntime() || !uid || !courseId) return;
  const key = getWebBookCacheKey(uid, courseId, version);
  const updatedAt = new Date().toISOString();
  await runWebBookStoreOperation<IDBValidKey>(WEB_BOOK_PACKAGE_STORE, 'readwrite', (store) =>
    store.put({
      key,
      uid,
      courseId,
      version,
      packageUrl,
      packagePath,
      updatedAt,
      blob
    } satisfies WebBookPackageRecord)
  );
  await runWebBookStoreOperation<IDBValidKey>(WEB_BOOK_COURSE_STORE, 'readwrite', (store) =>
    store.put({
      key,
      uid,
      courseId,
      version,
      updatedAt,
      course: toStoredCourse(course)
    } satisfies WebBookCourseRecord)
  );
}

async function readBookPackageFromWebCache(uid: string, courseId: string, versionHint?: number): Promise<WebBookPackageRecord | null> {
  if (isCapacitorNativeRuntime() || !uid || !courseId) return null;
  const hintedVersion = Number.isFinite(versionHint) ? Math.max(1, Math.floor(Number(versionHint))) : undefined;
  if (hintedVersion) {
    const hinted = await runWebBookStoreOperation<WebBookPackageRecord>(
      WEB_BOOK_PACKAGE_STORE,
      'readonly',
      (store) => store.get(getWebBookCacheKey(uid, courseId, hintedVersion))
    );
    if (hinted?.blob) return hinted;
  }
  const records = await runWebBookStoreOperation<WebBookPackageRecord[]>(
    WEB_BOOK_PACKAGE_STORE,
    'readonly',
    (store) => store.index('uid').getAll(uid)
  );
  const matches = (records || [])
    .filter((record) => record.courseId === courseId && record.blob)
    .sort((left, right) => right.version - left.version);
  return matches[0] || null;
}

async function readInstalledCoursesFromWebCache(uid: string): Promise<CourseData[]> {
  if (isCapacitorNativeRuntime() || !uid) return [];
  const records = await runWebBookStoreOperation<WebBookPackageRecord[]>(
    WEB_BOOK_PACKAGE_STORE,
    'readonly',
    (store) => store.index('uid').getAll(uid)
  );
  const latestByCourseId = new Map<string, WebBookPackageRecord>();
  for (const record of records || []) {
    const existing = latestByCourseId.get(record.courseId);
    if (!existing || record.version > existing.version) {
      latestByCourseId.set(record.courseId, record);
    }
  }
  const courses: CourseData[] = [];
  for (const record of latestByCourseId.values()) {
    try {
      const course = await hydrateCourseFromBundleBlob(
        record.courseId,
        record.blob,
        record.packageUrl,
        record.packagePath,
        { localUserId: uid, versionHint: record.version, persistAssets: true }
      );
      if (course && hasPersistableCourseContent(course)) {
        courses.push(course);
      }
    } catch (error) {
      console.warn('Web installed book cache read failed:', error);
    }
  }
  return courses;
}

async function hydrateCourseFromBundleBlob(
  courseId: string,
  bundleBlob: Blob,
  urlOverride?: string,
  pathOverride?: string,
  options?: BookBundleHydrationOptions
): Promise<CourseData | null> {
  const zip = await JSZip.loadAsync(await bundleBlob.arrayBuffer());
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) return null;

  const manifestRaw = JSON.parse(await manifestFile.async('string')) as Record<string, unknown>;
  const assetUrlCache = new Map<string, string>();
  const packageVersion = Number.isFinite(options?.versionHint)
    ? Math.max(1, Math.floor(Number(options?.versionHint)))
    : (extractBundleVersionFromPath(pathOverride) || 1);
  const localUserId = String(options?.localUserId || '').trim();
  const shouldPersistAssets = options?.persistAssets === true && Boolean(localUserId);

  const resolveAssetUrl = async (rawPath: string, kind: 'image' | 'audio'): Promise<string | undefined> => {
    const normalizedPath = normalizeBundleAssetPath(rawPath);
    if (!normalizedPath) return undefined;
    const cacheKey = `${kind}:${normalizedPath}`;
    const cached = assetUrlCache.get(cacheKey);
    if (cached) return cached;
    const assetFile = zip.file(normalizedPath);
    if (!assetFile) return undefined;
    const mimeType = inferMimeTypeFromAssetPath(normalizedPath);
    const blob = await assetFile.async('blob');
    const typedBlob = (blob.type || '').trim()
      ? blob
      : new Blob([blob], { type: mimeType });

    if (shouldPersistAssets && isCapacitorNativeRuntime()) {
      try {
        const localUrl = await writeBundleAssetToNativeCache(
          localUserId,
          courseId,
          packageVersion,
          normalizedPath,
          typedBlob
        );
        if (localUrl) {
          assetUrlCache.set(cacheKey, localUrl);
          return localUrl;
        }
      } catch {
        console.warn('Native book asset write failed:', error);
      }
      return undefined;
    }

    if (shouldPersistAssets && typeof URL !== 'undefined') {
      const objectUrl = URL.createObjectURL(typedBlob);
      assetUrlCache.set(cacheKey, objectUrl);
      return objectUrl;
    }

    if (kind === 'audio' && typeof URL !== 'undefined') {
      const objectUrl = URL.createObjectURL(typedBlob);
      assetUrlCache.set(cacheKey, objectUrl);
      return objectUrl;
    }

    const optimizedBlob = kind === 'image'
      ? await optimizeImageBlobForSmartbook(typedBlob)
      : typedBlob;
    const dataUrl = await blobToDataUrlInApp(optimizedBlob);
    if (!dataUrl) return undefined;
    assetUrlCache.set(cacheKey, dataUrl);
    return dataUrl;
  };

  const resolveBundledAssetPath = (rawPath: string): string | undefined => {
    const normalizedPath = normalizeBundleAssetPath(rawPath);
    if (!normalizedPath) return undefined;
    const assetFile = zip.file(normalizedPath);
    if (!assetFile) return undefined;
    return normalizedPath;
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
        const assetUrl = await resolveAssetUrl(source, 'image');
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
      const pageImageUrlRaw = typeof node.pageImageUrl === 'string' ? node.pageImageUrl : undefined;
      const pageAudioUrlRaw = typeof node.pageAudioUrl === 'string' ? node.pageAudioUrl : undefined;
      const resolvedPodcastAudioUrl = (
        podcastAudioUrlRaw &&
        !/^https?:\/\//i.test(podcastAudioUrlRaw) &&
        !/^data:/i.test(podcastAudioUrlRaw) &&
        !podcastAudioUrlRaw.startsWith('blob:')
      )
        ? (await resolveAssetUrl(podcastAudioUrlRaw, 'audio') || resolveBundledAssetPath(podcastAudioUrlRaw))
        : podcastAudioUrlRaw;
      const resolvedPageImageUrl = (
        pageImageUrlRaw &&
        !/^https?:\/\//i.test(pageImageUrlRaw) &&
        !/^data:/i.test(pageImageUrlRaw) &&
        !pageImageUrlRaw.startsWith('blob:')
      )
        ? await resolveAssetUrl(pageImageUrlRaw, 'image')
        : pageImageUrlRaw;
      const resolvedPageAudioUrl = (
        pageAudioUrlRaw &&
        !/^https?:\/\//i.test(pageAudioUrlRaw) &&
        !/^data:/i.test(pageAudioUrlRaw) &&
        !pageAudioUrlRaw.startsWith('blob:')
      )
        ? (await resolveAssetUrl(pageAudioUrlRaw, 'audio') || resolveBundledAssetPath(pageAudioUrlRaw) || pageAudioUrlRaw)
        : pageAudioUrlRaw;
      return {
        id: typeof node.id === 'string' ? node.id : `node-${index + 1}`,
        title: typeof node.title === 'string' ? node.title : '',
        description: typeof node.description === 'string' ? node.description : '',
        type: node.type,
        status: node.status,
        duration: typeof node.duration === 'string' ? node.duration : undefined,
        content: normalizeMarkdownNarrativeLayout(
          await rewriteMarkdownImageUrls(typeof node.content === 'string' ? node.content : undefined) || ''
        ) || undefined,
        podcastScript: typeof node.podcastScript === 'string' ? node.podcastScript : undefined,
        podcastAudioUrl: resolvedPodcastAudioUrl,
        pageText: typeof node.pageText === 'string' ? node.pageText : undefined,
        pageImageUrl: resolvedPageImageUrl,
        pageAudioUrl: resolvedPageAudioUrl,
        pageAudioStatus: typeof node.pageAudioStatus === 'string' ? node.pageAudioStatus as TimelineNode['pageAudioStatus'] : undefined,
        pageAudioStoragePath: typeof node.pageAudioStoragePath === 'string' ? node.pageAudioStoragePath : undefined,
        pageSequence: Number.isFinite(Number(node.pageSequence)) ? Math.max(1, Math.floor(Number(node.pageSequence))) : undefined,
        questions: Array.isArray(node.questions) ? node.questions : undefined
      } as TimelineNode;
    }))
    : [];

  const rawCover = (manifestRaw.cover && typeof manifestRaw.cover === 'object')
    ? manifestRaw.cover as Record<string, unknown>
    : null;
  const coverPath = typeof rawCover?.path === 'string' ? rawCover.path : undefined;
  const coverImageUrl = coverPath ? await resolveAssetUrl(coverPath, 'image') : undefined;
  const coverNarrationAudioRaw = typeof manifestRaw.coverNarrationAudioUrl === 'string'
    ? manifestRaw.coverNarrationAudioUrl
    : undefined;
  const coverNarrationAudioUrl = (
    coverNarrationAudioRaw &&
    !/^https?:\/\//i.test(coverNarrationAudioRaw) &&
    !/^data:/i.test(coverNarrationAudioRaw) &&
    !coverNarrationAudioRaw.startsWith('blob:')
  )
    ? (await resolveAssetUrl(coverNarrationAudioRaw, 'audio') || resolveBundledAssetPath(coverNarrationAudioRaw) || coverNarrationAudioRaw)
    : coverNarrationAudioRaw;

  const materializedRawCourse: Record<string, unknown> = {
    ...manifestRaw,
    id: typeof manifestRaw.id === 'string' ? manifestRaw.id : courseId,
    topic: resolveCourseTopic(manifestRaw.topic, manifestRaw.title, manifestRaw.bookTitle),
    coverImageUrl,
    visualStoryMode: manifestRaw.visualStoryMode === true,
    visualStoryAudioStatus: typeof manifestRaw.visualStoryAudioStatus === 'string' ? manifestRaw.visualStoryAudioStatus : undefined,
    coverNarrationText: typeof manifestRaw.coverNarrationText === 'string' ? manifestRaw.coverNarrationText : undefined,
    coverNarrationAudioUrl,
    coverNarrationAudioStoragePath: typeof manifestRaw.coverNarrationAudioStoragePath === 'string' ? manifestRaw.coverNarrationAudioStoragePath : undefined,
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

function isAudioDataOrBlobUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  return url.startsWith('data:') || url.startsWith('blob:');
}

function isTransientBlobUrl(url: unknown): boolean {
  return typeof url === 'string' && url.startsWith('blob:');
}

function sanitizeNodeForLocalStorage(node: TimelineNode): TimelineNode {
  const nextNode: TimelineNode = { ...node };

  if (typeof nextNode.content === 'string') {
    nextNode.content = stripEmbeddedDataImagesFromMarkdown(nextNode.content)
      .replace(/!\[[^\]]*]\(\s*blob:[^)]+\)\s*/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  if (isTransientBlobUrl(nextNode.pageImageUrl)) {
    nextNode.pageImageUrl = undefined;
  }

  // Audio data/blob URLs are too large to persist (can be hundreds of MB in aggregate).
  // They are re-loaded from Firebase Storage or the ZIP bundle on next book open.
  if (isAudioDataOrBlobUrl(nextNode.pageAudioUrl)) {
    nextNode.pageAudioUrl = undefined;
  }
  if (isAudioDataOrBlobUrl(nextNode.podcastAudioUrl)) {
    nextNode.podcastAudioUrl = undefined;
  }

  return nextNode;
}

function hasRichNodeContent(node: TimelineNode | null | undefined): boolean {
  if (!node) return false;
  return (
    (typeof node.content === 'string' && node.content.trim().length > 0) ||
    (typeof node.podcastScript === 'string' && node.podcastScript.trim().length > 0) ||
    (typeof node.podcastAudioUrl === 'string' && node.podcastAudioUrl.trim().length > 0) ||
    (typeof node.pageText === 'string' && node.pageText.trim().length > 0) ||
    (typeof node.pageImageUrl === 'string' && node.pageImageUrl.trim().length > 0) ||
    (typeof node.pageAudioUrl === 'string' && node.pageAudioUrl.trim().length > 0) ||
    (Array.isArray(node.questions) && node.questions.length > 0)
  );
}

function hasCompleteLectureContent(course: CourseData | null | undefined): boolean {
  if (!course || !Array.isArray(course.nodes) || course.nodes.length === 0) return false;
  const lectureNodes = course.nodes.filter((node) => node.type === 'lecture');
  if (lectureNodes.length === 0) {
    return course.nodes.some((node) => hasRichNodeContent(node));
  }
  if (course.visualStoryMode === true) {
    return lectureNodes.every((node) => Boolean(node.pageImageUrl?.trim()) && Boolean(node.pageText?.trim()));
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
  if (course.visualStoryMode === true) {
    return lectureNodes.some((node) => !node.pageImageUrl?.trim() || !node.pageText?.trim());
  }
  return lectureNodes.some((node) => !(typeof node.content === 'string' && node.content.trim().length > 0));
}

function hasMissingNarrativeImagesForHydration(course: CourseData | null | undefined): boolean {
  if (!course || !Array.isArray(course.nodes) || course.nodes.length === 0) return false;
  const isNarrative =
    course.bookType === 'fairy_tale' ||
    course.bookType === 'story' ||
    course.bookType === 'novel';
  if (!isNarrative) return false;

  const hasBundleSource =
    Boolean(String(course.contentPackagePath || '').trim()) ||
    Boolean(String(course.contentPackageUrl || '').trim()) ||
    Boolean(String(course.bundle?.path || '').trim());
  if (!hasBundleSource) return false;

  // Visual-story books store images on `pageImageUrl`, not in markdown `content`.
  if (course.visualStoryMode === true) {
    return false;
  }

  const lectureNodes = course.nodes.filter((node) => node.type === 'lecture');
  if (
    lectureNodes.length > 0 &&
    lectureNodes.every((node) => String(node.pageImageUrl || '').trim().length > 0)
  ) {
    return false;
  }

  const lectureBodies = course.nodes
    .filter((node) => node.type === 'lecture' && typeof node.content === 'string' && node.content.trim().length > 0)
    .map((node) => String(node.content || ''));
  if (!lectureBodies.length) return false;

  const hasBundledRelativeImageReference = lectureBodies.some((body) => {
    const markdownImageRe = /!\[[^\]]*]\(\s*<?([^)\s>]+)>?\s*\)/gi;
    const htmlImageRe = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;
    const isBundledRelativeSource = (value: string | undefined): boolean => {
      const source = String(value || '').trim();
      return Boolean(
        source &&
        !/^data:/i.test(source) &&
        !/^https?:\/\//i.test(source) &&
        !source.startsWith('blob:') &&
        !/^(\/|\.{1,2}\/)/.test(source)
      );
    };

    let match: RegExpExecArray | null = markdownImageRe.exec(body);
    while (match) {
      if (isBundledRelativeSource(match[1])) return true;
      match = markdownImageRe.exec(body);
    }

    match = htmlImageRe.exec(body);
    while (match) {
      if (isBundledRelativeSource(match[1] || match[2] || match[3])) return true;
      match = htmlImageRe.exec(body);
    }

    return false;
  });
  if (hasBundledRelativeImageReference) return true;

  const hasAnyImageMarkup = lectureBodies.some((body) => /!\[[^\]]*]\([^)]+\)|<img\b/i.test(body));
  return !hasAnyImageMarkup;
}

function isFairyTaleCourse(course: Pick<CourseData, 'bookType'> | null | undefined): boolean {
  return course?.bookType === 'fairy_tale';
}

function resolveFirstGeneratedImageAsFairyTaleCover(
  course: Pick<CourseData, 'bookType' | 'nodes'> | null | undefined
): string | undefined {
  if (!isFairyTaleCourse(course) || !Array.isArray(course?.nodes)) return undefined;

  const orderedNodes = [...course.nodes].sort((a, b) => {
    const aSeq = Number.isFinite(Number(a.pageSequence)) ? Number(a.pageSequence) : Number.MAX_SAFE_INTEGER;
    const bSeq = Number.isFinite(Number(b.pageSequence)) ? Number(b.pageSequence) : Number.MAX_SAFE_INTEGER;
    return aSeq - bSeq;
  });

  for (const node of orderedNodes) {
    const pageImageUrl = typeof node.pageImageUrl === 'string' ? node.pageImageUrl.trim() : '';
    if (pageImageUrl) return pageImageUrl;

    const content = typeof node.content === 'string' ? node.content : '';
    const markdownImageUrl = content.match(MARKDOWN_IMAGE_URL_CAPTURE_RE)?.[1]?.trim();
    if (markdownImageUrl) return markdownImageUrl;
  }

  return undefined;
}

function courseNeedsHydration(course: CourseData | null | undefined): boolean {
  return (
    isCourseProgressOnly(course) ||
    !course?.coverImageUrl ||
    courseNeedsFullContentRepair(course) ||
    hasMissingPrimaryNodeContent(course) ||
    hasMissingNarrativeImagesForHydration(course) ||
    courseNeedsPersistentAssetRepair(course)
  );
}

function courseNeedsContentHydration(course: CourseData | null | undefined): boolean {
  return (
    isCourseProgressOnly(course) ||
    courseNeedsFullContentRepair(course) ||
    hasMissingPrimaryNodeContent(course) ||
    hasMissingNarrativeImagesForHydration(course) ||
    courseNeedsPersistentAssetRepair(course)
  );
}

function courseNeedsStartupCloudRefresh(course: CourseData | null | undefined): boolean {
  if (!course) return true;
  const normalizedStatus = normalizeCourseStatus(course.status);
  if (normalizedStatus === 'processing') return true;
  if (isPlaceholderCourseTopic(course.topic)) return true;
  if (!course.contentPackagePath && !course.contentPackageUrl && !course.bundle?.path && courseNeedsContentHydration(course)) {
    return true;
  }
  return false;
}

function visualStoryNeedsAudioHydration(course: CourseData | null | undefined): boolean {
  if (!course || course.visualStoryMode !== true) return false;
  const hasAudioSignal =
    course.visualStoryAudioStatus === 'ready' ||
    course.visualStoryAudioStatus === 'partial' ||
    course.bundle?.includesPodcast === true ||
    (course.nodes || []).some((node) => String(node.pageAudioStoragePath || '').trim()) ||
    Boolean(String(course.coverNarrationAudioStoragePath || '').trim());
  if (!hasAudioSignal) return false;
  const lectureNodes = (course.nodes || []).filter((node) => node.type === 'lecture' && Boolean(node.pageImageUrl?.trim()));
  if (lectureNodes.length === 0) return false;
  return lectureNodes.some((node) => !node.pageAudioUrl?.trim());
}

function getPackagePathFromUrl(url: unknown): string | undefined {
  const normalizedUrl = typeof url === 'string' ? url.trim() : '';
  if (!normalizedUrl || !isFirebaseStorageDownloadUrl(normalizedUrl)) return undefined;
  return tryParseFirebaseStorageObjectPath(normalizedUrl) || undefined;
}

function mergeCoursePackageMetadata(localCourse: CourseData, cloudCourse: CourseData): CourseData {
  const preferredPath = resolvePreferredBookZipStoragePath(
    localCourse.contentPackagePath,
    cloudCourse.contentPackagePath,
    localCourse.bundle?.path,
    cloudCourse.bundle?.path
  );
  const pickUrlForPath = (path: string | undefined): string | undefined => {
    if (!path) return localCourse.contentPackageUrl || cloudCourse.contentPackageUrl;
    const candidates = [cloudCourse, localCourse];
    for (const candidate of candidates) {
      const candidatePath = normalizeStorageObjectPath(candidate.contentPackagePath);
      const candidateUrlPath = getPackagePathFromUrl(candidate.contentPackageUrl);
      if ((candidatePath === path || candidateUrlPath === path) && candidate.contentPackageUrl) {
        return candidate.contentPackageUrl;
      }
    }
    return localCourse.contentPackageUrl || cloudCourse.contentPackageUrl;
  };
  const bundleForPreferredPath =
    (normalizeStorageObjectPath(cloudCourse.bundle?.path) === preferredPath ? cloudCourse.bundle : undefined) ||
    (normalizeStorageObjectPath(localCourse.bundle?.path) === preferredPath ? localCourse.bundle : undefined) ||
    cloudCourse.bundle ||
    localCourse.bundle;
  const preferredVersion = preferredPath ? extractBundleVersionFromPath(preferredPath) : undefined;
  const mergedBundle = preferredPath
    ? {
      ...bundleForPreferredPath,
      path: preferredPath,
      version: preferredVersion || bundleForPreferredPath?.version || 1,
      includesPodcast: Boolean(
        bundleForPreferredPath?.includesPodcast ||
        cloudCourse.bundle?.includesPodcast ||
        localCourse.bundle?.includesPodcast
      ),
      generatedAt:
        bundleForPreferredPath?.generatedAt ||
        cloudCourse.contentPackageUpdatedAt ||
        localCourse.contentPackageUpdatedAt ||
        new Date()
    }
    : (localCourse.bundle || cloudCourse.bundle);

  return {
    ...localCourse,
    userId: localCourse.userId || cloudCourse.userId,
    visualStoryMode: localCourse.visualStoryMode === true || cloudCourse.visualStoryMode === true,
    visualStoryAudioStatus: cloudCourse.visualStoryAudioStatus || localCourse.visualStoryAudioStatus,
    coverNarrationText: cloudCourse.coverNarrationText || localCourse.coverNarrationText,
    coverNarrationAudioUrl: cloudCourse.coverNarrationAudioUrl || localCourse.coverNarrationAudioUrl,
    coverNarrationAudioStoragePath: cloudCourse.coverNarrationAudioStoragePath || localCourse.coverNarrationAudioStoragePath,
    coverImageUrl: localCourse.coverImageUrl || cloudCourse.coverImageUrl,
    contentPackagePath: preferredPath || localCourse.contentPackagePath || cloudCourse.contentPackagePath,
    contentPackageUrl: pickUrlForPath(preferredPath),
    contentPackageUpdatedAt: cloudCourse.contentPackageUpdatedAt || localCourse.contentPackageUpdatedAt,
    bundle: mergedBundle,
    cover: localCourse.cover || cloudCourse.cover,
    status: normalizeCourseStatus(localCourse.status) || normalizeCourseStatus(cloudCourse.status)
  };
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
    deviceCoverImageUrl: undefined,
    coverImageUrl:
      typeof course.coverImageUrl === 'string' &&
      (DATA_IMAGE_URL_PREFIX_RE.test(course.coverImageUrl) || isTransientBlobUrl(course.coverImageUrl))
        ? undefined
        : course.coverImageUrl,
    // Cover narration audio data/blob URLs are too large to persist.
    coverNarrationAudioUrl: isAudioDataOrBlobUrl(course.coverNarrationAudioUrl)
      ? undefined
      : course.coverNarrationAudioUrl,
    nodes: Array.isArray(course.nodes) ? course.nodes.map(sanitizeNodeForLocalStorage) : [],
    createdAt: course.createdAt.toISOString(),
    lastActivity: course.lastActivity.toISOString()
  };
}

function toStoragePackageCourse(course: CourseData): StoredCourse {
  return {
    ...course,
    deviceCoverImageUrl: undefined,
    nodes: Array.isArray(course.nodes) ? course.nodes.map((node) => ({ ...node })) : [],
    createdAt: course.createdAt.toISOString(),
    lastActivity: course.lastActivity.toISOString()
  };
}

function toCompactStoredCourse(course: CourseData): StoredCourse {
  return {
    ...course,
    deviceCoverImageUrl: undefined,
    coverImageUrl:
      typeof course.coverImageUrl === 'string' &&
      (DATA_IMAGE_URL_PREFIX_RE.test(course.coverImageUrl) || isTransientBlobUrl(course.coverImageUrl))
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
    deviceCoverImageUrl: undefined,
    description: undefined,
    language: course.language,
    ageGroup: course.ageGroup,
    category: course.category,
    searchTags: Array.isArray(course.searchTags)
      ? course.searchTags.filter((tag) => typeof tag === 'string').slice(0, 24)
      : undefined,
    totalDuration: course.totalDuration,
    coverImageUrl:
      typeof course.coverImageUrl === 'string' &&
      (DATA_IMAGE_URL_PREFIX_RE.test(course.coverImageUrl) || isTransientBlobUrl(course.coverImageUrl))
        ? undefined
        : course.coverImageUrl,
    nodes: Array.isArray(course.nodes) ? course.nodes.map(toQuotaSafeStoredNode) : [],
    createdAt: course.createdAt.toISOString(),
    lastActivity: course.lastActivity.toISOString()
  };
}

function writeFullCoursesToLocal(uid: string, courses: CourseData[]): void {
  const storageKey = getLocalFullCoursesKey(uid);
  if (isCapacitorNativeRuntime()) {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Native iOS/Android keeps full downloaded books in Filesystem-backed storage.
    }
    return;
  }
  if (localCourseCacheDisabledByQuota.has(uid)) {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore cleanup failures.
    }
    return;
  }
  const candidates = sortCoursesByLastActivity(courses)
    .filter((course) => hasPersistableCourseContent(course))
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

  console.warn('Full book local cache skipped (storage quota exceeded). Compact book list cache continues.');

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

function getNativeLibraryIndexPath(uid: string): string {
  return `${getNativeFullCourseCacheDir(uid)}/library-index.json`;
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
  return getInstalledBookVersion(course);
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
  const normalizedPageText = typeof node.pageText === 'string'
    ? node.pageText.trim()
    : '';
  const normalizedPageImageUrl = typeof node.pageImageUrl === 'string'
    ? node.pageImageUrl.trim()
    : '';
  const normalizedPageAudioUrl = typeof node.pageAudioUrl === 'string'
    ? node.pageAudioUrl.trim()
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
    normalizedPageText ? simpleStableHash(normalizedPageText) : '',
    normalizedPageImageUrl ? simpleStableHash(normalizedPageImageUrl) : '',
    normalizedPageAudioUrl ? simpleStableHash(normalizedPageAudioUrl) : '',
    node.pageAudioStatus || '',
    Number.isFinite(Number(node.pageSequence)) ? String(node.pageSequence) : '',
    String(questionCount)
  ].join(':');
}

function getNativeFullCourseCacheRevision(course: CourseData): string {
  const normalizedCover = (
    typeof course.coverImageUrl === 'string' &&
    !DATA_IMAGE_URL_PREFIX_RE.test(course.coverImageUrl) &&
    !isTransientBlobUrl(course.coverImageUrl)
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

function isPersistentLocalAssetUrl(value: unknown): boolean {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return Boolean(
    normalized &&
    (
      DATA_IMAGE_URL_PREFIX_RE.test(normalized) ||
      /^data:audio\//i.test(normalized) ||
      /^file:\/\//i.test(normalized) ||
      /^capacitor:\/\//i.test(normalized)
    )
  );
}

function isRemoteOrUnresolvedAssetUrl(value: unknown): boolean {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return true;
  if (isPersistentLocalAssetUrl(normalized)) return false;
  if (DATA_IMAGE_URL_PREFIX_RE.test(normalized)) return false;
  return true;
}

function courseNeedsPersistentAssetRepair(course: CourseData | null | undefined): boolean {
  if (!isCapacitorNativeRuntime()) return false;
  if (!course) return true;
  if (course.visualStoryMode === true) {
    if (isRemoteOrUnresolvedAssetUrl(course.coverImageUrl)) return true;
    // Audio is NOT checked here: it lives in the ZIP bundle and is loaded on book open.
    // If audio was never generated, absence is valid (not an error requiring repair).
    const lectureNodes = (course.nodes || []).filter((node) => node.type === 'lecture');
    if (lectureNodes.length === 0) return true;
    return lectureNodes.some((node) => {
      if (!node.pageText?.trim()) return true;
      if (isRemoteOrUnresolvedAssetUrl(node.pageImageUrl)) return true;
      return false;
    });
  }

  if (hasMissingNarrativeImagesForHydration(course)) return true;
  return false;
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

  const serializedCourse = JSON.stringify(toNativeStoredCourse(uid, course));
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
      void upsertCourseInNativeLibraryIndex(uid, course);
    } catch (error) {
      console.warn('Native full-course cache write failed:', error);
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
      const version = resolveNativeCourseCacheVersion(course);
      const materializedCourse = await materializeNativeInstalledCourseAssets(uid, course, version);
      if (!materializedCourse) continue;
      missingNativeFullCourseCachePaths.delete(cachePath);
      void writeFullCourseToNativeCache(uid, materializedCourse);
      return materializedCourse;
    } catch (error) {
      if (isNativeFilesystemMissingError(error)) {
        missingNativeFullCourseCachePaths.add(cachePath);
        nativeFullCourseCacheRevisionByPath.delete(cachePath);
      }
    }
  }
  const cachedPackage = await readBookPackageFromNativeCache(uid, courseId, versionHint);
  if (cachedPackage) {
    try {
      const hydratedCourse = await hydrateCourseFromBundleBlob(
        courseId,
        cachedPackage.blob,
        undefined,
        undefined,
        { localUserId: uid, versionHint: cachedPackage.version, persistAssets: true }
      );
      const materializedCourse = hydratedCourse
        ? await materializeNativeInstalledCourseAssets(uid, hydratedCourse, cachedPackage.version)
        : null;
      if (materializedCourse && hasPersistableCourseContent(materializedCourse)) {
        await writeFullCourseToNativeCache(uid, materializedCourse);
        return materializedCourse;
      }
    } catch (error) {
      console.warn('Native book ZIP cache read failed:', error);
    }
  }
  return null;
}

async function writeBookPackageToNativeCache(
  uid: string,
  courseId: string,
  version: number,
  blob: Blob
): Promise<void> {
  if (!isCapacitorNativeRuntime() || !uid || !courseId) return;
  const base64 = await blobToBase64InApp(blob);
  if (!base64) return;
  const packagePath = getNativeBookPackageCachePath(uid, courseId, version);
  const packageDir = getNativeBookPackageCourseCacheDir(uid, courseId);
  try {
    await Filesystem.writeFile({
      path: packagePath,
      data: base64,
      directory: Directory.Data,
      recursive: true
    });
    missingNativeBookPackageCachePaths.delete(packagePath);
    missingNativeBookPackageCacheDirs.delete(packageDir);
  } catch (error) {
    console.warn('Native book ZIP cache write failed:', error);
  }
}

async function listNativeBookPackageCacheVersions(uid: string, courseId: string): Promise<number[]> {
  if (!isCapacitorNativeRuntime()) return [];
  const packageDir = getNativeBookPackageCourseCacheDir(uid, courseId);
  if (missingNativeBookPackageCacheDirs.has(packageDir)) return [];
  try {
    const result = await Filesystem.readdir({
      path: packageDir,
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
    missingNativeBookPackageCacheDirs.delete(packageDir);
    return versions;
  } catch (error) {
    if (isNativeFilesystemMissingError(error)) {
      missingNativeBookPackageCacheDirs.add(packageDir);
    }
    return [];
  }
}

type NativeBookPackageCacheRecord = {
  blob: Blob;
  version: number;
};

async function readBookPackageFromNativeCache(
  uid: string,
  courseId: string,
  versionHint?: number
): Promise<NativeBookPackageCacheRecord | null> {
  if (!isCapacitorNativeRuntime() || !uid || !courseId) return null;
  const candidates: Array<{ path: string; version: number }> = [];
  const pushCandidate = (version: number) => {
    const safeVersion = Math.max(1, Math.floor(version));
    const path = getNativeBookPackageCachePath(uid, courseId, safeVersion);
    if (candidates.some((candidate) => candidate.path === path)) return;
    candidates.push({ path, version: safeVersion });
  };
  const hintedVersion = Number.isFinite(versionHint) ? Math.max(1, Math.floor(Number(versionHint))) : undefined;
  if (hintedVersion) {
    pushCandidate(hintedVersion);
  }
  const versions = await listNativeBookPackageCacheVersions(uid, courseId);
  for (const version of versions) {
    pushCandidate(version);
  }

  for (const candidate of candidates) {
    const packagePath = candidate.path;
    if (missingNativeBookPackageCachePaths.has(packagePath)) continue;
    try {
      const result = await Filesystem.readFile({
        path: packagePath,
        directory: Directory.Data
      });
      const base64 = typeof result.data === 'string' ? result.data : '';
      if (!base64) continue;
      const blob = base64ToBlobInApp(base64, 'application/zip');
      if (!blob) continue;
      missingNativeBookPackageCachePaths.delete(packagePath);
      return { blob, version: candidate.version };
    } catch (error) {
      if (isNativeFilesystemMissingError(error)) {
        missingNativeBookPackageCachePaths.add(packagePath);
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

async function readInstalledBook(uid: string, courseId: string, versionHint?: number): Promise<CourseData | null> {
  if (!uid || !courseId) return null;
  if (isCapacitorNativeRuntime()) {
    return readFullCourseFromNativeCache(uid, courseId, versionHint);
  }
  const record = await readBookPackageFromWebCache(uid, courseId, versionHint);
  if (!record?.blob) return null;
  return hydrateCourseFromBundleBlob(
    courseId,
    record.blob,
    record.packageUrl,
    record.packagePath,
    { localUserId: uid, versionHint: record.version, persistAssets: true }
  );
}

async function readInstalledLibrary(uid: string): Promise<CourseData[]> {
  if (!uid) return [];
  if (isCapacitorNativeRuntime()) {
    return readCoursesFromNativeLibraryIndex(uid);
  }
  return readInstalledCoursesFromWebCache(uid);
}

async function installBookPackageBlob(
  uid: string,
  course: CourseData,
  blob: Blob,
  packageUrl?: string,
  packagePath?: string,
  versionHint?: number
): Promise<CourseData | null> {
  if (!uid || !course.id) return null;
  const version = Number.isFinite(versionHint)
    ? Math.max(1, Math.floor(Number(versionHint)))
    : getInstalledBookVersion({
      ...course,
      contentPackagePath: packagePath || course.contentPackagePath
    });

  if (isCapacitorNativeRuntime()) {
    await writeBookPackageToNativeCache(uid, course.id, version, blob);
  }

  const hydrated = await hydrateCourseFromBundleBlob(
    course.id,
    blob,
    packageUrl || course.contentPackageUrl,
    packagePath || course.contentPackagePath,
    { localUserId: uid, versionHint: version, persistAssets: true }
  );
  const materializedHydrated = isCapacitorNativeRuntime() && hydrated
    ? await materializeNativeInstalledCourseAssets(uid, hydrated, version)
    : hydrated;
  if (!materializedHydrated || !hasPersistableCourseContent(materializedHydrated)) return null;

  const mergedCourse = mergeSharedCourseWithUserProgress(
    {
      ...materializedHydrated,
      userId: materializedHydrated.userId || course.userId,
      contentPackageUrl: materializedHydrated.contentPackageUrl || packageUrl || course.contentPackageUrl,
      contentPackagePath: materializedHydrated.contentPackagePath || packagePath || course.contentPackagePath,
      contentPackageUpdatedAt: materializedHydrated.contentPackageUpdatedAt || course.contentPackageUpdatedAt,
      bundle: materializedHydrated.bundle || course.bundle,
      cover: materializedHydrated.cover || course.cover,
      status: 'ready'
    },
    toProgressDocFromCourseSnapshot(course)
  );

  if (isCapacitorNativeRuntime()) {
    await writeFullCourseToNativeCache(uid, mergedCourse);
  } else {
    await writeBookPackageToWebCache(
      uid,
      course.id,
      version,
      blob,
      mergedCourse,
      packageUrl || course.contentPackageUrl,
      packagePath || course.contentPackagePath
    );
  }

  return mergedCourse;
}

async function installBookPackage(uid: string, course: CourseData): Promise<CourseData | null> {
  if (!uid || !course.id) return null;
  const versionHint = getInstalledBookVersion(course);
  const installed = await readInstalledBook(uid, course.id, versionHint);
  if (
    installed &&
    hasPersistableCourseContent(installed) &&
    getInstalledBookVersion(installed) >= versionHint
  ) {
    return mergeSharedCourseWithUserProgress(installed, toProgressDocFromCourseSnapshot(course));
  }

  const preferredPath = resolvePreferredBookZipStoragePath(course.contentPackagePath, course.bundle?.path);
  const preferredUrl = typeof course.contentPackageUrl === 'string' && course.contentPackageUrl.trim()
    ? course.contentPackageUrl.trim()
    : undefined;

  const tryFetchUrl = async (url: string): Promise<CourseData | null> => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = window.setTimeout(() => controller?.abort(), SMARTBOOK_PACKAGE_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller?.signal });
      if (!response.ok) throw new Error(`Book package fetch failed (${response.status})`);
      const blob = await response.blob();
      const pathFromUrl = isFirebaseStorageDownloadUrl(url)
        ? tryParseFirebaseStorageObjectPath(url)
        : undefined;
      return installBookPackageBlob(
        uid,
        course,
        blob,
        url,
        preferredPath || pathFromUrl || course.contentPackagePath,
        extractBundleVersionFromPath(preferredPath || pathFromUrl) || versionHint
      );
    } finally {
      window.clearTimeout(timer);
    }
  };

  if (preferredUrl) {
    try {
      const hydrated = await tryFetchUrl(preferredUrl);
      if (hydrated) return hydrated;
    } catch (error) {
      console.warn('Book package URL install failed; trying Storage path:', error);
    }
  }

  if (preferredPath) {
    const blob = await withPromiseTimeout(
      getBlob(storageRef(getStorage(), preferredPath)),
      SMARTBOOK_STORAGE_BLOB_TIMEOUT_MS,
      `Book package blob timeout (${preferredPath})`
    );
    let resolvedUrl = preferredUrl;
    if (!resolvedUrl) {
      try {
        resolvedUrl = await withPromiseTimeout(
          getDownloadURL(storageRef(getStorage(), preferredPath)),
          SMARTBOOK_STORAGE_URL_TIMEOUT_MS,
          `Book package URL resolve timeout (${preferredPath})`
        );
      } catch {
        resolvedUrl = undefined;
      }
    }
    return installBookPackageBlob(
      uid,
      course,
      blob,
      resolvedUrl,
      preferredPath,
      extractBundleVersionFromPath(preferredPath) || versionHint
    );
  }

  return null;
}

async function readCourseCoverFromNativeCache(
  uid: string,
  courseId: string,
  sourceKey?: string
): Promise<string | null> {
  if (!isCapacitorNativeRuntime()) return null;
  try {
    const result = await Filesystem.readFile({
      path: getNativeCourseCoverCachePath(uid, courseId),
      directory: Directory.Data,
      encoding: Encoding.UTF8
    });
    const raw = typeof result.data === 'string' ? result.data : '';
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NativeCourseCoverCachePayload>;
    if (parsed.schemaVersion !== 2) return null;
    const cachedSourceKey = typeof parsed.sourceKey === 'string' ? parsed.sourceKey.trim() : '';
    if (sourceKey && cachedSourceKey && cachedSourceKey !== sourceKey) return null;
    const imagePath = getNativeCourseCoverImageFilePath(uid, courseId);
    await Filesystem.stat({ path: imagePath, directory: Directory.Data });
    const uriResult = await Filesystem.getUri({ path: imagePath, directory: Directory.Data });
    const cap = (window as any)?.Capacitor;
    return typeof cap?.convertFileSrc === 'function' ? cap.convertFileSrc(uriResult.uri) : null;
  } catch (error) {
    if (!isNativeFilesystemMissingError(error)) {
      console.warn('Native course cover cache read failed:', error);
    }
    return null;
  }
}

async function readCourseCoversFromNativeCache(uid: string, courses: CourseData[]): Promise<Map<string, string>> {
  const next = new Map<string, string>();
  if (!isCapacitorNativeRuntime()) return next;
  let cachedCourseIds: Set<string>;
  try {
    const result = await Filesystem.readdir({
      path: getNativeCourseCoverCacheDir(uid),
      directory: Directory.Data
    });
    cachedCourseIds = new Set(
      (result.files || [])
        .map((entry) => (typeof entry === 'string' ? entry : entry?.name || ''))
        .filter((name) => name.endsWith('.json'))
        .map((name) => name.slice(0, -'.json'.length))
    );
  } catch (error) {
    if (!isNativeFilesystemMissingError(error)) {
      console.warn('Native course cover cache list failed:', error);
    }
    return next;
  }

  for (const course of courses) {
    if (!cachedCourseIds.has(getNativeFullCourseCacheSafeCourseId(course.id))) continue;
    const cachedCover = await readCourseCoverFromNativeCache(
      uid,
      course.id,
      getCourseCoverCacheSourceKey(course)
    );
    if (cachedCover) next.set(course.id, cachedCover);
  }
  return next;
}

function mergeDeviceCoversIntoCourses(courses: CourseData[], coversByCourseId: Map<string, string>): CourseData[] {
  if (coversByCourseId.size === 0) return courses;
  let changed = false;
  const nextCourses = courses.map((course) => {
    const deviceCoverImageUrl = coversByCourseId.get(course.id);
    if (!deviceCoverImageUrl || course.deviceCoverImageUrl === deviceCoverImageUrl) return course;
    changed = true;
    return { ...course, deviceCoverImageUrl };
  });
  return changed ? nextCourses : courses;
}

async function mergeNativeCourseCoversIntoCourses(uid: string, courses: CourseData[]): Promise<CourseData[]> {
  if (!isCapacitorNativeRuntime() || courses.length === 0) return courses;
  const coversByCourseId = await readCourseCoversFromNativeCache(uid, courses);
  return mergeDeviceCoversIntoCourses(courses, coversByCourseId);
}

async function writeCourseCoverToNativeCache(
  uid: string,
  course: CourseData,
  options?: { skipCacheRead?: boolean }
): Promise<string | null> {
  if (!isCapacitorNativeRuntime()) return null;
  if (!course.id) return null;
  const sourceKey = getCourseCoverCacheSourceKey(course);
  if (!sourceKey) return null;

  if (!options?.skipCacheRead) {
    const cachedUri = await readCourseCoverFromNativeCache(uid, course.id, sourceKey);
    if (cachedUri) return cachedUri;
  }

  const dataUrl = await fetchCourseCoverAsDataUrl(course);
  if (!dataUrl || !DATA_IMAGE_URL_PREFIX_RE.test(dataUrl)) return null;

  const base64Index = dataUrl.indexOf('base64,');
  if (base64Index < 0) return null;
  const base64Data = dataUrl.slice(base64Index + 7);

  const imagePath = getNativeCourseCoverImageFilePath(uid, course.id);
  const metaPath = getNativeCourseCoverCachePath(uid, course.id);

  try {
    await Filesystem.writeFile({
      path: imagePath,
      data: base64Data,
      directory: Directory.Data,
      recursive: true
    });

    const payload: NativeCourseCoverCachePayload = {
      schemaVersion: 2,
      courseId: course.id,
      sourceKey,
      updatedAt: new Date().toISOString()
    };
    await Filesystem.writeFile({
      path: metaPath,
      data: JSON.stringify(payload),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      recursive: true
    });

    const uriResult = await Filesystem.getUri({ path: imagePath, directory: Directory.Data });
    const cap = (window as any)?.Capacitor;
    return typeof cap?.convertFileSrc === 'function' ? cap.convertFileSrc(uriResult.uri) : null;
  } catch (error) {
    console.warn('Native course cover cache write failed:', error);
    return null;
  }
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
    item.contentPackagePath,
    bundlePayload?.path
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
      version: extractBundleVersionFromPath(resolvedBundlePath) || (Number.isFinite(bundleVersion) ? Math.max(1, Math.floor(bundleVersion)) : 1),
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
    visualStoryMode: item.visualStoryMode === true,
    visualStoryAudioStatus:
      item.visualStoryAudioStatus === 'pending' ||
      item.visualStoryAudioStatus === 'ready' ||
      item.visualStoryAudioStatus === 'failed' ||
      item.visualStoryAudioStatus === 'partial'
        ? item.visualStoryAudioStatus
        : undefined,
    coverNarrationText: typeof item.coverNarrationText === 'string' ? item.coverNarrationText : undefined,
    coverNarrationAudioUrl: typeof item.coverNarrationAudioUrl === 'string' ? item.coverNarrationAudioUrl : undefined,
    coverNarrationAudioStoragePath: typeof item.coverNarrationAudioStoragePath === 'string'
      ? item.coverNarrationAudioStoragePath
      : undefined,
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

function mergeCourseCacheLists(primary: CourseData[], secondary: CourseData[]): CourseData[] {
  const byId = new Map<string, CourseData>();
  const put = (course: CourseData) => {
    const existing = byId.get(course.id);
    if (!existing) {
      byId.set(course.id, course);
      return;
    }
    if (courseNeedsContentHydration(existing) && !courseNeedsContentHydration(course)) {
      byId.set(course.id, mergeSharedCourseWithUserProgress(course, toProgressDocFromCourseSnapshot(existing)));
      return;
    }
    if (!courseNeedsContentHydration(existing) && courseNeedsContentHydration(course)) {
      return;
    }
    if (course.lastActivity > existing.lastActivity && !isCourseProgressOnly(course)) {
      byId.set(course.id, course);
    }
  };

  primary.forEach(put);
  secondary.forEach(put);
  return sortCoursesByLastActivity(Array.from(byId.values()));
}

async function readCoursesFromNativeLibraryIndex(uid: string): Promise<CourseData[]> {
  if (!isCapacitorNativeRuntime()) return [];
  try {
    const result = await Filesystem.readFile({
      path: getNativeLibraryIndexPath(uid),
      directory: Directory.Data,
      encoding: Encoding.UTF8
    });
    const raw = typeof result.data === 'string' ? result.data : '';
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<NativeLibraryIndexPayload>;
    const indexCourses = Array.isArray(parsed.courses)
      ? parsed.courses
        .filter(shouldKeepSingleBundleStoredCourse)
        .map(fromStoredCourse)
        .filter((course): course is CourseData => course !== null)
      : [];
    if (indexCourses.length === 0) {
      nativeInstalledCourseIdsByUid.set(uid, new Set());
      return [];
    }

    const fullCourses = await readFullCoursesFromNativeCache(uid, indexCourses.map((course) => course.id));
    const indexById = new Map(indexCourses.map((course) => [course.id, course]));
    const installedCourses = sortCoursesByLastActivity(
      Array.from(fullCourses.values()).map((course) => {
        const indexedCourse = indexById.get(course.id);
        return indexedCourse
          ? mergeSharedCourseWithUserProgress(course, toProgressDocFromCourseSnapshot(indexedCourse))
          : course;
      })
    );

    if (installedCourses.length !== indexCourses.length) {
      await writeCoursesToNativeLibraryIndex(uid, installedCourses);
    } else {
      nativeInstalledCourseIdsByUid.set(uid, new Set(installedCourses.map((course) => course.id)));
    }
    return installedCourses;
  } catch (error) {
    nativeInstalledCourseIdsByUid.set(uid, new Set());
    if (!isNativeFilesystemMissingError(error)) {
      console.warn('Native library index read failed:', error);
    }
    return [];
  }
}

async function writeCoursesToNativeLibraryIndex(uid: string, courses: CourseData[]): Promise<void> {
  if (!isCapacitorNativeRuntime()) return;
  const indexCourses = sortCoursesByLastActivity(courses)
    .filter((course) => course.id)
    .map(toQuotaSafeStoredCourse);

  const payload: NativeLibraryIndexPayload = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    courses: indexCourses
  };

  try {
    await Filesystem.writeFile({
      path: getNativeLibraryIndexPath(uid),
      data: JSON.stringify(payload),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      recursive: true
    });
    nativeInstalledCourseIdsByUid.set(uid, new Set(indexCourses.map((course) => course.id)));
  } catch (error) {
    console.warn('Native library index write failed:', error);
  }
}

function writeInstalledCoursesToNativeLibraryIndex(uid: string, courses: CourseData[]): void {
  if (!isCapacitorNativeRuntime()) return;
  const installedCourseIds = nativeInstalledCourseIdsByUid.get(uid);
  if (!installedCourseIds || installedCourseIds.size === 0) return;
  void writeCoursesToNativeLibraryIndex(
    uid,
    courses.filter((course) => installedCourseIds.has(course.id))
  );
}

async function upsertCourseInNativeLibraryIndex(uid: string, course: CourseData): Promise<void> {
  if (!isCapacitorNativeRuntime()) return;
  const existing = await readCoursesFromNativeLibraryIndex(uid);
  await writeCoursesToNativeLibraryIndex(uid, mergeCourseCacheLists([course], existing));
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
  deviceCoverImageUrl?: string;
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
    visualStoryMode: sharedCourse.visualStoryMode === true || progress.visualStoryMode === true,
    visualStoryAudioStatus: sharedCourse.visualStoryAudioStatus || progress.visualStoryAudioStatus,
    coverNarrationText: sharedCourse.coverNarrationText || progress.coverNarrationText,
    coverNarrationAudioUrl: sharedCourse.coverNarrationAudioUrl || progress.coverNarrationAudioUrl,
    coverNarrationAudioStoragePath: sharedCourse.coverNarrationAudioStoragePath || progress.coverNarrationAudioStoragePath,
    coverImageUrl: sharedCourse.coverImageUrl || progress.coverImageUrl,
    deviceCoverImageUrl: sharedCourse.deviceCoverImageUrl || progress.deviceCoverImageUrl,
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
    visualStoryMode: course.visualStoryMode,
    visualStoryAudioStatus: course.visualStoryAudioStatus,
    coverNarrationText: course.coverNarrationText,
    coverNarrationAudioUrl: course.coverNarrationAudioUrl,
    coverNarrationAudioStoragePath: course.coverNarrationAudioStoragePath,
    coverImageUrl: course.coverImageUrl,
    deviceCoverImageUrl: course.deviceCoverImageUrl,
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
  if (isCapacitorNativeRuntime()) {
    try {
      window.localStorage.removeItem(getLocalCourseCoverCacheKey(uid));
    } catch {
      // Native runtime persists covers as files via writeCourseCoverToNativeCache.
    }
    return;
  }
  try {
    const entries: LocalCourseCoverCacheEntry[] = courses
      .filter((course) => typeof course.coverImageUrl === 'string' && DATA_IMAGE_URL_PREFIX_RE.test(course.coverImageUrl))
      .map((course) => ({
        courseId: course.id,
        coverImageUrl: course.coverImageUrl as string,
        updatedAt: course.lastActivity.toISOString()
      }));

    if (entries.length === 0) {
      window.localStorage.removeItem(getLocalCourseCoverCacheKey(uid));
      return;
    }

    let count = entries.length;
    while (count > 0) {
      try {
        window.localStorage.setItem(getLocalCourseCoverCacheKey(uid), JSON.stringify(entries.slice(0, count)));
        return;
      } catch (error) {
        if (!isQuotaExceededLocalStorageError(error)) {
          return;
        }
        count = Math.floor(count / 2);
      }
    }
    window.localStorage.removeItem(getLocalCourseCoverCacheKey(uid));
  } catch {
    // Ignore: cover cache is a best-effort recovery layer for freshly created books.
  }
}

function persistCoursesToLocal(uid: string, courses: CourseData[]): void {
  if (isCapacitorNativeRuntime()) {
    pendingLocalCourseWrites.delete(uid);
    return;
  }

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
    maxItems?: number;
    mapper: (course: CourseData) => StoredCourse;
  }> = [
    { mapper: toQuotaSafeStoredCourse },
    { maxItems: 80, mapper: toQuotaSafeStoredCourse },
    { maxItems: 40, mapper: toCompactStoredCourse },
    { maxItems: 12, mapper: toCompactStoredCourse }
  ];

  let quotaExceeded = false;
  for (const plan of writePlans) {
    try {
      const plannedCourses = typeof plan.maxItems === 'number'
        ? latestCourses.slice(0, plan.maxItems)
        : latestCourses;
      const payload = JSON.stringify(
        plannedCourses.map(plan.mapper)
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

  const coursesToWrite = pendingLocalCourseWrites.get(uid) || [];
  writeInstalledCoursesToNativeLibraryIndex(uid, coursesToWrite);
  persistCoursesToLocal(uid, coursesToWrite);
  pendingLocalCourseWrites.delete(uid);
}

function writeCoursesToLocal(uid: string, courses: CourseData[]): void {
  writeInstalledCoursesToNativeLibraryIndex(uid, courses);
  if (isCapacitorNativeRuntime()) {
    pendingLocalCourseWrites.delete(uid);
    const existingTimer = localCourseWriteTimers.get(uid);
    if (typeof existingTimer === 'number') {
      window.clearTimeout(existingTimer);
      localCourseWriteTimers.delete(uid);
    }
    return;
  }
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
  const legacyTotal = Number(raw.createCredits);
  const rawPurchased = Number(raw.purchasedCredits);
  const rawCommunityEarned = Number(raw.communityEarnedCredits);
  const hasSourceBreakdown = Number.isFinite(rawPurchased) && Number.isFinite(rawCommunityEarned);
  if (!hasSourceBreakdown && !Number.isFinite(legacyTotal)) return null;
  const purchasedCredits = Math.max(0, Math.round((hasSourceBreakdown ? rawPurchased : legacyTotal) * 100) / 100);
  const communityEarnedCredits = Math.max(0, Math.round((hasSourceBreakdown ? rawCommunityEarned : 0) * 100) / 100);
  return {
    purchasedCredits,
    communityEarnedCredits,
    createCredits: Math.round((purchasedCredits + communityEarnedCredits) * 100) / 100
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
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('');
  const [animationKey, setAnimationKey] = useState(0);

  const getTabVal = (v: ViewState) => {
    if (v === 'HOME') return 0;
    if (v === 'AI_CHAT') return 1;
    if (v === 'COMMUNITY') return 2;
    if (v === 'PROFILE') return 3;
    return 4;
  };

  const handleViewChange = (nextView: ViewState) => {
    if (nextView === currentView) return;
    const currentIdx = getTabVal(currentView);
    const nextIdx = getTabVal(nextView);
    setSlideDirection(nextIdx > currentIdx ? 'right' : 'left');
    setAnimationKey((prev) => prev + 1);
    setCurrentView(nextView);
  };

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
  const [hasCompletedNativeCacheMerge, setHasCompletedNativeCacheMerge] = useState(false);
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
  const [isLoginPromptOpen, setLoginPromptOpen] = useState(false);
  const [isCreditPurchaseBusy, setCreditPurchaseBusy] = useState(false);
  const [creditPackDisplayPrices, setCreditPackDisplayPrices] = useState<Partial<Record<string, string>>>({});
  const [legalConsentState, setLegalConsentState] = useState<LegalConsentState>('unknown');
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
  const automaticCommunityPublishAttemptedRef = useRef<Set<string>>(new Set());
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
  const coverLookupExhaustedRef = useRef<Set<string>>(new Set());
  const coverRepairInFlightByCourseIdRef = useRef<Set<string>>(new Set());
  const nativeCoverPrefetchAttemptedRef = useRef<Set<string>>(new Set());
  const nativeDownloadStateProbeAttemptedRef = useRef<Set<string>>(new Set());
  const backgroundBookPackageUpdateInFlightRef = useRef<Set<string>>(new Set());
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

    const optimizedDataUrl = await optimizeDataImageUrlForSmartbook(dataUrl);
    const cacheKey = `${safeOwnerId}:${courseId}:${simpleStableHash(relativePath)}:${simpleStableHash(optimizedDataUrl)}`;
    const cached = uploadedStorageAssetUrlByKeyRef.current.get(cacheKey);
    if (cached) return cached;

    const inFlight = uploadingStorageAssetPromiseByKeyRef.current.get(cacheKey);
    if (inFlight) return inFlight;

    const promise = (async () => {
      const { ext, mimeType } = inferImageExtensionFromDataUrl(optimizedDataUrl);
      const safeCourseId = String(courseId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeRelative = String(relativePath)
        .replace(/[^a-zA-Z0-9/_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^\/+|\/+$/g, '');
      const path = `smartbooks/${safeOwnerId}/${safeCourseId}/${safeRelative}.${ext}`;
      const fileRef = storageRef(getStorage(), path);
      await uploadString(fileRef, optimizedDataUrl, 'data_url', { contentType: mimeType });
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
      const optimizedBlob = await optimizeImageBlobForSmartbook(blob);
      const mimeTypeRaw = String(optimizedBlob.type || blob.type || '').toLowerCase();
      const mimeType = mimeTypeRaw.startsWith('image/') ? mimeTypeRaw : 'image/png';
      const inferredExt = inferFileExtensionFromMimeType(mimeType);
      const ext = inferredExt === 'jpg' || inferredExt === 'png' || inferredExt === 'webp' || inferredExt === 'gif'
        ? inferredExt
        : 'png';
      const fileRef = storageRef(getStorage(), `smartbooks/${safeOwnerId}/${safeCourseId}/cover.${ext}`);
      await uploadBytes(fileRef, optimizedBlob, { contentType: mimeType });
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
    course: Pick<CourseData, 'id' | 'coverImageUrl' | 'contentPackagePath' | 'bookType' | 'nodes' | 'cover' | 'bundle'>
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

    const preferredPackagePath = resolvePreferredBookZipStoragePath(course.contentPackagePath, course.bundle?.path);
    const packageBasePath = typeof preferredPackagePath === 'string'
      ? preferredPackagePath.trim().replace(/\/(?:package\.json|book\.zip)$/i, '')
      : '';
    const coverPath = normalizeStorageObjectPath(course.cover?.path);
    if (coverPath) {
      if (coverPath.startsWith('smartbooks/')) {
        pushCandidate(coverPath);
      } else if (packageBasePath) {
        pushCandidate(`${packageBasePath}/${coverPath}`);
      }
    }
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
    course: Pick<CourseData, 'id' | 'coverImageUrl' | 'contentPackagePath' | 'bookType' | 'nodes' | 'cover' | 'bundle'>
  ): Promise<string | undefined> => {
    const fairyTaleFirstImageCover = resolveFirstGeneratedImageAsFairyTaleCover(course);
    if (fairyTaleFirstImageCover) {
      return fairyTaleFirstImageCover;
    }

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
      visualStoryMode: course.visualStoryMode === true,
      visualStoryAudioStatus: course.visualStoryAudioStatus,
      coverNarrationText: course.coverNarrationText,
      coverNarrationAudioUrl: course.coverNarrationAudioUrl,
      coverNarrationAudioStoragePath: course.coverNarrationAudioStoragePath,
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
    if (cached && hasPersistableCourseContent(cached) && !visualStoryNeedsAudioHydration(cached)) return cached;

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

      const initialPackageUrl = typeof packageUrl === 'string' && packageUrl.trim() ? packageUrl.trim() : undefined;
      const initialPackageUrlPath = initialPackageUrl && isFirebaseStorageDownloadUrl(initialPackageUrl)
        ? tryParseFirebaseStorageObjectPath(initialPackageUrl)
        : null;
      const preferredInitialPath = candidatePaths[0];
      let resolvedUrl = initialPackageUrl &&
        (!initialPackageUrlPath || !safeOwnerId || initialPackageUrlPath.startsWith(`smartbooks/${safeOwnerId}/`)) &&
        (!preferredInitialPath || !initialPackageUrlPath || initialPackageUrlPath === preferredInitialPath)
        ? initialPackageUrl
        : undefined;
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
          const isZipLike = /application\/zip|application\/x-zip-compressed/i.test(contentType) || /\.zip($|\?)/i.test(url);
          if (isZipLike) {
            const responseBlob = await response.blob();
            window.clearTimeout(timer);
            const effectivePath = resolvedPath || packagePath;
            const effectiveVersion = extractBundleVersionFromPath(effectivePath) || hintedVersion || 1;
            if (safeOwnerId) {
              if (isCapacitorNativeRuntime()) {
                void writeBookPackageToNativeCache(safeOwnerId, courseId, effectiveVersion, responseBlob);
              }
            }
            const hydrated = await hydrateCourseFromBundleBlob(
              courseId,
              responseBlob,
              url,
              effectivePath,
              { localUserId: safeOwnerId, versionHint: effectiveVersion, persistAssets: true }
            );
            if (safeOwnerId && hydrated) {
              if (!isCapacitorNativeRuntime()) {
                void writeBookPackageToWebCache(safeOwnerId, courseId, effectiveVersion, responseBlob, hydrated, url, effectivePath);
              }
            }
            return hydrated;
          }
          const payload = await response.json();
          window.clearTimeout(timer);
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
          const effectiveVersion = extractBundleVersionFromPath(path) || hintedVersion || 1;
          if (safeOwnerId) {
            if (isCapacitorNativeRuntime()) {
              void writeBookPackageToNativeCache(safeOwnerId, courseId, effectiveVersion, packageBlob);
            }
          }
          const hydrated = await hydrateCourseFromBundleBlob(
            courseId,
            packageBlob,
            resolvedUrl,
            path,
            { localUserId: safeOwnerId, versionHint: effectiveVersion, persistAssets: true }
          );
          if (safeOwnerId && hydrated && !isCapacitorNativeRuntime()) {
            void writeBookPackageToWebCache(safeOwnerId, courseId, effectiveVersion, packageBlob, hydrated, resolvedUrl, path);
          }
          return hydrated;
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

      const tryLoadFromNativePackageCache = async (): Promise<CourseData | null> => {
        if (!safeOwnerId) return null;
        const packageRecord = await readBookPackageFromNativeCache(safeOwnerId, courseId, hintedVersion);
        if (!packageRecord) return null;
        const hydrated = await hydrateCourseFromBundleBlob(
          courseId,
          packageRecord.blob,
          resolvedUrl,
          resolvedPath || packagePath,
          {
            localUserId: safeOwnerId,
            versionHint: packageRecord.version,
            persistAssets: true
          }
        );
        return await materializeCourse(hydrated, resolvedUrl, resolvedPath || packagePath);
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

      try {
        hydratedCourse = await tryLoadFromNativePackageCache();
        if (hydratedCourse) {
          lastError = null;
        }
      } catch (nativePackageError) {
        lastError = nativePackageError;
      }

      if (!hydratedCourse && resolvedUrl) {
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

  const resolveCourseCoverRepair = async (
    course: CourseData
  ): Promise<{ coverImageUrl?: string; hydratedCourse?: CourseData | null }> => {
    const directCoverImageUrl = await resolveFreshCoverUrlForCourse(course);
    if (directCoverImageUrl) {
      return { coverImageUrl: directCoverImageUrl };
    }

    if (authUser?.uid && (!course.userId || course.userId === authUser.uid)) {
      try {
        const result = await repairSmartBookCover({ bookId: course.id });
        const repairedCoverUrl = String(result.data?.coverImageUrl || '').trim();
        if (repairedCoverUrl) return { coverImageUrl: repairedCoverUrl };
      } catch (error) {
        console.warn(`Standalone book cover repair failed (${course.id}):`, error);
      }
    }

    // The device never downloads the full package just to render a library cover.
    return {};
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
    timeoutMs = SMARTBOOK_EXPORT_HYDRATION_WAIT_MS,
    requireAudioHydration = false
  ): Promise<CourseData | null> => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const snapshot = savedCoursesRef.current.find((course) => course.id === courseId) || null;
      if (!snapshot) return null;
      if (!courseNeedsContentHydration(snapshot) && (!requireAudioHydration || !visualStoryNeedsAudioHydration(snapshot))) {
        return snapshot;
      }
      await waitMs(120);
    }

    return savedCoursesRef.current.find((course) => course.id === courseId) || null;
  };

  const resolveCourseForExport = async (courseId: string): Promise<CourseData | null> => {
    const snapshot = savedCoursesRef.current.find((course) => course.id === courseId) || null;
    if (!snapshot) return null;
    const needsAudioHydration = visualStoryNeedsAudioHydration(snapshot);
    if (!courseNeedsContentHydration(snapshot) && !needsAudioHydration) return snapshot;

    try {
      await ensureCourseHydrated(courseId, { markNodesLoading: false, force: needsAudioHydration });
    } catch {
      // Best-effort hydration only; export still falls back to the latest known snapshot.
    }

    const hydratedSnapshot = await waitForHydratedCourseSnapshot(courseId, SMARTBOOK_EXPORT_HYDRATION_WAIT_MS, needsAudioHydration);
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
        const packageMetadataMerged = mergeCoursePackageMetadata(course, cloudCourse);
        return {
          ...packageMetadataMerged,
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
      snapshotHint?: CourseData;
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

    const snapshot = savedCoursesRef.current.find((course) => course.id === courseId) || options?.snapshotHint || null;
    const markNodesLoading = options?.markNodesLoading === true;

    const applyHydratedCourseLocally = (hydrated: CourseData, progressSnapshot: CourseData): CourseData => {
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
        return nextCourses;
      });

      return mergedCourse;
    };

    if (!snapshot) {
      return false;
    }

    if (!options?.force && !courseNeedsContentHydration(snapshot)) {
      return true;
    }

    // Prefer any installed package; opening should not redownload a book already on the device/browser.
    const installedCourse = await readInstalledBook(
      localUserId,
      courseId,
      extractBundleVersionFromPath(snapshot.contentPackagePath) || snapshot.bundle?.version
    );
    if (
      installedCourse &&
      !courseNeedsContentHydration(installedCourse) &&
      (!options?.force || !visualStoryNeedsAudioHydration(installedCourse))
    ) {
      applyHydratedCourseLocally(installedCourse, snapshot);
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
          { preferBackend: true, versionHint: extractBundleVersionFromPath(latestSnapshot.contentPackagePath) || latestSnapshot.bundle?.version }
        );

        if (!hydrated) {
          console.warn(`[Book Sync] No content found for book ${courseId} (owner=${ownerUid}, path=${packagePath || 'none'}, url=${packageUrl ? 'yes' : 'none'})`);
          return false;
        }

        const mergedCourse = applyHydratedCourseLocally(hydrated, latestSnapshot);
        await writeFullCourseToNativeCache(localUserId, mergedCourse);
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
      const n = Number(costOverride);
      return n < 1 ? n : Math.floor(n);
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
    if (isGuestSession || (!authUser && !isAuthLoading)) {
      setLoginPromptOpen(true);
      return false;
    }
    const cost = resolveCreditCost(action, costOverride);
    const wallet = creditWalletRef.current;
    const amount = wallet.createCredits;
    if (amount >= cost) return true;
    openCreditPaywall(action);
    return false;
  };

  const consumeCreditForAction = async (action: CreditActionType, costOverride?: number): Promise<boolean> => {
    if (isGuestSession || (!authUser && !isAuthLoading)) {
      setLoginPromptOpen(true);
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
    const expectedPurchasedCredits = baselineWallet.purchasedCredits + pack.createCredits;
    const deadline = Date.now() + CREDIT_WEBHOOK_SYNC_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const { wallet } = await runCreditGatewayOperation(localUserId, {
        operation: 'getWallet'
      });
      if (wallet && wallet.purchasedCredits >= expectedPurchasedCredits) {
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
        visualStoryMode: cloudPayload.visualStoryMode === true,
        visualStoryAudioStatus:
          cloudPayload.visualStoryAudioStatus === 'pending' ||
          cloudPayload.visualStoryAudioStatus === 'ready' ||
          cloudPayload.visualStoryAudioStatus === 'failed' ||
          cloudPayload.visualStoryAudioStatus === 'partial'
            ? cloudPayload.visualStoryAudioStatus
            : undefined,
        coverNarrationText: typeof cloudPayload.coverNarrationText === 'string' ? cloudPayload.coverNarrationText : undefined,
        coverNarrationAudioUrl: typeof cloudPayload.coverNarrationAudioUrl === 'string' ? cloudPayload.coverNarrationAudioUrl : undefined,
        coverNarrationAudioStoragePath: typeof cloudPayload.coverNarrationAudioStoragePath === 'string'
          ? cloudPayload.coverNarrationAudioStoragePath
          : undefined,
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
      const safeBookDocPayload = {
        ...stripUndefinedDeepForFirestore(bookDocPayload),
        nodes: deleteField(),
        content: deleteField(),
        pages: deleteField()
      };
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
    LocalNotifications.requestPermissions().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!authUser?.uid) return;
    const uid = authUser.uid;
    const registerToken = async () => {
      try {
        await FirebaseMessaging.requestPermissions();
        const { token } = await FirebaseMessaging.getToken();
        if (!token) return;
        const fn = httpsCallable<{ token: string; platform: string }, { success: boolean }>(functions, 'registerFcmToken');
        await fn({ token, platform: 'ios' });
      } catch {
        // silently fail — push is optional
      }
    };
    void registerToken();

    const tokenListener = FirebaseMessaging.addListener('tokenReceived', async ({ token }) => {
      if (!token) return;
      try {
        const fn = httpsCallable<{ token: string; platform: string }, { success: boolean }>(functions, 'registerFcmToken');
        await fn({ token, platform: 'ios' });
      } catch { /* ignore */ }
    });

    return () => { tokenListener.then((l) => l.remove()).catch(() => undefined); };
  }, [authUser?.uid]);

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
    const uid = authUser?.uid;
    if (!uid || isAuthLoading || !hasCompletedLocalBootstrap || legalConsentState !== 'accepted') return;

    const eligibleCourses = savedCourses.filter((course) => {
      if (!course.id || course.id.startsWith('community_')) return false;
      if (course.communityPublication?.status === 'published') return false;
      return Boolean(
        resolvePreferredBookZipStoragePath(course.bundle?.path, course.contentPackagePath)
        || String(course.contentPackageUrl || '').trim()
      );
    });
    if (eligibleCourses.length === 0) return;

    void runTasksWithConcurrency(eligibleCourses, 2, async (course) => {
      const attemptKey = `${uid}:${course.id}`;
      if (automaticCommunityPublishAttemptedRef.current.has(attemptKey)) return;
      automaticCommunityPublishAttemptedRef.current.add(attemptKey);
      try {
        const result = await autoPublishToCommunity({
          bookId: course.id,
          isPublic: true,
          autoPublish: true,
          rightsAccepted: true,
          termsAccepted: true,
          ageConfirmed: true
        });
        const updatedAt = new Date();
        setSavedCourses((current) => {
          const next = current.map((item) => item.id === course.id
            ? { ...item, communityPublication: { id: result.data.communityBookId, status: 'published' as const, updatedAt } }
            : item);
          savedCoursesRef.current = next;
          return next;
        });
      } catch (error) {
        window.setTimeout(() => automaticCommunityPublishAttemptedRef.current.delete(attemptKey), 5 * 60_000);
      }
    });
  }, [authUser?.uid, hasCompletedLocalBootstrap, isAuthLoading, legalConsentState, savedCourses]);

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
    const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : null);
    if (!localUserId || !isCapacitorNativeRuntime() || savedCourses.length === 0) return;

    const targets = savedCourses.filter((course) => {
      const sourceKey = getCourseCoverCacheSourceKey(course);
      if (!sourceKey) return false;
      if (course.deviceCoverImageUrl && isPersistentLocalAssetUrl(course.deviceCoverImageUrl)) return false;
      const attemptKey = `${localUserId}:${course.id}:${simpleStableHash(sourceKey)}`;
      if (nativeCoverPrefetchAttemptedRef.current.has(attemptKey)) return false;
      nativeCoverPrefetchAttemptedRef.current.add(attemptKey);
      return true;
    });
    if (targets.length === 0) return;

    let cancelled = false;
    const downloadedCovers = new Map<string, string>();

    void runTasksWithConcurrency(targets, 1, async (course) => {
      if (cancelled) return;
      try {
        const deviceCoverImageUrl = await writeCourseCoverToNativeCache(
          localUserId,
          course,
          { skipCacheRead: true }
        );
        if (deviceCoverImageUrl) downloadedCovers.set(course.id, deviceCoverImageUrl);
      } catch (error) {
        console.warn('Native course cover prefetch failed:', error);
      }
    }).then(() => {
      if (cancelled || downloadedCovers.size === 0) return;
      setSavedCourses((prev) => {
        const nextCourses = mergeDeviceCoversIntoCourses(prev, downloadedCovers);
        if (nextCourses === prev) return prev;
        savedCoursesRef.current = nextCourses;
        return nextCourses;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [authUser?.uid, isGuestSession, savedCourses]);

  useEffect(() => {
    const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : null);
    if (!localUserId || !isCapacitorNativeRuntime() || savedCourses.length === 0) return;
    const installedCourseIds = nativeInstalledCourseIdsByUid.get(localUserId);
    if (!installedCourseIds || installedCourseIds.size === 0) return;

    const targets = savedCourses.filter((course) => {
      if (!installedCourseIds.has(course.id)) return false;
      if (!courseNeedsContentHydration(course)) return false;
      const cacheVersion = resolveNativeCourseCacheVersion(course);
      const attemptKey = `${localUserId}:${course.id}:v${cacheVersion}`;
      if (nativeDownloadStateProbeAttemptedRef.current.has(attemptKey)) return false;
      nativeDownloadStateProbeAttemptedRef.current.add(attemptKey);
      return true;
    });
    if (targets.length === 0) return;

    let cancelled = false;
    void readFullCoursesFromNativeCache(localUserId, targets.map((course) => course.id)).then((nativeFullCourseCache) => {
      if (nativeFullCourseCache.size === 0) return;

      const readyCourseIds = new Set<string>();

      if (!cancelled) {
        setSavedCourses((prev) => {
          let changed = false;
          const nextCourses = sortCoursesByLastActivity(prev.map((course) => {
            const fullCachedCourse = nativeFullCourseCache.get(course.id);
            if (!fullCachedCourse || !courseNeedsContentHydration(course)) return course;
            const mergedCourse = mergeSharedCourseWithUserProgress(
              fullCachedCourse,
              toProgressDocFromCourseSnapshot(course)
            );
            if (!courseNeedsContentHydration(mergedCourse)) {
              coursePackageByIdRef.current.set(course.id, mergedCourse);
              readyCourseIds.add(course.id);
            }
            changed = true;
            return mergedCourse;
          }));
          if (!changed) return prev;
          savedCoursesRef.current = nextCourses;
          writeCoursesToLocal(localUserId, nextCourses);
          writeFullCoursesToLocal(localUserId, nextCourses);
          return nextCourses;
        });
      } else {
        // Cancelled due to savedCourses change — still mark cached courses as ready
        // so the Download button doesn't flash on after Firebase sync overwrites state.
        for (const course of savedCoursesRef.current) {
          const fullCachedCourse = nativeFullCourseCache.get(course.id);
          if (!fullCachedCourse || !courseNeedsContentHydration(course)) continue;
          const mergedCourse = mergeSharedCourseWithUserProgress(
            fullCachedCourse,
            toProgressDocFromCourseSnapshot(course)
          );
          if (!courseNeedsContentHydration(mergedCourse)) {
            coursePackageByIdRef.current.set(course.id, mergedCourse);
            readyCourseIds.add(course.id);
          }
        }
      }

      if (readyCourseIds.size > 0) {
        setCourseOpenStateById((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const courseId of readyCourseIds) {
            const previous = next[courseId];
            if (previous?.status === 'ready' && previous.progress === 100) continue;
            next[courseId] = { status: 'ready', progress: 100, updatedAt: Date.now() };
            changed = true;
          }
          return changed ? next : prev;
        });
      }
    }).catch((error) => {
      console.warn('Native downloaded book state probe failed:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [authUser?.uid, isGuestSession, savedCourses]);

  useEffect(() => {
    if (!authUser?.uid) return;
    if (!savedCourses.length) return;

    const localUserId = authUser.uid;
    const repairTargets = savedCourses.flatMap((course) => {
      const hasUnresolvedStoragePath = typeof course.coverImageUrl === 'string' &&
        course.coverImageUrl.trim().startsWith('smartbooks/');
      const fairyTaleFirstImageCover = resolveFirstGeneratedImageAsFairyTaleCover(course);
      const needsFairyTaleFirstImageCover = !course.coverImageUrl && Boolean(fairyTaleFirstImageCover);
      const packagePath = resolvePreferredBookZipStoragePath(course.contentPackagePath, course.bundle?.path);
      const needsCoverFromPackage = !course.coverImageUrl && Boolean(packagePath || course.contentPackageUrl);
      const needsLegacyCoverLookup = !course.coverImageUrl;
      if (!hasUnresolvedStoragePath && !needsFairyTaleFirstImageCover && !needsCoverFromPackage && !needsLegacyCoverLookup) return [];

      const repairKey = `${course.id}:${course.coverImageUrl || ''}:${packagePath || ''}:${course.cover?.path || ''}`;
      if (coverRepairInFlightByCourseIdRef.current.has(course.id)) return [];
      if (coverLookupExhaustedRef.current.has(repairKey)) return [];
      if (!markRetriableAttemptWithCooldown(
        coverRepairAttemptedByCourseRef.current,
        repairKey,
        SMARTBOOK_COVER_REPAIR_RETRY_COOLDOWN_MS
      )) {
        return [];
      }

      coverRepairInFlightByCourseIdRef.current.add(course.id);
      return [{ course, repairKey }];
    });

    if (repairTargets.length === 0) return;

    const repairCourseCovers = async () => {
      const resolvedCovers: Array<{
        courseId: string;
        repairKey: string;
        coverImageUrl?: string;
        hydratedCourse?: CourseData | null;
      }> = [];

      await runTasksWithConcurrency(repairTargets, 2, async ({ course, repairKey }) => {
        try {
          const repair = await resolveCourseCoverRepair(course);
          resolvedCovers.push({
            courseId: course.id,
            repairKey,
            coverImageUrl: repair.coverImageUrl,
            hydratedCourse: repair.hydratedCourse
          });
        } finally {
          coverRepairInFlightByCourseIdRef.current.delete(course.id);
        }
      });

      const repairedById = new Map(
        resolvedCovers
          .filter((entry) => typeof entry.coverImageUrl === 'string' && entry.coverImageUrl.trim())
          .map((entry) => {
            const repairedCover = entry.coverImageUrl!.trim();
            coverRepairAttemptedByCourseRef.current.delete(entry.repairKey);
            return [entry.courseId, repairedCover] as const;
          })
      );
      const hydratedById = new Map(
        resolvedCovers
          .filter((entry): entry is typeof entry & { hydratedCourse: CourseData } => (
            Boolean(entry.hydratedCourse && hasPersistableCourseContent(entry.hydratedCourse))
          ))
          .map((entry) => [entry.courseId, entry.hydratedCourse] as const)
      );

      for (const entry of resolvedCovers) {
        if (!repairedById.has(entry.courseId)) {
          coverLookupExhaustedRef.current.add(entry.repairKey);
        }
      }

      if (repairedById.size === 0 && hydratedById.size === 0) return;

      const readyCourseIds = new Set<string>();
      const nativeCacheCourses: CourseData[] = [];

      setSavedCourses((prev) => {
        let changed = false;
        const nextCourses = prev.map((course) => {
          const repairedCoverImageUrl = repairedById.get(course.id);
          const hydratedCourse = hydratedById.get(course.id);
          if (!repairedCoverImageUrl && !hydratedCourse) return course;

          const cachedCourse = coursePackageByIdRef.current.get(course.id);
          if (cachedCourse) {
            coursePackageByIdRef.current.set(course.id, {
              ...cachedCourse,
              coverImageUrl: repairedCoverImageUrl || cachedCourse.coverImageUrl
            });
          }

          const nextCourse = hydratedCourse
            ? mergeSharedCourseWithUserProgress(
              {
                ...hydratedCourse,
                coverImageUrl: repairedCoverImageUrl || hydratedCourse.coverImageUrl
              },
              toProgressDocFromCourseSnapshot(course)
            )
            : {
              ...course,
              coverImageUrl: repairedCoverImageUrl
            };

          if (
            nextCourse.coverImageUrl === course.coverImageUrl &&
            nextCourse.nodes === course.nodes
          ) {
            return course;
          }

          changed = true;
          if (hydratedCourse && !courseNeedsContentHydration(nextCourse)) {
            coursePackageByIdRef.current.set(course.id, nextCourse);
            readyCourseIds.add(course.id);
            nativeCacheCourses.push(nextCourse);
          }
          return nextCourse;
        });

        if (!changed) return prev;
        writeCoursesToLocal(localUserId, nextCourses);
        writeFullCoursesToLocal(localUserId, nextCourses);
        return nextCourses;
      });

      if (readyCourseIds.size > 0) {
        setCourseOpenStateById((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const courseId of readyCourseIds) {
            const previous = next[courseId];
            if (previous?.status === 'ready' && previous.progress === 100) continue;
            next[courseId] = { status: 'ready', progress: 100, updatedAt: Date.now() };
            changed = true;
          }
          return changed ? next : prev;
        });
      }
      if (nativeCacheCourses.length > 0) {
        void runTasksWithConcurrency(nativeCacheCourses, 2, async (course) => {
          await writeFullCourseToNativeCache(localUserId, course);
        });
      }
    };

    void repairCourseCovers();
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
    const subject = encodeURIComponent('Fortale Support');
    const body = encodeURIComponent('Hello Fortale Support,\n\nI need help with:\n\n');
    const mailtoUrl = `mailto:fortale@sponelabs.com?subject=${subject}&body=${body}`;
    window.location.assign(mailtoUrl);
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
      return;
    }

    let cancelled = false;
    const loadLegalConsent = async () => {
      setLegalConsentState('unknown');
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
        }

        if (!hasAcceptedCurrentVersion) {
          try {
            await setDoc(
              doc(db, 'users', authUser.uid),
              {
                email: authUser.email ?? null,
                displayName: authUser.displayName ?? null,
                appLanguage: resolvedAppLanguage,
                appLanguageLabel: getAppLanguageLabel(resolvedAppLanguage),
                legalConsentAcceptedAt: new Date(),
                legalConsentVersion: LEGAL_CONSENT_VERSION,
                legalConsentSource: 'login_implicit',
                legalTermsLastUpdated: defaultTermsPolicy.lastUpdatedDate,
                legalPrivacyLastUpdated: defaultPrivacyPolicy.lastUpdatedDate
              },
              { merge: true }
            );
          } catch (error) {
            console.warn('Implicit legal consent metadata could not be saved:', error);
          }
        }

        if (!cancelled) setLegalConsentState('accepted');

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
        if (!cancelled) setLegalConsentState('accepted');
      }
    };

    void loadLegalConsent();
    return () => {
      cancelled = true;
    };
  }, [authUser?.uid, isGuestSession]);

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
    if (!isCreditPaywallOpen) return;
    if (!isCapacitorNativeRuntime() || !isRevenueCatEnabled()) return;

    let cancelled = false;
    void (async () => {
      try {
        await ensureRevenueCatConfigured({
          appUserId: authUser?.uid ?? null,
          email: authUser?.email ?? null,
          displayName: authUser?.displayName ?? null
        });
        const nextPriceStrings = await getRevenueCatCreditPackPriceStrings();
        if (!cancelled && Object.keys(nextPriceStrings).length > 0) {
          setCreditPackDisplayPrices((current) => ({ ...current, ...nextPriceStrings }));
        }
      } catch (error) {
        console.warn('Failed to load RevenueCat credit pack price strings:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser?.displayName, authUser?.email, authUser?.uid, isCreditPaywallOpen]);

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
    const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : (isAuthLoading ? bootstrapAuthUid : null));

    if (!localUserId) {
      progressOnlyFallbackCourseIdsRef.current.clear();
      setSavedCourses([]);
      setStickyNotes([]);
      setLikedCourseIds([]);
      setActiveCourseId(null);
      setLoadingMessage('Kitaplar yükleniyor...');
      setIsLoading(false);
      setHasCompletedLocalBootstrap(true);
      setHasCompletedNativeCacheMerge(true);
      return;
    }

    let isCancelled = false;

    const fetchCourses = async () => {
      setLoadingMessage('Kitaplar yükleniyor...');
      setHasCompletedLocalBootstrap(false);
      setHasCompletedNativeCacheMerge(false);
      eagerHydrationNativeCacheMergedIdsRef.current.clear();
      const mergeNativeFullCoursesIntoState = async (courseIds: string[]) => {
        if (courseIds.length === 0) return;
        try {
          const nativeFullCourseCache = await readFullCoursesFromNativeCache(localUserId, courseIds);
          if (isCancelled) return;
          if (nativeFullCourseCache.size === 0) return;

          let mergedCourses: CourseData[] | null = null;
          setSavedCourses((prev) => {
            let changed = false;
            const nextCourses = sortCoursesByLastActivity(
              prev.map((course) => {
                const fullCachedCourse = nativeFullCourseCache.get(course.id);
                if (!fullCachedCourse) return course;
                if (!courseNeedsContentHydration(course)) return course;

                changed = true;
                eagerHydrationNativeCacheMergedIdsRef.current.add(course.id);
                const mergedCourse = mergeSharedCourseWithUserProgress(
                  fullCachedCourse,
                  toProgressDocFromCourseSnapshot(course)
                );
                if (!courseNeedsContentHydration(mergedCourse)) {
                  coursePackageByIdRef.current.set(course.id, mergedCourse);
                }
                return mergedCourse;
              })
            );

            if (!changed) return prev;
            mergedCourses = nextCourses;
            return nextCourses;
          });
          // Side effects outside the state updater.
          if (mergedCourses) {
            writeCoursesToLocal(localUserId, mergedCourses);
            writeFullCoursesToLocal(localUserId, mergedCourses);
          }
        } catch {
          // Ignore native cache read failures during bootstrap.
        }
      };

      const installedLibraryCourses = await readInstalledLibrary(localUserId);
      const installedCourseIds = new Set(installedLibraryCourses.map((course) => course.id));
      const localStorageCourses = isCapacitorNativeRuntime() ? [] : readCoursesFromLocal(localUserId);
      let localCourses = mergeCourseCacheLists(installedLibraryCourses, localStorageCourses);
      if (localCourses.length > 0) {
        localCourses = await mergeNativeCourseCoversIntoCourses(localUserId, localCourses);
      }
      const localStickyNotes = readStickyNotesFromLocal(localUserId);
      const localLikedCourseIds = readLikedCourseIdsFromLocal(localUserId);
      const progressOnlyFallbackCourseIds = new Set<string>();

      if (isCancelled) return;

      setIsLoading(localCourses.length === 0);
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
      setHasCompletedNativeCacheMerge(true);

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

      if (localCourses.length > 0) {
        setIsLoading(false);
      } else {
        setLoadingMessage('Kitaplar senkronize ediliyor...');
      }

      const shouldStayOnDeviceLibrary =
        !authUser &&
        isCapacitorNativeRuntime() &&
        localCourses.length > 0 &&
        !incomingSharedSmartBookId &&
        !localCourses.some(courseNeedsStartupCloudRefresh);

      if (shouldStayOnDeviceLibrary) {
        progressOnlyFallbackCourseIdsRef.current.clear();
        void stickyNotesBootstrapPromise;
        setIsLoading(false);
        setLoadingMessage('Kitaplar yükleniyor...');
        return;
      }

      if (!authUser || !cloudSyncEnabled) {
        progressOnlyFallbackCourseIdsRef.current.clear();
        if (!authUser && isAuthLoading && !isGuestSession && localCourses.length === 0) {
          void stickyNotesBootstrapPromise;
          return;
        }
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
        if (isCancelled) return;
        didLoadBackendBootstrap = true;
      } catch (backendBootstrapError) {
        console.warn('Server-side book bootstrap skipped:', backendBootstrapError);
      }

      try {
        const byId = new Map<string, CourseData>();

        localCourses.forEach((localCourse) => {
          byId.set(localCourse.id, localCourse);
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

        if (didLoadBackendBootstrap) {
          backendBootstrapCourses.forEach((cloudCourse) => {
            const existing = byId.get(cloudCourse.id);
            if (!existing) {
              byId.set(cloudCourse.id, cloudCourse);
              if (courseNeedsContentHydration(cloudCourse)) {
                progressOnlyFallbackCourseIds.add(cloudCourse.id);
              }
              return;
            }

            const packageMetadataMerged = mergeCoursePackageMetadata(existing, cloudCourse);
            if (!courseNeedsContentHydration(packageMetadataMerged)) {
              byId.set(cloudCourse.id, packageMetadataMerged);
              return;
            }

            const metadataMerged: CourseData = {
              ...packageMetadataMerged,
              nodes: existing.nodes.length > 0 ? existing.nodes : cloudCourse.nodes
            };
            byId.set(cloudCourse.id, metadataMerged);
            if (courseNeedsContentHydration(metadataMerged)) {
              progressOnlyFallbackCourseIds.add(cloudCourse.id);
            }
          });
        }

        progressOnlyFallbackCourseIdsRef.current = new Set(
          Array.from(progressOnlyFallbackCourseIds).filter((courseId) => {
            const snapshot = byId.get(courseId);
            return Boolean(snapshot && courseNeedsContentHydration(snapshot));
          })
        );

        const courses = Array.from(byId.values());
        let sortedCourses = sortCoursesByLastActivity(courses);
        sortedCourses = await mergeNativeCourseCoversIntoCourses(localUserId, sortedCourses);
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
          setIsLoading(false);
          await mergeNativeFullCoursesIntoState(Array.from(installedCourseIds));
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
        if (isCancelled) return;
        setLoadingMessage('Kitaplar yükleniyor...');
        setHasCompletedLocalBootstrap(true);
        setIsLoading(false);
        setHasCompletedNativeCacheMerge(true);
      }
    };

    fetchCourses();
    return () => {
      isCancelled = true;
    };
  }, [authUser?.uid, bootstrapAuthUid, cloudSyncEnabled, incomingSharedSmartBookId, isAuthLoading, isGuestSession]);

  const nativeRealtimeBookSyncNeeded =
    !isCapacitorNativeRuntime() ||
    savedCourses.some((course) => courseNeedsStartupCloudRefresh(course));

  useEffect(() => {
    if (!authUser?.uid || !cloudSyncEnabled) return;

    const uid = authUser.uid;
    if (isCapacitorNativeRuntime() && !nativeRealtimeBookSyncNeeded) return;

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
        const byId = new Map<string, CourseData>(prev.map((course) => [course.id, course] as const));

        for (const cloudBook of cloudBooks) {
          const localBook = prev.find((course) => course.id === cloudBook.id) || savedCoursesRef.current.find((course) => course.id === cloudBook.id);
          if (!localBook) {
            byId.set(cloudBook.id, cloudBook);
            continue;
          }

          const packageMetadataMerged = mergeCoursePackageMetadata(localBook, cloudBook);
          if (!courseNeedsContentHydration(packageMetadataMerged)) {
            byId.set(localBook.id, packageMetadataMerged);
            continue;
          }

          const mergedBook: CourseData = {
            ...packageMetadataMerged,
            nodes: localBook.nodes.length > 0 ? localBook.nodes : cloudBook.nodes
          };
          byId.set(cloudBook.id, mergedBook);
        }

        const nextCourses = sortCoursesByLastActivity(Array.from(byId.values()));
        savedCoursesRef.current = nextCourses;
        return nextCourses;
      });
      // Side effects must run outside the state updater (no heavy JSON work during React reconciliation).
      const coursesToPersist = savedCoursesRef.current;
      if (coursesToPersist.length > 0) {
        writeCoursesToLocal(uid, coursesToPersist);
        writeFullCoursesToLocal(uid, coursesToPersist);
      }
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
  }, [authUser?.uid, cloudSyncEnabled, nativeRealtimeBookSyncNeeded]);

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

  const eagerHydrationNativeCacheMergedIdsRef = useRef<Set<string>>(new Set());

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
  }, [activeCourse, authUser?.uid, cloudSyncEnabled]);

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
  }, [activeCourse, authUser?.uid, cloudSyncEnabled]);

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
    if (isFairyTaleCourse(course)) return;
    if (course.visualStoryMode === true) return;
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
    if (course.visualStoryMode === true) return;
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

    const hasServerPackage = Boolean(
      resolvePreferredBookZipStoragePath(seededCourse.contentPackagePath, seededCourse.bundle?.path) ||
      String(seededCourse.contentPackageUrl || '').trim()
    );
    if (hasServerPackage) {
      const isInstalled = await ensureCourseHydrated(seededCourse.id, {
        markNodesLoading: false,
        force: true,
        snapshotHint: seededCourse
      });
      if (!isInstalled) {
        updateCourseOpenState(seededCourse.id, { status: 'failed', progress: 0 });
        throw new Error('Book package could not be installed locally.');
      }
      updateCourseOpenState(seededCourse.id, { status: 'ready', progress: 100 });
      openCourseFlow(seededCourse.id);
      return;
    }

    openCourseFlow(seededCourse.id);
    if (seededCourse.nodes.length > 0 && seededCourse.visualStoryMode !== true) {
      startBackgroundSmartBookPackaging(seededCourse.id);
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
        {
          ...stripUndefinedDeepForFirestore(bookDocPayload),
          nodes: deleteField(),
          content: deleteField(),
          pages: deleteField()
        },
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
      const hydrated = await ensureCourseHydrated(courseId, { markNodesLoading: false });
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

  const applyInstalledCourseForOpen = (
    localUserId: string,
    courseId: string,
    installedCourse: CourseData,
    progressSnapshot: CourseData
  ): CourseData => {
    const mergedCourse = mergeSharedCourseWithUserProgress(
      installedCourse,
      toProgressDocFromCourseSnapshot(progressSnapshot)
    );
    coursePackageByIdRef.current.set(courseId, mergedCourse);
    setSavedCourses((prev) => {
      let changed = false;
      const nextCourses = sortCoursesByLastActivity(prev.map((course) => {
        if (course.id !== courseId) return course;
        changed = true;
        return mergedCourse;
      }));
      if (!changed) return prev;
      savedCoursesRef.current = nextCourses;
      writeCoursesToLocal(localUserId, nextCourses);
      writeFullCoursesToLocal(localUserId, nextCourses);
      return nextCourses;
    });
    return mergedCourse;
  };

  const queueBookPackageUpdate = (localUserId: string, cloudCourse: CourseData) => {
    if (!localUserId || !cloudCourse.id) return;
    const cloudVersion = getInstalledBookVersion(cloudCourse);
    const updateKey = `${localUserId}:${cloudCourse.id}:v${cloudVersion}`;
    if (backgroundBookPackageUpdateInFlightRef.current.has(updateKey)) return;
    backgroundBookPackageUpdateInFlightRef.current.add(updateKey);

    void (async () => {
      try {
        const installed = await readInstalledBook(localUserId, cloudCourse.id);
        const installedVersion = installed ? getInstalledBookVersion(installed) : 0;
        if (installedVersion >= cloudVersion) return;
        const updated = await installBookPackage(localUserId, cloudCourse);
        if (!updated) return;

        if (activeCourseId === cloudCourse.id && currentView === 'COURSE_FLOW') {
          coursePackageByIdRef.current.set(cloudCourse.id, updated);
          return;
        }

        setSavedCourses((prev) => {
          let changed = false;
          const nextCourses = sortCoursesByLastActivity(prev.map((course) => {
            if (course.id !== cloudCourse.id) return course;
            changed = true;
            return mergeSharedCourseWithUserProgress(updated, toProgressDocFromCourseSnapshot(course));
          }));
          if (!changed) return prev;
          savedCoursesRef.current = nextCourses;
          writeCoursesToLocal(localUserId, nextCourses);
          writeFullCoursesToLocal(localUserId, nextCourses);
          return nextCourses;
        });
      } catch (error) {
        console.warn('Background book package update skipped:', error);
      } finally {
        backgroundBookPackageUpdateInFlightRef.current.delete(updateKey);
      }
    })();
  };

  const handleCourseSelect = (courseId: string) => {
    void (async () => {
      const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : null);
      if (!localUserId) return;
      const existing = savedCoursesRef.current.find((course) => course.id === courseId)
        || savedCourses.find((course) => course.id === courseId)
        || null;

      if (!existing) return;
      const versionHint = extractBundleVersionFromPath(existing.contentPackagePath) || existing.bundle?.version;
      const installedCourse = await readInstalledBook(localUserId, courseId, versionHint);
      if (installedCourse && hasPersistableCourseContent(installedCourse)) {
        applyInstalledCourseForOpen(localUserId, courseId, installedCourse, existing);
        updateCourseOpenState(courseId, { status: 'ready', progress: 100 });
        openCourseFlow(courseId);
        queueBookPackageUpdate(localUserId, existing);
        return;
      }

      const hasInstallablePackage = Boolean(
        resolvePreferredBookZipStoragePath(existing.contentPackagePath, existing.bundle?.path) ||
        String(existing.contentPackageUrl || '').trim()
      );
      if (hasInstallablePackage) {
        updateCourseOpenState(courseId, { status: 'downloading', progress: 8 });
        try {
          const newlyInstalledCourse = await installBookPackage(localUserId, existing);
          if (!newlyInstalledCourse || !hasPersistableCourseContent(newlyInstalledCourse)) {
            updateCourseOpenState(courseId, { status: 'failed', progress: 8 });
            return;
          }
          applyInstalledCourseForOpen(localUserId, courseId, newlyInstalledCourse, existing);
          updateCourseOpenState(courseId, { status: 'ready', progress: 100 });
          openCourseFlow(courseId);
        } catch (error) {
          console.warn(`Book package installation failed (${courseId}):`, error);
          updateCourseOpenState(courseId, { status: 'failed', progress: 8 });
        }
        return;
      }

      // Legacy books without a package keep their existing reader path.
      if (existing.nodes.length > 0 && !courseNeedsContentHydration(existing)) {
        updateCourseOpenState(courseId, { status: 'ready', progress: 100 });
        openCourseFlow(courseId);
        return;
      }

      const isReady = await ensureCourseReadyForOpen(courseId, existing);
      if (isReady) {
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

    if (authUser) {
      await deleteMyCommunityData({});
    }

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

  const handleCourseUpdate = async (updatedNodes: TimelineNode[], coursePatch?: Partial<CourseData>) => {
    const localUserId = authUser?.uid ?? (isGuestSession ? GUEST_LOCAL_UID : null);
    if (!activeCourseId || !localUserId) return;

    const now = new Date();
    let updatedCourse: CourseData | null = null;

    setSavedCourses(prev => {
      const nextCourses = sortCoursesByLastActivity(
        prev.map((course) => {
          if (course.id !== activeCourseId) return course;
          updatedCourse = { ...course, ...coursePatch, nodes: updatedNodes, lastActivity: now };
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
      ...(coursePatch || {}),
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
            onNavigate={handleViewChange}
            onCourseCreate={handleCourseCreate}
            onDeleteCourse={handleCourseDelete}
            savedCourses={savedCourses}
            onCourseSelect={handleCourseSelect}
            canDeleteCourse={canDeleteCourse}
            stickyNotes={stickyNotes}
            onCreateStickyNote={handleStickyNoteCreate}
            onUpdateStickyNote={handleStickyNoteUpdate}
            onDeleteStickyNote={handleCourseDelete}
            onRequireCredit={requireCreditForAction}
            onConsumeCredit={consumeCreditForAction}
            isBootstrapping={Boolean(isLoading && savedCourses.length === 0)}
            bootstrapMessage={loadingMessage}
            defaultBookLanguage={getAppLanguageLabel(appLanguage)}
            courseOpenStates={courseOpenStateById}
            isLoggedIn={Boolean(authUser && !isGuestSession)}
            onRequestLogin={handleOpenLoginScreen}
            authUserId={authUser?.uid}
          />
        );
      case 'COURSE_FLOW': {
        return (
          <CourseFlowView
            onBack={() => handleViewChange('HOME')}
            onNavigate={handleViewChange}
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
            isLoggedIn={Boolean(authUser && !isGuestSession)}
            onRequestLogin={handleOpenLoginScreen}
            wallet={creditWallet}
          />
        );
      case 'EXPLORE':
        return (
          <HomeView
            onNavigate={handleViewChange}
            onCourseCreate={handleCourseCreate}
            onDeleteCourse={handleCourseDelete}
            savedCourses={savedCourses}
            onCourseSelect={handleCourseSelect}
            canDeleteCourse={canDeleteCourse}
            stickyNotes={stickyNotes}
            onCreateStickyNote={handleStickyNoteCreate}
            onUpdateStickyNote={handleStickyNoteUpdate}
            onDeleteStickyNote={handleCourseDelete}
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
      case 'COMMUNITY':
        return (
          <CommunityView
            authUser={authUser}
            wallet={creditWallet}
            onRequireCredit={requireCreditForAction}
            onNavigate={handleViewChange}
            onOpenPaywall={() => openCreditPaywall('community_download')}
          />
        );
      case 'PROFILE':
        return (
          <ProfileView
            userName={userName}
            userEmail={authUser?.email || (isGuestSession ? 'Misafir oturumu' : undefined)}
            isGuestSession={isGuestSession}
            savedBookCount={savedCourses.length}
            wallet={creditWallet}
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
            onNavigate={handleViewChange}
            onCourseCreate={handleCourseCreate}
            onDeleteCourse={handleCourseDelete}
            savedCourses={savedCourses}
            onCourseSelect={handleCourseSelect}
            canDeleteCourse={canDeleteCourse}
            stickyNotes={stickyNotes}
            onCreateStickyNote={handleStickyNoteCreate}
            onUpdateStickyNote={handleStickyNoteUpdate}
            onDeleteStickyNote={handleCourseDelete}
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

  const canRenderWhileAuthBootstraps = Boolean(
    isAuthLoading &&
    currentView !== 'COURSE_FLOW' &&
    (isGuestSession || bootstrapAuthUid || savedCourses.length > 0)
  );

  if (isAuthLoading && !canRenderWhileAuthBootstraps) {
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

  const shouldWaitForCreditStorePrices = Boolean(
    isCreditPaywallOpen &&
    isCapacitorNativeRuntime() &&
    isRevenueCatEnabled() &&
    CREDIT_PACKS.some((pack) => !creditPackDisplayPrices[pack.id])
  );

  return (
    <UiI18nProvider key={appLanguage} language={appLanguage}>
      <Suspense fallback={<FullScreenFallback message={loadingMessage} />}>
        <div className="fixed inset-0 bg-[#1A1F26] text-text-primary font-sans antialiased flex justify-center">
          <div className="app-shell-width relative h-full overflow-hidden bg-transparent flex flex-col md:border-x md:border-white/5">
            <LoginPromptModal
              isOpen={isLoginPromptOpen}
              onClose={() => setLoginPromptOpen(false)}
              onLogin={() => {
                setLoginPromptOpen(false);
                handleOpenLoginScreen();
              }}
            />
            <CreditPaywallModal
              isOpen={isCreditPaywallOpen}
              onClose={() => {
                setCreditPaywallOpen(false);
                setCreditPaywallIntent(null);
              }}
              wallet={creditWallet}
              packs={CREDIT_PACKS.map((pack) => ({
                ...pack,
                displayPrice: creditPackDisplayPrices[pack.id]
              }))}
              waitForStorePrices={shouldWaitForCreditStorePrices}
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
                currentView={currentView}
                credits={creditWallet}
                onOpenPaywall={() => openCreditPaywall()}
                showBackButton={currentView !== 'HOME'}
                onBack={() => handleViewChange('HOME')}
              />
            )}

            <main className="flex-1 relative overflow-hidden">
              <div className="absolute inset-0 w-full h-full">
                <div
                  key={animationKey}
                  className={`w-full h-full transition-container ${
                    slideDirection === 'right' ? 'animate-slide-from-right' :
                    slideDirection === 'left' ? 'animate-slide-from-left' : ''
                  }`}
                >
                  {renderView()}
                </div>
              </div>
            </main>

            {!isReaderFullscreen && (
              <BottomNav
                currentView={currentView}
                onViewChange={handleViewChange}
                onToggleSettings={handleToggleSettings}
                isSettingsOpen={isSettingsOpen}
                showCourseScrollTop={currentView === 'COURSE_FLOW' && (activeCourse?.bookType === 'story' || activeCourse?.bookType === 'novel')}
                onCourseScrollTop={() => window.dispatchEvent(new CustomEvent('fortale:course-scroll-top'))}
              />
            )}
          </div>
        </div>
      </Suspense>
    </UiI18nProvider>
  );
}
