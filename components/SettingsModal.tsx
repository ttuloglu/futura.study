import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Bell,
  BookOpen,
  ChevronDown,
  Coins,
  Globe2,
  LogIn,
  LogOut,
  Mail,
  Scale,
  ShieldCheck,
  Trash2,
  User as UserIcon
} from 'lucide-react';
import { CreditWallet, ViewState } from '../types';
import { APP_LANGUAGE_OPTIONS, getAppLanguageLabel, type AppLanguageCode } from '../data/appLanguages';
import { useUiI18n } from '../i18n/uiI18n';
import FloatIslandSheet from './FloatIslandSheet';
import type { AppNotificationItem } from '../utils/appNotificationCenter';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userEmail?: string;
  isLoggedIn: boolean;
  credits: CreditWallet;
  appLanguage: AppLanguageCode;
  notifications: AppNotificationItem[];
  unreadNotificationCount: number;
  onOpenPaywall: () => void;
  onNavigate: (view: ViewState) => void;
  onContact: () => void;
  onAppLanguageChange: (language: AppLanguageCode) => void | Promise<void>;
  onAuthAction: () => void | Promise<void>;
  onMarkNotificationsRead: () => void;
  onClearNotifications: () => void;
}

const tileButtonClass =
  'fortale-settings-surface w-full h-10 flex items-center justify-center gap-2 px-3 rounded-xl border text-xs font-semibold text-white transition-all';

const SMARTBOOK_SURFACE_BG = 'rgba(14, 38, 31, 0.78)';
const SMARTBOOK_SURFACE_BORDER = 'rgba(230, 245, 238, 0.16)';

