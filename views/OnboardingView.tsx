import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Download,
  Feather,
  FileText,
  Headphones,
  Languages,
  Library,
  Sparkles,
  Users,
  WandSparkles
} from 'lucide-react';
import {
  ONBOARDING_V2_COPY,
  ONBOARDING_V2_LABELS,
  type OnboardingV2Copy
} from '../data/onboardingV2Copy';
import { useUiI18n } from '../i18n/uiI18n';

type DemoKind = 'fairy' | 'story' | 'workbook';

type DemoBook = {
  id: DemoKind;
  image: string;
  accent: string;
  accentSoft: string;
};

interface OnboardingViewProps {
  onFinish: () => void;
  onExplore?: () => void;
}

const STAGE_COUNT = 4;
const FORTALE_AI_LABEL = 'Fortale AI';
const FORTALE_ORIGINAL_LABEL = 'Fortale Original';

const DEMO_BOOKS: DemoBook[] = [
  {
    id: 'fairy',
    image: '/onboarding/v2/demo-fairy-tale.webp',
    accent: '#f4b75f',
    accentSoft: 'rgba(244,183,95,0.18)'
  },
  {
    id: 'story',
    image: '/onboarding/v2/demo-story.webp',
    accent: '#b79cff',
    accentSoft: 'rgba(183,156,255,0.18)'
  },
  {
    id: 'workbook',
    image: '/onboarding/v2/demo-workbook.webp',
    accent: '#61d7f5',
    accentSoft: 'rgba(97,215,245,0.18)'
  }
];

const LANGUAGE_NAMES = [
  'Türkçe',
  'English',
  'Deutsch',
  'Français',
  'Español',
  'Português',
  'Italiano',
  'Nederlands',
  'Dansk',
  'Norsk',
  'Svenska',
  'Suomi',
  'Polski',
  'Ελληνικά',
  'العربية',
  'हिन्दी',
  'Bahasa Indonesia',
  '日本語',
  '한국어',
  'ไทย'
];

function getChoiceLabel(copy: OnboardingV2Copy, kind: DemoKind) {
  if (kind === 'fairy') return copy.fairyChoice;
  if (kind === 'story') return copy.storyChoice;
  return copy.workbookChoice;
}

function getCoverTitle(copy: OnboardingV2Copy, kind: DemoKind) {
  if (kind === 'fairy') return copy.fairyCoverTitle;
  if (kind === 'story') return copy.storyCoverTitle;
  return copy.workbookCoverTitle;
}

