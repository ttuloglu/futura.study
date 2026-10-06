import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useUiI18n } from '../i18n/uiI18n';
import FLogo from './FLogo';
import { composerViewport } from '../utils/composerViewport';
import { NativeFloatIsland, supportsNativeFloatIsland, type NativeKeyboardState } from '../utils/nativeFloatIsland';

interface FloatIslandSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  layer?: number;
  maxWidth?: number | string;
  closeDisabled?: boolean;
  closeOnBackdrop?: boolean;
  showHeader?: boolean;
  showCloseButton?: boolean;
  showLogo?: boolean;
  keyboardAware?: boolean;
  logoSize?: number;
  panelClassName?: string;
  bodyClassName?: string;
  panelRef?: React.RefObject<HTMLDivElement | null>;
}

export default function FloatIslandSheet({
  isOpen,
  onClose,
  children,
  title,
  subtitle,
  footer,
  layer = 900,
  maxWidth = 520,
  closeDisabled = false,
  closeOnBackdrop = true,
  showHeader = true,
  showCloseButton = true,
  showLogo = true,
  keyboardAware = false,
  logoSize = 28,
  panelClassName = '',
  bodyClassName = 'p-4 sm:p-5',
  panelRef
}: FloatIslandSheetProps) {
  const { t } = useUiI18n();
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closeDisabled) onClose();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeDisabled, isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !keyboardAware) return;
    const fullHeight = Math.max(window.innerHeight, document.documentElement.clientHeight);
    let nativeKeyboard: NativeKeyboardState | undefined;
    let keyboardListener: { remove: () => Promise<void> } | undefined;
    let active = true;
    const resize = () => {
      const viewport = window.visualViewport;
      const geometry = composerViewport(fullHeight, viewport?.height || window.innerHeight, viewport?.offsetTop || 0, nativeKeyboard);
      const root = rootRef.current;
      if (!root) return;
      root.dataset.keyboard = String(geometry.keyboard);
      root.style.setProperty('--fortale-sheet-viewport-height', `${geometry.height}px`);
      root.style.setProperty('--fortale-sheet-viewport-top', `${geometry.top}px`);
    };
    resize();
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', resize);
    window.addEventListener('resize', resize);
    if (supportsNativeFloatIsland()) {
      void NativeFloatIsland.addListener('keyboardGeometry', state => {
        if (active) { nativeKeyboard = state; resize(); }
      }).then(async listener => {
        if (!active) { void listener.remove(); return; }
        keyboardListener = listener;
        const state = await NativeFloatIsland.getKeyboardState();
        if (active) { nativeKeyboard = state; resize(); }
      }).catch(() => { /* VisualViewport remains the fallback. */ });
    }
    return () => {
      active = false;
      void keyboardListener?.remove();
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
      window.removeEventListener('resize', resize);
    };
  }, [isOpen, keyboardAware]);

  if (!isOpen || typeof document === 'undefined') return null;

  const resolvedMaxWidth = typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth;

  return createPortal(
    <div ref={rootRef} className="fortale-floatisland-sheet-root fixed inset-0 flex items-end justify-center bg-black/68 backdrop-blur-sm" style={{ zIndex: layer }}>
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={() => closeOnBackdrop && !closeDisabled && onClose()}
        aria-label={t('Kapat')}
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={`fortale-floatisland-sheet-panel fortale-sheet-surface relative flex w-full min-h-0 flex-col overflow-hidden ${panelClassName}`}
        style={{ maxWidth: resolvedMaxWidth }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="fortale-sheet-handle" aria-hidden />
        {showHeader && (
          <header className="fortale-sheet-header items-center">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {showLogo && (
                <div className="shrink-0 flex items-center justify-center">
                  <FLogo size={logoSize} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {title && <h2 id={titleId} className="truncate text-[17px] font-black text-white">{title}</h2>}
                {subtitle && <div className="mt-0.5 text-[11px] leading-4 text-slate-300">{subtitle}</div>}
              </div>
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                disabled={closeDisabled}
                className="fortale-sheet-close"
                aria-label={t('Kapat')}
              >
                <X size={17} />
              </button>
            )}
          </header>
        )}
        <div className={`fortale-sheet-body min-h-0 flex-1 overflow-y-auto ${bodyClassName}`}>{children}</div>
        {footer && <footer className="fortale-sheet-footer">{footer}</footer>}
      </section>
    </div>,
    document.body
  );
}
