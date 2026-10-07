import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Share2 } from 'lucide-react';
import DialogCloseButton from './DialogCloseButton';
import { getReadingRecords, subscribeReading } from '../utils/readingProgress';
import { readingStats, type ReadingBookMetadata } from '../utils/readingProgressModel';
import { createReadingStatsImage, favorite, readingLanguageName } from '../utils/readingStatsImage';
import { saveBlobAsFile } from '../utils/fileDownload';
import { CompanionCharacter } from './FortaleCompanion';
import { useUiI18n } from '../i18n/uiI18n';
import '../styles/readingStats.css';
export default function ReadingStatsDialog({ books = [], onOpenChange }: { books?: ReadingBookMetadata[]; onOpenChange?: (open: boolean) => void }) {
  const {t,locale}=useUiI18n();
  const records=useSyncExternalStore(subscribeReading,getReadingRecords,getReadingRecords);
  const stats=useMemo(()=>readingStats(Object.values(records),new Date(),books),[records,books]);
  const [opened,setOpened]=useState(false), [sharing,setSharing]=useState(false),[error,setError]=useState('');
  const closeCallback=useRef<(() => void) | undefined>(undefined);
  const closeButton=useRef<HTMLButtonElement>(null);
  const close=()=>{ setOpened(false); closeCallback.current?.();closeCallback.current=undefined; };
  useEffect(()=>{ onOpenChange?.(opened); },[opened,onOpenChange]);
  useEffect(()=>{
    const open=(event:Event)=>{ closeCallback.current=(event as CustomEvent).detail.close;setError('');setOpened(true); };
    window.addEventListener('fortale:reading-stats',open);
    return ()=>{window.removeEventListener('fortale:reading-stats',open);closeCallback.current?.();};
  },[]);
  useEffect(()=>{
    if (!opened) return;
    const previous=document.activeElement as HTMLElement;
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';closeButton.current?.focus();
    const key=(event:KeyboardEvent)=>{
      if (event.key==='Escape') close();
      if (event.key==='Tab') {
        const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>('.reading-stats-overlay button'));
        const current=buttons.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();buttons[(current+(event.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();
      }
    };
    window.addEventListener('keydown',key);
    return ()=>{document.body.style.overflow=overflow;window.removeEventListener('keydown',key);previous?.focus();};
  },[opened]);
  if (!opened) return null;
  return createPortal(<div className="reading-stats-overlay" data-companion-exclude onClick={event=>{if(event.target===event.currentTarget)close();}}>
    <section role="dialog" aria-modal="true" aria-labelledby="reading-stats-title" className="reading-stats-dialog">
      <header className="reading-stats-header">
        <div className="reading-stats-friend" aria-hidden="true"><CompanionCharacter mood="banner" size={60}/></div>
        <div className="reading-stats-heading"><h2 id="reading-stats-title">{t('Okuma istatistikleri')}</h2><p>{t('Tüm zamanlar')}</p></div>
        <div className="reading-stats-actions">
          <button className="reading-stats-share" disabled={sharing} aria-label={t('Okuma hatıramı paylaş')} onClick={async()=>{
            setSharing(true);setError('');
            try { await saveBlobAsFile({blob:await createReadingStatsImage(stats,t,locale),fileName:'Fortale-Okuma-Hatiram.png'}); }
            catch {setError(t('Görsel kaydedilemedi. Tekrar deneyebilirsin.'));}finally{setSharing(false);}
          }}><Share2 size={18}/></button>
          <DialogCloseButton ref={closeButton} className="reading-stats-close" onClick={close}/>
        </div>
      </header>
      <div className="reading-stats-content">
        <dl className="reading-stats-summary">
          <div className="reading-stats-total"><dd>{stats.total}</dd><dt>{t('Bitirilen kitap')}</dt></div>
          <div><dd>{stats.month}</dd><dt>{t('Bu ay')}</dt></div>
          <div><dd>{stats.inProgress}</dd><dt>{t('Devam edilen')}</dt></div>
        </dl>
        <section className="reading-stats-section" aria-labelledby="reading-stats-types-title">
          <h3 id="reading-stats-types-title">{t('Kitap türleri')}</h3>
          <dl className="reading-stats-types">
            {([['Hikaye','novel'],['Masal','fairy_tale'],['Çalışma kitabı','story'],['Yabancı dil','language_learning']] as const).map(([label,type])=>{
              const count=stats.types[type] || 0;
              return <div key={type}><dt>{t(label)}</dt><dd><span className="reading-stats-track" aria-hidden="true"><i style={{width:`${stats.total ? count/stats.total*100 : 0}%`}}/></span><b>{count}</b></dd></div>;
            })}
          </dl>
        </section>
        <section className="reading-stats-section" aria-labelledby="reading-stats-language-title">
          <div className="reading-stats-section-heading"><h3 id="reading-stats-language-title">{t('Yabancı dilde okuma')}</h3><span>{t('Bitirilen kitap')}</span></div>
          {Object.keys(stats.learning.languages).length > 0 ? <dl className="reading-stats-languages">
            {Object.entries(stats.learning.languages).sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0])).map(([code,count])=><div key={code}><dt>{readingLanguageName(code,locale)}</dt><dd>{count}</dd></div>)}
          </dl> : <p className="reading-stats-note">{t('Bitirdiğin yabancı dil kitapları burada görünecek.')}</p>}
          {Object.keys(stats.learning.levels).length > 0 && <div className="reading-stats-levels"><span>{t('Kitap seviyeleri')}</span><ul aria-label={t('Kitap seviyeleri')}>{['A1','A2','B1','B2','C1','C2'].filter(level=>stats.learning.levels[level]).map(level=><li key={level}>{level}<b>{stats.learning.levels[level]}</b></li>)}</ul></div>}
          {stats.learning.inProgress > 0 && <p className="reading-stats-note reading-stats-learning-progress">{t('Devam edilen')} <b>{stats.learning.inProgress}</b> · {t('Yabancı dil')}</p>}
        </section>
        {stats.total > 0 ? <dl className="reading-stats-favorites">
          <div><dt>{t('En sevdiğim tür')}</dt><dd>{t(favorite(stats.genres))}</dd></div>
          <div><dt>{t('En sevdiğim alt tür')}</dt><dd>{t(favorite(stats.subGenres))}</dd></div>
        </dl> : <p className="reading-stats-empty">{t('Bir kitabı bitirdiğinde ilk okuma hatıran burada görünecek.')}</p>}
        {error && <p className="reading-stats-error" role="alert">{error}</p>}
      </div>
    </section>
  </div>,document.body);
}