export default function SettingsModal({
  isOpen,
  onClose,
  userName,
  userEmail,
  isLoggedIn,
  credits,
  appLanguage,
  notifications,
  unreadNotificationCount,
  onOpenPaywall,
  onNavigate,
  onContact,
  onAppLanguageChange,
  onAuthAction,
  onMarkNotificationsRead,
  onClearNotifications
}: SettingsModalProps) {
  const { locale, t } = useUiI18n();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const languageMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [languageMenuStyle, setLanguageMenuStyle] = useState<React.CSSProperties>({});
  const notificationDateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }), [locale]);
  const smartbookSurfaceStyle: React.CSSProperties = {
    backgroundColor: SMARTBOOK_SURFACE_BG,
    borderColor: SMARTBOOK_SURFACE_BORDER
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isLanguageMenuOpen) {
        setIsLanguageMenuOpen(false);
        return;
      }
      onClose();
    };

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideMenu = Boolean(languageMenuRef.current?.contains(target));
      const clickedLanguageButton = Boolean(languageMenuButtonRef.current?.contains(target));
      if (!clickedInsideMenu && !clickedLanguageButton) {
        setIsLanguageMenuOpen(false);
      }
      if (!panelRef.current) return;
      if (panelRef.current.contains(target)) return;
      onClose();
    };

    document.addEventListener('keydown', handleEsc);
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isLanguageMenuOpen, isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setIsLanguageMenuOpen(false);
      setIsNotificationsOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isLanguageMenuOpen) return;

    const updateLanguageMenuPosition = () => {
      const trigger = languageMenuButtonRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const preferredWidth = Math.max(rect.width, 260);
      const maxWidth = Math.min(preferredWidth, viewportWidth - 24);
      const left = Math.min(
        Math.max(12, rect.left),
        Math.max(12, viewportWidth - maxWidth - 12)
      );
      const estimatedHeight = Math.min(356, Math.max(220, viewportHeight * 0.42));
      const gap = 10;
      const openUpwards = rect.bottom + gap + estimatedHeight > viewportHeight - 12 && rect.top - gap > estimatedHeight * 0.5;

      setLanguageMenuStyle({
        position: 'fixed',
        left,
        width: maxWidth,
        top: openUpwards ? undefined : Math.min(rect.bottom + gap, viewportHeight - estimatedHeight - 12),
        bottom: openUpwards ? Math.max(viewportHeight - rect.top + gap, 12) : undefined,
        maxHeight: Math.min(356, Math.max(220, viewportHeight - 32)),
        zIndex: 10003
      });
    };

    updateLanguageMenuPosition();
    const panel = panelRef.current;
    window.addEventListener('resize', updateLanguageMenuPosition);
    window.addEventListener('scroll', updateLanguageMenuPosition, true);
    panel?.addEventListener('scroll', updateLanguageMenuPosition);

    return () => {
      window.removeEventListener('resize', updateLanguageMenuPosition);
      window.removeEventListener('scroll', updateLanguageMenuPosition, true);
      panel?.removeEventListener('scroll', updateLanguageMenuPosition);
    };
  }, [isLanguageMenuOpen]);

  if (!isOpen) return null;

  return (
    <>
      <FloatIslandSheet isOpen onClose={onClose} title={userName} subtitle={userEmail || t('Misafir oturumu')} layer={10001} maxWidth={520} panelRef={panelRef} panelClassName="fortale-settings-panel" bodyClassName="p-4">
          <div className="w-full space-y-4">
            <button
              onClick={() => { onOpenPaywall(); onClose(); }}
              className="fortale-settings-surface w-full rounded-2xl border px-3.5 py-3 text-left transition-all hover:bg-[rgba(23,28,36,0.52)] flex items-center justify-between"
              style={smartbookSurfaceStyle}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300">
                  <Coins size={16} />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-white">{t('Kredi Paketleri')}</p>
                  <p className="text-[11px] text-white/60">{t('Kitap üretimi için kredi satın al')}</p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-amber-300 rounded-xl bg-amber-400/10 border border-amber-400/20 px-3 py-1.5 flex items-center gap-1">
                <Coins size={12} />
                <span>{credits?.createCredits ?? 0}C</span>
              </span>
            </button>

            <section className="overflow-hidden rounded-2xl border" style={smartbookSurfaceStyle}>
              <button
                type="button"
                onClick={() => {
                  setIsNotificationsOpen((current) => {
                    const next = !current;
                    if (next && unreadNotificationCount > 0) onMarkNotificationsRead();
                    return next;
                  });
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-white transition-all hover:bg-[rgba(23,28,36,0.52)]"
                aria-expanded={isNotificationsOpen}
                aria-label={t('Bildirimleri aç')}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(230,245,238,0.18)] bg-[rgba(19,48,40,0.82)]">
                    <Bell size={16} className="text-accent-green" />
                    {unreadNotificationCount > 0 ? (
                      <span className="absolute -right-1.5 -top-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white shadow-md">
                        {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-white">{t('Bildirimler')}</p>
                    <p className="truncate text-[10px] text-white/65">
                      {unreadNotificationCount > 0
                        ? `${unreadNotificationCount} ${t('okunmamış')}`
                        : t('Yeni bildirimleri ve kitap güncellemelerini burada gör.')}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-white/75 transition-transform ${isNotificationsOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isNotificationsOpen ? (
                <div className="border-t border-[rgba(230,245,238,0.12)] px-3 pb-3 pt-2.5">
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold text-white/60">{t('Bildirimler')}</p>
                    <button
                      type="button"
                      onClick={onClearNotifications}
                      disabled={notifications.length === 0}
                      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold text-red-200 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={t('Bildirim geçmişini temizle')}
                    >
                      <Trash2 size={12} />
                      {t('Tümünü temizle')}
                    </button>
                  </div>

                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center px-4 py-5 text-center">
                      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06] text-white/55">
                        <Bell size={18} />
                      </div>
                      <p className="text-[11px] font-semibold text-white">{t('Henüz bildirim yok')}</p>
                      <p className="mt-1 max-w-[290px] text-[10px] leading-relaxed text-white/55">
                        {t('Kitabın hazır olduğunda bildirimin burada görünecek.')}
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[min(36vh,280px)] space-y-2 overflow-y-auto pr-0.5">
                      {notifications.map((notification) => (
                        <article
                          key={notification.id}
                          className="rounded-xl border border-white/[0.08] bg-black/15 px-3 py-2.5"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[rgba(25,60,48,0.9)] text-accent-green">
                              <BookOpen size={14} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-[11px] font-semibold leading-snug text-white">{notification.title}</p>
                                {!notification.readAt ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent-green" /> : null}
                              </div>
                              <p className="mt-1 text-[10px] leading-relaxed text-white/65">{notification.body}</p>
                              <time className="mt-1.5 block text-[9px] text-white/40" dateTime={notification.createdAt}>
                                {notificationDateFormatter.format(new Date(notification.createdAt))}
                              </time>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </section>

            <div className="grid w-full grid-cols-2 gap-3">
              <button onClick={() => { onNavigate('TERMS'); onClose(); }} className={`${tileButtonClass} hover:bg-[rgba(23,28,36,0.52)]`} style={smartbookSurfaceStyle}>
                <Scale size={14} className="text-accent-green" />
                {t('Kullanım Şartları')}
              </button>
              <button onClick={() => { onNavigate('PRIVACY'); onClose(); }} className={`${tileButtonClass} hover:bg-[rgba(23,28,36,0.52)]`} style={smartbookSurfaceStyle}>
                <ShieldCheck size={14} className="text-accent-green" />
                {t('Gizlilik Politikası')}
              </button>
              <button onClick={() => { onContact(); onClose(); }} className={`${tileButtonClass} hover:bg-[rgba(23,28,36,0.52)]`} style={smartbookSurfaceStyle}>
                <Mail size={14} className="text-accent-green" />
                {t('Bize Ulaşın')}
              </button>
              <button onClick={() => { onNavigate('PROFILE'); onClose(); }} className={`${tileButtonClass} hover:bg-[rgba(23,28,36,0.52)]`} style={smartbookSurfaceStyle}>
                <UserIcon size={14} className="text-accent-green" />
                {t('Profil')}
              </button>
              <div className="relative col-span-2">
                <button
                  ref={languageMenuButtonRef}
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsLanguageMenuOpen((prev) => !prev);
                  }}
                  className="fortale-settings-surface flex w-full items-center justify-between gap-3 rounded-[18px] border px-3 py-3 text-left text-white transition-all hover:bg-[rgba(23,28,36,0.52)]"
                  style={smartbookSurfaceStyle}
                  aria-haspopup="listbox"
                  aria-expanded={isLanguageMenuOpen}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(230,245,238,0.18)] bg-[rgba(19,48,40,0.82)]">
                      <Globe2 size={15} className="text-accent-green" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-white">{t('Uygulama Dili')}</p>
                      <p className="truncate text-[11px] text-white">{getAppLanguageLabel(appLanguage)}</p>
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-white transition-transform ${isLanguageMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>
            </div>

            {isLoggedIn ? (
              <button
                onClick={onAuthAction}
                className="fortale-settings-surface w-full h-10 flex items-center justify-center gap-2 px-3 rounded-xl border text-xs font-semibold text-red-200 transition-all hover:bg-[rgba(23,28,36,0.52)]"
                style={smartbookSurfaceStyle}
              >
                <LogOut size={14} />
                {t('Oturumu Kapat')}
              </button>
            ) : (
              <button
                onClick={onAuthAction}
                className="fortale-settings-surface w-full h-10 flex items-center justify-center gap-2 px-3 rounded-xl border text-xs font-semibold text-accent-green transition-all hover:bg-[rgba(23,28,36,0.52)]"
                style={smartbookSurfaceStyle}
              >
                <LogIn size={14} />
                {t('Giriş Yap')}
              </button>
            )}
          </div>
      </FloatIslandSheet>

      {isLanguageMenuOpen && typeof document !== 'undefined' ? createPortal((
        <>
          <button
            type="button"
            className="fixed inset-0 z-[10002] bg-transparent"
            aria-label={t('Dil menüsünü kapat')}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setIsLanguageMenuOpen(false);
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setIsLanguageMenuOpen(false);
            }}
          />
          <div
            ref={languageMenuRef}
            role="listbox"
            aria-label={t('Dil seçenekleri')}
            className="fortale-settings-menu overflow-hidden rounded-[22px] border shadow-[0_22px_34px_-24px_rgba(0,0,0,0.9)] backdrop-blur-[20px]"
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
            }}
            style={{
              ...languageMenuStyle,
              backgroundColor: 'rgba(14, 20, 27, 0.98)',
              borderColor: 'rgba(120,171,226,0.24)'
            }}
          >
            <div className="border-b border-[rgba(230,245,238,0.14)] px-3 py-2.5">
              <p className="text-[10px] font-bold tracking-[0.18em] text-white">{t('Diller')}</p>
            </div>
            <div className="overflow-y-auto p-2" style={{ maxHeight: 'min(42vh, 304px)' }}>
              {APP_LANGUAGE_OPTIONS.map((option) => {
                const isActive = option.code === appLanguage;
                return (
                  <button
                    key={option.code}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      window.setTimeout(() => {
                        setIsLanguageMenuOpen(false);
                      }, 0);
                      void onAppLanguageChange(option.code);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition-all ${isActive
                      ? 'bg-[rgba(25,60,97,0.82)] text-white'
                      : 'text-white hover:bg-[rgba(25,35,47,0.92)]'
                      }`}
                  >
                    <span className="text-[12px] font-semibold">{option.label}</span>
                    {isActive ? <Check size={15} className="shrink-0 text-accent-green" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ), document.body) : null}
    </>
  );
}
