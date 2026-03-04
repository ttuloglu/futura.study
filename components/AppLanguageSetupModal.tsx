import React from 'react';
import { Check, Globe2 } from 'lucide-react';
import { APP_LANGUAGE_OPTIONS, type AppLanguageCode } from '../data/appLanguages';
import { useUiI18n } from '../i18n/uiI18n';

interface AppLanguageSetupModalProps {
  isOpen: boolean;
  selectedLanguage: AppLanguageCode;
  onSelectLanguage: (language: AppLanguageCode) => void;
  onConfirm: () => void | Promise<void>;
}

export default function AppLanguageSetupModal({
  isOpen,
  selectedLanguage,
  onSelectLanguage,
  onConfirm
}: AppLanguageSetupModalProps) {
  const { t } = useUiI18n();
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[10030] bg-[rgba(4,8,13,0.72)] backdrop-blur-md" />

      <div className="fixed inset-0 z-[10031] flex items-center justify-center px-4 py-[max(calc(env(safe-area-inset-top,0px)+20px),20px)]">
        <div className="w-full max-w-[560px] overflow-hidden rounded-[30px] border border-dashed border-[rgba(120,171,226,0.26)] bg-[rgba(14,19,26,0.98)] shadow-[0_24px_44px_-24px_rgba(0,0,0,0.82)]">
          <div className="border-b border-dashed border-[rgba(120,171,226,0.18)] px-4 py-4 sm:px-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-dashed border-[rgba(120,171,226,0.22)] bg-[rgba(18,31,48,0.86)] px-3 py-1 text-[10px] font-bold tracking-[0.18em] text-[#cfe4fb]">
              <Globe2 size={13} />
              {t('Language Setup')}
            </div>
            <h2 className="mt-3 text-[16px] font-bold text-white sm:text-[18px]">{t('Uygulama dilini seçin')}</h2>
            <p className="mt-1 text-[11px] leading-5 text-[#b8cee8] sm:text-[12px]">
              {t('Telefon diliniz desteklenen 20 dil arasında bulunamadı. Devam etmek için uygulama dilini seçin.')}
            </p>
          </div>

          <div className="max-h-[min(54vh,420px)] overflow-y-auto p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {APP_LANGUAGE_OPTIONS.map((option) => {
                const isActive = option.code === selectedLanguage;
                return (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => onSelectLanguage(option.code)}
                    className={`flex items-center justify-between gap-3 rounded-[20px] border border-dashed px-3 py-3 text-left transition-all ${isActive
                      ? 'border-[#8cc9ff]/48 bg-[rgba(24,58,94,0.86)] text-white'
                      : 'border-[rgba(120,171,226,0.14)] bg-[rgba(19,27,36,0.9)] text-[#d8e7f7] hover:bg-[rgba(24,35,47,0.96)]'
                      }`}
                  >
                    <span className="text-[12px] font-semibold">{option.label}</span>
                    {isActive ? <Check size={15} className="shrink-0 text-accent-green" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-dashed border-[rgba(120,171,226,0.18)] px-4 py-4 sm:px-5">
            <button
              type="button"
              onClick={() => void onConfirm()}
              className="flex h-11 w-full items-center justify-center rounded-2xl border border-dashed border-[#8cc9ff]/48 bg-gradient-to-r from-[#1b4f86] via-[#2a67a4] to-[#2c5a9a] text-[12px] font-bold text-white transition-transform active:scale-[0.99]"
            >
              {t('Dili Kaydet ve Devam Et')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
