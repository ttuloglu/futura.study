import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Download, Palette, X } from 'lucide-react';
import type { CourseData, TimelineNode } from '../types';
import { NativeBookReader, prepareBookPagesForNativeReader, type NativeReaderTheme } from '../utils/nativeBookReader';
import { createNativeReaderMediaSession } from '../utils/nativeReaderMedia';
import { useBookReading } from '../hooks/useBookReading';
import { showReadingStats } from '../utils/readingStatsDialog';
import ReaderCompanion from './ReaderCompanion';
import type { PluginListenerHandle } from '@capacitor/core';
import StyledMarkdown from './StyledMarkdown';
import FaviconSpinner from './FaviconSpinner';
import { useUiI18n } from '../i18n/uiI18n';
import '../styles/fairyTaleReader.css';

interface Props {
  course: CourseData;
  nodes: TimelineNode[];
  onBack: () => void;
  onDownload: (format: 'pdf' | 'epub') => Promise<void>;
}
const themes: Record<NativeReaderTheme, { paper: string; ink: string; label: string }> = {
  sepia: { paper: '#f7efe3', ink: '#3d2e21', label: 'Sepya' },
  light: { paper: '#fcfcfc', ink: '#1f1f24', label: 'Açık' },
  dark: { paper: '#171a1f', ink: '#e8ebf0', label: 'Koyu' },
  pink: { paper: '#fce8ef', ink: '#1f1f24', label: 'Pembe' },
  blue: { paper: '#e3f2fc', ink: '#1f1f24', label: 'Açık mavi' }
};

