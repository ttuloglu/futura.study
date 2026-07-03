import React, { useRef } from 'react';
import { BookOpen, Sparkles, X } from 'lucide-react';
import FLogo from './FLogo';
import { useUiI18n } from '../i18n/uiI18n';
import { useModalDismiss } from '../utils/useModalDismiss';

interface LoginPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
}

export default function LoginPromptModal({ isOpen, onClose, onLogin }: LoginPromptModalProps) {
  const { t } = useUiI18n();
  const panelRef = useRef<HTMLDivElement | null>(null);
  useModalDismiss(panelRef, isOpen, onClose);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[11000] bg-black/34 backdrop-blur-sm" onClick={onClose} />

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[11001] px-2 pb-[max(10px,env(safe-area-inset-bottom))] sm:px-3">
        <div
          ref={panelRef}
          className="pointer-events-auto mx-auto w-full max-w-[520px] overflow-hidden rounded-[28px] border border-white/28 bg-[linear-gradient(136deg,rgba(15,23,42,0.97),rgba(17,35,57,0.96)_38%,rgba(20,46,74,0.95)_68%,rgba(19,36,59,0.97))] shadow-[0_-14px_56px_rgba(8,15,25,0.56)] animate-enter"
          style={{ boxShadow: '0 -18px 56px rgba(8, 15, 25, 0.56), inset 0 0 0 1px rgba(148, 191, 255, 0.18)' }}
        >
          <div className="bg-[radial-gradient(circle_at_10%_4%,rgba(96,165,250,0.28),transparent_36%),radial-gradient(circle_at_98%_2%,rgba(80,118,172,0.26),transparent_34%),radial-gradient(circle_at_32%_96%,rgba(59,130,246,0.3),transparent_38%)] p-4">
            <div
              className="mb-3 h-1.5 w-full rounded-full"
              style={{ background: '#3b82f6' }}
            />

            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-200/65 bg-slate-800/42 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.22)]">
                  <FLogo size={22} className="text-sky-200" />
                </div>
                <div>
                  <p className="text-[17px] font-extrabold tracking-tight text-white">{t('Fortale')}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-100">{t('Create, Discover and Share')}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-sky-200/60 bg-slate-700/38 text-sky-100 transition-colors hover:bg-slate-700/55"
                aria-label={t('Kapat')}
              >
                <X size={14} />
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-sky-300/30 bg-slate-800/40 p-4 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.12)]">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/50 bg-amber-400/12">
                  <BookOpen size={18} className="text-amber-200" />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-white">{t('Üye olarak devam et')}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/70">
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
                className="flex w-full items-center justify-center rounded-2xl border border-white/12 bg-white/5 px-5 py-2.5 text-[13px] font-semibold text-white/60 transition-colors hover:bg-white/10"
              >
                {t('Şimdi Değil')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
