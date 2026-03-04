import React, { useEffect, useState } from 'react';
import { Check, FileText, ShieldCheck } from 'lucide-react';
import { defaultPrivacyPolicy, defaultTermsPolicy } from '../data/policies';
import PolicyContent from './PolicyContent';
import { useUiI18n } from '../i18n/uiI18n';

interface LegalConsentModalProps {
  isOpen: boolean;
  isSaving?: boolean;
  error?: string | null;
  onAccept: () => void | Promise<void>;
}

const MODAL_TOP_OFFSET = 'clamp(92px, calc(var(--app-header-row-top, 56px) + 30px), 132px)';
const MODAL_BOTTOM_OFFSET = 'clamp(96px, calc(env(safe-area-inset-bottom, 0px) + 104px), 156px)';

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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[10020] bg-black/40 backdrop-blur-sm" />

      <div
        className="fixed left-0 right-0 z-[10021] px-[clamp(12px,3.5vw,24px)]"
        style={{ top: MODAL_TOP_OFFSET, bottom: MODAL_BOTTOM_OFFSET }}
      >
        <div className="mx-auto flex h-full w-full max-w-[min(540px,100%)] flex-col overflow-hidden rounded-[22px] border border-dashed border-[rgba(120,171,226,0.28)] bg-[rgba(17,22,29,0.96)] shadow-[0_24px_48px_-22px_rgba(0,0,0,0.72)] backdrop-blur-[20px] sm:max-w-[min(580px,100%)] sm:rounded-[28px] lg:max-w-[min(620px,100%)]">
          <div className="shrink-0 border-b border-dashed border-[rgba(120,171,226,0.2)] px-3.5 py-3.5 sm:px-4 sm:py-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-dashed border-[rgba(120,171,226,0.24)] bg-[rgba(18,31,48,0.88)] px-2.5 py-1 text-[10px] font-bold text-[#cfe4fb]">
              <FileText size={12} />
              {t('İlk Giriş Onayı')}
            </div>
            <h2 className="mt-3 text-[15px] font-bold text-white sm:text-[16px]">{t('Kullanım Şartları ve Gizlilik Onayı')}</h2>
            <p className="mt-1 text-[10px] leading-5 text-text-secondary sm:text-[11px]">
              {t('Devam etmek için kullanım şartlarını ve gizlilik politikasını onaylamanız gerekir.')}
              {' '}
              {t('Bu onay hesabınıza kaydedilir ve aynı sürüm için bir daha sorulmaz.')}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5 sm:px-4 sm:py-4">
            <div className="space-y-5 sm:space-y-6">
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-accent-green" />
                  <div>
                    <h3 className="text-[13px] font-bold text-white sm:text-[14px]">{t(defaultTermsPolicy.title)}</h3>
                    <p className="text-[10px] text-text-secondary">
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
                    <p className="text-[10px] text-text-secondary">
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
          </div>

          <div className="shrink-0 border-t border-dashed border-[rgba(120,171,226,0.2)] px-3.5 py-3.5 sm:px-4 sm:py-4">
            <label className="flex items-start gap-3 rounded-2xl border border-dashed border-[rgba(120,171,226,0.22)] bg-[rgba(19,32,49,0.86)] px-3 py-3">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(event) => setIsChecked(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent text-accent-green"
              />
              <span className="text-[10px] leading-5 text-[#d3e6fb] sm:text-[11px]">
                {t('Kullanım Şartlarını ve Gizlilik Politikasını okudum, anladım ve kabul ediyorum.')}
              </span>
            </label>

            {error ? (
              <p className="mt-2 text-[11px] text-[#ffb7b7]">{error}</p>
            ) : null}

            <button
              type="button"
              onClick={() => void onAccept()}
              disabled={!isChecked || isSaving}
              className={`mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-dashed text-[11px] font-bold transition-all sm:h-11 sm:text-[12px] ${!isChecked || isSaving
                ? 'border-[#3f556f]/30 bg-[#172233] text-[#7288a2]'
                : 'border-[#8cc9ff]/50 bg-gradient-to-r from-[#1b4f86] via-[#2a67a4] to-[#2c5a9a] text-white active:scale-95'
                }`}
            >
              <Check size={15} />
              {isSaving ? t('Onay Kaydediliyor...') : t('Onaylıyorum ve Devam Ediyorum')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
