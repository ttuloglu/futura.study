import React, { useEffect, useRef, useState } from 'react';
import { Coins, X } from 'lucide-react';
import FLogo from './FLogo';
import FaviconSpinner from './FaviconSpinner';
import { CreditActionType, CreditWallet } from '../types';
import { useUiI18n } from '../i18n/uiI18n';
import { useModalDismiss } from '../utils/useModalDismiss';

export interface CreditPackOption {
  id: string;
  createCredits: number;
  priceUsd: number;
  displayPrice?: string;
}

interface CreditPaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: CreditWallet;
  packs: CreditPackOption[];
  isPurchasing?: boolean;
  waitForStorePrices?: boolean;
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
    panelClass: 'border-[#cfe4ff]/30 bg-[#12315a]/70 shadow-[inset_0_0_0_1px_rgba(207,228,255,0.12)]',
    buyButtonClass: 'from-[#dcecff] via-[#9fc8f8] to-[#5f9bd8]',
    chipClass: 'border border-[#e7f2ff]/70 bg-[#e7f2ff]/90 text-[#071a33]',
    priceClass: 'text-[#e7f2ff]'
  },
  {
    panelClass: 'border-[#a9c7ec]/32 bg-[#0b294f]/76 shadow-[inset_0_0_0_1px_rgba(169,199,236,0.14)]',
    buyButtonClass: 'from-[#d4e8ff] via-[#8eb9ee] to-[#4f90d0]',
    chipClass: 'border border-[#dcecff]/70 bg-[#dcecff]/90 text-[#071a33]',
    priceClass: 'text-[#dcecff]'
  },
  {
    panelClass: 'border-[#84b7ee]/32 bg-[#12315f]/72 shadow-[inset_0_0_0_1px_rgba(132,183,238,0.14)]',
    buyButtonClass: 'from-[#d8ebff] via-[#96c4f6] to-[#4b9bd4]',
    chipClass: 'border border-[#e6f3ff]/70 bg-[#e6f3ff]/90 text-[#071a33]',
    priceClass: 'text-[#d8ebff]'
  },
  {
    panelClass: 'border-[#dcecff]/28 bg-[#163864]/72 shadow-[inset_0_0_0_1px_rgba(220,236,255,0.12)]',
    buyButtonClass: 'from-[#e5f2ff] via-[#9fc8f8] to-[#6aa7dc]',
    chipClass: 'border border-[#eff7ff]/70 bg-[#eff7ff]/90 text-[#071a33]',
    priceClass: 'text-[#eff7ff]'
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
  waitForStorePrices = false,
  insufficientAction = null,
  onPurchase
}: CreditPaywallModalProps) {
  const { t } = useUiI18n();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [activePackId, setActivePackId] = useState<string | null>(null);
  const wasPurchasingRef = useRef(false);

  useModalDismiss(panelRef, isOpen, onClose);

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
          className="fortale-paywall-panel pointer-events-auto mx-auto w-full max-w-[520px] overflow-hidden rounded-[28px] border border-white/28 bg-[linear-gradient(136deg,rgba(15,23,42,0.97),rgba(17,35,57,0.96)_38%,rgba(20,46,74,0.95)_68%,rgba(19,36,59,0.97))] shadow-[0_-14px_56px_rgba(8,15,25,0.56)] animate-enter"
          style={{ boxShadow: '0 -18px 56px rgba(8, 15, 25, 0.56), inset 0 0 0 1px rgba(148, 191, 255, 0.18)' }}
        >
          <div className="fortale-paywall-inner bg-[radial-gradient(circle_at_10%_4%,rgba(96,165,250,0.28),transparent_36%),radial-gradient(circle_at_98%_2%,rgba(80,118,172,0.26),transparent_34%),radial-gradient(circle_at_32%_96%,rgba(59,130,246,0.3),transparent_38%)] p-4">
            <div
              className="mb-3 h-1.5 w-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #dcecff 0%, #8eb9ee 50%, #3b82f6 100%)' }}
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

            <div className="fortale-paywall-balance mt-3 rounded-2xl border border-sky-300/65 bg-slate-800/45 p-3 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.18)]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-white">{t('Satın Al')}</p>
                  <p className="mt-1 text-[11px] text-white/80">{t(getHintByAction(insufficientAction))}</p>
                </div>
                <div className="rounded-xl border border-sky-200/70 bg-sky-400/18 px-2.5 py-1.5 text-right shadow-[inset_0_0_0_1px_rgba(96,165,250,0.2)]">
                  <div className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-sky-50">
                    <Coins size={11} />
                    {t('Mevcut Kredi')}
                  </div>
                  <div className="text-lg font-black text-white">{wallet.createCredits}</div>
                </div>
              </div>
            </div>

            {waitForStorePrices ? (
              <div className="mt-3 flex min-h-[168px] items-center justify-center rounded-2xl border border-sky-200/35 bg-slate-900/35">
                <span className="inline-flex items-center gap-2 text-[12px] font-bold text-sky-50">
                  <FaviconSpinner size={18} />
                  {t('Hazırlanıyor...')}
                </span>
              </div>
            ) : (
              <div className="mt-3 space-y-2.5">
                {packs.map((pack, index) => {
                  const accent = PACK_ACCENTS[index % PACK_ACCENTS.length];
                  const isPackBusy = isPurchasing && activePackId === pack.id;
                  return (
                    <div
                      key={pack.id}
                      className={`fortale-paywall-pack rounded-2xl border p-3 backdrop-blur-sm ${accent.panelClass}`}
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
                          <p className={`text-[13px] font-black ${accent.priceClass}`}>
                            {pack.displayPrice || `$${pack.priceUsd.toFixed(2)}`}
                          </p>
                          <button
                            type="button"
                            onClick={() => void handlePurchaseClick(pack.id)}
                            disabled={isPurchasing}
                            className={`fortale-paywall-buy inline-flex items-center rounded-xl border border-white/35 bg-gradient-to-r px-3 py-2 text-[12px] font-extrabold text-slate-900 shadow-[0_8px_20px_rgba(0,0,0,0.25)] transition-transform active:scale-[0.98] disabled:opacity-60 ${accent.buyButtonClass}`}
                          >
                            {isPackBusy ? (
                              <span className="inline-flex items-center gap-1.5 text-white">
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
            )}
          </div>
        </div>
      </div>
    </>
  );
}
