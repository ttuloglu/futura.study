import React, { forwardRef } from 'react';
import { X } from 'lucide-react';
import { useUiI18n } from '../i18n/uiI18n';

// All app dialogs share the production composer's close control.
const DialogCloseButton = forwardRef<HTMLButtonElement, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>>(
  function DialogCloseButton({ className = '', 'aria-label': label, ...props }, ref) {
    const { t } = useUiI18n();
    return <button {...props} ref={ref} type="button" data-dialog-close
      className={`fortale-dialog-close ${className}`} aria-label={label || t('Kapat')}>
      <X size={19} strokeWidth={2} aria-hidden="true" />
    </button>;
  }
);

export default DialogCloseButton;
