import React from 'react';
import { Coins, Settings, X } from 'lucide-react';
import { CreditWallet } from '../types';
import FLogo from './FLogo';
import { useUiI18n } from '../i18n/uiI18n';

interface GlobalHeaderProps {
  onToggleSettings: () => void;
  isSettingsOpen: boolean;
  credits?: CreditWallet;
  onOpenPaywall?: () => void;
}

export default function GlobalHeader({
  onToggleSettings,
  isSettingsOpen,
  credits,
  onOpenPaywall
}: GlobalHeaderProps) {
  const { t } = useUiI18n();
  const isIosClient = typeof window !== 'undefined' && (() => {
    const ua = window.navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    return window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  })();
  const createCredits = credits?.createCredits ?? 0;
  const groupShellStyle: React.CSSProperties = {
    background: 'rgba(17, 22, 29, 0.26)',
    border: '1px dashed rgba(188, 194, 203, 0.14)',
    borderRadius: 9999,
    padding: '2px',
    backdropFilter: 'blur(4px)',
    boxShadow: 'inset 0 0 0 1px rgba(188, 194, 203, 0.08)'
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
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-2 inset-x-2 rounded-full border border-dashed backdrop-blur-[4px]"
              style={{
                background: 'rgba(17, 22, 29, 0.3)',
                borderColor: 'rgba(188, 194, 203, 0.1)',
                boxShadow: 'inset 0 0 0 1px rgba(188, 194, 203, 0.06), 0 10px 20px -16px rgba(0,0,0,0.18)'
              }}
            />

            <div className="relative z-10 h-full mr-auto pointer-events-auto">
              <div className="rounded-full" style={groupShellStyle}>
                <div className="px-3 h-9 rounded-full flex items-center gap-2 font-semibold tracking-tight">
                  <FLogo size={14} />
                  <div className="leading-none">
                    <span className="block text-[13px] text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.22)]">Fortale</span>
                    <span className="block text-[9px] text-white/95 drop-shadow-[0_0_4px_rgba(255,255,255,0.2)]">{t('Build Your Epic')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 h-full ml-auto pointer-events-auto">
              <div className="rounded-full" style={groupShellStyle}>
                <div className="px-1 h-9 rounded-full flex items-center gap-1.5">
                  <button
                    onClick={() => onOpenPaywall?.()}
                    className="h-8 px-2.5 rounded-full text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.28)] hover:scale-105 active:scale-95 transition-transform duration-200 inline-flex items-center gap-1.5"
                    title={t('Kredi satın al')}
                    aria-label={t('Kredi satın al')}
                  >
                    <Coins size={14} />
                    <span className="text-[10px] font-semibold text-white whitespace-nowrap">
                      {createCredits}C
                    </span>
                  </button>
                  <button
                    onClick={onToggleSettings}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.28)] hover:scale-110 active:scale-90 transition-transform duration-200"
                  >
                    {isSettingsOpen ? <X size={18} /> : <Settings size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
