import * as React from "react"

export interface DamagePoint {
  id?: string;
  part: string;
  type: string;
  size: string;
  coords: { x: number; y: number; view: 'FRONT' | 'SIDE' | 'REAR' | 'TOP' };
  imageUrl?: string;
}

interface CarDamageMapProps {
  points: DamagePoint[];
  activePointId?: string;
  onPointClick?: (point: DamagePoint) => void;
  view?: 'FRONT' | 'SIDE' | 'REAR' | 'TOP';
}

export function CarDamageMap({ points, activePointId, onPointClick, view = 'FRONT' }: CarDamageMapProps) {
  // Filter points for current view
  const viewPoints = points.filter(p => p.coords.view === view);

  const renderView = () => {
    switch (view) {
      case 'FRONT':
        return (
          <svg viewBox="0 0 200 120" className="w-full h-full fill-none stroke-gray-600 stroke-1">
            {/* Windshield */}
            <path d="M50 40 Q100 35 150 40 L160 65 Q100 68 40 65 Z" />
            {/* Hood */}
            <path d="M40 65 Q100 60 160 65 L175 90 Q100 95 25 90 Z" />
            {/* Bumper */}
            <path d="M25 90 Q100 95 175 90 L170 105 Q100 110 30 105 Z" />
            {/* Headlights */}
            <ellipse cx="45" cy="80" rx="15" ry="8" />
            <ellipse cx="155" cy="80" rx="15" ry="8" />
            {/* Grille */}
            <rect x="75" y="85" width="50" height="15" rx="2" />
          </svg>
        );
      case 'SIDE':
        return (
          <svg viewBox="0 0 240 100" className="w-full h-full fill-none stroke-gray-600 stroke-1">
            {/* Body */}
            <path d="M20 70 L40 30 L100 25 L160 25 L200 35 L220 70 L220 85 L20 85 Z" />
            {/* Windows */}
            <path d="M45 35 L95 30 L95 65 L45 65 Z" />
            <path d="M105 30 L155 30 L185 40 L185 65 L105 65 Z" />
            {/* Doors */}
            <path d="M40 30 L100 25 L100 85 L40 85 Z" />
            <path d="M100 25 L160 25 L160 85 L100 85 Z" />
            {/* Wheels */}
            <circle cx="60" cy="85" r="15" />
            <circle cx="180" cy="85" r="15" />
          </svg>
        );
      case 'REAR':
        return (
          <svg viewBox="0 0 200 120" className="w-full h-full fill-none stroke-gray-600 stroke-1">
            {/* Rear Window */}
            <path d="M55 40 Q100 35 145 40 L155 65 Q100 68 45 65 Z" />
            {/* Trunk */}
            <path d="M45 65 Q100 62 155 65 L165 90 Q100 95 35 90 Z" />
            {/* Bumper */}
            <path d="M35 90 Q100 95 165 90 L160 105 Q100 110 40 105 Z" />
            {/* Taillights */}
            <rect x="40" y="75" width="20" height="10" rx="2" />
            <rect x="140" y="75" width="20" height="10" rx="2" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative w-full aspect-video bg-[var(--bg-input)] rounded-xl border border-[var(--border-default)] p-4 overflow-hidden group">
      {renderView()}
      
      {/* Damage Hotspots */}
      {viewPoints.map((point, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => onPointClick?.(point)}
          className={`absolute w-3 h-3 rounded-full border-2 border-white shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all transform -translate-x-1/2 -translate-y-1/2 hover:scale-150 z-10
            ${activePointId === point.id ? 'bg-amber-400 scale-125' : 'bg-red-500'}
          `}
          style={{ 
            left: `${point.coords.x}%`, 
            top: `${point.coords.y}%` 
          }}
        >
          <span className="absolute inset-0 rounded-full animate-ping bg-current opacity-40"></span>
        </button>
      ))}

      {/* View Label */}
      <div className="absolute top-2 left-2 px-2 py-1 bg-black/40 rounded text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest border border-[var(--border-default)]">
        {view} View
      </div>
    </div>
  );
}
