import React, { useEffect, useState } from 'react';
import { Check, FileText, ShieldCheck } from 'lucide-react';
import { defaultPrivacyPolicy, defaultTermsPolicy } from '../data/policies';
import PolicyContent from './PolicyContent';
import { useUiI18n } from '../i18n/uiI18n';
import FloatIslandSheet from './FloatIslandSheet';

interface LegalConsentModalProps {
  isOpen: boolean;
  isSaving?: boolean;
  error?: string | null;
  onAccept: () => void | Promise<void>;
}

export default function LegalConsentModal({
  isOpen,
  isSaving = false,
  error,
  onAccept
}: LegalConsentModalProps) {
  const { t } = useUiI18n();
  const [isChecked, setIsChecked] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsChecked(false);
  }, [isOpen]);

  return (
    <FloatIslandSheet
      isOpen={isOpen}
      onClose={() => undefined}
      closeDisabled
      closeOnBackdrop={false}
      showCloseButton={false}
      title={t('Kullanım Şartları ve Gizlilik Onayı')}
      subtitle={(
        <>
          {t('Devam etmek için kullanım şartlarını ve gizlilik politikasını onaylamanız gerekir.')}{' '}
          {t('Bu onay hesabınıza kaydedilir ve aynı sürüm için bir daha sorulmaz.')}
        </>
      )}
      layer={13021}
      maxWidth={620}
      footer={(
        <div>
          <label className="flex items-start gap-3 rounded-2xl border border-dashed border-[rgba(120,171,226,0.22)] bg-[rgba(19,32,49,0.86)] px-3 py-3">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(event) => setIsChecked(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent text-accent-green"
            />
            <span className="text-[10px] leading-5 text-white sm:text-[11px]">
              {t('Kullanım Şartlarını ve Gizlilik Politikasını; Topluluk Kuralları ve otomatik İçerik Hakları Beyanı dahil olmak üzere okudum, anladım ve kabul ediyorum.')}
            </span>
          </label>

          {error ? <p className="mt-2 text-[11px] text-[#ffb7b7]">{error}</p> : null}

          <button
            type="button"
            onClick={() => void onAccept()}
            disabled={!isChecked || isSaving}
            className={`mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-2xl border text-[11px] font-bold transition-all sm:h-11 sm:text-[12px] ${!isChecked || isSaving
              ? 'border-[#3f556f]/30 bg-[#172233] text-white'
              : 'border-white bg-white text-[#102238] active:scale-95'
              }`}
          >
            <Check size={15} />
            {isSaving ? t('Onay Kaydediliyor...') : t('Onaylıyorum ve Devam Ediyorum')}
          </button>
        </div>
      )}
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-dashed border-[rgba(120,171,226,0.24)] bg-[rgba(18,31,48,0.88)] px-2.5 py-1 text-[10px] font-bold text-white">
        <FileText size={12} />
        {t('İlk Giriş Onayı')}
      </div>

            <div className="space-y-5 sm:space-y-6">
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-accent-green" />
                  <div>
                    <h3 className="text-[13px] font-bold text-white sm:text-[14px]">{t(defaultTermsPolicy.title)}</h3>
                    <p className="text-[10px] text-white">
                      {t(defaultTermsPolicy.lastUpdatedLabel)}
                      {defaultTermsPolicy.lastUpdatedDate}
                    </p>
                  </div>
                </div>
                <div className="space-y-4 sm:space-y-5">
                  {defaultTermsPolicy.sections.map((section) => (
                    <section key={`terms-${section.title}`} className="space-y-2">
                      <h4 className="text-[11px] font-bold text-white sm:text-[12px]">{t(section.title)}</h4>
                      <PolicyContent content={section.content} />
                    </section>
                  ))}
                </div>
              </section>

              <section className="space-y-4 border-t border-dashed border-[rgba(120,171,226,0.18)] pt-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-accent-green" />
                  <div>
                    <h3 className="text-[13px] font-bold text-white sm:text-[14px]">{t(defaultPrivacyPolicy.title)}</h3>
                    <p className="text-[10px] text-white">
                      {t(defaultPrivacyPolicy.lastUpdatedLabel)}
                      {defaultPrivacyPolicy.lastUpdatedDate}
                    </p>
                  </div>
                </div>
                <div className="space-y-4 sm:space-y-5">
                  {defaultPrivacyPolicy.sections.map((section) => (
                    <section key={`privacy-${section.title}`} className="space-y-2">
                      <h4 className="text-[11px] font-bold text-white sm:text-[12px]">{t(section.title)}</h4>
                      <PolicyContent content={section.content} />
                    </section>
                  ))}
                </div>
              </section>
            </div>
    </FloatIslandSheet>
  );
}
