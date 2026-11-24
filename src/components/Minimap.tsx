import React from 'react';
import { MinimapMarker } from '../game/types';

interface MinimapProps {
  pathPoints: Array<{ x: number; y: number }>;
  markers: MinimapMarker[];
}

export const Minimap: React.FC<MinimapProps> = ({ pathPoints, markers }) => {
  if (pathPoints.length === 0) return null;

  const size = 124;
  const pointsAttr = pathPoints
    .map((p) => `${(p.x * size).toFixed(1)},${(p.y * size).toFixed(1)}`)
    .join(' ');

  return (
    <div
      className="bg-[#0a0c10]/85 border border-white/10 rounded-xl p-2 sm:p-2.5 shadow-lg"
      aria-label="Circuit minimap"
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="block overflow-visible w-[88px] h-[88px] md:w-[116px] md:h-[116px] [@media(max-height:460px)]:w-[84px] [@media(max-height:460px)]:h-[84px]"
      >
        <polygon
          points={pointsAttr}
          fill="none"
          stroke="rgba(148, 163, 184, 0.28)"
          strokeWidth="7"
          strokeLinejoin="round"
        />
        <polygon
          points={pointsAttr}
          fill="none"
          stroke="rgba(226, 232, 240, 0.72)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {markers.map((m) => (
          <circle
            key={m.id}
            cx={m.x * size}
            cy={m.y * size}
            r={m.isPlayer ? 5 : 3.5}
            fill={m.colorHex}
            stroke="#0a0c10"
            strokeWidth={m.isPlayer ? 1.8 : 1.2}
          />
        ))}
      </svg>
    </div>
  );
};
