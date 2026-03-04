import React, { useEffect, useRef } from 'react';
import { Coins, X } from 'lucide-react';
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

const SMARTBOOK_SURFACE_BG = 'rgba(17, 22, 29, 0.42)';
const SMARTBOOK_SURFACE_BORDER = 'rgba(173, 149, 124, 0.09)';

function getHintByAction(action: CreditActionType | null | undefined, t: (key: string) => string): string {
  if (action === 'create') return t('Fortale oluşturmak için oluşturma kredisi gerekir.');
  return t('Kredi bakiyenizi yükselterek kesintisiz devam edebilirsiniz.');
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
  const smartbookSurfaceStyle: React.CSSProperties = {
    backgroundColor: SMARTBOOK_SURFACE_BG,
    borderColor: SMARTBOOK_SURFACE_BORDER
  };

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
      <div className="fixed inset-0 z-[11000] bg-black/22 backdrop-blur-sm animate-enter" onClick={onClose} />
      <div className="fixed inset-0 z-[11001] px-3 sm:px-4 flex items-center justify-center">
        <div
          ref={panelRef}
          className="w-full max-w-[460px] rounded-[24px] border border-dashed shadow-[0_20px_38px_-18px_rgba(0,0,0,0.7)] backdrop-blur-[22px] animate-enter overflow-hidden"
          style={smartbookSurfaceStyle}
        >
          <div className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">{t('Kredi Satın Al')}</p>
                <p className="mt-1 text-[11px] text-white/68">{getHintByAction(insufficientAction, t)}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full border border-dashed text-white/80 leading-none transition-colors hover:bg-[rgba(23,28,36,0.52)]"
                style={smartbookSurfaceStyle}
                aria-label={t('Kapat')}
              >
                <X size={14} />
              </button>
            </div>

            <div
              className="w-full rounded-2xl border border-dashed px-3 py-2.5 text-left"
              style={smartbookSurfaceStyle}
            >
              <div className="flex items-center gap-2">
                <Coins size={14} className="text-[#b7d2f0]" />
                <p className="text-[12px] font-semibold text-white/92">{t('Mevcut Kredi')}</p>
              </div>
              <div className="mt-2 text-[11px]">
                <div className="rounded-xl border border-dashed px-2.5 py-2" style={smartbookSurfaceStyle}>
                  <div className="inline-flex items-center gap-1 text-white/62">
                    <Coins size={11} />
                    {t('Kredi')}
                  </div>
                  <div className="mt-1 text-white font-bold">{wallet.createCredits}</div>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              {packs.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => void onPurchase(pack.id)}
                  disabled={isPurchasing}
                  className="w-full rounded-2xl border border-dashed px-3 py-3 text-left transition-all hover:bg-[rgba(23,28,36,0.52)] disabled:opacity-70"
                  style={smartbookSurfaceStyle}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-[#c9dff7]" style={{ background: 'rgba(23,38,58,0.88)' }}>
                        {t('Kredi')}
                      </span>
                      <p className="text-[12px] font-bold text-white">
                        +{pack.createCredits} {t('kredi')}
                      </p>
                    </div>
                    <p className="text-sm font-black text-[#cfe4fb]">${pack.priceUsd.toFixed(2)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
