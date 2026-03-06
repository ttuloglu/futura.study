import React, { useMemo, useState } from 'react';
import { CourseData, TimelineNode } from '../types';
import { BookOpen, Clock3, Trash2 } from 'lucide-react';
import { useUiI18n } from '../i18n/uiI18n';
import { getSmartBookAgeGroupLabel } from '../utils/smartbookAgeGroup';

interface PersonalGrowthViewProps {
  savedCourses: CourseData[];
  onCourseSelect: (id: string) => void;
  onDeleteCourse?: (courseId: string) => Promise<void> | void;
  isBootstrapping?: boolean;
  bootstrapMessage?: string;
}

type CourseFilter = 'ongoing' | 'completed';
type SuccessScore = number | null;

type CourseStatusMeta = {
  progress: number;
  isCompleted: boolean;
  successScore: SuccessScore;
  isAchieved: boolean;
  statusLabel: string;
  statusToneClass: string;
  statusToneStyle: React.CSSProperties;
};

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

function formatTimeAgo(date: Date, t: (value: string) => string): string {
  const now = Date.now();
  const diffMs = Math.max(0, now - new Date(date).getTime());
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} ${t('gün önce')}`;
  if (hours > 0) return `${hours} ${t('saat önce')}`;
  if (minutes > 0) return `${minutes} ${t('dk önce')}`;
  return t('Az önce');
}

function bookTypeLabel(bookType?: CourseData['bookType']): string {
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

  const fallbackMinutes = Math.max(
    1,
    course.nodes.reduce((sum, node) => {
      const match = String(node.duration || '').match(/\d+/);
      return sum + (match ? Number.parseInt(match[0], 10) : 0);
    }, 0)
  );

  return `${fallbackMinutes} ${t('dk')}`;
}

export default function PersonalGrowthView({
  savedCourses,
  onCourseSelect,
  onDeleteCourse,
  isBootstrapping = false,
  bootstrapMessage
}: PersonalGrowthViewProps) {
  const { t } = useUiI18n();
  const [filter, setFilter] = useState<CourseFilter>('ongoing');
  const [courseDeleteModal, setCourseDeleteModal] = useState<{ isOpen: boolean; courseId: string | null; courseTitle: string }>({
    isOpen: false,
    courseId: null,
    courseTitle: ''
  });
  const [isCourseDeleting, setIsCourseDeleting] = useState(false);
  const effectiveBootstrapMessage = bootstrapMessage || t('Kitaplar yükleniyor...');

  const sortedCourses = useMemo(
    () =>
      [...savedCourses].sort(
        (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      ),
    [savedCourses]
  );

  const coursesWithMeta = useMemo(
    () =>
      sortedCourses.map((course) => ({
        course,
        meta: getCourseMeta(course)
      })),
    [sortedCourses]
  );

  const filteredCourses = useMemo(() => {
    if (filter === 'completed') {
      return coursesWithMeta.filter((item) => item.meta.isCompleted);
    }
    return coursesWithMeta.filter((item) => !item.meta.isCompleted);
  }, [coursesWithMeta, filter]);

  const filterButtonClass = (kind: CourseFilter) =>
    `flex-1 min-w-0 py-2 rounded-lg text-[10px] font-bold transition-all border border-dashed whitespace-nowrap ${filter === kind
      ? 'text-[#efe7db] border-transparent'
      : 'text-[#b7ab9b] border-transparent hover:text-[#efe7db] hover:bg-[rgba(60,52,45,0.35)]'
    }`;

  const filterButtonStyle = (kind: CourseFilter): React.CSSProperties =>
    filter === kind
      ? {
        background: 'linear-gradient(135deg, rgba(35,67,103,0.95) 0%, rgba(24,44,70,0.92) 100%)',
        boxShadow: 'inset 0 0 0 1px rgba(165,207,255,0.3), 0 0 14px rgba(94,141,198,0.22)',
        border: '1px dashed rgba(146,194,246,0.42)',
        color: '#ffffff'
      }
      : {};

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

  const getNextStep = (course: CourseData): TimelineNode | undefined =>
    course.nodes.find((node) => node.status === 'current') || course.nodes.find((node) => node.status === 'locked');

  return (
    <div
      className="view-container"
      style={{
        background:
          'radial-gradient(circle at 12% 7%, rgba(182, 223, 255, 0.24), transparent 44%), radial-gradient(circle at 88% 11%, rgba(143, 206, 255, 0.2), transparent 42%), linear-gradient(180deg, #1f3a57 0%, #162b42 100%)'
      }}
    >
      <div className="app-content-width space-y-5 pb-24">
        <section className="space-y-3">
          <div
            className="flex items-center gap-1 rounded-xl border border-dashed p-1"
            style={{
              background: 'rgba(17, 22, 29, 0.45)',
              borderColor: 'rgba(173, 149, 124, 0.12)',
              boxShadow: 'none'
            }}
          >
            <button
              onClick={() => setFilter('ongoing')}
              className={filterButtonClass('ongoing')}
              style={filterButtonStyle('ongoing')}
            >
              {t('Kitaplarım')}
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={filterButtonClass('completed')}
              style={filterButtonStyle('completed')}
            >
              {t('Okuduklarım')}
            </button>
          </div>

          {filteredCourses.length === 0 ? (
            <div
              className="rounded-2xl border border-dashed p-5 text-center"
              style={{
                background: 'rgba(17, 22, 29, 0.3)',
                borderColor: 'rgba(188, 194, 203, 0.1)',
                boxShadow: 'inset 0 0 0 1px rgba(188, 194, 203, 0.06)'
              }}
            >
              <p className="text-[12px] text-text-secondary">
                {isBootstrapping
                  ? effectiveBootstrapMessage
                  : (savedCourses.length === 0 ? t('Henüz hiç kitap yok.') : t('Bu filtrede kitap bulunamadı.'))}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredCourses.map(({ course, meta }) => (
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
                  className="group h-full rounded-[24px] border border-dashed p-3 text-left transition-all active:scale-[0.99] md:p-3.5"
                  style={{
                    background: 'rgba(17, 22, 29, 0.3)',
                    borderColor: 'rgba(188, 194, 203, 0.1)',
                    boxShadow: 'inset 0 0 0 1px rgba(188, 194, 203, 0.06)'
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
                        <>
                          <img
                            src={course.coverImageUrl}
                            alt={`${course.topic} ${t('Fortale kapağı')}`}
                            className="h-full w-full object-contain object-center border-0"
                          />
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-1.5 pb-1.5 pt-5">
                            <p className="line-clamp-3 text-[8px] font-black leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                              {course.topic}
                            </p>
                          </div>
                        </>
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
                            {getNextStep(course)?.title || t('Fortale Tamamlandı')}
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
                              strokeDashoffset={2 * Math.PI * 16 * (1 - meta.progress / 100)}
                              className="text-accent-green transition-all duration-700 ease-out"
                              strokeLinecap="round"
                            />
                          </svg>
                          <span className="absolute text-[8px] font-black text-accent-green">%{meta.progress}</span>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span
                          className="inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-semibold text-[#b9cde8]"
                          style={{ background: 'rgba(23, 38, 58, 0.72)', boxShadow: 'inset 0 0 0 1px rgba(55,80,111,0.22)' }}
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
                              width: `${meta.progress}%`,
                              background: 'linear-gradient(90deg, #5aa9ff 0%, #3b82f6 100%)'
                            }}
                          />
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-[#9cb9d7]">{formatTimeAgo(course.lastActivity, t)}</span>
                          <div className="flex items-center gap-1.5">
                            {onDeleteCourse && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openCourseDeleteModal(course);
                                }}
                                className="inline-flex items-center gap-1 rounded-xl border border-dashed border-[#ef4444]/50 bg-[rgba(127,29,29,0.35)] px-2 py-1 text-[10px] font-bold text-[#fecaca] transition-colors hover:bg-[rgba(127,29,29,0.55)]"
                                title={t('Sil')}
                              >
                                <Trash2 size={11} />
                                {t('Sil')}
                              </button>
                            )}
                            <span className="inline-flex items-center rounded-xl border border-dashed border-[#7da9d7]/35 bg-[rgba(22,48,82,0.76)] px-2.5 py-1 text-[10px] font-bold text-white transition-transform group-active:scale-95">
                              {t('Devam Et')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
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
    </div>
  );
}
