import React from 'react';
import { Coins } from 'lucide-react';
import type { CreditWallet } from '../types';
import { useUiI18n } from '../i18n/uiI18n';

interface CreditBalanceBreakdownProps {
  wallet: CreditWallet;
  className?: string;
  compact?: boolean;
}

function formatCreditAmount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}

export default function CreditBalanceBreakdown({
  wallet,
  className = '',
  compact = false
}: CreditBalanceBreakdownProps) {
  const { locale, t } = useUiI18n();
  const valueClass = compact ? 'text-[15px]' : 'text-[18px]';

  return (
    <div className={`credit-balance-breakdown ${className}`}>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white">{t('Satın alınan')}</p>
          <p className={`mt-1 font-black text-white ${valueClass}`}>{formatCreditAmount(wallet.purchasedCredits, locale)}</p>
        </div>
        <div className="min-w-0 border-l border-white/15 pl-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white">{t('Topluluktan elde edilen')}</p>
          <p className={`mt-1 font-black text-white ${valueClass}`}>{formatCreditAmount(wallet.communityEarnedCredits, locale)}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/15 pt-2.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-white">
          <Coins size={13} />
          {t('Toplam kredi')}
        </span>
        <span className={`${valueClass} font-black text-white`}>{formatCreditAmount(wallet.createCredits, locale)}</span>
      </div>
    </div>
  );
}
