import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Share2, X } from 'lucide-react';
import { getReadingRecords, subscribeReading } from '../utils/readingProgress';
import { readingStats } from '../utils/readingProgressModel';
import { createReadingStatsImage, favorite } from '../utils/readingStatsImage';
import { saveBlobAsFile } from '../utils/fileDownload';
import { CompanionCharacter } from './FortaleCompanion';
import { useUiI18n } from '../i18n/uiI18n';
import '../styles/readingStats.css';
export default function ReadingStatsDialog({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const {t}=useUiI18n();
  const records=useSyncExternalStore(subscribeReading,getReadingRecords,getReadingRecords);
  const stats=useMemo(()=>readingStats(Object.values(records)),[records]);
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
      <button ref={closeButton} className="reading-stats-close" aria-label={t('Kapat')} onClick={close}><X size={22}/></button>
      <div className="reading-stats-friend"><CompanionCharacter mood="banner" size={135}/></div>
      <div className="reading-stats-sign">
        <button className="reading-stats-share" disabled={sharing} aria-label={t('Okuma hatıramı paylaş')} onClick={async()=>{
          setSharing(true);setError('');
          try { await saveBlobAsFile({blob:await createReadingStatsImage(stats),fileName:'Fortale-Okuma-Hatiram.png'}); }
          catch {setError(t('Görsel kaydedilemedi. Tekrar deneyebilirsin.'));}finally{setSharing(false);}
        }}><Share2 size={22}/></button>
        <h2 id="reading-stats-title">{t('Okuma Hatıram')}</h2>
        <strong className="reading-stats-total">{stats.total}</strong><p>{t('kitap bitirdim')}</p>
        <div className="reading-stats-types">{[['Masal','fairy_tale'],['Hikaye','novel'],['Çalışma kitabı','story']].map(([label,type])=><div key={type}><b>{stats.types[type] || 0}</b><span>{t(label)}</span></div>)}</div>
        <p className="reading-stats-month">{t('Bu ay')} <b>{stats.month}</b> {t('kitap bitirdim')}</p>
        <dl><div><dt>{t('En sevdiğim tür')}</dt><dd>{t(favorite(stats.genres))}</dd></div><div><dt>{t('En sevdiğim alt tür')}</dt><dd>{t(favorite(stats.subGenres))}</dd></div></dl>
        {!stats.total && <p className="reading-stats-empty">{t('Bir kitabı bitirdiğinde ilk okuma hatıran burada görünecek.')}</p>}
        {error && <p role="alert">{error}</p>}
      </div>
    </section>
  </div>,document.body);
}
