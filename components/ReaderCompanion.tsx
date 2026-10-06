import React, { useRef } from 'react';
import { CompanionCharacter, useCompanionExpressions } from './FortaleCompanion';
import { showReadingStats } from '../utils/readingStatsDialog';
import { useUiI18n } from '../i18n/uiI18n';
export default function ReaderCompanion() {
  const lastTap=useRef(0);
  const {t} = useUiI18n();
  const {wink,affection} = useCompanionExpressions(true);
  return <button className="reader-companion-dock" type="button" aria-label={t('Çift dokun: okuma hatıram')}
    onPointerUp={()=>{const now=Date.now();if(lastTap.current && now-lastTap.current<350){lastTap.current=0;void showReadingStats();}else lastTap.current=now;}}
    onDoubleClick={() => void showReadingStats()} onKeyDown={event => { if (event.key==='Enter' || event.key===' ') { event.preventDefault(); void showReadingStats(); } }}>
    <CompanionCharacter mood="read" wink={wink} affection={affection} size={44}/>
  </button>;
}
