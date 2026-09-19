import React from 'react';
import FortaleMark from './FortaleMark';

interface FaviconSpinnerProps {
  size?: number;
  className?: string;
  dark?: boolean;
}

export default function FaviconSpinner({ size = 24, className = '', dark = false }: FaviconSpinnerProps) {
  const markSize = Math.max(18, size);
  return (
    <span
      className={`inline-flex items-center justify-center flex-shrink-0 ${className}`.trim()}
      style={{ width: markSize, height: markSize }}
      aria-hidden="true"
    >
      <FortaleMark
        size={markSize}
        animated={true}
        dark={dark}
        className="select-none pointer-events-none"
      />
    </span>
  );
}
