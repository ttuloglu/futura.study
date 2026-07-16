import React from 'react';
import { Check, Globe2 } from 'lucide-react';
import { APP_LANGUAGE_OPTIONS, type AppLanguageCode } from '../data/appLanguages';
import { useUiI18n } from '../i18n/uiI18n';
import FloatIslandSheet from './FloatIslandSheet';

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
  return (
    <FloatIslandSheet
      isOpen={isOpen}
      onClose={() => undefined}
      closeDisabled
      closeOnBackdrop={false}
      showCloseButton={false}
      title={(
        <span className="inline-flex items-center gap-2">
          <Globe2 size={16} />
          {t('Uygulama dilini seçin')}
        </span>
      )}
      subtitle={t('Telefon diliniz desteklenen 20 dil arasında bulunamadı. Devam etmek için uygulama dilini seçin.')}
      layer={13031}
      maxWidth={560}
      footer={(
        <button
          type="button"
          onClick={() => void onConfirm()}
          className="flex h-11 w-full items-center justify-center rounded-2xl bg-white text-[12px] font-bold text-[#102238] transition-transform active:scale-[0.99]"
        >
          {t('Dili Kaydet ve Devam Et')}
        </button>
      )}
    >
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
                : 'border-[rgba(120,171,226,0.14)] bg-[rgba(19,27,36,0.9)] text-white hover:bg-[rgba(24,35,47,0.96)]'
                }`}
            >
              <span className="text-[12px] font-semibold">{option.label}</span>
              {isActive ? <Check size={15} className="shrink-0 text-accent-green" /> : null}
            </button>
          );
        })}
      </div>
    </FloatIslandSheet>
  );
}
