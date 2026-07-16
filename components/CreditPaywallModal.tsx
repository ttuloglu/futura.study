import React, { useEffect, useRef, useState } from 'react';
import FaviconSpinner from './FaviconSpinner';
import CreditBalanceBreakdown from './CreditBalanceBreakdown';
import { CreditActionType, CreditWallet } from '../types';
import { useUiI18n } from '../i18n/uiI18n';
import { useModalDismiss } from '../utils/useModalDismiss';
import FloatIslandSheet from './FloatIslandSheet';

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
    buyButtonClass: 'bg-[#dcecff]',
    chipClass: 'border border-[#e7f2ff]/70 bg-[#e7f2ff]/90 text-[#071a33]',
    priceClass: 'text-white'
  },
  {
    panelClass: 'border-[#a9c7ec]/32 bg-[#0b294f]/76 shadow-[inset_0_0_0_1px_rgba(169,199,236,0.14)]',
    buyButtonClass: 'bg-[#dcecff]',
    chipClass: 'border border-[#dcecff]/70 bg-[#dcecff]/90 text-[#071a33]',
    priceClass: 'text-white'
  },
  {
    panelClass: 'border-[#84b7ee]/32 bg-[#12315f]/72 shadow-[inset_0_0_0_1px_rgba(132,183,238,0.14)]',
    buyButtonClass: 'bg-[#dcecff]',
    chipClass: 'border border-[#e6f3ff]/70 bg-[#e6f3ff]/90 text-[#071a33]',
    priceClass: 'text-white'
  },
  {
    panelClass: 'border-[#dcecff]/28 bg-[#163864]/72 shadow-[inset_0_0_0_1px_rgba(220,236,255,0.12)]',
    buyButtonClass: 'bg-[#dcecff]',
    chipClass: 'border border-[#eff7ff]/70 bg-[#eff7ff]/90 text-[#071a33]',
    priceClass: 'text-white'
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
    <FloatIslandSheet isOpen onClose={onClose} title={t('Satın Al')} subtitle={t(getHintByAction(insufficientAction))} layer={11001} maxWidth={520} panelRef={panelRef} closeDisabled={isPurchasing} panelClassName="fortale-paywall-panel">
            <div
              className="mb-3 h-1.5 w-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #dcecff 0%, #8eb9ee 50%, #3b82f6 100%)' }}
            />
            <div className="fortale-paywall-balance mt-3 rounded-2xl border border-sky-300/65 bg-slate-800/45 p-3 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.18)]">
              <p className="text-sm font-bold text-white">{t('Kredi Bakiyesi')}</p>
              <p className="mt-1 text-[11px] text-white">{t(getHintByAction(insufficientAction))}</p>
              <CreditBalanceBreakdown wallet={wallet} className="mt-3" />
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
                            className={`fortale-paywall-buy inline-flex items-center rounded-xl border border-white/35 px-3 py-2 text-[12px] font-extrabold text-slate-900 shadow-[0_8px_20px_rgba(0,0,0,0.25)] transition-transform active:scale-[0.98] disabled:opacity-60 ${accent.buyButtonClass}`}
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
    </FloatIslandSheet>
  );
}
