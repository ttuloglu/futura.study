import React from 'react';
import FortaleMark from './FortaleMark';

interface FLogoProps {
  className?: string;
  size?: number;
  animated?: boolean;
  withBackground?: boolean;
  dark?: boolean;
  monochrome?: boolean;
}

export default function FLogo({
  className = '',
  size = 24,
  animated = false,
  withBackground = false,
  dark = false,
  monochrome = false
}: FLogoProps) {
  return (
    <FortaleMark
      className={className}
      size={size}
      animated={animated}
      withBackground={withBackground}
      dark={dark}
      monochrome={monochrome}
    />
  );
}
