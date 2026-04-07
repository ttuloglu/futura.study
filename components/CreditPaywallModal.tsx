import React, { useEffect, useRef, useState } from 'react';
import { Coins, X } from 'lucide-react';
import FLogo from './FLogo';
import FaviconSpinner from './FaviconSpinner';
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
    panelClass: 'border-amber-300/70 bg-amber-500/16 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.18)]',
    buyButtonClass: 'from-amber-300 via-yellow-300 to-amber-200',
    chipClass: 'border border-amber-100/85 bg-amber-100/95 text-amber-950',
    priceClass: 'text-amber-100'
  },
  {
    panelClass: 'border-emerald-300/70 bg-emerald-500/16 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2)]',
    buyButtonClass: 'from-emerald-300 via-teal-300 to-cyan-300',
    chipClass: 'border border-emerald-100/85 bg-emerald-100/95 text-emerald-950',
    priceClass: 'text-emerald-100'
  },
  {
    panelClass: 'border-blue-300/70 bg-blue-500/16 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.2)]',
    buyButtonClass: 'from-blue-300 via-sky-300 to-indigo-300',
    chipClass: 'border border-blue-100/85 bg-blue-100/95 text-blue-950',
    priceClass: 'text-blue-100'
  },
  {
    panelClass: 'border-cyan-300/70 bg-cyan-500/14 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.2)]',
    buyButtonClass: 'from-cyan-300 via-sky-300 to-blue-300',
    chipClass: 'border border-cyan-100/85 bg-cyan-100/95 text-cyan-950',
    priceClass: 'text-cyan-100'
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
  const [activePackId, setActivePackId] = useState<string | null>(null);
  const wasPurchasingRef = useRef(false);

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

  useEffect(() => {
    if (!isOpen) {
      setActivePackId(null);
      wasPurchasingRef.current = false;
      return;
    }
    if (isPurchasing) {
      wasPurchasingRef.current = true;
      return;
    }
    if (wasPurchasingRef.current) {
      setActivePackId(null);
      wasPurchasingRef.current = false;
    }
  }, [isOpen, isPurchasing]);

  if (!isOpen) return null;

  const handlePurchaseClick = async (packId: string) => {
    setActivePackId(packId);
    try {
      await onPurchase(packId);
    } catch {
      if (!isPurchasing) {
        setActivePackId(null);
      }
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[11000] bg-black/34 backdrop-blur-sm" onClick={onClose} />

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[11001] px-2 pb-[max(10px,env(safe-area-inset-bottom))] sm:px-3">
        <div
          ref={panelRef}
          className="pointer-events-auto mx-auto w-full max-w-[520px] overflow-hidden rounded-[28px] border border-white/28 bg-[linear-gradient(136deg,rgba(15,23,42,0.97),rgba(17,35,57,0.96)_38%,rgba(20,46,74,0.95)_68%,rgba(19,36,59,0.97))] shadow-[0_-14px_56px_rgba(8,15,25,0.56)] animate-enter"
          style={{ boxShadow: '0 -18px 56px rgba(8, 15, 25, 0.56), inset 0 0 0 1px rgba(148, 191, 255, 0.18)' }}
        >
          <div className="bg-[radial-gradient(circle_at_10%_4%,rgba(245,158,11,0.3),transparent_36%),radial-gradient(circle_at_98%_2%,rgba(16,185,129,0.26),transparent_34%),radial-gradient(circle_at_32%_96%,rgba(59,130,246,0.3),transparent_38%)] p-4">
            <div
              className="mb-3 h-1.5 w-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #f59e0b 0%, #10b981 50%, #3b82f6 100%)' }}
            />
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-200/65 bg-slate-800/42 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.22)]">
                  <FLogo size={22} className="text-sky-200" />
                </div>
                <div>
                  <p className="text-[17px] font-extrabold tracking-tight text-white">{t('Fortale')}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-100">{t('Build Your Epic')}</p>
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

            <div className="mt-3 rounded-2xl border border-sky-300/65 bg-slate-800/45 p-3 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.18)]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-white">{t('Satın Al')}</p>
                  <p className="mt-1 text-[11px] text-white/80">{t(getHintByAction(insufficientAction))}</p>
                </div>
                <div className="rounded-xl border border-amber-300/70 bg-amber-400/18 px-2.5 py-1.5 text-right shadow-[inset_0_0_0_1px_rgba(245,158,11,0.2)]">
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
                const isPackBusy = isPurchasing && activePackId === pack.id;
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
                          onClick={() => void handlePurchaseClick(pack.id)}
                          disabled={isPurchasing}
                          className={`inline-flex items-center rounded-xl border border-white/35 bg-gradient-to-r px-3 py-2 text-[12px] font-extrabold text-slate-900 shadow-[0_8px_20px_rgba(0,0,0,0.25)] transition-transform active:scale-[0.98] disabled:opacity-60 ${accent.buyButtonClass}`}
                        >
                          {isPackBusy ? (
                            <span className="inline-flex items-center gap-1.5">
                              <FaviconSpinner size={14} />
                              <span>{t('İşleniyor')}</span>
                            </span>
                          ) : t('Satın Al')}
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
