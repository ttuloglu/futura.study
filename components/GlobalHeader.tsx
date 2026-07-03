import React from 'react';
import { ArrowLeft, Coins } from 'lucide-react';
import { CreditWallet } from '../types';
import FLogo from './FLogo';
import { useUiI18n } from '../i18n/uiI18n';

interface GlobalHeaderProps {
  credits?: CreditWallet;
  onOpenPaywall?: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
}

export default function GlobalHeader({
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

  return (
    <header
      className="fixed left-0 right-0 z-40 pointer-events-none transition-opacity duration-300"
      style={{ top: isIosClient ? '-5px' : '0' }}
    >
      <div
        className="w-full pointer-events-none relative pb-8"
        style={{
          background: 'transparent',
          paddingTop: 'var(--app-header-row-top)',
          paddingBottom: '32px',
          borderTop: 'none',
          borderRadius: '0'
        }}
      >
        <div className="app-chrome-width">
          <div className="relative flex w-full items-center justify-between py-2 px-2 gap-2">
            <div className="relative z-10 h-full mr-auto pointer-events-auto">
              <div className="rounded-full" style={groupShellStyle}>
                <div className="fortale-chrome-pill px-3 h-9 rounded-full flex items-center gap-2 font-semibold tracking-tight">
                  <FLogo size={16} className="fortale-brand-logo" />
                  <div className="leading-none">
                    <span className="block text-[13px] text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.22)]">Fortale</span>
                  </div>
                </div>
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
                    <Coins size={14} />
                    <span className="text-[10px] font-semibold text-white whitespace-nowrap">
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
