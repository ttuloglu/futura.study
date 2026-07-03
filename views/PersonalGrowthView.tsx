import React, { useEffect, useMemo, useState } from 'react';
import { CourseData, CourseOpenUiState } from '../types';
import { BookOpen, Download, FileText, Heart, MessageCircle, Search, Share2, Trash2, X } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { useUiI18n } from '../i18n/uiI18n';
import { getSmartBookAgeGroupLabel } from '../utils/smartbookAgeGroup';
import { functions } from '../firebaseConfig';
import FaviconSpinner from '../components/FaviconSpinner';
import FortaleDropdown from '../components/FortaleDropdown';

interface PersonalGrowthViewProps {
  savedCourses: CourseData[];
  onCourseSelect: (id: string) => void;
  onDeleteCourse?: (courseId: string) => Promise<void> | void;
  isBootstrapping?: boolean;
  bootstrapMessage?: string;
  courseOpenStates?: Record<string, CourseOpenUiState>;
  isLoggedIn?: boolean;
  onRequestLogin?: () => void;
}

const publishToCommunityFn = httpsCallable<Record<string, unknown>, { communityBookId: string }>(functions, 'publishToCommunity');
const getCommunityProfileFn = httpsCallable<Record<string, unknown>, CommunityProfileResult>(functions, 'getCommunityProfile');
const getCommunityBookFn = httpsCallable<{ communityBookId: string }, CommunityBookDetailResult>(functions, 'getCommunityBook');

type CourseViewMode = 'card' | 'cover';
type CourseTypeFilter = 'all' | NonNullable<CourseData['bookType']>;
type CourseTypeFilterOption = {
  value: CourseTypeFilter;
  label: string;
};
type SuccessScore = number | null;

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

