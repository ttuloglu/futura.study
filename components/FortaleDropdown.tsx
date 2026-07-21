import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export type FortaleDropdownOption<T extends string> = {
  value: T;
  label: string;
};

type FortaleDropdownProps<T extends string> = {
  label: string;
  value: T;
  options: Array<FortaleDropdownOption<T>>;
  onChange: (value: T) => void;
  className?: string;
  triggerClassName?: string;
  triggerStyle?: React.CSSProperties;
  minMenuWidth?: number;
  menuAlign?: 'left' | 'right';
  wizardStyle?: boolean;
};

export default function FortaleDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  className = '',
  triggerClassName = '',
  triggerStyle,
  minMenuWidth = 0,
  menuAlign = 'left',
  wizardStyle = false
}: FortaleDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 224 });
  const selected = options.find((option) => option.value === value) || options[0];

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button || typeof window === 'undefined') return;
    const rect = button.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 6;
    const desiredHeight = Math.min(224, options.length * 44 + 8);
    const menuWidth = Math.max(rect.width, minMenuWidth);
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openUpward = spaceBelow < Math.min(144, desiredHeight) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(88, Math.min(desiredHeight, openUpward ? spaceAbove - gap : spaceBelow - gap));
    const top = openUpward
      ? Math.max(viewportPadding, rect.top - maxHeight - gap)
      : Math.min(window.innerHeight - viewportPadding - maxHeight, rect.bottom + gap);
    const preferredLeft = menuAlign === 'right' ? rect.right - menuWidth : rect.left;
    const left = Math.max(viewportPadding, Math.min(preferredLeft, window.innerWidth - menuWidth - viewportPadding));
    setMenuPosition({ top, left, width: menuWidth, maxHeight });
  }, [menuAlign, minMenuWidth, options.length]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && (rootRef.current?.contains(target) || menuRef.current?.contains(target))) return;
      setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    updateMenuPosition();
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!isOpen) updateMenuPosition();
          setIsOpen((current) => !current);
        }}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-xl border px-3 text-left text-[11px] ${wizardStyle ? 'font-normal' : 'font-black'} text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] transition-colors ${isOpen ? 'border-white/35 bg-[#183550]' : 'border-white/18 bg-[#10263d] hover:border-white/30 hover:bg-[#17334f]'} ${triggerClassName}`}
        style={triggerStyle}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate !text-white">{selected?.label || label}</span>
        <ChevronDown size={13} className={`shrink-0 text-white transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label={label}
          className="fortale-cosmos-menu fixed z-[1000] overflow-y-auto rounded-xl border p-1.5 shadow-[0_22px_60px_rgba(0,0,0,0.72)]"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            maxHeight: menuPosition.maxHeight
          }}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value || '__empty__'}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[11px] ${wizardStyle ? 'font-normal' : 'font-black'} transition-colors ${isSelected
                  ? `bg-white ${wizardStyle ? 'text-black' : 'text-[#0b1d32]'} shadow-[0_4px_14px_rgba(0,0,0,0.22)]`
                  : 'bg-[#10263d] text-white hover:bg-[#193a58]'
                }`}
              >
                <span className={`truncate ${isSelected ? (wizardStyle ? '!text-black' : '!text-[#0b1d32]') : '!text-white'}`}>{option.label}</span>
                {isSelected ? <Check size={14} strokeWidth={3} className={`shrink-0 ${wizardStyle ? 'text-black' : 'text-[#0b1d32]'}`} /> : <span className="h-[14px] w-[14px] shrink-0" />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
