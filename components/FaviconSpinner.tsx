import React from 'react';

interface FaviconSpinnerProps {
  size?: number;
  className?: string;
}

export default function FaviconSpinner({ size = 16, className = '' }: FaviconSpinnerProps) {
  const ringSize = Math.max(10, size);
  return (
    <span
      className={`inline-flex animate-spin items-center justify-center ${className}`}
      style={{ width: ringSize, height: ringSize }}
      aria-hidden="true"
    >
      <img
        src="/favicon-red.svg"
        alt=""
        draggable={false}
        className="select-none pointer-events-none"
        style={{ width: ringSize, height: ringSize }}
      />
    </span>
  );
}
