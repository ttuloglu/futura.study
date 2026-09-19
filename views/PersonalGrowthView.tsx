import React, { useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { CourseData, CourseOpenUiState, CreditWallet } from '../types';
import { BookOpen, Search, Trash2 } from 'lucide-react';
import { useUiI18n } from '../i18n/uiI18n';
import { getSmartBookAgeGroupLabel } from '../utils/smartbookAgeGroup';
import FaviconSpinner from '../components/FaviconSpinner';
import FortaleDropdown from '../components/FortaleDropdown';
import FloatIslandSheet from '../components/FloatIslandSheet';

interface PersonalGrowthViewProps {
  savedCourses: CourseData[];
  onCourseSelect: (id: string) => void;
  onDeleteCourse?: (courseId: string) => Promise<void> | void;
  isBootstrapping?: boolean;
  bootstrapMessage?: string;
  courseOpenStates?: Record<string, CourseOpenUiState>;
  isLoggedIn?: boolean;
  onRequestLogin?: () => void;
  wallet?: CreditWallet;
}

type CourseTypeFilter = 'all' | NonNullable<CourseData['bookType']>;
type CourseTypeFilterOption = {
  value: CourseTypeFilter;
  label: string;
};

function resolveCourseCoverImageUrl(course: CourseData): string | undefined {
  if (Capacitor.isNativePlatform()) {
    return course.deviceCoverImageUrl || course.coverImageUrl;
  }
  return course.coverImageUrl;
}

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
  courseOpenStates = {}
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
  const [previewCourse, setPreviewCourse] = useState<CourseData | null>(null);
  const effectiveBootstrapMessage = bootstrapMessage || t('Kitaplar yükleniyor...');

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
        {/* Library Header Bar */}
        <section className="py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-black text-white">
                {t('Kişisel Kitaplığım')}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-white/60">
                {savedCourses.length} {t('kitap')}
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
        </section>

        {/* Book list */}
        <section className="space-y-3">
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
                    : t('Henüz hiç kitap yok. Ana sayfadan yeni bir kitap üretebilirsiniz.')}
              </p>
            </div>
          ) : (
            <div className="fortale-library-cover-grid fortale-book-list-grid">
              {filteredCourses.map((course) => {
                const openUi = getCourseOpenUi(course);
                const displayCoverImageUrl = resolveCourseCoverImageUrl(course);
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
                      </div>
                      <div className="fortale-book-list-meta">
                        {course.language && <span>{course.language}</span>}
                        {course.subGenre && <span>{t(course.subGenre)}</span>}
                      </div>
                      <div className="fortale-book-list-stats flex items-center justify-end">
                        {onDeleteCourse && (
                          <button type="button" onClick={() => openCourseDeleteModal(course)} className="is-danger" title={t('Sil')} aria-label={t('Sil')}>
                            <Trash2 size={13} />
                          </button>
                        )}
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
        const previewOpenUi = getCourseOpenUi(previewCourse);
        const previewCover = resolveCourseCoverImageUrl(previewCourse);
        return (
          <FloatIslandSheet
            isOpen
            onClose={() => setPreviewCourse(null)}
            title={previewCourse.topic}
            subtitle={`${t(bookTypeLabel(previewCourse.bookType))} · ${formatCourseCreatedDate(previewCourse.createdAt || previewCourse.lastActivity, locale)}`}
            maxWidth={520}
            layer={980}
            footer={(
              <button
                type="button"
                onClick={() => {
                  setPreviewCourse(null);
                  onCourseSelect(previewCourse.id);
                }}
                disabled={previewOpenUi.isDownloading}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[13px] font-black text-[#102018] disabled:opacity-50"
              >
                {previewOpenUi.isDownloading ? <FaviconSpinner size={24} dark={true} /> : <BookOpen size={16} />} {previewOpenUi.label}
              </button>
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
                <div className="mt-4 space-y-1.5 text-[11px] leading-5 text-white/80">
                  {previewCourse.language && <p><span className="text-white/50">{t('Dil')}:</span> {previewCourse.language}</p>}
                  {previewCourse.subGenre && <p><span className="text-white/50">{t('Alt Tür')}:</span> {t(previewCourse.subGenre)}</p>}
                  {previewCourse.creatorName && <p><span className="text-white/50">{t('Yazar')}:</span> {previewCourse.creatorName}</p>}
                </div>
              </div>
            </div>
            {previewCourse.description && (
              <div className="mt-5 border-t border-dashed border-white/15 pt-4">
                <h3 className="text-[13px] font-black text-white">{t('Açıklama')}</h3>
                <p className="mt-2 text-[12px] leading-6 text-white/80">{previewCourse.description}</p>
              </div>
            )}
          </FloatIslandSheet>
        );
      })()}

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
