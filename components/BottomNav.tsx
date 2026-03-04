import React from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { ViewState } from '../types';
import FLogo from './FLogo';

interface BottomNavProps {
  currentView: ViewState;
  onViewChange: (view: ViewState) => void;
}

export default function BottomNav({ currentView, onViewChange }: BottomNavProps) {
  return (
    <div className="fixed bottom-4 left-0 right-0 z-40 pointer-events-none">
      <div className="w-full pointer-events-auto">
        <div className="app-content-width px-4 flex items-center justify-between h-12">
          {/* Sol Grup: Tek Bir "Ada" Pill (Notedyo Yapısı) */}
          {/* Container h-11, floating-island-icon, quick-add-trigger */}
          <nav
            className="flex items-center gap-1 px-1 h-11 floating-island-icon quick-add-trigger rounded-full overflow-visible"
          >
            <button
              onClick={() => onViewChange('HOME')}
              className={`flex items-center justify-center w-11 h-11 rounded-full text-white hover:scale-110 active:scale-90 transition-transform duration-200 ${currentView === 'HOME' ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`}
            >
              <LayoutGrid size={26} strokeWidth={2} />
            </button>

            <button
              onClick={() => onViewChange('COURSE_FLOW')}
              className={`flex items-center justify-center w-11 h-11 rounded-full text-white hover:scale-110 active:scale-90 transition-transform duration-200 ${currentView === 'COURSE_FLOW' ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`}
            >
              <List size={26} strokeWidth={2} />
            </button>


          </nav>

          {/* Sağ Grup: Kişisel Gelişim */}
          <nav className="flex items-center gap-2">
            <button
              onClick={() => onViewChange('AI_CHAT')}
              className={`flex items-center justify-center w-11 h-11 floating-island-icon quick-add-trigger rounded-full text-white hover:scale-110 active:scale-90 transition-transform duration-200 ${currentView === 'AI_CHAT' ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
            >
              <FLogo size={26} />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
