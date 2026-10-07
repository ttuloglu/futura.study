import { Eye } from 'lucide-react';
import React, { useRef, useSyncExternalStore } from 'react';
import { CompanionCharacter, useCompanionExpressions } from './FortaleCompanion';
import { showReadingStats } from '../utils/readingStatsDialog';
import { useUiI18n } from '../i18n/uiI18n';
import { getCompanionActivity, setCompanionHidden, subscribeCompanionActivity } from '../utils/companionActivity';
import CompanionMenu, { useCompanionMenu } from './CompanionMenu';
import { supportsNativeFloatIsland } from '../utils/nativeFloatIsland';
export default function ReaderCompanion() {
  const lastTap = useRef(0);
  const suppressClick = useRef(false);
  const { t } = useUiI18n();
  const activity = useSyncExternalStore(subscribeCompanionActivity, getCompanionActivity, getCompanionActivity);
  const menu = useCompanionMenu();
  const { wink, affection } = useCompanionExpressions(true, !activity.hidden);
  return <><CompanionMenu anchor={menu.anchor} onClose={menu.close} />
    <button className="reader-companion-dock" type="button" aria-label={t(activity.hidden ? 'Avatarı göster' : 'Fortale’nin küçük dostu')}
      aria-haspopup={activity.hidden ? undefined : 'menu'} aria-expanded={Boolean(menu.anchor)}
      onPointerDown={event => { if (!activity.hidden) menu.startPress(event); }} onPointerMove={menu.movePress}
      onPointerCancel={() => { menu.endPress(); suppressClick.current = true; }}
      onPointerUp={() => {
        suppressClick.current = menu.endPress();
        if (suppressClick.current || activity.hidden || supportsNativeFloatIsland()) { lastTap.current = 0; return; }
        const now = Date.now();
        if (lastTap.current && now - lastTap.current < 350) { lastTap.current = 0; void showReadingStats(); }
        else lastTap.current = now;
      }}
      onClick={event => {
        if (activity.hidden) { setCompanionHidden(false); return; }
        if (suppressClick.current) { suppressClick.current = false; return; }
        menu.open(event.currentTarget);
      }}
      onContextMenu={event => { event.preventDefault(); if (!activity.hidden) menu.open(event.currentTarget); }}>
      {activity.hidden ? <Eye size={18} aria-hidden="true" /> : <CompanionCharacter mood={activity.command === 'auto' ? 'read' : activity.command} wink={wink} affection={affection} size={44} />}
    </button>
  </>;
}
