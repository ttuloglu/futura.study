import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { CourseData, CourseOpenUiState, CreditWallet } from '../types';
import { BookOpen, Search, Trash2, X } from 'lucide-react';
import { useUiI18n } from '../i18n/uiI18n';
import { getSmartBookAgeGroupLabel } from '../utils/smartbookAgeGroup';
import FaviconSpinner from '../components/FaviconSpinner';
import LibraryTypeFilter from '../components/LibraryTypeFilter';
import FloatIslandSheet from '../components/FloatIslandSheet';
import { getReadingRecords, subscribeReading } from '../utils/readingProgress';
import { libraryReadingState, sortLibraryByReading } from '../utils/readingProgressModel';
import { APP_LANGUAGE_OPTIONS, getLocalizedLanguageName } from '../data/appLanguages';

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
  const readingRecords = useSyncExternalStore(subscribeReading, getReadingRecords);
  const [typeFilter, setTypeFilter] = useState<CourseTypeFilter>('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [courseDeleteModal, setCourseDeleteModal] = useState<{ isOpen: boolean; courseId: string | null; courseTitle: string }>({
    isOpen: false,
    courseId: null,
    courseTitle: ''
  });
  const [isCourseDeleting, setIsCourseDeleting] = useState(false);
  const [previewCourse, setPreviewCourse] = useState<CourseData | null>(null);
  const [fullscreenCover, setFullscreenCover] = useState<{ src: string; title: string } | null>(null);
  const effectiveBootstrapMessage = bootstrapMessage || t('Kitaplar yükleniyor...');

  const typeFilterOptions: CourseTypeFilterOption[] = useMemo(() => [
    { value: 'all', label: t('Tüm Kitaplar') },
    { value: 'fairy_tale', label: t('Masal') },
    { value: 'story', label: t('Çalışma Kitabı') },
    { value: 'novel', label: t('Hikaye') }
  ], [t]);

  const languageFilterOptions = useMemo(() => {
    const codes = Array.from(new Set(savedCourses.map(course => course.languageLearning?.targetLanguage || course.language).filter((code): code is string => Boolean(code))));
    return [
      { value: 'all', label: t('Tüm Diller') },
      ...codes.sort((a, b) => a.localeCompare(b)).map(code => ({
        value: code,
        label: APP_LANGUAGE_OPTIONS.find(option => option.code === code)?.label || code
      }))
    ];
  }, [savedCourses, t]);

  const sortedCourses = useMemo(
    () => sortLibraryByReading(savedCourses, readingRecords),
    [savedCourses, readingRecords]
  );

  const filteredCourses = useMemo(() => {
    const normalizedQuery = normalizeLibrarySearchText(searchText);
    return sortedCourses.filter((course) => {
      if (typeFilter !== 'all' && course.bookType !== typeFilter) return false;
      const courseLanguage = course.languageLearning?.targetLanguage || course.language;
      if (languageFilter !== 'all' && courseLanguage !== languageFilter) return false;
      if (!normalizedQuery) return true;
      const haystack = normalizeLibrarySearchText([
        course.topic,
        course.description,
        course.subGenre,
        course.creatorName,
        course.languageLearning?.targetLanguage,
        course.languageLearning?.cefrLevel,
        bookTypeLabel(course.bookType),
        getSmartBookAgeGroupLabel(course.ageGroup)
      ].filter(Boolean).join(' '));
      return haystack.includes(normalizedQuery);
    });
  }, [languageFilter, searchText, sortedCourses, typeFilter]);

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
    const reading = libraryReadingState(readingRecords[course.id]);
    const label = isDownloading
      ? `${t('İndiriliyor')} %${progress}`
      : isFailed
        ? t('Tekrar dene')
        : reading.started
          ? t('Okumaya devam et')
          : isReady ? t('Oku') : t('İndir');
    return { state, progress, isDownloading, isReady, isFailed, label, reading };
  };

  return (
    <div className="view-container fortale-library-view">
      <div className="app-content-width fortale-library-content space-y-3 pb-24">
        {/* Library Header Bar */}
        {savedCourses.length > 0 && (
          <section className="pt-1 pb-1">
            <div className="flex items-center gap-1.5">
              <LibraryTypeFilter<CourseTypeFilter>
                label={t('Kitap Türü')}
                value={typeFilter}
                options={typeFilterOptions}
                onChange={setTypeFilter}
                width={144}
              />
              <LibraryTypeFilter<string>
                label={t('Kitap Dili')}
                value={languageFilter}
                options={languageFilterOptions}
                onChange={setLanguageFilter}
                width={124}
              />
              <div className="ml-auto flex items-center gap-1.5">
                <span className="whitespace-nowrap text-[10px] font-semibold text-white/65">{savedCourses.length} {t('kitap')}</span>
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
            </div>
          </section>
        )}

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
            <div className="grid grid-cols-3 gap-x-2.5 gap-y-4 items-start">
              {filteredCourses.map((course) => {
                const openUi = getCourseOpenUi(course);
                const displayCoverImageUrl = resolveCourseCoverImageUrl(course);
                const typeName = t(course.bookType === 'story' ? course.creativeBrief?.workbookCategory || course.category || bookTypeLabel(course.bookType) : bookTypeLabel(course.bookType));
                const subGenreName = course.subGenre ? t(course.subGenre) : (course.category ? t(course.category) : '');

                return (
                  <article key={course.id} className="flex flex-col min-w-0">
                    {/* Kitap görseli (yazı yok) */}
                    <button
                      type="button"
                      onClick={() => setPreviewCourse(course)}
                      className="group relative block w-full text-left"
                      aria-label={course.topic}
                    >
                      <div className="relative aspect-[9/13] w-full overflow-hidden rounded-[8px] bg-white/[0.04] shadow-[0_4px_14px_rgba(0,0,0,0.35)] transition-transform group-active:scale-[0.97]">
                        {displayCoverImageUrl ? (
                          <img
                            src={displayCoverImageUrl}
                            alt=""
                            className="h-full w-full object-cover object-center"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1c2430] to-[#0f141c] text-white/30">
                            <BookOpen size={24} />
                          </div>
                        )}

                        {openUi.isDownloading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                            <FaviconSpinner size={20} />
                          </div>
                        )}

                        {/* Kitabın alt borderı kırmızı okuma ilerleme çubuğu */}
                        <div
                          className="absolute bottom-0 inset-x-0 h-[3px] bg-black/50 overflow-hidden"
                          role="progressbar"
                          aria-label={t('Okuma ilerlemesi')}
                          aria-valuenow={openUi.reading.progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="fortale-progress-bar-red h-full transition-all"
                            style={{ width: `${openUi.reading.progress}%`, backgroundColor: '#c04235' }}
                          />
                        </div>
                      </div>
                    </button>

                    {/* Altında oku butonu (ikon yok) */}
                    <button
                      type="button"
                      onClick={() => !openUi.isDownloading && onCourseSelect(course.id)}
                      disabled={openUi.isDownloading}
                      className="mt-2 flex h-[30px] w-full items-center justify-center rounded-[8px] bg-white text-[11px] font-bold text-[#0a1c31] transition-transform active:scale-95 disabled:opacity-50"
                    >
                      {openUi.isDownloading ? `${t('İndiriliyor')} %${openUi.progress}` : t('Oku')}
                    </button>

                    {/* Altında tür adı */}
                    <button
                      type="button"
                      onClick={() => setPreviewCourse(course)}
                      className="mt-1.5 truncate text-center text-[11px] font-semibold text-white/90 hover:text-white"
                      title={typeName}
                    >
                      {typeName}
                    </button>

                    {/* Altında alt tür adı */}
                    <div
                      className="truncate text-center text-[10px] text-white/50"
                      title={subGenreName}
                    >
                      {subGenreName || '\u00A0'}
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
          keyboardAware
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
        const languageName = getLocalizedLanguageName(previewCourse.languageLearning?.targetLanguage || previewCourse.language, locale);
        const languageDisplayString = previewCourse.languageLearning
          ? `${t('Dil öğrenme kitabı')} · ${languageName} ${previewCourse.languageLearning.cefrLevel}`
          : languageName;
        const typeName = t(bookTypeLabel(previewCourse.bookType));
        const subGenreName = previewCourse.subGenre ? t(previewCourse.subGenre) : '';

        return (
          <FloatIslandSheet
            isOpen
            onClose={() => setPreviewCourse(null)}
            title={previewCourse.topic}
            subtitle={`${typeName} · ${formatCourseCreatedDate(previewCourse.createdAt || previewCourse.lastActivity, locale)}`}
            maxWidth={520}
            layer={980}
            footer={(
              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewCourse(null);
                    onCourseSelect(previewCourse.id);
                  }}
                  disabled={previewOpenUi.isDownloading}
                  className="flex-1 h-12 rounded-2xl bg-white text-[13px] font-bold text-[#102018] flex items-center justify-center disabled:opacity-50 active:scale-[0.98] transition-transform"
                >
                  {previewOpenUi.isDownloading ? `${t('İndiriliyor')} %${previewOpenUi.progress}` : t('Oku')}
                </button>
                {onDeleteCourse && (
                  <button
                    type="button"
                    onClick={() => {
                      const courseToDelete = previewCourse;
                      setPreviewCourse(null);
                      openCourseDeleteModal(courseToDelete);
                    }}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
                    title={t('Sil')}
                    aria-label={t('Sil')}
                  >
                    <Trash2 size={19} />
                  </button>
                )}
              </div>
            )}
          >
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => previewCover && setFullscreenCover({ src: previewCover, title: previewCourse.topic })}
                className="w-[110px] shrink-0 cursor-zoom-in text-left transition-transform active:scale-95"
                aria-label={t('Kapağı tam ekran gör')}
              >
                <div className="relative aspect-[9/13] w-full overflow-hidden rounded-[8px] bg-white/[0.04] shadow-[0_4px_12px_rgba(0,0,0,0.35)]">
                  {previewCover ? (
                    <img src={previewCover} alt={previewCourse.topic} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1c2430] to-[#0f141c] text-white/30">
                      <BookOpen size={28} />
                    </div>
                  )}
                  {/* Kapak alt borderı kırmızı ilerleme */}
                  <div className="absolute bottom-0 inset-x-0 h-[3px] bg-black/50 overflow-hidden">
                    <div className="fortale-progress-bar-red h-full transition-all" style={{ width: `${previewOpenUi.reading.progress}%`, backgroundColor: '#c04235' }} />
                  </div>
                </div>
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="fortale-shelf-type">{typeName}</span>
                  {subGenreName && <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white/80">{subGenreName}</span>}
                </div>
                <div className="mt-2.5 space-y-1 text-[11px] leading-5 text-white/80">
                  {languageDisplayString && <p className="text-white/90">{languageDisplayString}</p>}
                  {previewCourse.creatorName && <p><span className="text-white/50">{t('Yazar')}:</span> {previewCourse.creatorName}</p>}
                </div>
              </div>
            </div>

            {/* İlerleme Çubuğu */}
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-white/70">{t('Okuma İlerlemesi')}</span>
                <span className="text-white font-black">%{previewOpenUi.reading.progress}</span>
              </div>
              <div
                className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-label={t('Okuma ilerlemesi')}
                aria-valuenow={previewOpenUi.reading.progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="fortale-progress-bar-red h-full rounded-full transition-all"
                  style={{ width: `${previewOpenUi.reading.progress}%`, backgroundColor: '#c04235' }}
                />
              </div>
            </div>

            {/* Kısa bir açıklama */}
            <div className="mt-4 border-t border-white/10 pt-3">
              <h4 className="text-[12px] font-bold text-white/90">{t('Açıklama')}</h4>
              <p className="mt-1.5 text-[12px] leading-relaxed text-white/75">
                {previewCourse.description || previewCourse.creativeBrief?.synopsis || t('Bu kitap için henüz bir açıklama eklenmedi.')}
              </p>
            </div>
          </FloatIslandSheet>
        );
      })()}

      <FloatIslandSheet
        isOpen={Boolean(fullscreenCover)}
        onClose={() => setFullscreenCover(null)}
        title={fullscreenCover?.title || t('Kapak Görseli')}
        layer={1200}
        maxWidth={520}
        panelClassName="fortale-cover-preview-sheet"
      >
        {fullscreenCover && (
          <img
            src={fullscreenCover.src}
            alt={fullscreenCover.title}
            className="fortale-cover-preview-image"
          />
        )}
      </FloatIslandSheet>

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