type CourseStatusMeta = {
  progress: number;
  isCompleted: boolean;
  successScore: SuccessScore;
  isAchieved: boolean;
  statusLabel: string;
  statusToneClass: string;
  statusToneStyle: React.CSSProperties;
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

function getCourseMeta(course: CourseData): CourseStatusMeta {
  const total = course.nodes.length;
  const completedCount = course.nodes.filter((node) => node.status === 'completed').length;
  const rawProgress = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const progress = Math.min(100, Math.max(0, rawProgress));
  const retentionNode = course.nodes.find((node) => node.type === 'retention');
  const completedByRetention =
    retentionNode?.status === 'completed' && (retentionNode.score ?? 0) >= 70;
  const completedByAllNodes = total > 0 && completedCount >= total;
  const isCompleted = completedByRetention || completedByAllNodes;
  const retentionScore = typeof retentionNode?.score === 'number' ? retentionNode.score : null;
  const examNode = course.nodes.find((node) => node.type === 'exam');
  const examScore = typeof examNode?.score === 'number' ? examNode.score : null;
  const quizNode = course.nodes.find((node) => node.type === 'quiz');
  const quizScore = typeof quizNode?.score === 'number' ? quizNode.score : null;
  const scoredNodes = course.nodes
    .filter((node) => (node.type === 'quiz' || node.type === 'exam' || node.type === 'retention') && typeof node.score === 'number')
    .map((node) => Number(node.score));
  const averageScore = scoredNodes.length ? Math.round(scoredNodes.reduce((sum, value) => sum + value, 0) / scoredNodes.length) : null;
  const successScore = retentionScore ?? examScore ?? quizScore ?? averageScore;
  const isAchieved = isCompleted && typeof successScore === 'number' && successScore >= 70;

  if (isCompleted) {
    return {
      progress: 100,
      isCompleted: true,
      successScore,
      isAchieved,
      statusLabel: 'Tamamlandı',
      statusToneClass: 'text-[#8fd0ff] bg-[#163451]',
      statusToneStyle: {
        boxShadow: 'inset 0 0 0 1px rgba(89, 164, 219, 0.38)'
      }
    };
  }

  return {
    progress,
    isCompleted: false,
    successScore,
    isAchieved: false,
    statusLabel: 'Devam Ediyor',
    statusToneClass: 'text-[#f2c46a] bg-[#3a2d14]',
    statusToneStyle: {
      boxShadow: 'inset 0 0 0 1px rgba(188, 142, 59, 0.35)'
    }
  };
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

function estimateCoursePageCount(course: CourseData): number {
  if (Number.isFinite(course.targetPageCount)) {
    return Math.max(1, Math.floor(course.targetPageCount as number));
  }
  const readableNodes = course.nodes.filter((node) => (
    node.type === 'lecture' &&
    (node.content?.trim() || node.pageText?.trim() || node.pageImageUrl?.trim())
  ));
  if (readableNodes.length > 0) return readableNodes.length;
  const textWords = course.nodes.reduce((sum, node) => {
    const content = `${node.content || ''} ${node.pageText || ''} ${node.podcastScript || ''}`.trim();
    return sum + (content ? content.split(/\s+/).filter(Boolean).length : 0);
  }, 0);
  if (textWords > 0) return Math.max(1, Math.round(textWords / 180));
  return Math.max(1, course.nodes.length);
}

export default function PersonalGrowthView({
  savedCourses,
  onCourseSelect,
  onDeleteCourse,
  isBootstrapping = false,
  bootstrapMessage,
  courseOpenStates = {},
  isLoggedIn = false,
  onRequestLogin
}: PersonalGrowthViewProps) {
  const { locale, t } = useUiI18n();
  const [viewMode, setViewMode] = useState<CourseViewMode>('card');
  const [typeFilter, setTypeFilter] = useState<CourseTypeFilter>('all');
  const [searchText, setSearchText] = useState('');
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
  const [communityRightsAccepted, setCommunityRightsAccepted] = useState(false);
  const [communityTermsAccepted, setCommunityTermsAccepted] = useState(false);
  const [containsPersonalLikeness, setContainsPersonalLikeness] = useState(false);
  const [likenessAccepted, setLikenessAccepted] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState('');
  const [communityDashboard, setCommunityDashboard] = useState<CommunityProfileResult | null>(null);
  const [isCommunityDashboardLoading, setIsCommunityDashboardLoading] = useState(false);
  const [communityDashboardVersion, setCommunityDashboardVersion] = useState(0);
  const [commentsSheet, setCommentsSheet] = useState<CommentsSheetState | null>(null);
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

  const coursesWithMeta = useMemo(
    () =>
      filteredCourses.map((course) => ({
        course,
        meta: getCourseMeta(course)
      })),
    [filteredCourses]
  );

  const viewModeButtonClass = (kind: CourseViewMode) =>
    `fortale-library-mode-button h-8 rounded-xl px-3 text-[10px] font-bold transition-all ${viewMode === kind
      ? 'text-white'
      : 'text-[#b7cbe0] hover:text-white'
    }`;

  const viewModeButtonStyle = (_kind: CourseViewMode): React.CSSProperties => ({});

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
        rightsAccepted: communityRightsAccepted,
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

  const renderCommunityStats = (course: CourseData, communityBook?: CommunityBookStats) => {
    if (!communityBook) return null;
    const statClass = 'inline-flex h-8 items-center gap-1.5 rounded-xl bg-white/[0.065] px-2.5 text-[12px] font-black text-[#d7e7f6]';
    return (
      <div className="flex flex-wrap items-center justify-start gap-1.5">
        <span className={statClass} title={t('Kalp')}>
          <Heart size={13} className="text-[#ff8aa8]" />
          {communityBook.likeCount || 0}
        </span>
        <span className={statClass} title={t('İndirilme')}>
          <Download size={13} className="text-[#8fd0ff]" />
          {communityBook.downloadCount || 0}
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void openCommunityComments(course, communityBook);
          }}
          className={`${statClass} transition-colors hover:bg-white/[0.09] hover:text-white`}
          title={t('Yorumlar')}
          aria-label={t('Yorumlar')}
        >
          <MessageCircle size={13} className="text-[#d9c7ff]" />
          {communityBook.commentCount || 0}
        </button>
      </div>
    );
  };

  return (
    <div className="view-container fortale-library-view">
      <div className="app-content-width fortale-library-content space-y-5 pb-24">
        <section className="fortale-library-hero">
          <p>{t('Fortale')}</p>
          <h1>{t('Kitaplarım')}</h1>
          <span>{t('Create, Discover and Share')}</span>
        </section>
        {isLoggedIn && (
          <section
            className="fortale-library-panel rounded-2xl border p-3"
            style={{
              background: 'rgba(17, 22, 29, 0.3)',
              borderColor: 'rgba(188, 194, 203, 0.1)',
              boxShadow: 'inset 0 0 0 1px rgba(188, 194, 203, 0.06)'
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-black text-white">
                  {communityDashboard?.profile.alias || t('Topluluk Profili')}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold text-[#91a9c2]">
                  {isCommunityDashboardLoading
                    ? t('Topluluk istatistikleri yükleniyor...')
                    : `${communityDashboard?.profile.publicationCount ?? 0} ${t('yayında')}`}
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-2 border-t border-white/[0.08] pt-3 text-[12px] font-bold text-[#c8daeb]">
              <div className="grid grid-cols-2 gap-x-4">
                <p>{t('Takipçi')}: <span className="text-white">{communityDashboard?.profile.followerCount ?? 0}</span></p>
                <p>{t('Takip')}: <span className="text-white">{communityDashboard?.profile.followingCount ?? 0}</span></p>
              </div>
              <div className="grid grid-cols-2 gap-x-4">
                <p>{t('Üretilen')}: <span className="text-white">{totalProducedBooks}</span></p>
                <p>{t('İndirilen')}: <span className="text-white">{communityDashboard?.profile.totalDownloadCount ?? 0}</span></p>
              </div>
            </div>
          </section>
        )}
        <section className="space-y-3">
          {savedCourses.length > 0 && (
            <div
              className="fortale-library-panel flex flex-col gap-2 rounded-2xl border px-3 py-2.5 md:flex-row md:items-center md:justify-between"
              style={{
                background: 'rgba(17, 22, 29, 0.3)',
                borderColor: 'rgba(188, 194, 203, 0.1)',
                boxShadow: 'inset 0 0 0 1px rgba(188, 194, 203, 0.06)'
              }}
            >
              <div className="relative min-w-0 flex-1">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7f9ab8]" />
                <input
                  type="search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder={t('Kitap ara')}
                  className="h-9 w-full rounded-xl border bg-[rgba(15,24,36,0.62)] pl-9 pr-3 text-[12px] font-semibold text-[#d9e9f8] outline-none placeholder:text-[#7892ad]"
                  style={{ borderColor: 'rgba(135, 164, 197, 0.18)' }}
                />
              </div>
              <div className="flex items-center justify-between gap-2 md:justify-end">
                <div
                  className="fortale-library-mode-switch inline-flex shrink-0 items-center gap-1 rounded-xl border p-1"
                  style={{
                    background: 'rgba(15, 24, 36, 0.62)',
                    borderColor: 'rgba(135, 164, 197, 0.18)'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setViewMode('card')}
                    className={viewModeButtonClass('card')}
                    style={viewModeButtonStyle('card')}
                  >
                    {t('Kart')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('cover')}
                    className={viewModeButtonClass('cover')}
                    style={viewModeButtonStyle('cover')}
                  >
                    {t('Kapak')}
                  </button>
                </div>
                <FortaleDropdown
                  label={t('Kitap Türü')}
                  value={typeFilter}
                  options={typeFilterOptions}
                  onChange={setTypeFilter}
                  className="min-w-[132px] shrink-0"
                  triggerClassName="!h-9"
                  minMenuWidth={176}
                  menuAlign="right"
                />
              </div>
            </div>
          )}

          {coursesWithMeta.length === 0 ? (
            <div
              className="fortale-library-panel rounded-2xl border p-5 text-center"
              style={{
                background: 'rgba(17, 22, 29, 0.3)',
                borderColor: 'rgba(188, 194, 203, 0.1)',
                boxShadow: 'inset 0 0 0 1px rgba(188, 194, 203, 0.06)'
              }}
            >
              <p className="text-[12px] text-text-secondary">
                {isBootstrapping
                  ? effectiveBootstrapMessage
                  : savedCourses.length > 0
                    ? t('Bu filtrede kitap bulunamadı.')
                    : t('Henüz hiç kitap yok.')}
              </p>
            </div>
          ) : (
            <div className={viewMode === 'cover' ? 'grid grid-cols-2 gap-3 md:grid-cols-3' : 'grid grid-cols-1 gap-3 md:grid-cols-2'}>
              {coursesWithMeta.map(({ course, meta }) => {
                const openUi = getCourseOpenUi(course);
                const displayCoverImageUrl = course.deviceCoverImageUrl || course.coverImageUrl;
                const communityBook = communityBookBySourceId.get(course.id);
                const openButtonClass = 'fortale-library-open-button inline-flex items-center rounded-xl border px-2.5 py-1 text-[10px] font-bold text-white transition-transform group-active:scale-95 disabled:cursor-not-allowed disabled:opacity-80';
                return viewMode === 'cover' ? (
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
                    className={`fortale-library-card group ${bookTypeClass(course.bookType)} cursor-pointer rounded-[24px] border p-2.5 text-left transition-all active:scale-[0.99]`}
                    style={{
                      background: 'rgba(17, 22, 29, 0.3)',
                      borderColor: 'rgba(188, 194, 203, 0.1)',
                      boxShadow: 'inset 0 0 0 1px rgba(188, 194, 203, 0.06)'
                    }}
                  >
                    <div className="overflow-hidden rounded-[20px]">
                      <div
                        className="aspect-[3/4] overflow-hidden rounded-[20px]"
                        style={displayCoverImageUrl
                          ? { background: 'rgba(10, 16, 24, 0.78)' }
                          : { background: 'linear-gradient(160deg, rgba(33,51,77,0.96) 0%, rgba(18,29,44,0.94) 100%)' }}
                      >
                        {displayCoverImageUrl ? (
                          <img
                            src={displayCoverImageUrl}
                            alt={`${course.topic} ${t('Fortale kapağı')}`}
                            className="h-full w-full scale-[1.08] object-cover object-center"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <BookOpen size={28} className="text-zinc-500" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 min-w-0">
                      {renderCommunityStats(course, communityBook)}
                      <div
                        className="mt-2 flex items-center justify-between gap-2 border-t pt-2"
                        style={{ borderColor: 'rgba(96, 129, 164, 0.3)' }}
                      >
                        <p className="text-[10px] text-[#d2e3f3]">
                          {formatCourseCreatedDate(course.createdAt || course.lastActivity, locale)}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              openCommunityPublish(course);
                            }}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-xl transition-colors ${publishedCourseIds.has(course.id) ? 'bg-emerald-400/15 text-emerald-200' : 'text-[#9cb9d7] hover:bg-white/[0.06] hover:text-white'}`}
                            title={publishedCourseIds.has(course.id) ? t('Yayında') : t('Toplulukta Paylaş')}
                            aria-label={publishedCourseIds.has(course.id) ? t('Yayında') : t('Toplulukta Paylaş')}
                          >
                            <Share2 size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              if (openUi.isDownloading) return;
                              onCourseSelect(course.id);
                            }}
                            disabled={openUi.isDownloading}
                            className={openButtonClass}
                            style={
                              openUi.isReady
                                ? {
                                  borderColor: 'rgba(110, 231, 183, 0.55)',
                                  background: 'linear-gradient(135deg, rgba(16,72,46,0.85) 0%, rgba(12,58,36,0.82) 100%)'
                                }
                                : openUi.isDownloading
                                  ? {
                                    borderColor: 'rgba(96, 165, 250, 0.5)',
                                    background: 'linear-gradient(135deg, rgba(29,78,216,0.55) 0%, rgba(30,64,175,0.5) 100%)'
                                  }
                                  : openUi.isFailed
                                    ? {
                                      borderColor: 'rgba(248, 113, 113, 0.45)',
                                      background: 'rgba(127, 29, 29, 0.75)'
                                    }
                                    : {
                                      borderColor: 'rgba(148, 163, 184, 0.4)',
                                      background: 'rgba(23, 38, 58, 0.78)'
                                    }
                            }
                          >
                            {openUi.label}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
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
                    className={`fortale-library-card group ${bookTypeClass(course.bookType)} h-full cursor-pointer rounded-[24px] border p-3 text-left transition-all active:scale-[0.99] md:p-3.5`}
                    style={{
                      background: 'rgba(17, 22, 29, 0.3)',
                      borderColor: 'rgba(188, 194, 203, 0.1)',
                      boxShadow: 'inset 0 0 0 1px rgba(188, 194, 203, 0.06)'
                    }}
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className="relative shrink-0 h-[92px] w-[69px] overflow-hidden rounded-[4px] md:h-[104px] md:w-[78px]"
                        style={displayCoverImageUrl
                          ? { background: 'transparent' }
                          : { background: 'rgba(44, 48, 53, 0.72)' }}
                      >
                        {displayCoverImageUrl ? (
                          <img
                            src={displayCoverImageUrl}
                            alt={`${course.topic} ${t('Fortale kapağı')}`}
                            className="h-full w-full scale-[1.08] object-cover object-center border-0"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <BookOpen size={20} className="text-zinc-500" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-[13px] font-bold leading-[1.25] text-white">
                            {course.topic}
                          </p>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`fortale-library-type-tag ${bookTypeClass(course.bookType)} inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-semibold`}
                          >
                            {t(bookTypeLabel(course.bookType))}
                          </span>
                          {course.subGenre?.trim() && (
                            <span
                              className="inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-semibold text-[#b9cde8]"
                              style={{ background: 'rgba(23, 38, 58, 0.72)', boxShadow: 'inset 0 0 0 1px rgba(55,80,111,0.22)' }}
                            >
                              {t(course.subGenre.trim())}
                            </span>
                          )}
                          {course.bookType !== 'story' && (
                            <span
                              className="inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-semibold text-[#b9cde8]"
                              style={{ background: 'rgba(23, 38, 58, 0.72)', boxShadow: 'inset 0 0 0 1px rgba(55,80,111,0.22)' }}
                            >
                              {t(getSmartBookAgeGroupLabel(course.ageGroup))}
                            </span>
                          )}
                          <div className="inline-flex items-center gap-1.5 rounded-lg bg-[rgba(23,38,58,0.68)] px-2 py-1" title={t('Sayfa')}>
                            <FileText size={10} className="text-[#7fb1ec]" />
                            <span className="text-[10px] text-[#b9cde8]">
                              {estimateCoursePageCount(course)} {t('sf')}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3">
                          <div
                            className="flex items-center justify-between gap-2 border-t pt-2"
                            style={{ borderColor: 'rgba(96, 129, 164, 0.3)' }}
                          >
                            {communityBook ? renderCommunityStats(course, communityBook) : (
                              <span className="text-[10px] text-[#9cb9d7]">
                                {formatCourseCreatedDate(course.createdAt || course.lastActivity, locale)}
                              </span>
                            )}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openCommunityPublish(course);
                                }}
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-xl transition-colors ${publishedCourseIds.has(course.id) ? 'bg-emerald-400/15 text-emerald-200' : 'text-[#9cb9d7] hover:bg-white/[0.06] hover:text-white'}`}
                                title={publishedCourseIds.has(course.id) ? t('Yayında') : t('Toplulukta Paylaş')}
                                aria-label={publishedCourseIds.has(course.id) ? t('Yayında') : t('Toplulukta Paylaş')}
                              >
                                <Share2 size={11} />
                              </button>
                              {onDeleteCourse && (
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
                                  if (openUi.isDownloading) return;
                                  onCourseSelect(course.id);
                                }}
                                disabled={openUi.isDownloading}
                                className={openButtonClass}
                                style={
                                  openUi.isReady
                                    ? {
                                      borderColor: 'rgba(110, 231, 183, 0.55)',
                                      background: 'linear-gradient(135deg, rgba(16,72,46,0.85) 0%, rgba(12,58,36,0.82) 100%)'
                                    }
                                    : openUi.isDownloading
                                      ? {
                                        borderColor: 'rgba(96, 165, 250, 0.5)',
                                        background: 'linear-gradient(135deg, rgba(29,78,216,0.55) 0%, rgba(30,64,175,0.5) 100%)'
                                      }
                                      : openUi.isFailed
                                        ? {
                                          borderColor: 'rgba(248, 113, 113, 0.45)',
                                          background: 'rgba(127, 29, 29, 0.75)'
                                        }
                                        : {
                                          borderColor: 'rgba(148, 163, 184, 0.4)',
                                          background: 'rgba(23, 38, 58, 0.78)'
                                        }
                                }
                              >
                                {openUi.label}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
      {publishCourse && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[26px] border border-white/10 bg-[#111c2a] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[17px] font-black text-white">{publishedCourseIds.has(publishCourse.id) ? t('Topluluk Yayını') : t('Toplulukta Paylaş')}</h2>
                <p className="mt-1 line-clamp-2 text-[11px] text-[#a9bfd4]">{publishCourse.topic}</p>
              </div>
              <button type="button" onClick={() => !isPublishing && setPublishCourse(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-white"><X size={17} /></button>
            </div>

            <div className="mt-4 flex gap-3 rounded-2xl border border-white/10 bg-black/10 p-3">
              <div className="h-24 w-[72px] shrink-0 overflow-hidden rounded-lg bg-[#0a1522]">
                {publishCourse.coverImageUrl || publishCourse.deviceCoverImageUrl ? <img src={publishCourse.deviceCoverImageUrl || publishCourse.coverImageUrl} alt={publishCourse.topic} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><BookOpen size={20} className="text-white/30" /></div>}
              </div>
              <div className="min-w-0"><p className="text-[12px] font-black text-white">{publishCourse.topic}</p><p className="mt-2 text-[10px] text-white/50">{t(bookTypeLabel(publishCourse.bookType))} · {publishCourse.language || t('Dil belirtilmedi')}</p><p className="mt-2 text-[10px] leading-4 text-[#9db5cd]">{t('Toplulukta ilk iki okunabilir bölüm ücretsiz önizlenir. Tam kitap 0.5 krediyle kişisel kitaplığa eklenir.')}</p></div>
            </div>

            <label className="mt-4 block text-[11px] font-bold text-white/70">{t('Topluluk rumuzu')}<input value={communityAlias} maxLength={32} onChange={(event) => setCommunityAlias(event.target.value)} placeholder={t('2–32 karakter')} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0a1522] px-3 text-[13px] text-white outline-none" /></label>
            <label className="mt-3 block text-[11px] font-bold text-white/70">{t('Biyografi')}<textarea value={communityBio} maxLength={160} onChange={(event) => setCommunityBio(event.target.value)} className="mt-2 min-h-16 w-full resize-none rounded-xl border border-white/10 bg-[#0a1522] p-3 text-[12px] text-white outline-none" /></label>

            <div className="mt-4 space-y-3">
              <label className="flex items-start gap-3 text-[11px] leading-5 text-[#c5d5e4]"><input type="checkbox" checked={communityAgeConfirmed} onChange={(event) => setCommunityAgeConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-400" />{t('13 yaşında veya daha büyük olduğumu onaylıyorum.')}</label>
              <label className="flex items-start gap-3 text-[11px] leading-5 text-[#c5d5e4]"><input type="checkbox" checked={communityRightsAccepted} onChange={(event) => setCommunityRightsAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-400" />{t('Bu içeriği yayınlama hakkına sahip olduğumu beyan ediyorum.')}</label>
              <label className="flex items-start gap-3 text-[11px] leading-5 text-[#c5d5e4]"><input type="checkbox" checked={communityTermsAccepted} onChange={(event) => setCommunityTermsAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-400" />{t('Topluluk kurallarını, moderasyonu ve kişisel kullanım lisansını kabul ediyorum.')}</label>
              <label className="flex items-start gap-3 text-[11px] leading-5 text-[#c5d5e4]"><input type="checkbox" checked={containsPersonalLikeness} onChange={(event) => { setContainsPersonalLikeness(event.target.checked); if (!event.target.checked) setLikenessAccepted(false); }} className="mt-1 h-4 w-4 accent-emerald-400" />{t('Kitapta bana veya başka bir gerçek kişiye benzeyen stilize görsel var.')}</label>
              {containsPersonalLikeness && <label className="ml-7 flex items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/8 p-3 text-[11px] leading-5 text-amber-100"><input type="checkbox" checked={likenessAccepted} onChange={(event) => setLikenessAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-amber-300" />{t('Bu kişisel benzerliğin herkese açık toplulukta gösterilmesini ayrıca onaylıyorum.')}</label>}
            </div>

            {publishMessage && <p className={`mt-4 rounded-xl border p-3 text-[11px] font-bold ${publishedCourseIds.has(publishCourse.id) ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100' : 'border-rose-300/20 bg-rose-400/10 text-rose-100'}`}>{publishMessage}</p>}

            <div className="mt-5 grid grid-cols-2 gap-2">
              {publishedCourseIds.has(publishCourse.id) ? <button type="button" onClick={() => void handleCommunityUnpublish()} disabled={isPublishing} className="rounded-2xl border border-rose-300/25 bg-rose-400/10 py-3 text-[11px] font-black text-rose-100 disabled:opacity-50">{t('Yayından Kaldır')}</button> : <button type="button" onClick={() => setPublishCourse(null)} disabled={isPublishing} className="rounded-2xl border border-white/10 bg-white/5 py-3 text-[11px] font-black text-white/65">{t('Vazgeç')}</button>}
              <button type="button" onClick={() => void handleCommunityPublish()} disabled={isPublishing || !communityAlias.trim() || !communityAgeConfirmed || !communityRightsAccepted || !communityTermsAccepted || (containsPersonalLikeness && !likenessAccepted)} className="flex items-center justify-center rounded-2xl bg-[#7eb79b] py-3 text-[11px] font-black text-[#102018] disabled:opacity-40">{isPublishing ? <FaviconSpinner size={14} /> : publishedCourseIds.has(publishCourse.id) ? t('Güncelle') : t('Yayınla')}</button>
            </div>
          </div>
        </div>
      )}

      {commentsSheet && (
        <div className="fixed inset-0 z-[96] flex items-end justify-center bg-black/65 backdrop-blur-sm">
          <button
            type="button"
            aria-label={t('Kapat')}
            className="absolute inset-0"
            onClick={() => setCommentsSheet(null)}
          />
          <div className="relative w-full max-w-md rounded-t-[28px] border border-white/10 bg-[#101b29] p-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] shadow-[0_-24px_64px_rgba(0,0,0,0.42)]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-black text-white">{t('Yorumlar')}</p>
                <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold text-[#9fb5cc]">{commentsSheet.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setCommentsSheet(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white"
                aria-label={t('Kapat')}
              >
                <X size={16} />
              </button>
            </div>

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
                <p className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4 text-center text-[12px] font-semibold text-[#a9bfd4]">
                  {t('Henüz yorum yok.')}
                </p>
              ) : (
                commentsSheet.comments.map((comment) => (
                  <div key={comment.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12px] font-black text-white">{comment.alias || t('Okur')}</p>
                      {comment.createdAt && (
                        <span className="shrink-0 text-[9px] font-semibold text-[#7f96ad]">
                          {formatCourseCreatedDate(new Date(comment.createdAt), locale)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-5 text-[#d4e3f2]">{comment.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
