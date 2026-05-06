import React from 'react';
import { Library, Settings, X } from 'lucide-react';
import { ViewState } from '../types';
import FLogo from './FLogo';

interface BottomNavProps {
  currentView: ViewState;
  onViewChange: (view: ViewState) => void;
  onToggleSettings: () => void;
  isSettingsOpen: boolean;
}

export default function BottomNav({ currentView, onViewChange, onToggleSettings, isSettingsOpen }: BottomNavProps) {
  const groupShellStyle: React.CSSProperties = {
    background: 'transparent',
    border: '0',
    borderRadius: 9999,
    padding: '0',
    boxShadow: 'none'
  };

  return (
    <div className="fixed bottom-4 left-0 right-0 z-40 pointer-events-none">
      <div className="w-full pointer-events-auto">
        <div className="app-chrome-width">
          <div className="relative flex w-full items-center justify-between py-2 px-2 gap-2">
            <div
              className="relative z-10 h-full mr-auto pointer-events-auto"
            >
              <div className="rounded-full" style={groupShellStyle}>
                <div className="h-9 rounded-full flex items-center gap-2">
                  <button
                    onClick={() => onViewChange('HOME')}
                    className={`fortale-chrome-icon-button flex items-center justify-center w-9 h-9 rounded-full text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.3)] hover:scale-110 active:scale-90 transition-transform duration-200 ${currentView === 'HOME' ? 'is-active opacity-100' : 'opacity-85 hover:opacity-100'}`}
                  >
                    <FLogo size={22} className="fortale-nav-logo" />
                  </button>
                  <button
                    onClick={onToggleSettings}
                    className={`fortale-chrome-icon-button flex items-center justify-center w-9 h-9 rounded-full text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.3)] hover:scale-110 active:scale-90 transition-transform duration-200 ${isSettingsOpen ? 'is-active opacity-100' : 'opacity-85 hover:opacity-100'}`}
                    aria-label="Ayarlar"
                    title="Ayarlar"
                  >
                    {isSettingsOpen ? <X size={20} strokeWidth={2} /> : <Settings size={20} strokeWidth={2} />}
                  </button>
                </div>
              </div>
            </div>

            <div
              className="relative z-10 h-full ml-auto pointer-events-auto"
            >
              <div className="rounded-full" style={groupShellStyle}>
                <div className="h-9 rounded-full flex items-center">
                  <button
                    onClick={() => onViewChange('AI_CHAT')}
                    className={`fortale-chrome-icon-button flex items-center justify-center w-9 h-9 rounded-full text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.3)] hover:scale-110 active:scale-90 transition-transform duration-200 ${currentView === 'AI_CHAT' ? 'is-active opacity-100' : 'opacity-92 hover:opacity-100'}`}
                  >
                    <Library size={22} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
