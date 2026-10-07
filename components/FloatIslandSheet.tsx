import React, { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import DialogCloseButton from './DialogCloseButton';
import { useUiI18n } from '../i18n/uiI18n';
import FLogo from './FLogo';
import { composerViewport } from '../utils/composerViewport';
import { NativeFloatIsland, supportsNativeFloatIsland, type NativeKeyboardState } from '../utils/nativeFloatIsland';
import { lockSheetBackground } from '../utils/sheetBackground';

interface FloatIslandSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerActions?: React.ReactNode;
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
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

export default function FloatIslandSheet({
  isOpen,
  onClose,
  children,
  title,
  subtitle,
  headerActions,
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
  panelRef,
  initialFocusRef
}: FloatIslandSheetProps) {
  const { t } = useUiI18n();
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isOpen) return;
    return lockSheetBackground();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closeDisabled) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeDisabled, isOpen, onClose]);

  useLayoutEffect(() => {
    if (!isOpen || !keyboardAware) return;
    let nativeKeyboard: NativeKeyboardState | undefined;
    let keyboardListener: { remove: () => Promise<void> } | undefined;
    let active = true;
    const resize = () => {
      const fullHeight = Math.max(window.innerHeight, document.documentElement.clientHeight);
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

  useLayoutEffect(() => {
    if (!isOpen || !initialFocusRef?.current) return;
    initialFocusRef.current.focus({ preventScroll: true });
  }, [isOpen, initialFocusRef]);

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
        style={{ '--fortale-sheet-max-width': resolvedMaxWidth, maxWidth: 'var(--fortale-sheet-tablet-width, var(--fortale-sheet-max-width))' } as React.CSSProperties}
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
            {headerActions}
            {showCloseButton && (
              <DialogCloseButton
                onClick={onClose}
                disabled={closeDisabled}
                className="fortale-sheet-close"
                aria-label={t('Kapat')}
              />
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
