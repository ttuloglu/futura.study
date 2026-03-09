import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useUiI18n } from '../i18n/uiI18n';

type OnboardingMediaType = 'video' | 'image';

type OnboardingSlide = {
  id: string;
  type: OnboardingMediaType;
  src: string;
  label: string;
  title: string;
  description: string;
};

interface OnboardingViewProps {
  onFinish: () => void;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: 'intro-video',
    type: 'video',
    src: '/onboarding/fortale-onboarding-intro.mp4',
    label: 'Fortale',
    title: 'Hayalini yaz, hikayen başlasın.',
    description: 'Masal, hikaye ve roman kitaplarını saniyeler içinde üret.'
  },
  {
    id: 'image-1',
    type: 'image',
    src: '/onboarding/fortale-1.webp',
    label: 'Masal Üretimi',
    title: 'Çocuklara büyülü masallar hazırla.',
    description: 'Yaş grubu ve karakter seç, Fortale akıcı bir masal kursun.'
  },
  {
    id: 'image-3',
    type: 'image',
    src: '/onboarding/fortale-3.webp',
    label: 'Roman Modu',
    title: 'Hayal gücünü kullan.',
    description: 'Fortale karakter gelişimi ve tutarlı anlatımla kitabını büyütür.'
  },
  {
    id: 'image-4',
    type: 'image',
    src: '/onboarding/fortale-4.webp',
    label: 'Yaz ve Paylaş',
    title: 'Hikaye ve Romanını yaz.',
    description: 'PDF ve EPUB olarak paylaş.'
  },
  {
    id: 'image-5',
    type: 'image',
    src: '/onboarding/fortale-5.webp',
    label: 'Dışa Aktar',
    title: 'PDF ve EPUB olarak paylaş.',
    description: 'Kitaplarını tek dokunuşla PDF veya EPUB biçiminde indir.'
  },
  {
    id: 'image-6',
    type: 'image',
    src: '/onboarding/fortale-6.webp',
    label: 'Hazır',
    title: 'Fortale ile Epic ol.',
    description: 'Şimdi giriş yap ve ilk masalını hemen oluştur.'
  }
];

export default function OnboardingView({ onFinish }: OnboardingViewProps) {
  const { t } = useUiI18n();
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeProgress, setActiveProgress] = useState(0);
  const [failedMediaById, setFailedMediaById] = useState<Record<string, true>>({});
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);

  const activeSlide = SLIDES[activeIndex];
  const isLastSlide = activeIndex === SLIDES.length - 1;
  const canGoBack = activeIndex > 0;
  const hasMediaError = Boolean(failedMediaById[activeSlide.id]);

  const handleSkip = () => {
    onFinish();
  };

  const handleNext = () => {
    if (isLastSlide) {
      onFinish();
      return;
    }
    setActiveIndex((prev) => Math.min(prev + 1, SLIDES.length - 1));
  };

  const handlePrevious = () => {
    if (!canGoBack) return;
    setActiveIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleMediaError = () => {
    setFailedMediaById((prev) => {
      if (prev[activeSlide.id]) return prev;
      return { ...prev, [activeSlide.id]: true };
    });
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
    touchEndXRef.current = null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    touchEndXRef.current = event.changedTouches[0]?.clientX ?? null;
    const start = touchStartXRef.current;
    const end = touchEndXRef.current;
    if (start === null || end === null) return;

    const delta = start - end;
    if (Math.abs(delta) < 42) return;
    if (delta > 0) {
      handleNext();
      return;
    }
    handlePrevious();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault();
        if (isLastSlide) {
          onFinish();
          return;
        }
        setActiveIndex((prev) => Math.min(prev + 1, SLIDES.length - 1));
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onFinish();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isLastSlide, onFinish]);

  useEffect(() => {
    const AUTO_ADVANCE_MS = 5200;
    const startedAt = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const nextProgress = Math.min((now - startedAt) / AUTO_ADVANCE_MS, 1);
      setActiveProgress(nextProgress);

      if (nextProgress >= 1) {
        if (isLastSlide) {
          onFinish();
        } else {
          setActiveIndex((prev) => Math.min(prev + 1, SLIDES.length - 1));
        }
        return;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    setActiveProgress(0);
    rafId = window.requestAnimationFrame(tick);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [activeIndex, isLastSlide, onFinish]);

  return (
    <div className="fixed inset-0 z-[120] bg-[#020406] text-white">
      <div
        className="relative h-full w-full overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {!hasMediaError && activeSlide.type === 'video' && (
          <video
            key={activeSlide.id}
            className="absolute inset-0 h-full w-full object-cover"
            src={activeSlide.src}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onError={handleMediaError}
          />
        )}

        {!hasMediaError && activeSlide.type === 'image' && (
          <img
            key={activeSlide.id}
            className="absolute inset-0 h-full w-full object-cover"
            src={activeSlide.src}
            alt={t(activeSlide.title)}
            loading="eager"
            onError={handleMediaError}
          />
        )}

        {hasMediaError && (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_18%,rgba(253,186,116,0.34),transparent_36%),radial-gradient(circle_at_85%_2%,rgba(96,165,250,0.36),transparent_38%),linear-gradient(180deg,#142032_0%,#070c13_100%)]" />
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/58 via-black/18 to-black/80" />

        <div className="absolute inset-x-0 top-0 z-20 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="mb-4 flex items-center gap-1.5">
            {SLIDES.map((slide, index) => (
              <div
                key={slide.id}
                className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-white/90 transition-[width] duration-150 ease-linear"
                  style={{
                    width:
                      index < activeIndex
                        ? '100%'
                        : index > activeIndex
                          ? '0%'
                          : `${Math.max(0, Math.min(100, activeProgress * 100))}%`
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSkip}
              className="rounded-full border border-white/32 bg-black/34 px-3 py-1.5 text-[12px] font-semibold text-white/90 backdrop-blur-sm active:scale-[0.98]"
            >
              {t('Atla')}
            </button>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <div className="rounded-3xl border border-white/18 bg-black/34 p-5 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/85">{t(activeSlide.label)}</p>
            <h1 className="mt-2 text-[30px] font-black leading-[1.08] tracking-[-0.02em]">{t(activeSlide.title)}</h1>
            <p className="mt-3 text-[14px] leading-[1.55] text-white/86">{t(activeSlide.description)}</p>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={!canGoBack}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition ${
                  canGoBack
                    ? 'border-white/35 bg-black/30 text-white active:scale-[0.98]'
                    : 'border-white/15 bg-black/20 text-white/30'
                }`}
                aria-label={t('Geri')}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#f59e0b] to-[#f97316] px-5 py-3 text-[14px] font-bold text-slate-950 shadow-[0_10px_30px_rgba(249,115,22,0.42)] active:scale-[0.99]"
              >
                {isLastSlide ? t('Giriş Yap') : t('Devam Et')}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
