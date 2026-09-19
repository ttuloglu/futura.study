import React from 'react';
import { ArrowLeft, Coins } from 'lucide-react';
import { CreditWallet, ViewState } from '../types';
import { useUiI18n } from '../i18n/uiI18n';
import FLogo from './FLogo';

interface GlobalHeaderProps {
  currentView: ViewState;
  credits?: CreditWallet;
  onOpenPaywall?: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
}

export default function GlobalHeader({
  currentView,
  credits,
  onOpenPaywall,
  showBackButton = false,
  onBack
}: GlobalHeaderProps) {
  const { t } = useUiI18n();
  const isIosClient = typeof window !== 'undefined' && (() => {
    const ua = window.navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    return window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  })();
  const createCredits = credits?.createCredits ?? 0;
  const groupShellStyle: React.CSSProperties = {
    background: 'transparent',
    border: '0',
    borderRadius: 9999,
    padding: '0',
    boxShadow: 'none'
  };

  const getHeaderTitle = () => {
    if (currentView === 'HOME') return 'Fortale';
    if (currentView === 'AI_CHAT') return t('Kitaplarım');
    if (currentView === 'PROFILE') return t('Profil');
    if (currentView === 'COURSE_FLOW') return t('Kitap Oku');
    if (currentView === 'PRIVACY') return t('Gizlilik');
    if (currentView === 'TERMS') return t('Yasal');
    return 'Fortale';
  };

  return (
    <header
      className="fixed left-0 right-0 z-40 pointer-events-none transition-opacity duration-300"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)'
      }}
    >
      <div
        className="w-full bg-transparent"
        style={{
          boxShadow: 'none',
          borderRadius: '0'
        }}
      >
        <div className="app-chrome-width">
          <div className="relative flex w-full items-center justify-between py-2 px-2 gap-2">
            <div className="fortale-global-header-status relative z-10 mr-auto pointer-events-auto transition-opacity duration-200 flex items-center">
              <div
                className={`inline-flex flex-col items-start select-none ${showBackButton && onBack ? 'cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all' : ''}`}
                onClick={showBackButton && onBack ? onBack : undefined}
                role={showBackButton && onBack ? 'button' : undefined}
                tabIndex={showBackButton && onBack ? 0 : undefined}
                aria-label={getHeaderTitle()}
              >
                <div className="flex items-center gap-2">
                  <FLogo size={26} className="shrink-0" />
                  <span className="text-[17px] font-extrabold tracking-tight text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
                    {getHeaderTitle()}
                  </span>
                </div>
                {/* Kalından inceye amber çizgi */}
                <svg
                  className="w-full h-[3.5px] mt-1 overflow-visible pointer-events-none"
                  viewBox="0 0 100 4"
                  preserveAspectRatio="none"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M 1.5 0.5 L 98.5 1.75 A 0.25 0.25 0 0 1 98.5 2.25 L 1.5 3.5 A 1.5 1.5 0 0 0 1.5 0.5 Z"
                    fill="url(#fortale-amber-taper)"
                    style={{ filter: 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.45))' }}
                  />
                  <defs>
                    <linearGradient id="fortale-amber-taper" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#F59E0B" stopOpacity="1" />
                      <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.85" />
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.2" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            <div className="relative z-10 h-full ml-auto pointer-events-auto">
              <div className="rounded-full" style={groupShellStyle}>
                <div className="h-9 rounded-full flex items-center gap-1.5">
                  <button
                    onClick={() => onOpenPaywall?.()}
                    className="fortale-chrome-icon-button h-9 px-3 rounded-full text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.28)] hover:scale-105 active:scale-95 transition-transform duration-200 inline-flex items-center gap-1.5"
                    title={t('Kredi satın al')}
                    aria-label={t('Kredi satın al')}
                  >
                    <Coins size={14} className="text-amber-400" />
                    <span className="text-[11px] font-bold text-white whitespace-nowrap">
                      {createCredits}C
                    </span>
                  </button>
                  {showBackButton && (
                    <button
                      onClick={onBack}
                      className="fortale-chrome-icon-button w-9 h-9 rounded-full border flex items-center justify-center text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.28)] hover:scale-110 active:scale-90 transition-transform duration-200"
                      aria-label={t('Anasayfaya dön')}
                      title={t('Anasayfaya dön')}
                    >
                      <ArrowLeft size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
