import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useUiI18n } from '../i18n/uiI18n';

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
  panelClassName = '',
  bodyClassName = 'p-4 sm:p-5',
  panelRef
}: FloatIslandSheetProps) {
  const { t } = useUiI18n();
  const titleId = useId();

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

  if (!isOpen || typeof document === 'undefined') return null;

  const resolvedMaxWidth = typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth;

  return createPortal(
    <div className="fortale-floatisland-sheet-root fixed inset-0 flex items-end justify-center bg-black/68 backdrop-blur-sm" style={{ zIndex: layer }}>
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
          <header className="fortale-sheet-header">
            <div className="min-w-0 flex-1">
              {title && <h2 id={titleId} className="truncate text-[17px] font-black text-white">{title}</h2>}
              {subtitle && <div className="mt-1 text-[11px] leading-4 text-white">{subtitle}</div>}
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
        <div className="fortale-sheet-island-clearance" aria-hidden="true" />
      </section>
    </div>,
    document.body
  );
}
