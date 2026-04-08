import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, Bell, LogOut, Save, ShieldCheck, Trash2, User, UserRoundPen } from 'lucide-react';
import { useUiI18n } from '../i18n/uiI18n';

interface ProfileViewProps {
  userName: string;
  userEmail?: string;
  isGuestSession?: boolean;
  onLogout: () => void | Promise<void>;
  onUpdateProfileName?: (nextName: string) => void | Promise<void>;
  onDeleteMyData?: () => void | Promise<void>;
  onDeleteAccount?: () => void | Promise<void>;
}

type ProfileDangerAction = 'delete-data' | 'delete-account' | null;

export default function ProfileView({
  userName,
  userEmail,
  isGuestSession = false,
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
    if (
      normalized.includes('resource_exhausted') ||
      normalized.includes('resource exhausted') ||
      normalized.includes('quota') ||
      normalized.includes('rate limit') ||
      normalized.includes('"code":429') ||
      normalized.includes('http 4') ||
      normalized.includes('http 5') ||
      normalized.includes('functions/') ||
      normalized.includes('internal') ||
      normalized.includes('unavailable') ||
      normalized.includes('failed-precondition') ||
      normalized.includes('deadline-exceeded')
    ) {
      return fallback;
    }
    return fallback;
  };

  useEffect(() => {
    setNameInput(userName);
  }, [userName]);

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

  return (
    <div className="view-container">
      {pendingDangerAction && dangerModalMeta && (
        <div className="fixed inset-0 z-[980] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setPendingDangerAction(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-dashed p-4" style={{ background: 'rgba(15,23,34,0.96)', borderColor: 'rgba(228,120,120,0.38)' }}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-[#ffb3a8]" />
              <p className="text-[14px] font-bold text-white">{dangerModalMeta.title}</p>
            </div>
            <p className="mt-2 text-[12px] leading-6 text-[#c5d8ee]">
              {dangerModalMeta.description}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDangerAction(null)}
                className="h-9 rounded-xl border border-dashed px-3 text-[12px] font-semibold text-[#c9ddf4]"
                style={{ borderColor: 'rgba(126,158,194,0.42)', background: 'rgba(20,34,52,0.72)' }}
              >
                {t('Vazgeç')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDangerAction}
                disabled={isDangerActionBusy}
                className="h-9 rounded-xl border border-dashed px-3 text-[12px] font-bold text-white disabled:opacity-70"
                style={{ borderColor: 'rgba(255,164,145,0.62)', background: 'linear-gradient(135deg, #a33f45 0%, #7d2d31 100%)' }}
              >
                {isDangerActionBusy ? t('İşleniyor...') : dangerModalMeta.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {(statusMessage || errorMessage) && (
        <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+80px)] z-[985] -translate-x-1/2 px-4">
          <div className="rounded-2xl border border-white/45 bg-white/20 px-4 py-3 backdrop-blur-xl shadow-[0_18px_28px_-18px_rgba(0,0,0,0.85)]">
            <p className="text-[12px] font-semibold text-white">{errorMessage || statusMessage}</p>
          </div>
        </div>
      )}

      <div className="app-content-width space-y-8 pt-4">
        <section>
          <div className="glass-panel bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full glass-icon border-white/10 mb-3">
                <User size={24} className="text-text-secondary opacity-40" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight leading-[1.2] mb-1.5">{userName}</h1>
              {userEmail && (
                <p className="text-[10px] text-text-secondary opacity-60 mb-2">{userEmail}</p>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="mb-3 px-1 flex items-center gap-2">
            <Activity size={10} className="text-accent-green" />
            <h2 className="text-[10px] font-bold text-text-secondary opacity-60">{t('Profil Bilgileri')}</h2>
          </div>
          <div className="rounded-2xl glass-panel bg-white/[0.03] border border-white/5 overflow-hidden px-4">
            <div className="py-4 border-b border-white/5">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 glass-icon border-white/10 text-text-secondary opacity-60">
                  <UserRoundPen size={14} />
                </div>
                <span className="text-xs font-bold text-white">{t('İsim Soyisim')}</span>
              </div>
              <input
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                maxLength={80}
                disabled={!canManageAccount || isSavingName}
                className="h-10 w-full rounded-xl border border-dashed px-3 text-[13px] text-white placeholder:text-[#8ea8c8] disabled:opacity-70"
                style={{
                  borderColor: 'rgba(118,170,226,0.48)',
                  background: 'linear-gradient(180deg, rgba(21,35,54,0.92) 0%, rgba(17,27,40,0.95) 100%)'
                }}
                placeholder={t('Adınız ve soyadınız')}
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveProfileName}
                  disabled={!canManageAccount || isSavingName}
                  className="h-9 rounded-xl border border-dashed px-3 text-[12px] font-bold inline-flex items-center gap-1.5 text-white disabled:opacity-70"
                  style={{
                    borderColor: 'rgba(255,217,122,0.82)',
                    background: 'linear-gradient(90deg, #1f5c97 0%, #2f70b4 52%, #3a87ca 100%)'
                  }}
                >
                  <Save size={13} />
                  {isSavingName ? t('Kaydediliyor...') : t('Kaydet')}
                </button>
              </div>
            </div>

            <button
              onClick={() => setNotifications(!notifications)}
              className="w-full py-4 flex items-center justify-between border-b border-white/5 active:opacity-60 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 glass-icon border-white/10 text-text-secondary opacity-60">
                  <Bell size={14} />
                </div>
                <span className="text-xs font-bold text-white">{t('Bildirimler')}</span>
              </div>
              <div className={`h-4 w-8 rounded-full p-[2px] transition-all duration-300 ${notifications ? 'bg-accent-green shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-white/5'}`}>
                <div className={`h-3 w-3 rounded-full bg-white transition-all duration-300 ${notifications ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </button>

            <button className="w-full py-4 flex items-center justify-between active:opacity-60 transition-all text-left group">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 glass-icon border-white/10 text-text-secondary opacity-60">
                  <ShieldCheck size={14} />
                </div>
                <span className="text-xs font-bold text-white">{t('Gizlilik & güvenlik')}</span>
              </div>
              <span className="text-[10px] text-text-secondary opacity-50">{t('Aktif')}</span>
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <div className="mb-2 px-1 flex items-center gap-2">
            <Activity size={10} className="text-accent-red" />
            <h2 className="text-[10px] font-bold text-text-secondary opacity-60">{t('Hesap Yönetimi')}</h2>
          </div>
          <div className="rounded-2xl glass-panel bg-white/[0.03] border border-white/5 overflow-hidden px-4 py-3">
            <button
              type="button"
              onClick={() => setPendingDangerAction('delete-data')}
              disabled={!canManageAccount}
              className="w-full h-10 rounded-xl border border-dashed px-3 text-[12px] font-semibold inline-flex items-center justify-between text-[#ffd2cc] disabled:opacity-60"
              style={{ borderColor: 'rgba(232,137,137,0.42)', background: 'rgba(88,32,37,0.32)' }}
            >
              <span>{t('Verilerimi Sil')}</span>
              <Trash2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => setPendingDangerAction('delete-account')}
              disabled={!canManageAccount}
              className="mt-2 w-full h-10 rounded-xl border border-dashed px-3 text-[12px] font-bold inline-flex items-center justify-between text-white disabled:opacity-60"
              style={{ borderColor: 'rgba(255,154,140,0.62)', background: 'linear-gradient(135deg, #9f3c42 0%, #71272c 100%)' }}
            >
              <span>{t('Hesabımı Sil')}</span>
              <AlertTriangle size={14} />
            </button>
            {!canManageAccount && (
              <p className="mt-2 text-[11px] text-text-secondary opacity-70">{t('Misafir oturumunda hesap yönetimi işlemleri kapalıdır.')}</p>
            )}
          </div>
        </section>

        <section className="px-1 pb-12">
          <button
            onClick={onLogout}
            className="flex items-center gap-3 text-text-secondary hover:text-accent-red active:scale-95 transition-all w-full py-1"
          >
            <div className="h-8 w-8 btn-glass-danger border-none shadow-none">
              <LogOut size={14} />
            </div>
            <span className="text-[10px] font-black tracking-widest opacity-40">{t('Oturumu kapat')}</span>
          </button>

          <div className="mt-6 text-center">
            <p className="text-[8px] font-black text-text-secondary opacity-20 tracking-tighter">
              Fortale v3.4.0 (2026 Edition)
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}
