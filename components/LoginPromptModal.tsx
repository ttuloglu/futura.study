import React from 'react';
import { BookOpen, Sparkles } from 'lucide-react';
import { useUiI18n } from '../i18n/uiI18n';
import FloatIslandSheet from './FloatIslandSheet';

interface LoginPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
}

export default function LoginPromptModal({ isOpen, onClose, onLogin }: LoginPromptModalProps) {
  const { t } = useUiI18n();
  if (!isOpen) return null;

  return (
    <FloatIslandSheet isOpen onClose={onClose} title={t('Fortale')} subtitle={t('Create, Discover and Share')} layer={11001} maxWidth={520}>
            <div
              className="mb-3 h-1.5 w-full rounded-full"
              style={{ background: '#3b82f6' }}
            />
            <div className="mt-4 rounded-2xl border border-sky-300/30 bg-slate-800/40 p-4 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.12)]">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/50 bg-amber-400/12">
                  <BookOpen size={18} className="text-amber-200" />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-white">{t('Üye olarak devam et')}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-white">
                    {t('Kitap oluşturmak için ücretsiz hesap açman yeterli. Üye olunca 3 oluşturma kredisi seni bekliyor.')}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-xl border border-sky-300/25 bg-sky-500/10 px-3 py-2">
                <Sparkles size={13} className="shrink-0 text-sky-200" />
                <p className="text-[11px] font-semibold text-sky-100">
                  {t('Masallar, hikayeler, romanlar — hepsi birkaç dakikada hazır.')}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={onLogin}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0b2342] px-5 py-3.5 text-[15px] font-extrabold tracking-tight text-white shadow-md transition-opacity active:opacity-80"
              >
                {t('Üye Ol / Giriş Yap')}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex w-full items-center justify-center rounded-2xl border border-white/12 bg-white/5 px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/10"
              >
                {t('Şimdi Değil')}
              </button>
            </div>
    </FloatIslandSheet>
  );
}
