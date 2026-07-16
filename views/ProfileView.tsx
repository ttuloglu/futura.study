import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, Bell, Download, LogOut, Save, ShieldCheck, Trash2, User, UserRoundPen } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { useUiI18n } from '../i18n/uiI18n';
import { functions } from '../firebaseConfig';
import FaviconSpinner from '../components/FaviconSpinner';
import FloatIslandSheet from '../components/FloatIslandSheet';
import CreditBalanceBreakdown from '../components/CreditBalanceBreakdown';
import type { CreditWallet } from '../types';

interface ProfileViewProps {
  userName: string;
  userEmail?: string;
  isGuestSession?: boolean;
  savedBookCount?: number;
  wallet: CreditWallet;
  onLogout: () => void | Promise<void>;
  onUpdateProfileName?: (nextName: string) => void | Promise<void>;
  onDeleteMyData?: () => void | Promise<void>;
  onDeleteAccount?: () => void | Promise<void>;
}

type ProfileDangerAction = 'delete-data' | 'delete-account' | null;

type CommunityProfileResult = {
  profile: {
    userId: string;
    alias?: string;
    followerCount: number;
    followingCount: number;
    publicationCount: number;
    totalLikeCount: number;
    totalDownloadCount: number;
  };
};

const getCommunityProfileFn = httpsCallable<Record<string, unknown>, CommunityProfileResult>(functions, 'getCommunityProfile');