export default function OnboardingView({ onFinish, onExplore }: OnboardingViewProps) {
  const { language, t } = useUiI18n();
  const copy = ONBOARDING_V2_COPY[language];
  const labels = ONBOARDING_V2_LABELS[language];
  const [stage, setStage] = useState(0);
  const [selectedKind, setSelectedKind] = useState<DemoKind>('workbook');
  const [demoPhase, setDemoPhase] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const selectedBook = useMemo(
    () => DEMO_BOOKS.find((book) => book.id === selectedKind) || DEMO_BOOKS[2],
    [selectedKind]
  );
  const isRtl = language === 'ar';

  useEffect(() => {
    DEMO_BOOKS.forEach(({ image }) => {
      const preload = new Image();
      preload.src = image;
    });
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    syncPreference();
    mediaQuery.addEventListener?.('change', syncPreference);
    return () => mediaQuery.removeEventListener?.('change', syncPreference);
  }, []);

  useEffect(() => {
    if (stage !== 2) return;
    setDemoPhase(prefersReducedMotion ? 4 : 0);
    if (prefersReducedMotion) return;

    let phase = 0;
    const intervalId = window.setInterval(() => {
      phase += 1;
      setDemoPhase(Math.min(phase, 4));
      if (phase >= 4) window.clearInterval(intervalId);
    }, 760);

    return () => window.clearInterval(intervalId);
  }, [prefersReducedMotion, selectedKind, stage]);

  const goNext = () => {
    if (stage >= STAGE_COUNT - 1) {
      onFinish();
      return;
    }
    setStage((current) => Math.min(current + 1, STAGE_COUNT - 1));
  };

  const goBack = () => setStage((current) => Math.max(current - 1, 0));

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault();
        goNext();
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goBack();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onFinish();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onFinish, stage]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartXRef.current;
    const end = event.changedTouches[0]?.clientX ?? null;
    touchStartXRef.current = null;
    if (start === null || end === null) return;
    const delta = start - end;
    if (Math.abs(delta) < 52) return;
    if (delta > 0) goNext();
    else goBack();
  };

  const demoPhases = [
    { label: labels.idea, icon: Sparkles },
    { label: labels.title, icon: WandSparkles },
    { label: t('Kapak'), icon: BookOpen },
    { label: labels.sectionsAndVisuals, icon: FileText },
    { label: t('Seslendirme'), icon: Headphones }
  ];

  return (
    <div
      className="fixed inset-0 z-[120] overflow-hidden bg-[#030914] text-white"
      dir={isRtl ? 'rtl' : 'ltr'}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="onboarding-v2-aurora pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.055] [background-image:linear-gradient(rgba(255,255,255,.45)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.45)_1px,transparent_1px)] [background-size:42px_42px]" />

      <header className="absolute inset-x-0 top-0 z-30 mx-auto flex w-full max-w-6xl items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <div className="flex min-w-0 flex-1 gap-1.5" aria-label={`${stage + 1} / ${STAGE_COUNT}`}>
          {Array.from({ length: STAGE_COUNT }, (_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setStage(index)}
              className="group h-5 flex-1 py-2"
              aria-label={`${index + 1}`}
              aria-current={stage === index ? 'step' : undefined}
            >
              <span className="block h-1 overflow-hidden rounded-full bg-white/15">
                <span
                  className={`block h-full origin-left rounded-full transition-transform duration-500 ${
                    index <= stage ? 'scale-x-100 bg-gradient-to-r from-cyan-300 to-amber-300' : 'scale-x-0'
                  }`}
                />
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onFinish}
          className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-[12px] font-bold text-white/80 backdrop-blur-xl transition hover:bg-white/[0.12] active:scale-95"
        >
          {t('Atla')}
        </button>
      </header>

      <main className="relative z-10 h-full overflow-y-auto overscroll-contain px-4 pb-[calc(6.8rem+env(safe-area-inset-bottom))] pt-[calc(4.75rem+env(safe-area-inset-top))] sm:px-6 sm:pb-28 sm:pt-24">
        <div key={stage} className="onboarding-v2-stage mx-auto flex min-h-full w-full max-w-6xl items-center justify-center">
          {stage === 0 && (
            <section className="grid w-full items-center gap-7 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
              <div className="mx-auto max-w-xl text-center lg:mx-0 lg:text-start">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/[0.08] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100">
                  <img src="/favicon-red.svg" alt="" className="h-4 w-4" /> {FORTALE_AI_LABEL}
                </div>
                <h1 className="text-[clamp(2.55rem,10vw,5.8rem)] font-black leading-[0.94] tracking-[-0.055em]">
                  {copy.heroTitle}
                </h1>
                <p className="mx-auto mt-5 max-w-lg text-[15px] font-medium leading-7 text-slate-300 sm:text-lg lg:mx-0">
                  {copy.heroBody}
                </p>
                <div className="mx-auto mt-6 flex max-w-md items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.07] p-3 text-start shadow-2xl backdrop-blur-xl lg:mx-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 text-slate-950 shadow-lg shadow-orange-500/20">
                    <Feather className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">{labels.writeYourIdea}</p>
                    <p className="truncate text-sm font-bold text-white sm:text-base">{copy.prompt}</p>
                  </div>
                  <span className="ms-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-950">
                    <ArrowRight className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
                  </span>
                </div>
              </div>

              <div className="relative mx-auto h-[330px] w-full max-w-[480px] sm:h-[480px]">
                <div className="absolute inset-[12%] rounded-full bg-cyan-400/15 blur-3xl" />
                <div className="onboarding-v2-orbit absolute left-1/2 top-1/2 h-[265px] w-[265px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/15 sm:h-[390px] sm:w-[390px]" />
                {DEMO_BOOKS.map((book, index) => (
                  <div
                    key={book.id}
                    className="onboarding-v2-book absolute left-1/2 top-1/2 w-[132px] overflow-hidden rounded-[18px] border border-white/20 bg-slate-900 shadow-[0_28px_70px_rgba(0,0,0,.48)] sm:w-[185px]"
                    style={{
                      '--book-x': index === 0 ? '-118%' : index === 1 ? '-50%' : '18%',
                      '--book-y': index === 0 ? '-43%' : index === 1 ? '-60%' : '-43%',
                      '--book-r': index === 0 ? '-10deg' : index === 1 ? '0deg' : '10deg',
                      '--book-delay': `${index * 160}ms`,
                      zIndex: index === 1 ? 3 : 2
                    } as React.CSSProperties}
                  >
                    <img className="aspect-[2/3] w-full object-cover" src={book.image} alt="" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/82 to-transparent px-3 pb-3 pt-10">
                      <p className="line-clamp-2 text-[11px] font-black leading-tight sm:text-sm">{getCoverTitle(copy, book.id)}</p>
                    </div>
                  </div>
                ))}
                <div className="absolute bottom-[-1%] left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5 rounded-2xl border border-white/15 bg-[#061221]/80 px-5 py-2.5 text-[11px] font-bold text-white/80 shadow-xl backdrop-blur-xl sm:bottom-[-2%] sm:text-xs">
                  <span className="whitespace-nowrap">{labels.completeBook}</span>
                  <span className="flex items-center justify-center gap-3" aria-hidden="true">
                    <BookOpen className="h-4 w-4 text-cyan-300" />
                    <Headphones className="h-4 w-4 text-violet-300" />
                    <Download className="h-4 w-4 text-amber-300" />
                  </span>
                </div>
              </div>
            </section>
          )}

          {stage === 1 && (
            <section className="w-full max-w-5xl">
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300">{labels.youChoose}</p>
                <h1 className="mt-2 text-[clamp(2rem,8vw,4rem)] font-black leading-[1.02] tracking-[-0.045em]">{copy.chooseTitle}</h1>
              </div>

              <div className="mx-auto mt-7 grid max-w-[860px] grid-cols-3 gap-2.5 sm:mt-10 sm:gap-5">
                {DEMO_BOOKS.map((book) => {
                  const selected = selectedKind === book.id;
                  return (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => setSelectedKind(book.id)}
                      className={`group relative overflow-hidden rounded-[20px] border text-start transition duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:rounded-[28px] ${
                        selected
                          ? 'scale-[1.025] border-white/55 bg-white/[0.12] shadow-[0_22px_65px_rgba(0,0,0,.42)]'
                          : 'border-white/10 bg-white/[0.045] opacity-75 hover:opacity-100'
                      }`}
                      style={{ boxShadow: selected ? `0 24px 70px ${book.accentSoft}` : undefined }}
                      aria-pressed={selected}
                    >
                      <div className="relative overflow-hidden">
                        <img
                          className="aspect-[2/3] w-full object-cover transition duration-700 group-hover:scale-[1.035]"
                          src={book.image}
                          alt={getCoverTitle(copy, book.id)}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#030914] via-transparent to-transparent" />
                        {selected && (
                          <span className="absolute end-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-950 shadow-xl sm:end-3 sm:top-3 sm:h-9 sm:w-9">
                            <Check className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={3} />
                          </span>
                        )}
                      </div>
                      <div className="relative -mt-8 p-2.5 pt-0 sm:-mt-12 sm:p-5 sm:pt-0">
                        <span className="mb-1.5 block h-1 w-6 rounded-full sm:w-9" style={{ backgroundColor: book.accent }} />
                        <p className="text-[11px] font-black leading-tight text-white sm:text-[17px]">{getChoiceLabel(copy, book.id)}</p>
                        <p className="mt-1 hidden text-xs font-medium text-white/50 sm:line-clamp-2 sm:block">{getCoverTitle(copy, book.id)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {stage === 2 && (
            <section className="grid w-full max-w-5xl items-center gap-4 sm:gap-7 md:grid-cols-[0.85fr_1.15fr] md:gap-12">
              <div className="mx-auto w-full max-w-[165px] sm:max-w-[250px] md:max-w-[280px]">
                <div className="relative">
                  <div className="absolute inset-3 rounded-[28px] blur-3xl" style={{ background: selectedBook.accentSoft }} />
                  <div className={`relative overflow-hidden rounded-[26px] border border-white/25 bg-slate-900 shadow-[0_32px_80px_rgba(0,0,0,.55)] transition duration-700 ${demoPhase >= 2 ? 'onboarding-v2-cover-ready' : 'scale-[0.92] opacity-70'}`}>
                    <img className="aspect-[2/3] w-full object-cover" src={selectedBook.image} alt={getCoverTitle(copy, selectedKind)} />
                    {demoPhase >= 4 && (
                      <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-cyan-100/20 bg-[#061421]/86 px-2.5 py-2 shadow-2xl backdrop-blur-xl sm:top-4 sm:px-3">
                        <img src="/favicon-red.svg" alt="" className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                        <span className="whitespace-nowrap text-[7px] font-black uppercase tracking-[0.1em] text-cyan-100 sm:text-[8px] sm:tracking-[0.16em]">{FORTALE_AI_LABEL}</span>
                        <span className="flex items-end gap-0.5" aria-hidden="true">
                          {Array.from({ length: 9 }, (_, index) => (
                            <span
                              key={index}
                              className="onboarding-v2-wave-bar block w-0.5 rounded-full bg-cyan-300 sm:w-[3px]"
                              style={{ '--wave-index': index, height: `${5 + (index % 5) * 1.5}px` } as React.CSSProperties}
                            />
                          ))}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#020712] via-[#020712]/92 to-transparent px-3 pb-3 pt-14 sm:px-5 sm:pb-5 sm:pt-20">
                      <p className="text-base font-black leading-[1.05] tracking-[-0.025em] sm:text-xl">{getCoverTitle(copy, selectedKind)}</p>
                      <p className="mt-2 hidden text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 sm:block">{FORTALE_ORIGINAL_LABEL}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mx-auto w-full max-w-xl text-center md:text-start">
                <h1 className="text-[clamp(2rem,8vw,4.6rem)] font-black leading-[0.98] tracking-[-0.05em]">{copy.transformationTitle}</h1>
                <p className="mt-2 text-xs font-medium leading-5 text-slate-300 sm:mt-4 sm:text-base sm:leading-6">“{copy.prompt}”</p>

                <div className="mt-3 space-y-1.5 sm:mt-6 sm:space-y-2.5">
                  {demoPhases.map(({ label, icon: Icon }, index) => {
                    const complete = demoPhase >= index;
                    return (
                      <div
                        key={label}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-start transition-all duration-500 sm:gap-3 sm:rounded-2xl sm:px-3.5 sm:py-3 ${
                          complete
                            ? 'translate-x-0 border-white/15 bg-white/[0.08] opacity-100'
                            : 'translate-x-4 border-transparent bg-white/[0.025] opacity-30'
                        }`}
                      >
                        <span
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9 sm:rounded-xl"
                          style={{ background: complete ? selectedBook.accentSoft : 'rgba(255,255,255,.04)', color: complete ? selectedBook.accent : 'rgba(255,255,255,.45)' }}
                        >
                          {complete ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={3} /> : <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                        </span>
                        <span className="min-w-0 flex-1 text-sm font-extrabold">{label}</span>
                        {complete && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: selectedBook.accent }} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {stage === 3 && (
            <section className="w-full max-w-5xl text-center">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-300/10 text-cyan-200 shadow-[0_0_45px_rgba(34,211,238,.17)] sm:h-14 sm:w-14">
                <Languages className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <p className="mt-4 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300">{copy.languageTitle}</p>
              <h1 className="mx-auto mt-2 max-w-3xl text-[clamp(2.25rem,8.5vw,5.1rem)] font-black leading-[0.96] tracking-[-0.055em]">{copy.finalTitle}</h1>
              <p className="mx-auto mt-4 max-w-xl text-sm font-medium leading-6 text-slate-300 sm:text-base">{copy.finalBody}</p>

              <div className="relative mx-auto mt-6 max-w-4xl overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
                <div className="onboarding-v2-marquee flex w-max gap-2 py-2">
                  {[...LANGUAGE_NAMES, ...LANGUAGE_NAMES].map((name, index) => (
                    <span key={`${name}-${index}`} className="whitespace-nowrap rounded-full border border-white/12 bg-white/[0.055] px-3 py-1.5 text-xs font-bold text-white/72">
                      {name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
                {[
                  { label: t('Oku'), icon: BookOpen },
                  { label: t('Dinle'), icon: Headphones },
                  { label: 'PDF / ePub', icon: Download },
                  { label: labels.library, icon: Library },
                  { label: t('Topluluk'), icon: Users }
                ].map(({ label, icon: Icon }) => (
                  <span key={label} className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-[#071421]/80 px-3 py-2 text-xs font-extrabold text-white/78">
                    <Icon className="h-3.5 w-3.5 text-amber-300" /> {label}
                  </span>
                ))}
              </div>

              <div className="mx-auto mt-6 flex min-h-[160px] max-w-[450px] items-end justify-center gap-3 pb-2 sm:min-h-[202px] sm:gap-5 sm:pb-3">
                {DEMO_BOOKS.map((book, index) => (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => setSelectedKind(book.id)}
                    className={`relative w-[92px] shrink-0 overflow-hidden rounded-[14px] border border-white/20 shadow-2xl transition duration-500 sm:w-[120px] ${index === 1 ? 'translate-y-0' : 'translate-y-2 scale-[0.94]'}`}
                    aria-label={getCoverTitle(copy, book.id)}
                  >
                    <img className="aspect-[2/3] w-full object-cover" src={book.image} alt="" />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 px-2 pb-2 pt-8 text-[9px] font-black leading-tight sm:text-[11px]">
                      {getCoverTitle(copy, book.id)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className="absolute inset-x-0 bottom-0 z-30 mx-auto w-full max-w-6xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
        {stage < STAGE_COUNT - 1 ? (
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-[22px] border border-white/12 bg-[#06111e]/80 p-2 shadow-[0_20px_70px_rgba(0,0,0,.45)] backdrop-blur-2xl">
            <button
              type="button"
              onClick={goBack}
              disabled={stage === 0}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white transition enabled:hover:bg-white/10 enabled:active:scale-95 disabled:opacity-25"
              aria-label={t('Geri')}
            >
              <ArrowLeft className={`h-5 w-5 ${isRtl ? 'rotate-180' : ''}`} />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-300 to-amber-300 px-5 text-sm font-black text-slate-950 shadow-[0_10px_35px_rgba(56,189,248,.2)] transition hover:brightness-105 active:scale-[0.985]"
            >
              {stage === 0 ? copy.chooseTitle : stage === 1 ? copy.transformationTitle : copy.finalTitle}
              <ArrowRight className={`h-4 w-4 shrink-0 ${isRtl ? 'rotate-180' : ''}`} />
            </button>
          </div>
        ) : (
          <div className="mx-auto flex max-w-xl gap-2 rounded-[22px] border border-white/12 bg-[#06111e]/86 p-2 shadow-[0_20px_70px_rgba(0,0,0,.5)] backdrop-blur-2xl">
            <button
              type="button"
              onClick={onExplore || onFinish}
              className="h-12 min-w-0 flex-[0.82] rounded-2xl border border-white/14 bg-white/[0.065] px-3 text-xs font-black text-white/85 transition hover:bg-white/10 active:scale-[0.985] sm:text-sm"
            >
              {copy.secondaryCta}
            </button>
            <button
              type="button"
              onClick={onFinish}
              className="inline-flex h-12 min-w-0 flex-[1.18] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-300 to-amber-300 px-3 text-xs font-black text-slate-950 shadow-[0_10px_35px_rgba(56,189,248,.22)] transition hover:brightness-105 active:scale-[0.985] sm:text-sm"
            >
              {copy.primaryCta}
              <ArrowRight className={`h-4 w-4 shrink-0 ${isRtl ? 'rotate-180' : ''}`} />
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
