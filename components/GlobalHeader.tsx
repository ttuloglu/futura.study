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
  const createCredits = credits?.createCredits ?? 0;

  return (
    <header
      className="fixed left-0 right-0 z-40 pointer-events-none transition-opacity duration-300"
      style={{ top: '0' }}
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
        <div className="app-content-width px-4">
          <div className="flex items-center justify-between relative">
            <div className="h-9 px-3 rounded-full flex items-center gap-2 font-semibold tracking-tight floating-island-icon quick-add-trigger pointer-events-auto">
              <FLogo size={14} />
                <div className="leading-none">
                  <span className="block text-[13px] text-white">Fortale</span>
                  <span className="block text-[9px] text-white/75">{t('Build Your Epic')}</span>
                </div>
              </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenPaywall?.()}
                className="h-9 px-3 rounded-full floating-island-icon quick-add-trigger pointer-events-auto text-white hover:scale-105 active:scale-95 transition-transform duration-200 inline-flex items-center gap-1.5"
                title={t('Kredi satın al')}
                aria-label={t('Kredi satın al')}
              >
                <Coins size={14} />
                <span className="text-[10px] font-semibold text-white/90 whitespace-nowrap">
                  {createCredits}C
                </span>
              </button>
              <button
                onClick={onToggleSettings}
                className="w-9 h-9 rounded-full flex items-center justify-center floating-island-icon quick-add-trigger pointer-events-auto text-white hover:scale-110 active:scale-90 transition-transform duration-200"
              >
                {isSettingsOpen ? <X size={18} /> : <Settings size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
