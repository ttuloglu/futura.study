import React from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { ViewState } from '../types';
import FLogo from './FLogo';

interface BottomNavProps {
  currentView: ViewState;
  onViewChange: (view: ViewState) => void;
}

export default function BottomNav({ currentView, onViewChange }: BottomNavProps) {
  const groupShellStyle: React.CSSProperties = {
    background: 'rgba(17, 22, 29, 0.26)',
    border: '1px dashed rgba(188, 194, 203, 0.14)',
    borderRadius: 9999,
    padding: '2px',
    backdropFilter: 'blur(4px)',
    boxShadow: 'inset 0 0 0 1px rgba(188, 194, 203, 0.08)'
  };

  return (
    <div className="fixed bottom-4 left-0 right-0 z-40 pointer-events-none">
      <div className="w-full pointer-events-auto">
        <div className="app-chrome-width">
          <div className="relative flex w-full items-center justify-between py-2 px-2 gap-2">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-2 inset-x-2 rounded-full border border-dashed backdrop-blur-[4px]"
              style={{
                background: 'rgba(17, 22, 29, 0.3)',
                borderColor: 'rgba(188, 194, 203, 0.1)',
                boxShadow: 'inset 0 0 0 1px rgba(188, 194, 203, 0.06), 0 10px 20px -16px rgba(0,0,0,0.18)'
              }}
            />

            <div
              className="relative z-10 h-full mr-auto pointer-events-auto"
            >
              <div className="rounded-full" style={groupShellStyle}>
                <div className="px-1 h-9 rounded-full flex items-center gap-1.5">
                  <button
                    onClick={() => onViewChange('HOME')}
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.3)] hover:scale-110 active:scale-90 transition-transform duration-200 ${currentView === 'HOME' ? 'opacity-100' : 'opacity-85 hover:opacity-100'}`}
                  >
                    <LayoutGrid size={22} strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => onViewChange('COURSE_FLOW')}
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.3)] hover:scale-110 active:scale-90 transition-transform duration-200 ${currentView === 'COURSE_FLOW' ? 'opacity-100' : 'opacity-85 hover:opacity-100'}`}
                  >
                    <List size={22} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>

            <div
              className="relative z-10 h-full ml-auto pointer-events-auto"
            >
              <div className="rounded-full" style={groupShellStyle}>
                <div className="px-1 h-9 rounded-full flex items-center">
                  <button
                    onClick={() => onViewChange('AI_CHAT')}
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.3)] hover:scale-110 active:scale-90 transition-transform duration-200 ${currentView === 'AI_CHAT' ? 'opacity-100' : 'opacity-92 hover:opacity-100'}`}
                  >
                    <FLogo size={22} />
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
