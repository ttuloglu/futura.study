import { setCompanionHidden } from '../utils/companionActivity';
import DialogCloseButton from './DialogCloseButton';
import ImagePreviewDialog from './ImagePreviewDialog';
import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { companionReaderOptions, NativeBookReader, type NativeReaderTheme, type NativeBookPage } from '../utils/nativeBookReader';
import { createNativeReaderMediaSession } from '../utils/nativeReaderMedia';
import { useUiI18n } from '../i18n/uiI18n';
import type { CourseData } from '../types';
import type { PluginListenerHandle } from '@capacitor/core';
import { useBookReading } from '../hooks/useBookReading';
import { showReadingStats } from '../utils/readingStatsDialog';
import { showCompanionAvatarPicker } from '../utils/companionAvatarDialog';
import ReaderCompanion from './ReaderCompanion';
import FaviconSpinner from './FaviconSpinner';
import { readerHeading } from '../utils/readerHeading';
import { triggerHaptic } from '../utils/haptics';
import '../styles/fairyTaleReader.css';

export interface FairyTaleReaderPage { id: string; title: string; text: string; imageUrl?: string; audioUrl?: string }
interface Props {
  course: CourseData;
  title: string;
  pages: FairyTaleReaderPage[];
  onBack: () => void;
  onResolveAudio: (source: string) => Promise<string>;
  onPrepareNarration: (page: number) => Promise<boolean>;
  backgroundAudioSrc?: string;
  preparationProgress?: number;
  downloadControl?: React.ReactNode;
  onDownload?: (format: 'pdf' | 'epub') => Promise<void>;
}
const palettes: Record<NativeReaderTheme, { background: string; ink: string; label: string }> = {
  sepia: { background: '#f7efe3', ink: '#3d2e21', label: 'Sepya' },
  light: { background: '#fcfcfc', ink: '#1f1f24', label: 'Açık' },
  dark: { background: '#171a1f', ink: '#e8ebf0', label: 'Koyu' },
  pink: { background: '#fce8ef', ink: '#1f1f24', label: 'Pembe' },
  blue: { background: '#e3f2fc', ink: '#1f1f24', label: 'Açık mavi' }
};

