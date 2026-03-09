import React from 'react';
import { Play, Clock, BookOpen } from 'lucide-react';
import { Subject } from '../types';
import { useUiI18n } from '../i18n/uiI18n';

interface CourseCardProps {
  subject: Subject;
  onClick: () => void;
}

export default function CourseCard({ subject, onClick }: CourseCardProps) {
  const { t } = useUiI18n();
  return (
    <div
      onClick={onClick}
      className="group relative glass-panel bg-white/[0.03] border-white/5 rounded-2xl p-4 transition-all duration-300 cursor-pointer overflow-hidden active:scale-[0.98] hover:bg-white/[0.08]"
    >
      <div className="relative z-10">
        <div className="mb-3">
          <div className="flex-1">
            <span className="inline-block px-2 py-0.5 bg-accent-green/10 text-accent-green text-[8px] font-black tracking-tighter rounded-lg mb-1.5 shadow-none">
              {t('Devam Ediyor')}
            </span>
            <h3 className="text-base font-bold text-white leading-[1.24] mb-0.5">
              {subject.title}
            </h3>
            <p className="text-text-secondary text-[10px] font-medium opacity-60">
              {subject.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1.5 text-text-secondary opacity-50">
            <Clock size={12} />
            <span className="text-[9px] font-bold">{t('45dk kaldı')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-text-secondary opacity-50">
            <BookOpen size={12} />
            <span className="text-[9px] font-bold">{t('12 kart')}</span>
          </div>
        </div>

        <button className="w-full btn-glass-primary py-1.5 shadow-md">
          <Play size={10} fill="currentColor" />
          <span className="text-[10px]">{t('Devam et')}</span>
        </button>
      </div>
    </div>
  );
}