export default function BookReader(props: Props) {
  const { t } = useUiI18n();
  const native = Capacitor.getPlatform() === 'ios';
  const reading = useBookReading(props.course, native ? 'native' : 'web');
  const live = useRef(props); live.current = props;
  const [request, setRequest] = useState({ token: 0, index: 0 });
  const [theme, setTheme] = useState<NativeReaderTheme>('sepia');
  const [fontScale, setFontScale] = useState(1);
  const [error, setError] = useState('');
  const [webPage,setWebPage] = useState({index:0,count:1});
  const [downloading, setDownloading] = useState(false);
  const readerContentRef = useRef<HTMLDivElement>(null);
  const hasContent = props.nodes.some(node => node.content?.trim() || node.pageText?.trim() || node.pageImageUrl?.trim());
  const readerStyle = useRef({ theme, fontScale }); readerStyle.current = { theme, fontScale };
  const readingSections = useMemo(()=>prepareBookPagesForNativeReader(props.course,props.nodes).map(page=>({
    markdown:page.markdown || '',imageSrc:page.imageSrc || '',imageAlt:page.imageAlt || ''
  })),[props.nodes]);
  const content = useMemo(() => props.nodes.map(node => {
    const text = node.pageText?.trim() || node.content?.trim() || '';
    return `${node.pageImageUrl ? `![${node.title || ''}](${node.pageImageUrl})\n\n` : ''}## ${node.title || ''}\n\n${text}`;
  }).join('\n\n'), [props.nodes]);

  useEffect(()=>{
    if(!native && reading.ready && reading.initial) {
      if(reading.initial.theme) setTheme(reading.initial.theme as NativeReaderTheme);
      if(reading.initial.fontScale) setFontScale(reading.initial.fontScale);
    }
  },[reading.ready]);
  useEffect(() => {
    if (!native || !hasContent || !reading.ready) return;
    let active = true, opened = false;
    let listener: PluginListenerHandle | undefined;
    const sessionId=crypto.randomUUID();
    const media = createNativeReaderMediaSession();
    (async () => {
      try {
        const current = live.current;
        const pages = await Promise.all(prepareBookPagesForNativeReader(current.course, current.nodes).map(async page => ({
          ...page, imageSrc: await media.resolve(page.imageSrc)
        })));
        if (!active) return;
        listener=await NativeBookReader.addListener('readingProgress',position=>{ if(active && position.sessionId===sessionId) reading.observe(position); });
        if (!active) { await listener.remove(); return; }
        opened = true;
        const result = await NativeBookReader.openBook({ title: current.course.topic || t('Kitap'), bookType: current.course.bookType || 'novel',
          pages, sessionId, initialPageIndex: request.index,
          ...(request.token===0 && reading.initial ? {initialSourceIndex:reading.initial.sourceIndex,initialContentOffset:reading.initial.contentStartOffset,
            ...(reading.initial.theme ? {theme:reading.initial.theme as NativeReaderTheme} : {}),...(reading.initial.fontScale ? {fontScale:reading.initial.fontScale} : {})} : readerStyle.current) });
        opened = false;
        if (!active) return;
        if (result.theme) setTheme(result.theme);
        if (result.fontScale) setFontScale(result.fontScale);
        if (result.action === 'readingStats') {
          await showReadingStats();
          if(active) setRequest(value=>({token:value.token+1,index:result.lastPageIndex}));
        } else if (result.action === 'downloadPDF' || result.action === 'downloadEPUB') {
          setDownloading(true);
          try { await live.current.onDownload(result.action === 'downloadPDF' ? 'pdf' : 'epub'); }
          catch { window.alert(t('Dosya indirilemedi.')); }
          finally {
            if (active) { setDownloading(false); setRequest(value => ({ token: value.token + 1, index: result.lastPageIndex })); }
          }
        } else live.current.onBack();
      } catch { if (active) setError(t('Kitap açılamadı')); }
      finally { await listener?.remove(); await media.dispose(); }
    })();
    return () => {
      active = false; void listener?.remove();
      if (opened) void NativeBookReader.closeBook().finally(() => media.dispose());
      else void media.dispose();
    };
  }, [native, request.token, hasContent, reading.ready]);

  if (native || !hasContent || !reading.ready) return <div className="fairy-reader-native-wait"><FaviconSpinner size={44}/>
    <p>{t(downloading ? 'Dosya hazırlanıyor' : 'Kitabınız yükleniyor')}</p>
    {error && <><p role="alert">{error}</p><button onClick={() => { setError(''); setRequest(value => ({ ...value, token: value.token + 1 })); }}>{t('Tekrar dene')}</button></>}
    <button onClick={props.onBack}>{t('Geri')}</button></div>;
  const colors = themes[theme];
  const download = async (format: 'pdf' | 'epub') => {
    if (downloading) return;
    setDownloading(true);
    try { await props.onDownload(format); } catch { window.alert(t('Dosya indirilemedi.')); } finally { setDownloading(false); }
  };
  return <section className="fairy-book-reader book-reader" data-theme={theme} style={{ '--fairy-paper': colors.paper, '--fairy-ink': colors.ink } as React.CSSProperties}>
    <header className="fairy-reader-chrome">
      <button aria-label={t('Kapat')} onClick={props.onBack}><X size={20}/></button><strong>{props.course.topic}</strong>
      <button aria-label={t('Yazıyı küçült')} onClick={() => setFontScale(value => Math.max(.8, value - .1))}>A−</button>
      <button aria-label={t('Yazıyı büyüt')} onClick={() => setFontScale(value => Math.min(1.5, value + .1))}>A+</button>
      <details className="fairy-reader-download"><summary aria-label={t('Okuyucu zemini')}><Palette size={20}/></summary><div>
        {Object.entries(themes).map(([key, value]) => <button key={key} aria-pressed={theme === key} onClick={() => setTheme(key as NativeReaderTheme)}><i style={{ background: value.paper }}/>{t(value.label)}</button>)}
      </div></details>
      <details className="fairy-reader-download"><summary aria-label={t('İndir')}><Download size={20}/></summary><div>
        <button disabled={downloading} onClick={() => void download('pdf')}>{t('PDF indir')}</button>
        <button disabled={downloading} onClick={() => void download('epub')}>{t('EPUB indir')}</button>
      </div></details>
    </header>
    <div ref={readerContentRef} className="book-reader-content"><StyledMarkdown content={content} readerMode="fairytale-fullscreen" variant="inline" fullscreenFontScale={fontScale} preserveImageAspectRatio enableImageLightbox={false} readingSections={readingSections} initialReadingPosition={reading.initial} onReadingPosition={position => {reading.observe({...position,theme,fontScale});setWebPage({index:position.pageIndex,count:position.pageCount});}}/></div>
    <footer className="fairy-reader-chrome book-reader-footer"><ReaderCompanion/><span>{t('Sayfa')} {webPage.index+1} / {webPage.count}</span></footer>
  </section>;
}