export default function FairyTaleBookReader(props: Props) {
  const [previewImage, setPreviewImage] = useState<{src: string; title: string} | null>(null);
  const { t } = useUiI18n();
  const native = Capacitor.getPlatform() === 'ios';
  const reading = useBookReading(props.course,native ? 'native' : 'web');
  const live = useRef(props); live.current = props;
  const [pageIndex, setPageIndex] = useState(0);
  const [theme, setTheme] = useState<NativeReaderTheme>('sepia');
  const themeRef = useRef(theme); themeRef.current = theme;
  const scaleRef = useRef(1);
  const [fontScale, setFontScale] = useState(1);
  const [playing, setPlaying] = useState(false);
  const intent = useRef(false);
  const [preparing, setPreparing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [music, setMusic] = useState(true);
  const [error, setError] = useState('');
  const [direction, setDirection] = useState('forward');
  const [turning, setTurning] = useState(false);
  const [nativeRequest, setNativeRequest] = useState({ token: 0, index: 0, autoPlay: false });
  const audio = useRef<HTMLAudioElement>(null);
  const mediaPage = useRef<string | null>(null);
  const background = useRef<HTMLAudioElement>(null);
  const nextAudio = useRef<HTMLAudioElement>(null);
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);
  const version = useRef(0);
  const playReadyPage = useRef<() => void>(() => undefined);
  const turningRef = useRef(false);
  const pageRef = useRef(pageIndex); pageRef.current = pageIndex;
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const readerPageRef = useRef<HTMLElement>(null);
  const page = props.pages[pageIndex];
  const palette = palettes[theme];

  const stopAdvance = () => { if (advance.current) clearTimeout(advance.current); advance.current = null; };
  const pause = () => {
    intent.current = false; version.current += 1; stopAdvance();
    audio.current?.pause(); background.current?.pause(); setPlaying(false); setLoading(false);
  };
  const prepareNarration = async (index: number) => {
    setPreparing(true); setError('');
    try { return await live.current.onPrepareNarration(index); }
    catch { setError(t('Ses yüklenemedi')); return false; }
    finally { setPreparing(false); }
  };

  useEffect(() => {
    if (!native || !reading.ready) return;
    let active = true, opened = false;
    let listener: PluginListenerHandle | undefined;
    const sessionId=crypto.randomUUID();
    const media = createNativeReaderMediaSession();
    setLoading(true);
    (async () => {
      try {
        const current = live.current;
        const pages: NativeBookPage[] = await Promise.all(current.pages.map(async (page, index) => ({
          pageNumber: index + 1, title: readerHeading(page.title), contentHtml: '', plainText: page.text,
          imageSrc: await media.resolve(page.imageUrl).catch(() => page.imageUrl), imageAlt: page.title,
          audioSrc: page.audioUrl ? await current.onResolveAudio(page.audioUrl).then(media.resolve).catch(() => '') : undefined
        })));
        if (!active) return;
        listener=await NativeBookReader.addListener('readingProgress',position=>{if(active && position.sessionId===sessionId) reading.observe(position);});
        if(!active) {await listener.remove();return;}
        opened = true;
        const result = await NativeBookReader.openBook({ ...companionReaderOptions(t), title: current.title, bookType: 'fairy_tale', pages,
          sessionId, initialPageIndex: nativeRequest.index, theme: themeRef.current, fontScale:scaleRef.current,
          ...(nativeRequest.token===0 && reading.initial ? {initialSourceIndex:reading.initial.sourceIndex,initialContentOffset:reading.initial.contentStartOffset,
            ...(reading.initial.theme ? {theme:reading.initial.theme as NativeReaderTheme} : {}),...(reading.initial.fontScale ? {fontScale:reading.initial.fontScale} : {})} : {}), autoPlay: nativeRequest.autoPlay,
          backgroundAudioSrc: current.backgroundAudioSrc });
        opened = false;
        if (!active) return;
        if (typeof result.companionHidden === 'boolean') setCompanionHidden(result.companionHidden);
        if (result.theme) setTheme(result.theme);
        if (result.fontScale) {scaleRef.current=result.fontScale;setFontScale(result.fontScale);}
        setPageIndex(result.lastPageIndex);
        if(result.action==='readingStats' || result.action==='changeAvatar') {
          if(result.action==='changeAvatar') await showCompanionAvatarPicker();
          else await showReadingStats();
          if(active) setNativeRequest(value=>({token:value.token+1,index:result.lastPageIndex,autoPlay:false}));
        } else if (result.action === 'prepareNarration') {
          const ready = await prepareNarration(result.lastPageIndex);
          if (active) setNativeRequest(value => ({ token: value.token + 1, index: result.lastPageIndex, autoPlay: ready }));
        } else if (result.action === 'downloadPDF' || result.action === 'downloadEPUB') {
          try { await live.current.onDownload?.(result.action === 'downloadPDF' ? 'pdf' : 'epub'); }
          finally { if (active) setNativeRequest(value => ({ token: value.token + 1, index: result.lastPageIndex, autoPlay: false })); }
        } else { live.current.onBack(); }
      } catch {
        if (active) { setLoading(false); setError(t('Kitap açılamadı')); }
      } finally { await listener?.remove(); await media.dispose(); }
    })();
    return () => {
      active = false; void listener?.remove();
      if (opened) void NativeBookReader.closeBook().finally(() => media.dispose());
      else void media.dispose();
    };
  }, [native, nativeRequest.token, reading.ready]);

  const restoredWeb = useRef(false);
  useEffect(()=>{
    if(native || !reading.ready) return;
    if(reading.initial) {
      setPageIndex(Math.min(props.pages.length-1,Math.max(0,reading.initial.sourceIndex)));
      if(reading.initial.theme) setTheme(reading.initial.theme as NativeReaderTheme);
      if(reading.initial.fontScale) setFontScale(reading.initial.fontScale);
    }
  },[reading.ready]);
  useEffect(()=>{
    if(native || !reading.ready || turning) return;
    if(!restoredWeb.current) {
      if(reading.initial && pageIndex!==Math.min(props.pages.length-1,Math.max(0,reading.initial.sourceIndex))) return;
      restoredWeb.current=true;
    }
    reading.observe({sourceIndex:pageIndex,contentStartOffset:0,pageIndex,pageCount:props.pages.length,
      rangeStart:pageIndex/props.pages.length,rangeEnd:(pageIndex+1)/props.pages.length,isLast:pageIndex===props.pages.length-1,theme,fontScale});
  },[native,reading.ready,pageIndex,turning,theme,fontScale]);

  const turnTo = (index: number) => {
    if (index < 0 || index >= props.pages.length || index === pageRef.current || turningRef.current) return;
    triggerHaptic();
    version.current += 1; stopAdvance(); audio.current?.pause(); background.current?.pause();
    setDirection(index > pageRef.current ? 'forward' : 'reverse');
    turningRef.current = true; setTurning(true); setLoading(false);
    setPageIndex(index);
  };

  const ended = () => {
    if (!intent.current || turningRef.current || !audio.current?.ended || mediaPage.current !== live.current.pages[pageRef.current]?.id) return;
    stopAdvance();
    if (pageRef.current === live.current.pages.length - 1) { pause(); return; }
    advance.current = setTimeout(() => { if (intent.current) turnTo(pageRef.current + 1); }, 450);
  };

  playReadyPage.current = () => {
    if (native || !intent.current || turningRef.current) return;
    const current = live.current.pages[pageRef.current];
    if (!current) return;
    if (audio.current?.ended && mediaPage.current === current.id && pageRef.current < live.current.pages.length - 1) { ended(); return; }
    const run = ++version.current;
    setLoading(true); setError('');
    (async () => {
      try {
        if (!current.audioUrl) {
          const ready = await prepareNarration(pageRef.current);
          if (!ready) { pause(); return; }
          // Audio generation updates parent props before this next render.
          setPlaying(false); requestAnimationFrame(() => {
            if (run !== version.current || !intent.current) return;
            if (!live.current.pages[pageRef.current]?.audioUrl) { pause(); setError(t('Seslendirme hazır değil')); return; }
            setPlaying(true);
          });
          return;
        }
        const source = await live.current.onResolveAudio(current.audioUrl);
        if (!source) throw new Error('Missing audio');
        if (run !== version.current || !intent.current) return;
        const player = audio.current;
        if (!player) return;
        if (player.getAttribute('src') !== source) { player.src = source; player.load(); }
        mediaPage.current = current.id;
        if (player.ended) player.currentTime = 0;
        await player.play();
        if (run !== version.current) return;
        if (!intent.current) { player.pause(); return; }
        setLoading(false);
        if (background.current && music) { background.current.volume = .12; void background.current.play().catch(() => undefined); }
        const next = live.current.pages[pageRef.current + 1]?.audioUrl;
        if (next) void live.current.onResolveAudio(next).then(source => {
          if (run === version.current && nextAudio.current) nextAudio.current.src = source;
        }).catch(() => undefined);
      } catch { if (run === version.current) { pause(); setError(t('Ses yüklenemedi')); } }
    })();
  };

  useEffect(() => { if (!native && !turning && playing) playReadyPage.current(); }, [pageIndex, playing, turning, native]);
  useEffect(() => {
    if (!turning) return;
    // Fallback for browsers that disable CSS animations or omit animationend.
    const timer = setTimeout(() => { turningRef.current = false; setTurning(false); }, 650);
    return () => clearTimeout(timer);
  }, [turning]);
  useEffect(() => () => { version.current += 1; intent.current = false; if (advance.current) clearTimeout(advance.current); }, []);
  useEffect(() => {
    const pauseHidden = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', pauseHidden);
    return () => document.removeEventListener('visibilitychange', pauseHidden);
  }, []);
  useEffect(() => { if (background.current) { if (!music) background.current.pause(); else if (playing && !turning && !loading) { background.current.volume = .12; void background.current.play().catch(() => undefined); } } }, [music]);

  if (native || !reading.ready) return <div className="fairy-reader-native-wait">
    <FaviconSpinner size={30} />
    <p>{t(preparing ? 'Seslendirme hazırlanıyor' : 'Kitabınız yükleniyor')}{preparing && props.preparationProgress ? ` %${Math.round(props.preparationProgress)}` : ''}</p>
    {error && <><p role="alert">{error}</p><button onClick={() => { setError(''); setNativeRequest(value => ({ ...value, token: value.token + 1, autoPlay: false })); }}>{t('Tekrar dene')}</button></>}
    <button onClick={props.onBack}>{t('Geri')}</button>
  </div>;
  if (!page) return <div className="fairy-reader-native-wait"><p>{t('Kitabınız yükleniyor')}</p><button onClick={props.onBack}>{t('Geri')}</button></div>;
  return <section className="fairy-book-reader" data-theme={theme} style={{ '--fairy-paper': palette.background, '--fairy-ink': palette.ink, '--fairy-font-scale': fontScale } as React.CSSProperties}>
    <header className="fairy-reader-chrome">
      <DialogCloseButton aria-label={t('Kapat')} onClick={() => { pause(); props.onBack(); }}/>
      <strong>{props.title}</strong>
      <button aria-label={t('Yazıyı küçült')} onClick={() => setFontScale(value => Math.max(.8, value - .1))}>A−</button>
      <button aria-label={t('Yazıyı büyüt')} onClick={() => setFontScale(value => Math.min(1.5, value + .1))}>A+</button>
      {props.downloadControl}
    </header>
    <div className="fairy-reader-palettes" aria-label={t('Okuyucu zemini')}>
      {Object.entries(palettes).map(([id, colors]) => <button key={id} aria-label={t(colors.label)} aria-pressed={theme === id} onClick={() => setTheme(id as NativeReaderTheme)} style={{ background: colors.background }} />)}
    </div>
    <article ref={readerPageRef} className="fairy-reader-page" key={page.id} data-turning={turning} data-direction={direction}
      onAnimationEnd={event => { if (event.target === event.currentTarget) { turningRef.current = false; setTurning(false); } }}
      onPointerDown={event => { pointer.current = { x: event.clientX, y: event.clientY }; }}
      onPointerUp={event => { const start = pointer.current; pointer.current = null; if (!start) return; const dx = event.clientX - start.x, dy = event.clientY - start.y; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) turnTo(pageIndex + (dx < 0 ? 1 : -1)); }}
      onPointerCancel={() => { pointer.current = null; }}>
      {page.imageUrl && <img src={page.imageUrl} alt={page.title} role="button" tabIndex={0} title={t('Tam ekran aç')}
        onClick={() => { pause(); setPreviewImage({src: page.imageUrl!, title: page.title}); }}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pause(); setPreviewImage({src: page.imageUrl!, title: page.title}); } }}/>}
      {readerHeading(page.title) && <h2>{readerHeading(page.title)}</h2>}<div className="fairy-reader-text">{page.text}</div>
    </article>
    <footer className="fairy-reader-chrome fairy-reader-footer">
      <ReaderCompanion/>
      <button aria-label={t('Önceki sayfa')} disabled={!pageIndex || turning} onClick={() => turnTo(pageIndex - 1)}><ChevronLeft size={20} /></button>
      <button aria-label={t(playing ? 'Duraklat' : 'Dinle')} disabled={preparing || turning} onClick={() => { if (intent.current) pause(); else { intent.current = true; setPlaying(true); } }}>{loading || preparing ? <FaviconSpinner size={20} /> : playing ? <Pause size={20} /> : <Play size={20} />}</button>
      <span>{t('Sayfa')} {pageIndex + 1} / {props.pages.length}</span>
      <button aria-label={t(music ? 'Fon müziğini kapat' : 'Fon müziğini aç')} aria-pressed={music} onClick={() => setMusic(value => !value)}>{music ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
      <button aria-label={t('Sonraki sayfa')} disabled={pageIndex === props.pages.length - 1 || turning} onClick={() => turnTo(pageIndex + 1)}><ChevronRight size={20} /></button>
    </footer>
    {error && <p className="fairy-reader-error" role="alert">{error}</p>}
    <audio ref={audio} preload="auto" onEnded={ended} onError={() => { if (intent.current) { pause(); setError(t('Ses yüklenemedi')); } }} />
    <audio ref={nextAudio} preload="auto" /><audio ref={background} src={props.backgroundAudioSrc} loop preload="none" />
    <ImagePreviewDialog image={previewImage} onClose={() => setPreviewImage(null)}/>
  </section>;
}
