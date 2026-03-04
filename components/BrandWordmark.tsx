import React from 'react';

interface BrandWordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASS_MAP: Record<NonNullable<BrandWordmarkProps['size']>, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg'
};

export default function BrandWordmark({ className = '', size = 'md' }: BrandWordmarkProps) {
  return (
    <span className={`font-display leading-none tracking-tight text-zinc-900 ${SIZE_CLASS_MAP[size]} ${className}`}>
      <span className="text-accent-green">ƒ</span>
      <span>-</span>
      <span className="italic">study</span>
    </span>
  );
}
