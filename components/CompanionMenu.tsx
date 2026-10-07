import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EyeOff, Armchair, Footprints, Dumbbell, ChartNoAxesColumn, Shuffle, UsersRound } from 'lucide-react';
import { setCompanionCommand, setCompanionHidden } from '../utils/companionActivity';
import { showReadingStats } from '../utils/readingStatsDialog';
import { useUiI18n } from '../i18n/uiI18n';
import { NativeFloatIsland, supportsNativeFloatIsland } from '../utils/nativeFloatIsland';
import { showCompanionAvatarPicker } from '../utils/companionAvatarDialog';

type Anchor = { x: number; top: number; bottom: number; left: number; width: number };

export function applyCompanionMenuAction(action: string) {
  if (action === 'hide') setCompanionHidden(true);
  else if (action === 'sit' || action === 'walk' || action === 'exercise' || action === 'auto') setCompanionCommand(action);
  else if (action === 'statistics') void showReadingStats();
  else if (action === 'avatar') void showCompanionAvatarPicker();
}

function NativeCompanionMenu({ anchor, onClose }: { anchor: Anchor; onClose: () => void }) {
  const { t } = useUiI18n();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    let active = true;
    const requestId = crypto.randomUUID();
    void NativeFloatIsland.showCompanionMenu({ requestId,
      rect: { x: anchor.left, y: anchor.top, width: anchor.width, height: anchor.bottom - anchor.top },
      labels: { menu: t('Avatar menüsü'), avatar: t('Avatarı değiştir'), hide: t('Gizle'), sit: t('Otur'), walk: t('Gezin'), exercise: t('Spor yap'), statistics: t('İstatistik göster'), auto: t('Kendi haline bırak'), cancel: t('Kapat') },
    }).then(({ action }) => {
      if (!active) return;
      close.current();
      applyCompanionMenuAction(action);
    }).catch(() => { if (active) close.current(); });
    return () => { active = false; void NativeFloatIsland.dismissCompanionMenu({ requestId }).catch(() => {}); };
  }, [anchor, t]);
  return null;
}

export function useCompanionMenu() {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const press = useRef<{ x: number; y: number; opened: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const trigger = useRef<HTMLElement | null>(null);
  const isOpen = useRef(false);
  const cancelTimer = () => clearTimeout(timer.current);
  useEffect(() => () => clearTimeout(timer.current), []);
  const open = (element: HTMLElement) => {
    if (isOpen.current) return;
    isOpen.current = true;
    trigger.current = element;
    const rect = element.getBoundingClientRect();
    setAnchor({ x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width });
  };
  const close = () => { isOpen.current = false; setAnchor(null); trigger.current?.focus({ preventScroll: true }); };
  return { anchor, close, open,
    startPress(event: React.PointerEvent<HTMLElement>) {
      if (!event.isPrimary || event.button !== 0) return;
      cancelTimer();
      const element = event.currentTarget;
      press.current = { x: event.clientX, y: event.clientY, opened: false };
      timer.current = setTimeout(() => {
        if (!press.current) return;
        press.current.opened = true;
        open(element);
      }, 480);
    },
    movePress(event: React.PointerEvent<HTMLElement>) {
      if (press.current && Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 6) cancelTimer();
    },
    endPress() {
      cancelTimer();
      const opened = Boolean(press.current?.opened);
      press.current = null;
      return opened;
    },
  };
}

export default function CompanionMenu({ anchor, onClose }: { anchor: Anchor | null; onClose: () => void }) {
  const { t } = useUiI18n();
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  useEffect(() => {
    if (!anchor || !menu.current) return;
    const bounds = menu.current.getBoundingClientRect();
    const viewport = window.visualViewport;
    const topEdge = (viewport?.offsetTop || 0) + 12;
    const bottomEdge = topEdge + (viewport?.height || window.innerHeight) - 24;
    setPosition({ left: Math.max(12, Math.min(window.innerWidth - bounds.width - 12, anchor.x - bounds.width / 2)),
      top: Math.max(topEdge, Math.min(bottomEdge - bounds.height, anchor.top - bounds.height - 8)) });
    menu.current.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }, [anchor]);
  if (!anchor) return null;
  if (supportsNativeFloatIsland()) return <NativeCompanionMenu anchor={anchor} onClose={onClose} />;
  const options = [
    { label: 'Avatarı değiştir', Icon: UsersRound, action: () => { void showCompanionAvatarPicker(); } },
    { label: 'Gizle', Icon: EyeOff, action: () => setCompanionHidden(true) },
    { label: 'Otur', Icon: Armchair, action: () => setCompanionCommand('sit') },
    { label: 'Gezin', Icon: Footprints, action: () => setCompanionCommand('walk') },
    { label: 'Spor yap', Icon: Dumbbell, action: () => setCompanionCommand('exercise') },
    { label: 'İstatistik göster', Icon: ChartNoAxesColumn, action: () => { void showReadingStats(); } },
    { label: 'Kendi haline bırak', Icon: Shuffle, action: () => setCompanionCommand('auto') },
  ];
  return createPortal(<div className="fortale-companion-menu-backdrop" data-companion-exclude onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={menu} className="fortale-companion-menu" role="menu" aria-label={t('Avatar menüsü')}
      style={position} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        if (event.key === 'Tab') onClose();
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button') || []);
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
        }
      }}>
      {options.map(({ label, Icon, action }) => <button key={label} type="button" role="menuitem" onClick={() => { onClose(); action(); }}><Icon size={16} /><span>{t(label)}</span></button>)}
    </div>
  </div>, document.body);
}
