import React from 'react';
import { X, LayoutGrid, List, Library, Activity, User, LogOut } from 'lucide-react';
import FLogo from './FLogo';
import BrandWordmark from './BrandWordmark';
import { ViewState } from '../types';
import { useUiI18n } from '../i18n/uiI18n';

interface SidebarProps {
  isOpen: boolean;
  currentView: ViewState;
  userName: string;
  userEmail?: string;
  onLogout: () => void;
  onNavigate: (view: ViewState) => void;
  onClose: () => void;
}

export default function Sidebar({
  isOpen,
  currentView,
  userName,
  userEmail,
  onLogout,
  onNavigate,
  onClose
}: SidebarProps) {
  const { t } = useUiI18n();
  if (!isOpen) return null;

  const handleNavigate = (view: ViewState) => {
    onNavigate(view);
    onClose();
  };

  const mainItems: Array<{ icon: any; label: string; view: ViewState }> = [
    { icon: LayoutGrid, label: t('Merkez'), view: 'HOME' },
    { icon: List, label: t('Öğrenme Akışı'), view: 'COURSE_FLOW' },
    { icon: Activity, label: t('Kitaplarım'), view: 'AI_CHAT' },
    { icon: User, label: t('Profil'), view: 'PROFILE' },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-[#1A1F26]/40 backdrop-blur-md animate-enter"
        onClick={onClose}
      />

      <aside className="fixed inset-x-0 top-0 z-[51] w-full max-h-[90vh] animate-slide-down border-b border-white/10 glass-panel bg-[#2C363F]/95 shadow-2xl rounded-b-[2rem] overflow-hidden">
        <div className="app-content-width flex h-full flex-col">
          <div className="px-6 pb-6 pt-10">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 glass-icon border-white/10 text-accent-green">
                  <FLogo size={20} />
                </div>
                <div>
                  <div className="text-[10px] font-black text-text-secondary opacity-40 tracking-widest">{t('Global Space')}</div>
                  <BrandWordmark size="md" className="block font-bold text-white" />
                </div>
              </div>
              <button onClick={onClose} className="h-9 w-9 glass-icon hover:bg-white/10 transition-all">
                <X size={16} className="text-white" />
              </button>
            </div>

            <div className="rounded-2xl glass-panel bg-white/5 px-4 py-4 border border-white/5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black text-text-secondary opacity-40 tracking-tighter mb-0.5">{t('Hesap')}</p>
                <p className="truncate text-sm font-bold text-white">{userName}</p>
                <p className="truncate text-[10px] text-text-secondary opacity-60 font-medium">{userEmail || t('Oturum açık')}</p>
              </div>
              <button
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="h-9 w-9 btn-glass-danger shadow-none"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2">
            <div className="space-y-1.5">
              {mainItems.map((item) => (
                <SidebarItem
                  key={item.view}
                  icon={item.icon}
                  label={item.label}
                  active={currentView === item.view}
                  onClick={() => handleNavigate(item.view)}
                />
              ))}
            </div>
          </div>

          <div className="px-6 py-6 pb-12 border-t border-white/5 space-y-4">
            <div className="flex items-center justify-center gap-6 text-[10px] font-black text-text-secondary opacity-40 tracking-widest">
              <button onClick={() => handleNavigate('PRIVACY')} className="hover:text-white transition-colors">
                {t('Gizlilik')}
              </button>
              <button onClick={() => handleNavigate('TERMS')} className="hover:text-white transition-colors">
                {t('Kullanım Şartları')}
              </button>
            </div>
            <div className="text-center">
              <p className="text-[8px] font-black text-text-secondary opacity-20 tracking-tighter ">
                Fortale v3.4.0 (2026 Edition)
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  onClick
}: {
  icon: any;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition-all duration-300 overflow-hidden ${active
        ? 'glass-panel bg-white/10 border-white/20 text-white shadow-lg shadow-black/20'
        : 'text-text-secondary/60 hover:text-white hover:bg-white/5'
        }`}
    >
      {active && (
        <div className="absolute left-0 top-3 bottom-3 w-1 bg-accent-green rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
      )}
      <div className={`transition-all duration-300 ${active ? 'text-accent-green scale-110' : 'text-text-secondary opacity-40'}`}>
        <Icon size={18} strokeWidth={2.5} />
      </div>
      <span className={`text-sm tracking-tight ${active ? 'font-bold' : 'font-medium'}`}>
        {label}
      </span>
    </button>
  );
}
