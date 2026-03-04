import React from 'react';

interface FaviconSpinnerProps {
  size?: number;
  className?: string;
}

export default function FaviconSpinner({ size = 16, className = '' }: FaviconSpinnerProps) {
  const ringSize = Math.max(10, size);
  // Keep outer ring size stable; enlarge only inner favicon.
  const iconInset = Math.max(1, Math.round(ringSize * 0.04));
  const iconSize = Math.max(8, ringSize - iconInset * 2);
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: ringSize, height: ringSize }}
      aria-hidden="true"
    >
      <span
        className="relative inline-flex items-center justify-center animate-spin"
        style={{ width: ringSize, height: ringSize }}
      >
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: 'rgba(17, 22, 29, 0.88)',
            boxShadow: 'inset 0 0 0 1px rgba(173, 149, 124, 0.12), 0 6px 18px rgba(0,0,0,0.22)'
          }}
        />
        <img
          src="/favicon-red.svg"
          alt=""
          draggable={false}
          className="relative select-none pointer-events-none"
          style={{ width: iconSize, height: iconSize }}
        />
      </span>
    </span>
  );
}
