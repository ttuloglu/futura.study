import React, { useMemo, useState } from 'react';
import { CourseData } from '../types';
import { BookOpen, Clock3 } from 'lucide-react';
import { useUiI18n } from '../i18n/uiI18n';

interface PersonalGrowthViewProps {
  savedCourses: CourseData[];
  onCourseSelect: (id: string) => void;
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

export default function PersonalGrowthView({
  savedCourses,
  onCourseSelect,
  isBootstrapping = false,
  bootstrapMessage
}: PersonalGrowthViewProps) {
  const { t } = useUiI18n();
  const [filter, setFilter] = useState<CourseFilter>('ongoing');
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
        backgroundColor: 'rgba(21, 46, 70, 0.94)',
        boxShadow:
          'inset 0 0 0 1px rgba(143, 208, 255, 0.24), inset 0 -6px 12px rgba(33, 150, 243, 0.1)',
        border: '1px dashed rgba(143, 208, 255, 0.22)',
        color: '#9fd9ff'
      }
      : {};

  return (
    <div className="view-container">
      <div className="app-content-width space-y-5 pb-24">
        <section className="space-y-3">
          <div
            className="flex items-center gap-1 rounded-xl border border-dashed p-1"
            style={{
              background: 'rgba(17, 22, 29, 0.9)',
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
            <div className="rounded-2xl p-5 text-center bg-[#111b29] shadow-[inset_0_0_0_1px_rgba(54,79,108,0.34)]">
              <p className="text-[12px] text-text-secondary">
                {isBootstrapping
                  ? effectiveBootstrapMessage
                  : (savedCourses.length === 0 ? t('Henüz hiç kitap yok.') : t('Bu filtrede kitap bulunamadı.'))}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredCourses.map(({ course, meta }) => (
                <button
                  key={course.id}
                  onClick={() => onCourseSelect(course.id)}
                  className="h-full w-full rounded-2xl bg-[#111b29] p-3 text-left shadow-[inset_0_0_0_1px_rgba(54,79,108,0.34)] transition-all active:scale-[0.99]"
                  style={{ background: 'rgba(17, 22, 29, 0.42)' }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`shrink-0 w-[52px] h-[69px] rounded-[3px] overflow-hidden ${course.coverImageUrl ? '' : 'bg-[#1a2637]'}`}
                      style={course.coverImageUrl ? { background: 'transparent', boxShadow: 'none' } : undefined}
                    >
                      {course.coverImageUrl ? (
                        <img
                          src={course.coverImageUrl}
                          alt={`${course.topic} ${t('SmartBook kapağı')}`}
                          className="w-full h-full object-contain object-center border-0"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen size={16} className="text-white/30" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-[13px] font-bold text-white leading-[1.25] line-clamp-2">
                          {course.topic}
                        </h3>
                        <span
                          className={`shrink-0 px-2 py-1 rounded-full text-[9px] font-black ${meta.statusToneClass}`}
                          style={meta.statusToneStyle}
                        >
                          {t(meta.statusLabel)}
                        </span>
                      </div>

                      <div className="mt-2">
                        <div className="h-1.5 rounded-full bg-[#233246] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${meta.progress}%`,
                              maxWidth: '100%',
                              background: meta.isCompleted
                                ? 'linear-gradient(90deg, #3ecbff 0%, #2196F3 100%)'
                                : 'linear-gradient(90deg, #5aa9ff 0%, #3b82f6 100%)'
                            }}
                          />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-text-secondary">
                          <span>%{meta.progress} {t('ilerleme')}</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 size={10} />
                            {formatTimeAgo(course.lastActivity, t)}
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] text-white/78">
                          {t('Başarı puanı:')}{' '}
                          <span className={`font-bold ${typeof meta.successScore === 'number' ? (meta.successScore >= 70 ? 'text-[#9fd9ff]' : 'text-[#f4c17b]') : 'text-white/45'}`}>
                            {typeof meta.successScore === 'number' ? `%${meta.successScore}` : t('Henüz yok')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
