import React, { useEffect, useMemo, useState } from 'react';
import { CourseData, CourseOpenUiState, CreditWallet } from '../types';
import { BookOpen, Download, Heart, MessageCircle, Search, Share2, Trash2 } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { useUiI18n } from '../i18n/uiI18n';
import { getSmartBookAgeGroupLabel } from '../utils/smartbookAgeGroup';
import { functions } from '../firebaseConfig';
import FaviconSpinner from '../components/FaviconSpinner';
import FortaleDropdown from '../components/FortaleDropdown';
import FloatIslandSheet from '../components/FloatIslandSheet';
import CreditBalanceBreakdown from '../components/CreditBalanceBreakdown';

interface PersonalGrowthViewProps {
  savedCourses: CourseData[];
  onCourseSelect: (id: string) => void;
  onDeleteCourse?: (courseId: string) => Promise<void> | void;
  isBootstrapping?: boolean;
  bootstrapMessage?: string;
  courseOpenStates?: Record<string, CourseOpenUiState>;
  isLoggedIn?: boolean;
  onRequestLogin?: () => void;
  wallet: CreditWallet;
}

const publishToCommunityFn = httpsCallable<Record<string, unknown>, { communityBookId: string }>(functions, 'publishToCommunity');
const getCommunityProfileFn = httpsCallable<Record<string, unknown>, CommunityProfileResult>(functions, 'getCommunityProfile');
const getCommunityBookFn = httpsCallable<{ communityBookId: string }, CommunityBookDetailResult>(functions, 'getCommunityBook');

type CourseTypeFilter = 'all' | NonNullable<CourseData['bookType']>;
type CourseTypeFilterOption = {
  value: CourseTypeFilter;
  label: string;
};

type CommunityBookStats = {
  id: string;
  bookId: string;
  title: string;
  downloadCount: number;
  likeCount: number;
  commentCount?: number;
};

type CommunityProfileResult = {
  profile: {
    userId: string;
    alias?: string;
    followerCount: number;
    followingCount: number;
    publicationCount: number;
    totalLikeCount: number;
    totalDownloadCount: number;
  };
  books: CommunityBookStats[];
};

type CommunityComment = {
  id: string;
  userId: string;
  alias?: string;
  text: string;
  createdAt?: string | Date;
  isMine?: boolean;
};

type CommunityBookDetailResult = {
  book: CommunityBookStats;
  isFollowing: boolean;
  comments: CommunityComment[];
};

type CommentsSheetState = {
  title: string;
  comments: CommunityComment[];
  isLoading: boolean;
  message?: string;
};

function courseHasReadableContent(course: CourseData): boolean {
  const lectureNodes = course.nodes.filter((node) => node.type === 'lecture');
  if (lectureNodes.length === 0) {
    return course.nodes.some((node) => (
      Boolean(node.content?.trim()) ||
      Boolean(node.pageText?.trim()) ||
      Boolean(node.pageImageUrl?.trim()) ||
      Boolean(node.podcastScript?.trim())
    ));
  }
  if (course.visualStoryMode === true) {
    return lectureNodes.every((node) => Boolean(node.pageText?.trim()) && Boolean(node.pageImageUrl?.trim()));
  }
  return lectureNodes.every((node) => Boolean(node.content?.trim()));
}

function formatCourseCreatedDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(date));
}

function getCourseDateTime(date: Date | undefined): number {
  const value = date ? new Date(date).getTime() : 0;
  return Number.isFinite(value) ? value : 0;
}

