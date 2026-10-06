import { isReadingStatsOpen } from '../utils/readingStatsDialog';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CourseData } from '../types';
import { getReadingOwner, loadReadingRecord, saveReadingRecord } from '../utils/readingProgress';
import { mergeReadingRecords, type ReadingPosition, type ReadingRecord } from '../utils/readingProgressModel';

export function useBookReading(course: Pick<CourseData,'id'|'topic'|'bookType'|'category'|'subGenre'>, platform: 'native'|'web') {
  const [ready,setReady] = useState(false);
  const [initial,setInitial] = useState<ReadingRecord>();
  const session = useRef<{ owner:string; record:ReadingRecord; openedAt:number; position?:ReadingPosition; since:number; qualified:boolean } | undefined>(undefined);
  const metadata = useRef(course); metadata.current = course;
  const qualify = useCallback(() => {
    const current = session.current, position = current?.position;
    if (!current || !position || current.qualified || Date.now()-current.since < 3000) return;
    if (platform === 'web' && (document.hidden || isReadingStatsOpen())) return;
    if (position.active === false) return;
    current.qualified = true;
    current.record = mergeReadingRecords(current.record,{ ...current.record,
      coverage:[[position.rangeStart,position.rangeEnd]], reachedEnd:position.isLast, updatedAt:Date.now() });
    saveReadingRecord(current.record,current.owner);
  },[platform]);
  useEffect(() => {
    let active = true;
    const owner = getReadingOwner();
    void loadReadingRecord(course.id,owner).then(record => {
      if (!active) return;
      setInitial(record); session.current = { owner,openedAt:Date.now(),record:record || { bookId:course.id,title:course.topic || '',bookType:course.bookType || 'novel',
        genre:course.category || ({fairy_tale:'Masal',novel:'Hikaye',story:'Çalışma kitabı'}[course.bookType || 'novel']),subGenre:course.subGenre || '',bookmarks:{},coverage:[],reachedEnd:false,updatedAt:0 },since:0,qualified:false };
      setReady(true);
    });
    const timer = setInterval(qualify,1000);
    const onVisibility = () => {
      if (document.hidden) qualify();
      if (session.current) session.current.since = Date.now();
    };
    document.addEventListener('visibilitychange',onVisibility);
    window.addEventListener('fortale:reading-stats',onVisibility);window.addEventListener('fortale:reading-stats-closed',onVisibility);
    return () => { active=false; qualify(); clearInterval(timer); document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('fortale:reading-stats',onVisibility);window.removeEventListener('fortale:reading-stats-closed',onVisibility); session.current=undefined; };
  },[course.id,qualify]);
  const observe = useCallback((position:ReadingPosition) => {
    const current = session.current;
    if (!current || !Number.isFinite(position.pageIndex)) return;
    qualify();
    const same = current.position?.sourceIndex === position.sourceIndex && current.position?.contentStartOffset === position.contentStartOffset;
    const previous=current.position;
    if(same && previous?.pageIndex===position.pageIndex && previous?.pageCount===position.pageCount && previous?.rangeEnd===position.rangeEnd &&
      previous?.theme===position.theme && previous?.fontScale===position.fontScale && previous?.active===position.active) return;
    if (!same || position.active !== current.position?.active) { current.since=Date.now(); current.qualified=false; }
    current.position=position;
    const now=Date.now(), info=metadata.current;
    current.record=mergeReadingRecords(current.record,{...current.record,lastOpenedAt:current.openedAt,title:info.topic || '',genre:info.category || ({fairy_tale:'Masal',novel:'Hikaye',story:'Çalışma kitabı'}[info.bookType || 'novel']),subGenre:info.subGenre || '',
      bookmarks:{[platform]:{...position,platform,updatedAt:now}},coverage:[],reachedEnd:false,updatedAt:now});
    saveReadingRecord(current.record,current.owner);
  },[platform,qualify]);
  return {ready,initial:initial?.bookmarks[platform] || Object.values(initial?.bookmarks || {}).sort((a,b)=>b.updatedAt-a.updatedAt)[0],observe};
}
