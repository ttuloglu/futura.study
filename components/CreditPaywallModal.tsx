import React, { useEffect, useRef } from 'react';
import { Coins, X } from 'lucide-react';
import FLogo from './FLogo';
import { CreditActionType, CreditWallet } from '../types';
import { useUiI18n } from '../i18n/uiI18n';

export interface CreditPackOption {
  id: string;
  createCredits: number;
  priceUsd: number;
}

interface CreditPaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: CreditWallet;
  packs: CreditPackOption[];
  isPurchasing?: boolean;
  insufficientAction?: CreditActionType | null;
  onPurchase: (packId: string) => void | Promise<void>;
}

type PackAccent = {
  panelClass: string;
  buyButtonClass: string;
  chipClass: string;
  priceClass: string;
};

const PACK_ACCENTS: PackAccent[] = [
  {
    panelClass: 'border-lime-300/70 bg-lime-500/24',
    buyButtonClass: 'from-lime-300 to-emerald-300',
    chipClass: 'bg-lime-100 text-lime-950',
    priceClass: 'text-lime-100'
  },
  {
    panelClass: 'border-cyan-300/70 bg-cyan-500/24',
    buyButtonClass: 'from-cyan-300 to-sky-300',
    chipClass: 'bg-cyan-100 text-cyan-950',
    priceClass: 'text-cyan-100'
  },
  {
    panelClass: 'border-orange-300/70 bg-orange-500/24',
    buyButtonClass: 'from-amber-300 to-orange-300',
    chipClass: 'bg-amber-100 text-amber-950',
    priceClass: 'text-amber-100'
  },
  {
    panelClass: 'border-pink-300/70 bg-pink-500/24',
    buyButtonClass: 'from-pink-300 to-fuchsia-300',
    chipClass: 'bg-pink-100 text-pink-950',
    priceClass: 'text-pink-100'
  }
];

function getHintByAction(action: CreditActionType | null | undefined): string {
  if (action === 'create') return 'Kredi bakiyenizi yükselterek kesintisiz devam edebilirsiniz.';
  return 'Kredi bakiyenizi yükselterek kesintisiz devam edebilirsiniz.';
}

export default function CreditPaywallModal({
  isOpen,
  onClose,
  wallet,
  packs,
  isPurchasing = false,
  insufficientAction = null,
  onPurchase
}: CreditPaywallModalProps) {
  const { t } = useUiI18n();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const handleOutsideClick = (event: MouseEvent) => {
      if (!panelRef.current) return;
      if (panelRef.current.contains(event.target as Node)) return;
      onClose();
    };

    document.addEventListener('keydown', handleEsc);
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[11000] bg-black/34 backdrop-blur-sm" onClick={onClose} />

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[11001] px-2 pb-[max(10px,env(safe-area-inset-bottom))] sm:px-3">
        <div
          ref={panelRef}
          className="pointer-events-auto mx-auto w-full max-w-[520px] overflow-hidden rounded-[28px] border border-amber-300/65 bg-[linear-gradient(136deg,rgba(30,15,75,0.96),rgba(3,47,85,0.95)_38%,rgba(7,94,84,0.94)_68%,rgba(109,40,217,0.96))] shadow-[0_-14px_56px_rgba(8,15,25,0.56)] animate-enter"
        >
          <div className="bg-[radial-gradient(circle_at_10%_4%,rgba(250,204,21,0.36),transparent_36%),radial-gradient(circle_at_98%_2%,rgba(14,165,233,0.34),transparent_34%),radial-gradient(circle_at_32%_96%,rgba(236,72,153,0.28),transparent_38%)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/70 bg-amber-300/22">
                  <FLogo size={22} className="text-emerald-300" />
                </div>
                <div>
                  <p className="text-[17px] font-extrabold tracking-tight text-white">{t('Fortale')}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">{t('Build Your Epic')}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-orange-300/70 bg-orange-400/28 text-orange-100 transition-colors hover:bg-orange-400/40"
                aria-label={t('Kapat')}
              >
                <X size={14} />
              </button>
            </div>

            <div className="mt-3 rounded-2xl border border-cyan-300/65 bg-cyan-500/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-white">{t('Kredi Satın Al')}</p>
                  <p className="mt-1 text-[11px] text-white/80">{t(getHintByAction(insufficientAction))}</p>
                </div>
                <div className="rounded-xl border border-amber-300/70 bg-amber-400/26 px-2.5 py-1.5 text-right">
                  <div className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-50">
                    <Coins size={11} />
                    {t('Mevcut Kredi')}
                  </div>
                  <div className="text-lg font-black text-white">{wallet.createCredits}</div>
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-2.5">
              {packs.map((pack, index) => {
                const accent = PACK_ACCENTS[index % PACK_ACCENTS.length];
                return (
                  <div
                    key={pack.id}
                    className={`rounded-2xl border p-3 backdrop-blur-sm ${accent.panelClass}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${accent.chipClass}`}>
                          {t('Kredi')}
                        </span>
                        <p className="truncate text-[15px] font-extrabold text-white">
                          +{pack.createCredits}
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-1">
                        <p className={`text-[13px] font-black ${accent.priceClass}`}>${pack.priceUsd.toFixed(2)}</p>
                        <button
                          type="button"
                          onClick={() => void onPurchase(pack.id)}
                          disabled={isPurchasing}
                          className={`inline-flex items-center rounded-xl bg-gradient-to-r px-3 py-2 text-[12px] font-extrabold text-slate-900 shadow-[0_8px_20px_rgba(0,0,0,0.25)] transition-transform active:scale-[0.98] disabled:opacity-60 ${accent.buyButtonClass}`}
                        >
                          {isPurchasing ? t('İşleniyor...') : t('Kredi Satın Al')}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
