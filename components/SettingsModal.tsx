import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  ChevronDown,
  Coins,
  Globe2,
  LogIn,
  LogOut,
  Mail,
  Scale,
  ShieldCheck,
  User as UserIcon
} from 'lucide-react';
import { CreditWallet, ViewState } from '../types';
import { APP_LANGUAGE_OPTIONS, getAppLanguageLabel, type AppLanguageCode } from '../data/appLanguages';
import { useUiI18n } from '../i18n/uiI18n';
import FloatIslandSheet from './FloatIslandSheet';
import CreditBalanceBreakdown from './CreditBalanceBreakdown';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userEmail?: string;
  isLoggedIn: boolean;
  credits: CreditWallet;
  appLanguage: AppLanguageCode;
  onOpenPaywall: () => void;
  onNavigate: (view: ViewState) => void;
  onContact: () => void;
  onAppLanguageChange: (language: AppLanguageCode) => void | Promise<void>;
  onAuthAction: () => void | Promise<void>;
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
  onOpenPaywall,
  onNavigate,
  onContact,
  onAppLanguageChange,
  onAuthAction
}: SettingsModalProps) {
  const { locale, t } = useUiI18n();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const languageMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [languageMenuStyle, setLanguageMenuStyle] = useState<React.CSSProperties>({});
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
              className="fortale-settings-surface w-full rounded-2xl border px-3 py-2.5 text-left transition-all hover:bg-[rgba(23,28,36,0.52)]"
              style={smartbookSurfaceStyle}
            >
              <div className="flex items-center gap-2">
                <Coins size={14} className="text-accent-green" />
                <p className="text-[12px] font-semibold text-white">{t('Kredi Bakiyesi')}</p>
              </div>
              <CreditBalanceBreakdown wallet={credits} className="mt-3" compact />
            </button>

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
