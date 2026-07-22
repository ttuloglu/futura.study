import React from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, Home, Library, Settings, Users } from 'lucide-react';
import { ViewState } from '../types';
import { useUiI18n } from '../i18n/uiI18n';

interface BottomNavProps {
  currentView: ViewState;
  onViewChange: (view: ViewState) => void;
  onToggleSettings: () => void;
  isSettingsOpen: boolean;
  showCourseScrollTop?: boolean;
  onCourseScrollTop?: () => void;
}

export default function BottomNav({
  currentView,
  onViewChange,
  onToggleSettings,
  isSettingsOpen,
  showCourseScrollTop = false,
  onCourseScrollTop
}: BottomNavProps) {
  const { t } = useUiI18n();

  // Determine active states
  const isHomeActive = currentView === 'HOME' && !isSettingsOpen;
  const isCommunityActive = currentView === 'COMMUNITY' && !isSettingsOpen;
  const isChatActive = currentView === 'AI_CHAT' && !isSettingsOpen;
  const isSettingsActive = isSettingsOpen;

  const scrollTopControl = showCourseScrollTop ? (
    <div
      className="fortale-course-scroll-top-root fixed left-0 right-0 pointer-events-none flex justify-center px-4"
      style={{ zIndex: 50 }}
    >
      <button
        type="button"
        onClick={onCourseScrollTop}
        className="pointer-events-auto w-10 h-10 rounded-full flex items-center justify-center bg-stone-900/90 text-white border border-white/10 shadow-lg hover:scale-110 active:scale-90 transition-all duration-200"
        aria-label={t('Başa dön')}
        title={t('Başa dön')}
      >
        <ArrowUp size={18} strokeWidth={2.5} />
      </button>
    </div>
  ) : null;

  const navigation = (
    <div
      className="fortale-floatisland-root fixed left-0 right-0 pointer-events-none flex items-center justify-center px-4"
      style={{ zIndex: 20000 }}
    >
      <div className="floatisland-nav">
        {/* HOME BUTTON */}
        <button
          type="button"
          onClick={() => {
            if (isSettingsOpen) onToggleSettings();
            onViewChange('HOME');
          }}
          className={`floatisland-item tab-home ${isHomeActive ? 'active' : ''}`}
        >
          <Home size={18} strokeWidth={isHomeActive ? 2.5 : 2} />
          {isHomeActive && <span className="floatisland-label">{t('Anasayfa')}</span>}
        </button>

        {/* COMMUNITY BUTTON */}
        <button
          type="button"
          onClick={() => {
            if (isSettingsOpen) onToggleSettings();
            onViewChange('COMMUNITY');
          }}
          className={`floatisland-item tab-community ${isCommunityActive ? 'active' : ''}`}
          aria-label={t('Topluluk')}
          title={t('Topluluk')}
        >
          <Users size={18} strokeWidth={isCommunityActive ? 2.5 : 2} />
          {isCommunityActive && <span className="floatisland-label">{t('Topluluk')}</span>}
        </button>

        {/* AI CHAT / MY BOOKS BUTTON */}
        <button
          type="button"
          onClick={() => {
            if (isSettingsOpen) onToggleSettings();
            onViewChange('AI_CHAT');
          }}
          className={`floatisland-item tab-chat ${isChatActive ? 'active' : ''}`}
          aria-label={t('Kitaplarım')}
          title={t('Kitaplarım')}
        >
          <Library size={18} strokeWidth={isChatActive ? 2.5 : 2} />
          {isChatActive && <span className="floatisland-label">{t('Kitaplarım')}</span>}
        </button>

        {/* SETTINGS BUTTON */}
        <button
          type="button"
          onClick={onToggleSettings}
          className={`floatisland-item tab-settings ${isSettingsActive ? 'active' : ''}`}
          aria-label={t('Ayarlar')}
          title={t('Ayarlar')}
        >
          <Settings size={18} strokeWidth={isSettingsActive ? 2.5 : 2} />
          {isSettingsActive && <span className="floatisland-label">{t('Ayarlar')}</span>}
        </button>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return <>{scrollTopControl}{navigation}</>;
  }

  return (
    <>
      {scrollTopControl && createPortal(scrollTopControl, document.body)}
      {createPortal(navigation, document.body)}
    </>
  );
}