export default function ProfileView({
  userName,
  userEmail,
  isGuestSession = false,
  savedBookCount = 0,
  wallet,
  onLogout,
  onUpdateProfileName,
  onDeleteMyData,
  onDeleteAccount
}: ProfileViewProps) {
  const { t } = useUiI18n();
  const [notifications, setNotifications] = useState(true);
  const [nameInput, setNameInput] = useState(userName);
  const [isSavingName, setIsSavingName] = useState(false);
  const [pendingDangerAction, setPendingDangerAction] = useState<ProfileDangerAction>(null);
  const [isDangerActionBusy, setDangerActionBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [communityDashboard, setCommunityDashboard] = useState<CommunityProfileResult | null>(null);
  const [isCommunityDashboardLoading, setIsCommunityDashboardLoading] = useState(false);
  const statusToastTimerRef = useRef<number | null>(null);
  const canManageAccount = !isGuestSession;

  const getSafeProfileErrorMessage = (error: unknown, fallback: string): string => {
    const raw = String((error as { message?: unknown } | null)?.message || '');
    if (!raw) return fallback;
    const normalized = raw.toLocaleLowerCase('tr-TR');
    if (
      normalized.includes('permission-denied') ||
      normalized.includes('unauthenticated') ||
      normalized.includes('auth/') ||
      normalized.includes('oturum') ||
      normalized.includes('giriş')
    ) {
      return t('Oturum doğrulanamadı. Lütfen tekrar giriş yapın.');
    }
    return fallback;
  };

  useEffect(() => {
    setNameInput(userName);
  }, [userName]);

  useEffect(() => {
    if (isGuestSession) {
      setCommunityDashboard(null);
      setIsCommunityDashboardLoading(false);
      return;
    }
    let isCancelled = false;
    setIsCommunityDashboardLoading(true);
    getCommunityProfileFn({})
      .then((result) => {
        if (!isCancelled) setCommunityDashboard(result.data);
      })
      .catch(() => {
        if (!isCancelled) setCommunityDashboard(null);
      })
      .finally(() => {
        if (!isCancelled) setIsCommunityDashboardLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [isGuestSession]);

  const dangerModalMeta = useMemo(() => {
    if (pendingDangerAction === 'delete-data') {
      return {
        title: t('Verilerimi Sil'),
        description: t('Kitaplarınız, notlarınız ve hesap verileriniz kalıcı olarak silinir. Bu işlem geri alınamaz.'),
        confirmLabel: t('Verileri Sil'),
        successMessage: t('Verileriniz silindi.')
      };
    }
    if (pendingDangerAction === 'delete-account') {
      return {
        title: t('Hesabımı Sil'),
        description: t('Hesabınız ve ilişkili verileriniz kalıcı olarak silinir. Bu işlem geri alınamaz.'),
        confirmLabel: t('Hesabı Sil'),
        successMessage: t('Hesap silme işlemi tamamlandı.')
      };
    }
    return null;
  }, [pendingDangerAction, t]);

  const handleSaveProfileName = async () => {
    if (!onUpdateProfileName) return;
    const normalized = String(nameInput || '').trim().replace(/\s+/g, ' ');
    if (!normalized) {
      setErrorMessage(t('İsim Soyisim boş olamaz.'));
      return;
    }

    setIsSavingName(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      await onUpdateProfileName(normalized);
      setStatusMessage(t('İsim Soyisim güncellendi.'));
    } catch (error) {
      setErrorMessage(getSafeProfileErrorMessage(error, t('İsim Soyisim güncellenemedi.')));
    } finally {
      setIsSavingName(false);
    }
  };

  const handleConfirmDangerAction = async () => {
    if (!pendingDangerAction) return;

    setDangerActionBusy(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      if (pendingDangerAction === 'delete-data') {
        await onDeleteMyData?.();
      } else if (pendingDangerAction === 'delete-account') {
        await onDeleteAccount?.();
      }
      if (dangerModalMeta?.successMessage) {
        setStatusMessage(dangerModalMeta.successMessage);
      }
      setPendingDangerAction(null);
    } catch (error) {
      setErrorMessage(getSafeProfileErrorMessage(error, t('İşlem tamamlanamadı.')));
    } finally {
      setDangerActionBusy(false);
    }
  };

  useEffect(() => {
    const activeMessage = errorMessage || statusMessage;
    if (!activeMessage) return;
    if (statusToastTimerRef.current !== null) {
      window.clearTimeout(statusToastTimerRef.current);
    }
    statusToastTimerRef.current = window.setTimeout(() => {
      setErrorMessage('');
      setStatusMessage('');
      statusToastTimerRef.current = null;
    }, 2400);
  }, [errorMessage, statusMessage]);

  useEffect(() => {
    return () => {
      if (statusToastTimerRef.current !== null) {
        window.clearTimeout(statusToastTimerRef.current);
      }
    };
  }, []);

  const dashboardProfile = communityDashboard?.profile;

  return (
    <div className="view-container">
      <FloatIslandSheet
        isOpen={Boolean(pendingDangerAction && dangerModalMeta)}
        onClose={() => setPendingDangerAction(null)}
        closeDisabled={isDangerActionBusy}
        title={dangerModalMeta ? (
          <span className="inline-flex items-center gap-2">
            <AlertTriangle size={16} className="text-[#ffb3a8]" />
            {dangerModalMeta.title}
          </span>
        ) : undefined}
        subtitle={dangerModalMeta?.description}
        maxWidth={384}
        layer={980}
        bodyClassName="p-4"
      >
        {dangerModalMeta && (
          <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDangerAction(null)}
                className="h-9 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-[12px] font-semibold text-white"
              >
                {t('Vazgeç')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDangerAction}
                disabled={isDangerActionBusy}
                className="h-9 rounded-xl bg-[#9b3840] px-3 text-[12px] font-bold text-white disabled:opacity-70"
              >
                {isDangerActionBusy ? t('İşleniyor...') : dangerModalMeta.confirmLabel}
              </button>
          </div>
        )}
      </FloatIslandSheet>

      {(statusMessage || errorMessage) && (
        <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+80px)] z-[985] -translate-x-1/2 px-4">
          <div className="rounded-2xl border border-white/45 bg-white/20 px-4 py-3 backdrop-blur-xl shadow-[0_18px_28px_-18px_rgba(0,0,0,0.85)]">
            <p className="text-[12px] font-semibold text-white">{errorMessage || statusMessage}</p>
          </div>
        </div>
      )}

      <div className="app-content-width space-y-4 pb-24 pt-4">
        <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#17375a] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]">
              <User size={25} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white">{t('Profil')}</p>
              <h1 className="mt-1 truncate text-[23px] font-black leading-tight text-white">{userName}</h1>
              {userEmail && (
                <p className="mt-1 truncate text-[11px] font-semibold text-white">{userEmail}</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#071d34]/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white">{t('Topluluk Profili')}</p>
              <h2 className="mt-1 truncate text-[18px] font-black text-white">
                {dashboardProfile?.alias || t('Fortale')}
              </h2>
              <p className="mt-1 text-[11px] font-semibold text-white">
                {isCommunityDashboardLoading
                  ? t('Topluluk istatistikleri yükleniyor...')
                  : `${dashboardProfile?.publicationCount ?? 0} ${t('yayında')}`}
              </p>
            </div>
            {isCommunityDashboardLoading && <FaviconSpinner size={18} />}
          </div>

          <div className="mt-4 space-y-2 text-[12px] font-bold text-white">
            <div className="grid grid-cols-2 gap-x-4">
              <p>{t('Takipçi')}: <span className="text-white">{dashboardProfile?.followerCount ?? 0}</span></p>
              <p>{t('Takip')}: <span className="text-white">{dashboardProfile?.followingCount ?? 0}</span></p>
            </div>
            <div className="grid grid-cols-2 gap-x-4">
              <p>{t('Üretilen')}: <span className="text-white">{savedBookCount}</span></p>
              <p>{t('İndirilen')}: <span className="text-white">{dashboardProfile?.totalDownloadCount ?? 0}</span></p>
            </div>
          </div>

          <CreditBalanceBreakdown wallet={wallet} className="mt-4" compact />

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/[0.06] px-3 py-2">
              <div className="flex items-center gap-1.5 text-[#ff8aa8]">
                <Activity size={13} />
                <span className="text-[10px] font-black uppercase tracking-[0.12em]">{t('Kalp')}</span>
              </div>
              <p className="mt-1 text-[18px] font-black text-white">{dashboardProfile?.totalLikeCount ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.06] px-3 py-2">
              <div className="flex items-center gap-1.5 text-white">
                <Download size={13} />
                <span className="text-[10px] font-black uppercase tracking-[0.12em]">{t('İndirilme')}</span>
              </div>
              <p className="mt-1 text-[18px] font-black text-white">{dashboardProfile?.totalDownloadCount ?? 0}</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
          <div className="mb-4 flex items-center gap-2">
            <Activity size={13} className="text-white" />
            <h2 className="text-[12px] font-black uppercase tracking-[0.14em] text-white">{t('Profil Bilgileri')}</h2>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-[12px] font-bold text-white">
                <UserRoundPen size={14} className="text-white" />
                {t('İsim Soyisim')}
              </span>
              <input
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                maxLength={80}
                disabled={!canManageAccount || isSavingName}
                className="h-11 w-full rounded-2xl border border-white/10 bg-[#0e2238] px-3 text-[13px] font-semibold text-white outline-none placeholder:text-white disabled:opacity-70"
                placeholder={t('Adınız ve soyadınız')}
              />
            </label>
            <button
              type="button"
              onClick={handleSaveProfileName}
              disabled={!canManageAccount || isSavingName}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#2f70b4] px-3 text-[13px] font-black text-white disabled:opacity-70"
            >
              <Save size={14} />
              {isSavingName ? t('Kaydediliyor...') : t('Kaydet')}
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
          <button
            onClick={() => setNotifications(!notifications)}
            className="flex w-full items-center justify-between rounded-2xl bg-white/[0.05] px-3 py-3 active:opacity-70"
          >
            <span className="flex items-center gap-3 text-[13px] font-bold text-white">
              <Bell size={16} className="text-white" />
              {t('Bildirimler')}
            </span>
            <span className={`flex h-6 w-11 items-center rounded-full p-1 transition-colors ${notifications ? 'bg-[#50b889]' : 'bg-white/12'}`}>
              <span className={`h-4 w-4 rounded-full bg-white transition-transform ${notifications ? 'translate-x-5' : 'translate-x-0'}`} />
            </span>
          </button>

          <div className="mt-2 flex w-full items-center justify-between rounded-2xl bg-white/[0.05] px-3 py-3">
            <span className="flex items-center gap-3 text-[13px] font-bold text-white">
              <ShieldCheck size={16} className="text-white" />
              {t('Gizlilik & güvenlik')}
            </span>
            <span className="text-[11px] font-bold text-white">{t('Aktif')}</span>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#25141a]/72 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle size={13} className="text-[#ffb3a8]" />
            <h2 className="text-[12px] font-black uppercase tracking-[0.14em] text-[#ffd2cc]">{t('Hesap Yönetimi')}</h2>
          </div>

          <button
            type="button"
            onClick={() => setPendingDangerAction('delete-data')}
            disabled={!canManageAccount}
            className="flex h-11 w-full items-center justify-between rounded-2xl bg-[#5b252b] px-3 text-[12px] font-bold text-[#ffd2cc] disabled:opacity-60"
          >
            <span>{t('Verilerimi Sil')}</span>
            <Trash2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => setPendingDangerAction('delete-account')}
            disabled={!canManageAccount}
            className="mt-2 flex h-11 w-full items-center justify-between rounded-2xl bg-[#9b3840] px-3 text-[12px] font-black text-white disabled:opacity-60"
          >
            <span>{t('Hesabımı Sil')}</span>
            <AlertTriangle size={14} />
          </button>
          {!canManageAccount && (
            <p className="mt-2 text-[11px] font-semibold text-[#ffd2cc]/75">{t('Misafir oturumunda hesap yönetimi işlemleri kapalıdır.')}</p>
          )}
        </section>

        <section className="px-1 pb-12">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-3 text-white active:opacity-70"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#472229] text-[#ffb3a8]">
              <LogOut size={15} />
            </div>
            <span className="text-[12px] font-black">{t('Oturumu kapat')}</span>
          </button>
        </section>
      </div>
    </div>
  );
}
