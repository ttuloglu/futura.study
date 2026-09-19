import React from 'react';

type FortaleMarkProps = {
  size?: number;
  className?: string;
  animated?: boolean;
  monochrome?: boolean;
  dark?: boolean;
  withBackground?: boolean;
  style?: React.CSSProperties;
};

export const FortaleMark: React.FC<FortaleMarkProps> = ({
  size = 24,
  className = '',
  animated = false,
  monochrome = false,
  dark = false,
  withBackground = false,
  style
}) => {
  const isDarkBars = monochrome || dark;

  const pieces = [
    { id: '1', col: 0, x: 232, y: 352, width: 64, height: 320, rx: 32, isAmber: false },
    { id: '2', col: 1, x: 362, y: 242, width: 64, height: 540, rx: 32, isAmber: false },
    { id: '3', col: 2, x: 492, y: 172, width: 64, height: 680, rx: 32, isAmber: true }, // Merkez Amber Omurga
    { id: '4', col: 3, x: 622, y: 242, width: 64, height: 540, rx: 32, isAmber: false },
    { id: '5', col: 4, x: 752, y: 352, width: 64, height: 320, rx: 32, isAmber: false },
  ];

  const getPieceColor = (p: typeof pieces[0]) => {
    if (p.isAmber) return '#F59E0B';
    if (isDarkBars) return '#000000';
    return '#FFFFFF';
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`fortale-mark ${animated ? 'fortale-mark--animated' : ''} ${isDarkBars ? 'fortale-mark--dark' : ''} ${className}`.trim()}
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      {withBackground && (
        <rect width="1024" height="1024" rx="224" fill="#000000" />
      )}
      {pieces.map((piece) => {
        const color = getPieceColor(piece);
        return (
          <rect
            key={piece.id}
            x={piece.x}
            y={piece.y}
            width={piece.width}
            height={piece.height}
            rx={piece.rx}
            fill={color}
            className={`fortale-mark__piece fortale-mark__piece--${piece.id} ${animated ? 'fortale-mark__piece--animated' : ''}`}
            style={{
              transformOrigin: `${piece.x + piece.width / 2}px ${piece.y + piece.height / 2}px`,
              filter: piece.isAmber ? 'drop-shadow(0 0 10px rgba(245, 158, 11, 0.75))' : undefined,
            }}
          />
        );
      })}
    </svg>
  );
};

export default FortaleMark;