function normalizeLibrarySearchText(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function bookTypeLabel(bookType?: CourseData['bookType']): string {
  if (bookType === 'fairy_tale') return 'Masal';
  if (bookType === 'story') return 'Çalışma Kitabı';
  if (bookType === 'novel') return 'Hikaye';
  return 'Kitap';
}

function bookTypeClass(bookType?: CourseData['bookType']): string {
  if (bookType === 'fairy_tale' || bookType === 'story' || bookType === 'novel') {
    return `book-type-${bookType}`;
  }
  return 'book-type-book';
}

export default function PersonalGrowthView({
  savedCourses,
  onCourseSelect,
  onDeleteCourse,
  isBootstrapping = false,
  bootstrapMessage,
  courseOpenStates = {},
  isLoggedIn = false,
  onRequestLogin,
  wallet
}: PersonalGrowthViewProps) {
  const { locale, t } = useUiI18n();
  const [typeFilter, setTypeFilter] = useState<CourseTypeFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [courseDeleteModal, setCourseDeleteModal] = useState<{ isOpen: boolean; courseId: string | null; courseTitle: string }>({
    isOpen: false,
    courseId: null,
    courseTitle: ''
  });
  const [isCourseDeleting, setIsCourseDeleting] = useState(false);
  const [publishCourse, setPublishCourse] = useState<CourseData | null>(null);
  const [publishedCourseIds, setPublishedCourseIds] = useState<Set<string>>(new Set());
  const [communityAlias, setCommunityAlias] = useState('');
  const [communityBio, setCommunityBio] = useState('');
  const [communityAgeConfirmed, setCommunityAgeConfirmed] = useState(false);
  const [communityTermsAccepted, setCommunityTermsAccepted] = useState(false);
  const [containsPersonalLikeness, setContainsPersonalLikeness] = useState(false);
  const [likenessAccepted, setLikenessAccepted] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState('');
  const [communityDashboard, setCommunityDashboard] = useState<CommunityProfileResult | null>(null);
  const [isCommunityDashboardLoading, setIsCommunityDashboardLoading] = useState(false);
  const [communityDashboardVersion, setCommunityDashboardVersion] = useState(0);
  const [commentsSheet, setCommentsSheet] = useState<CommentsSheetState | null>(null);
  const [previewCourse, setPreviewCourse] = useState<CourseData | null>(null);
  const effectiveBootstrapMessage = bootstrapMessage || t('Kitaplar yükleniyor...');

  useEffect(() => {
    setPublishedCourseIds(new Set(
      savedCourses
        .filter((course) => course.communityPublication?.status === 'published')
        .map((course) => course.id)
    ));
  }, [savedCourses]);

  useEffect(() => {
    if (!isLoggedIn) {
      setCommunityDashboard(null);
      setIsCommunityDashboardLoading(false);
      return;
    }
    let isCancelled = false;
    setIsCommunityDashboardLoading(true);
    getCommunityProfileFn({})
      .then((result) => {
        if (isCancelled) return;
        setCommunityDashboard(result.data);
      })
      .catch(() => {
        if (isCancelled) return;
        setCommunityDashboard(null);
      })
      .finally(() => {
        if (isCancelled) return;
        setIsCommunityDashboardLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [isLoggedIn, communityDashboardVersion]);

  const communityBookBySourceId = useMemo(() => {
    const map = new Map<string, CommunityBookStats>();
    for (const book of communityDashboard?.books || []) {
      if (book.bookId) map.set(book.bookId, book);
    }
    return map;
  }, [communityDashboard]);

  const totalProducedBooks = savedCourses.length;
  const typeFilterOptions: CourseTypeFilterOption[] = useMemo(() => [
    { value: 'all', label: t('Tüm Kitaplar') },
    { value: 'fairy_tale', label: t('Masal') },
    { value: 'story', label: t('Çalışma Kitabı') },
    { value: 'novel', label: t('Hikaye') }
  ], [t]);

  const sortedCourses = useMemo(
    () =>
      [...savedCourses].sort(
        (a, b) => getCourseDateTime(b.lastActivity) - getCourseDateTime(a.lastActivity)
      ),
    [savedCourses]
  );

  const filteredCourses = useMemo(() => {
    const normalizedQuery = normalizeLibrarySearchText(searchText);
    return sortedCourses.filter((course) => {
      if (typeFilter !== 'all' && course.bookType !== typeFilter) return false;
      if (!normalizedQuery) return true;
      const haystack = normalizeLibrarySearchText([
        course.topic,
        course.title,
        course.description,
        course.subGenre,
        course.creatorName,
        bookTypeLabel(course.bookType),
        getSmartBookAgeGroupLabel(course.ageGroup)
      ].filter(Boolean).join(' '));
      return haystack.includes(normalizedQuery);
    });
  }, [searchText, sortedCourses, typeFilter]);

  const openCourseDeleteModal = (course: CourseData) => {
    if (!onDeleteCourse) return;
    setCourseDeleteModal({
      isOpen: true,
      courseId: course.id,
      courseTitle: course.topic
    });
  };

  const openCommunityPublish = (course: CourseData) => {
    if (!isLoggedIn) {
      onRequestLogin?.();
      return;
    }
    setPublishMessage('');
    setPublishCourse(course);
  };

  const openCommunityComments = async (course: CourseData, communityBook: CommunityBookStats) => {
    if (!isLoggedIn) {
      onRequestLogin?.();
      return;
    }
    setCommentsSheet({
      title: communityBook.title || course.topic,
      comments: [],
      isLoading: true
    });
    try {
      const result = await getCommunityBookFn({ communityBookId: communityBook.id });
      setCommentsSheet({
        title: result.data.book?.title || communityBook.title || course.topic,
        comments: result.data.comments || [],
        isLoading: false
      });
    } catch {
      setCommentsSheet({
        title: communityBook.title || course.topic,
        comments: [],
        isLoading: false,
        message: t('Yorumlar yüklenemedi.')
      });
    }
  };

  const handleCommunityPublish = async () => {
    if (!publishCourse || isPublishing) return;
    setIsPublishing(true);
    setPublishMessage('');
    try {
      await publishToCommunityFn({
        bookId: publishCourse.id,
        isPublic: true,
        alias: communityAlias,
        bio: communityBio,
        ageConfirmed: communityAgeConfirmed,
        rightsAccepted: true,
        termsAccepted: communityTermsAccepted,
        hasPersonalLikeness: containsPersonalLikeness,
        likenessAccepted: !containsPersonalLikeness || likenessAccepted
      });
      setPublishedCourseIds((current) => new Set(current).add(publishCourse.id));
      setCommunityDashboardVersion((version) => version + 1);
      setPublishMessage(t('Kitap toplulukta yayınlandı.'));
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code || '') : '';
      setPublishMessage(code.includes('already-exists') ? t('Bu rumuz kullanılıyor.') : t('Kitap yayınlanamadı. Alanları ve topluluk kurallarını kontrol edin.'));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCommunityUnpublish = async () => {
    if (!publishCourse || isPublishing || !window.confirm(t('Kitabı topluluktan kaldırmak istiyor musunuz?'))) return;
    setIsPublishing(true);
    try {
      await publishToCommunityFn({ bookId: publishCourse.id, isPublic: false });
      setPublishedCourseIds((current) => {
        const next = new Set(current);
        next.delete(publishCourse.id);
        return next;
      });
      setCommunityDashboardVersion((version) => version + 1);
      setPublishCourse(null);
    } catch {
      setPublishMessage(t('Kitap yayından kaldırılamadı.'));
    } finally {
      setIsPublishing(false);
    }
  };

  const closeCourseDeleteModal = () => {
    if (isCourseDeleting) return;
    setCourseDeleteModal({
      isOpen: false,
      courseId: null,
      courseTitle: ''
    });
  };

  const handleCourseDeleteConfirm = async () => {
    if (!onDeleteCourse || !courseDeleteModal.courseId || isCourseDeleting) return;
    setIsCourseDeleting(true);
    try {
      await onDeleteCourse(courseDeleteModal.courseId);
      setCourseDeleteModal({
        isOpen: false,
        courseId: null,
        courseTitle: ''
      });
    } finally {
      setIsCourseDeleting(false);
    }
  };

  const getCourseOpenUi = (course: CourseData) => {
    const state = courseOpenStates[course.id] || { status: 'idle' as const, progress: 0, updatedAt: 0 };
    const progress = Math.max(0, Math.min(100, Math.round(state.progress || 0)));
    const isDownloading = state.status === 'downloading';
    const isReady = state.status === 'ready' || courseHasReadableContent(course);
    const isFailed = state.status === 'failed';
    const label = isReady
      ? t('Oku')
      : isDownloading
        ? `${t('İndiriliyor')} %${progress}`
        : isFailed
          ? t('Tekrar dene')
          : t('İndir');
    return { state, progress, isDownloading, isReady, isFailed, label };
  };

  return (
    <div className="view-container fortale-library-view">
      <div className="app-content-width fortale-library-content space-y-5 pb-24">
        {isLoggedIn && (
          <section className="py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-black text-white">
                  {communityDashboard?.profile.alias || t('Topluluk Profili')}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold text-white">
                  {isCommunityDashboardLoading
                    ? t('Topluluk istatistikleri yükleniyor...')
                    : `${communityDashboard?.profile.publicationCount ?? 0} ${t('yayında')}`}
                </p>
              </div>
              {savedCourses.length > 0 && (
                <div className="flex shrink-0 items-center gap-2">
                  <FortaleDropdown
                    label={t('Kitap Türü')}
                    value={typeFilter}
                    options={typeFilterOptions}
                    onChange={setTypeFilter}
                    className="w-[126px] shrink-0"
                    triggerClassName="!h-9"
                    minMenuWidth={176}
                    menuAlign="right"
                  />
                  <button
                    type="button"
                    onClick={() => setSearchOpen(true)}
                    className="fortale-chrome-icon-button relative flex h-9 w-9 items-center justify-center rounded-full text-white"
                    aria-label={t('Kitap ara')}
                    title={t('Kitap ara')}
                  >
                    <Search size={17} />
                    {searchText.trim() && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-[#9bc7ff]" />}
                  </button>
                </div>
              )}
            </div>
            <div className="mt-3 space-y-2 border-t border-white/[0.08] pt-3 text-[12px] font-bold text-white">
              <div className="grid grid-cols-2 gap-x-4">
                <p>{t('Takipçi')}: <span className="text-white">{communityDashboard?.profile.followerCount ?? 0}</span></p>
                <p>{t('Takip')}: <span className="text-white">{communityDashboard?.profile.followingCount ?? 0}</span></p>
              </div>
              <div className="grid grid-cols-2 gap-x-4">
                <p>{t('Üretilen')}: <span className="text-white">{totalProducedBooks}</span></p>
                <p>{t('İndirilen')}: <span className="text-white">{communityDashboard?.profile.totalDownloadCount ?? 0}</span></p>
              </div>
            </div>
            <CreditBalanceBreakdown wallet={wallet} className="mt-3" compact />
          </section>
        )}
        <section className="space-y-3">
          {!isLoggedIn && savedCourses.length > 0 && (
            <div className="flex items-center justify-end gap-2 py-1">
              <FortaleDropdown
                label={t('Kitap Türü')}
                value={typeFilter}
                options={typeFilterOptions}
                onChange={setTypeFilter}
                className="w-[126px] shrink-0"
                triggerClassName="!h-9"
                minMenuWidth={176}
                menuAlign="right"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="fortale-chrome-icon-button relative flex h-9 w-9 items-center justify-center rounded-full text-white"
                aria-label={t('Kitap ara')}
                title={t('Kitap ara')}
              >
                <Search size={17} />
                {searchText.trim() && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-[#9bc7ff]" />}
              </button>
            </div>
          )}

          {filteredCourses.length === 0 ? (
            <div
              className="fortale-library-panel rounded-2xl border p-5 text-center"
              style={{
                background: 'rgba(17, 22, 29, 0.3)',
                borderColor: 'rgba(188, 194, 203, 0.1)',
                boxShadow: 'inset 0 0 0 1px rgba(188, 194, 203, 0.06)'
              }}
            >
              <p className="text-[12px] text-white">
                {isBootstrapping
                  ? effectiveBootstrapMessage
                  : savedCourses.length > 0
                    ? t('Bu filtrede kitap bulunamadı.')
                    : t('Henüz hiç kitap yok.')}
              </p>
            </div>
          ) : (
            <div className="fortale-library-cover-grid fortale-book-list-grid">
              {filteredCourses.map((course) => {
                const openUi = getCourseOpenUi(course);
                const displayCoverImageUrl = course.deviceCoverImageUrl || course.coverImageUrl;
                const communityBook = communityBookBySourceId.get(course.id);
                return (
                  <article
                    key={course.id}
                    className="fortale-book-list-item"
                  >
                    <button type="button" onClick={() => setPreviewCourse(course)} className="fortale-book-list-cover" aria-label={course.topic}>
                      <span className={`fortale-book-list-cover-media ${bookTypeClass(course.bookType)}`}>
                        {displayCoverImageUrl ? (
                          <img
                            src={displayCoverImageUrl}
                            alt={`${course.topic} ${t('Fortale kapağı')}`}
                            className="h-full w-full object-cover object-center"
                          />
                        ) : (
                          <div className="fortale-shelf-cover-empty">
                            <BookOpen size={24} />
                          </div>
                        )}
                        {openUi.isDownloading && (
                          <div className="fortale-shelf-download-overlay">
                            <div className="fortale-shelf-download-bar"><span style={{ width: `${openUi.progress}%` }} /></div>
                          </div>
                        )}
                      </span>
                    </button>

                    <div className="fortale-book-list-info">
                      <div className="fortale-book-list-topline">
                        <span className="fortale-book-list-type">{t(bookTypeLabel(course.bookType))}</span>
                        <button type="button" onClick={() => !openUi.isDownloading && onCourseSelect(course.id)} disabled={openUi.isDownloading} className="fortale-book-list-read"><BookOpen size={12} /> {openUi.label}</button>
                      </div>
                      <button type="button" onClick={() => setPreviewCourse(course)} className="fortale-book-list-title">{course.topic}</button>
                      <div className="fortale-book-list-byline">
                        <span>{course.creatorName || t('Fortale')}</span>
                        <time dateTime={new Date(course.createdAt || course.lastActivity).toISOString()}>{new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(new Date(course.createdAt || course.lastActivity))}</time>
                        <button type="button" onClick={() => openCommunityPublish(course)} className={publishedCourseIds.has(course.id) ? 'is-published' : ''} title={publishedCourseIds.has(course.id) ? t('Yayında') : t('Toplulukta Paylaş')} aria-label={publishedCourseIds.has(course.id) ? t('Yayında') : t('Toplulukta Paylaş')}><Share2 size={12} /></button>
                      </div>
                      <div className="fortale-book-list-meta">
                        {course.language && <span>{course.language}</span>}
                        {course.subGenre && <span>{t(course.subGenre)}</span>}
                      </div>
                      <div className="fortale-book-list-stats">
                        <span title={t('Kalp')}><Heart size={12} /> {communityBook?.likeCount || 0}</span>
                        <span title={t('İndirilme')}><Download size={12} /> {communityBook?.downloadCount || 0}</span>
                        <button type="button" onClick={() => communityBook && void openCommunityComments(course, communityBook)} disabled={!communityBook} title={t('Yorumlar')} aria-label={t('Yorumlar')}><MessageCircle size={12} /> {communityBook?.commentCount || 0}</button>
                        {onDeleteCourse && <button type="button" onClick={() => openCourseDeleteModal(course)} className="is-danger" title={t('Sil')} aria-label={t('Sil')}><Trash2 size={12} /></button>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
      {searchOpen && (
        <FloatIslandSheet
          isOpen
          onClose={() => setSearchOpen(false)}
          title={t('Kitap ara')}
          layer={1000}
          footer={(
            <button type="button" onClick={() => setSearchOpen(false)} className="flex h-12 w-full items-center justify-center rounded-2xl bg-white text-[13px] font-black text-[#102018] shadow-[0_8px_22px_rgba(255,255,255,0.12)]">
              {t('Ara')}
            </button>
          )}
        >
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white" />
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t('Kitap ara')}
              aria-label={t('Kitap ara')}
              autoFocus
              className="h-12 w-full rounded-2xl border border-white/12 bg-[#0a1522]/75 pl-10 pr-4 text-[13px] text-white outline-none placeholder:text-white focus:border-[#9bc7ff]/55"
            />
          </div>
        </FloatIslandSheet>
      )}
      {previewCourse && (() => {
        const previewCommunityBook = communityBookBySourceId.get(previewCourse.id);
        const previewOpenUi = getCourseOpenUi(previewCourse);
        const previewCover = previewCourse.deviceCoverImageUrl || previewCourse.coverImageUrl;
        return (
          <FloatIslandSheet
            isOpen
            onClose={() => setPreviewCourse(null)}
            title={previewCourse.topic}
            subtitle={`${t(bookTypeLabel(previewCourse.bookType))} · ${formatCourseCreatedDate(previewCourse.createdAt || previewCourse.lastActivity, locale)}`}
            maxWidth={520}
            layer={980}
            footer={(
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewCourse(null);
                    openCommunityPublish(previewCourse);
                  }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.06] text-[12px] font-black text-white"
                >
                  <Share2 size={14} /> {publishedCourseIds.has(previewCourse.id) ? t('Yayında') : t('Toplulukta Paylaş')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewCourse(null);
                    onCourseSelect(previewCourse.id);
                  }}
                  disabled={previewOpenUi.isDownloading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white text-[12px] font-black text-[#102018] disabled:opacity-50"
                >
                  <BookOpen size={14} /> {previewOpenUi.label}
                </button>
              </div>
            )}
          >
            <div className="flex gap-4">
              <div className="w-[126px] shrink-0">
                <span className="fortale-book-list-cover-media">
                  {previewCover ? <img src={previewCover} alt={previewCourse.topic} /> : <span className="fortale-shelf-cover-empty"><BookOpen size={28} /></span>}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <span className="fortale-shelf-type">{t(bookTypeLabel(previewCourse.bookType))}</span>
                <div className="mt-4 grid grid-cols-3 gap-1.5">
                  <span className="inline-flex h-8 items-center justify-center gap-1 rounded-xl bg-white/[0.06] text-[10px] font-black text-white"><Heart size={12} /> {previewCommunityBook?.likeCount || 0}</span>
                  <span className="inline-flex h-8 items-center justify-center gap-1 rounded-xl bg-white/[0.06] text-[10px] font-black text-white"><Download size={12} /> {previewCommunityBook?.downloadCount || 0}</span>
                  <button type="button" onClick={() => previewCommunityBook && void openCommunityComments(previewCourse, previewCommunityBook)} disabled={!previewCommunityBook} className="inline-flex h-8 items-center justify-center gap-1 rounded-xl bg-white/[0.06] text-[10px] font-black text-white disabled:opacity-70"><MessageCircle size={12} /> {previewCommunityBook?.commentCount || 0}</button>
                </div>
                <div className="mt-4 space-y-1.5 text-[10px] leading-5 text-white">
                  {previewCourse.language && <p>{previewCourse.language}</p>}
                  {previewCourse.subGenre && <p>{t(previewCourse.subGenre)}</p>}
                  {previewCourse.creatorName && <p>{previewCourse.creatorName}</p>}
                </div>
              </div>
            </div>
            {previewCourse.description && <div className="mt-5 border-t border-dashed border-white/15 pt-4"><h3 className="text-[13px] font-black text-white">{t('Açıklama')}</h3><p className="mt-2 text-[12px] leading-6 text-white">{previewCourse.description}</p></div>}
          </FloatIslandSheet>
        );
      })()}
      {publishCourse && (
        <FloatIslandSheet isOpen onClose={() => setPublishCourse(null)} title={publishedCourseIds.has(publishCourse.id) ? t('Topluluk Yayını') : t('Toplulukta Paylaş')} subtitle={publishCourse.topic} closeDisabled={isPublishing} layer={1100}>
            <div className="mt-4 flex gap-3 rounded-2xl border border-white/10 bg-black/10 p-3">
              <div className="w-[72px] shrink-0">
                <span className="fortale-book-list-cover-media">
                  {publishCourse.coverImageUrl || publishCourse.deviceCoverImageUrl ? <img src={publishCourse.deviceCoverImageUrl || publishCourse.coverImageUrl} alt={publishCourse.topic} /> : <div className="fortale-shelf-cover-empty"><BookOpen size={20} className="text-white" /></div>}
                </span>
              </div>
              <div className="min-w-0"><p className="text-[12px] font-black text-white">{publishCourse.topic}</p><p className="mt-2 text-[10px] text-white">{t(bookTypeLabel(publishCourse.bookType))} · {publishCourse.language || t('Dil belirtilmedi')}</p><p className="mt-2 text-[10px] leading-4 text-white">{t('Toplulukta ilk bölümün ilk başlığı ücretsiz önizlenir. Tam kitap 0.5 krediyle kişisel kitaplığa eklenir.')}</p></div>
            </div>

            <label className="mt-4 block text-[11px] font-bold text-white">{t('Topluluk rumuzu')}<input value={communityAlias} maxLength={32} onChange={(event) => setCommunityAlias(event.target.value)} placeholder={t('2–32 karakter')} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0a1522] px-3 text-[13px] text-white outline-none" /></label>
            <label className="mt-3 block text-[11px] font-bold text-white">{t('Biyografi')}<textarea value={communityBio} maxLength={160} onChange={(event) => setCommunityBio(event.target.value)} className="mt-2 min-h-16 w-full resize-none rounded-xl border border-white/10 bg-[#0a1522] p-3 text-[12px] text-white outline-none" /></label>

            <div className="mt-4 space-y-3">
              <label className="flex items-start gap-3 text-[11px] leading-5 text-white"><input type="checkbox" checked={communityAgeConfirmed} onChange={(event) => setCommunityAgeConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-400" />{t('13 yaşında veya daha büyük olduğumu onaylıyorum.')}</label>
              <p className="rounded-xl border border-sky-300/20 bg-sky-300/8 p-3 text-[11px] leading-5 text-white">{t('Giriş yaparken kabul ettiğiniz Kullanım Şartları uyarınca, bu içeriği yayınlama hakkına sahip olduğunuz beyanı otomatik olarak geçerlidir.')}</p>
              <label className="flex items-start gap-3 text-[11px] leading-5 text-white"><input type="checkbox" checked={communityTermsAccepted} onChange={(event) => setCommunityTermsAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-400" />{t('Topluluk kurallarını, moderasyonu ve kişisel kullanım lisansını kabul ediyorum.')}</label>
              <label className="flex items-start gap-3 text-[11px] leading-5 text-white"><input type="checkbox" checked={containsPersonalLikeness} onChange={(event) => { setContainsPersonalLikeness(event.target.checked); if (!event.target.checked) setLikenessAccepted(false); }} className="mt-1 h-4 w-4 accent-emerald-400" />{t('Kitapta bana veya başka bir gerçek kişiye benzeyen stilize görsel var.')}</label>
              {containsPersonalLikeness && <label className="ml-7 flex items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/8 p-3 text-[11px] leading-5 text-amber-100"><input type="checkbox" checked={likenessAccepted} onChange={(event) => setLikenessAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-amber-300" />{t('Bu kişisel benzerliğin herkese açık toplulukta gösterilmesini ayrıca onaylıyorum.')}</label>}
            </div>

            {publishMessage && <p className={`mt-4 rounded-xl border p-3 text-[11px] font-bold ${publishedCourseIds.has(publishCourse.id) ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100' : 'border-rose-300/20 bg-rose-400/10 text-rose-100'}`}>{publishMessage}</p>}

            <div className="mt-5 grid grid-cols-2 gap-2">
              {publishedCourseIds.has(publishCourse.id) ? <button type="button" onClick={() => void handleCommunityUnpublish()} disabled={isPublishing} className="rounded-2xl border border-rose-300/25 bg-rose-400/10 py-3 text-[11px] font-black text-rose-100 disabled:opacity-50">{t('Yayından Kaldır')}</button> : <button type="button" onClick={() => setPublishCourse(null)} disabled={isPublishing} className="rounded-2xl border border-white/10 bg-white/5 py-3 text-[11px] font-black text-white">{t('Vazgeç')}</button>}
              <button type="button" onClick={() => void handleCommunityPublish()} disabled={isPublishing || !communityAlias.trim() || !communityAgeConfirmed || !communityTermsAccepted || (containsPersonalLikeness && !likenessAccepted)} className="flex items-center justify-center rounded-2xl bg-[#7eb79b] py-3 text-[11px] font-black text-[#102018] disabled:opacity-40">{isPublishing ? <FaviconSpinner size={14} /> : publishedCourseIds.has(publishCourse.id) ? t('Güncelle') : t('Yayınla')}</button>
            </div>
        </FloatIslandSheet>
      )}

      {commentsSheet && (
        <FloatIslandSheet isOpen onClose={() => setCommentsSheet(null)} title={t('Yorumlar')} subtitle={commentsSheet.title} layer={1100}>
            <div className="mt-4 max-h-[56vh] space-y-2 overflow-y-auto pr-1">
              {commentsSheet.isLoading ? (
                <div className="flex min-h-24 items-center justify-center">
                  <FaviconSpinner size={22} />
                </div>
              ) : commentsSheet.message ? (
                <p className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3 text-[12px] font-bold text-rose-100">
                  {commentsSheet.message}
                </p>
              ) : commentsSheet.comments.length === 0 ? (
                <p className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4 text-center text-[12px] font-semibold text-white">
                  {t('Henüz yorum yok.')}
                </p>
              ) : (
                commentsSheet.comments.map((comment) => (
                  <div key={comment.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12px] font-black text-white">{comment.alias || t('Okur')}</p>
                      {comment.createdAt && (
                        <span className="shrink-0 text-[9px] font-semibold text-white">
                          {formatCourseCreatedDate(new Date(comment.createdAt), locale)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-5 text-white">{comment.text}</p>
                  </div>
                ))
              )}
            </div>
        </FloatIslandSheet>
      )}

      {courseDeleteModal.isOpen && (
        <FloatIslandSheet isOpen onClose={closeCourseDeleteModal} title={t('Bu kitabı silmek istediğine emin misin?')} subtitle={courseDeleteModal.courseTitle} closeDisabled={isCourseDeleting} layer={1150} bodyClassName="hidden" footer={(
          <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={closeCourseDeleteModal}
                  disabled={isCourseDeleting}
                  className="h-12 rounded-2xl border border-white/12 bg-[rgba(34,44,58,0.95)] text-[14px] font-semibold text-white disabled:opacity-60"
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
        )}><span /></FloatIslandSheet>
      )}
    </div>
  );
}
