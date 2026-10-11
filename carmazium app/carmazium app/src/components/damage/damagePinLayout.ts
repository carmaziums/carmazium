/**
 * Spread projected 3D damage pins only when their tap targets would collide.
 * Positions remain tied to their real mesh projection; this is a visual,
 * camera-facing overlay displacement, not a mutation of stored coordinates.
 *
 * Pure deterministic helper: it does not do raycasts, resize Three.js,
 * or make any extra WebView bridge calls while the camera is idle.
 */
export interface ProjectedDamagePin {
  id: string;
  x: number; // projection percentage 0..100
  y: number;
  visible: boolean;
}
export interface PlacedDamagePin {
  id: string;
  left: number; // native dp
  top: number;
  displaced: boolean;
}
const MIN_DISTANCE = 49;
const BORDER_X = 25;
const BORDER_TOP = 48; // avoid model's generic-body-type warning banner
const BORDER_BOTTOM = 30;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Limited spiral: keeps pin ordering stable during orbit and near edges. */
const OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [50, 0], [-50, 0], [0, 50], [0, -50],
  [48, 48], [-48, 48], [48, -48], [-48, -48],
  [100, 0], [-100, 0], [0, 100], [0, -100],
  [74, 42], [-74, 42], [74, -42], [-74, -42],
  [46, 74], [-46, 74], [46, -74], [-46, -74],
];

export function layoutProjectedDamagePins(
  projected: readonly ProjectedDamagePin[],
  width: number,
  height: number,
): PlacedDamagePin[] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= BORDER_X * 2
    || height <= BORDER_TOP + BORDER_BOTTOM) return [];
  const placed: PlacedDamagePin[] = [];
  for (const pin of projected) {
    if (!pin.visible || !Number.isFinite(pin.x) || !Number.isFinite(pin.y)) continue;
    const x = clamp(width * pin.x / 100, BORDER_X, width - BORDER_X);
    const y = clamp(height * pin.y / 100, BORDER_TOP, height - BORDER_BOTTOM);
    let best: { left: number; top: number; score: number; distance: number } | null = null;
    for (const [dx, dy] of OFFSETS) {
      const left = clamp(x + dx, BORDER_X, width - BORDER_X);
      const top = clamp(y + dy, BORDER_TOP, height - BORDER_BOTTOM);
      const distance = Math.hypot(left - x, top - y);
      const separation = placed.length
        ? Math.min(...placed.map(other => Math.hypot(left - other.left, top - other.top)))
        : Infinity;
      const candidate = { left, top, distance, score: separation };
      if (separation >= MIN_DISTANCE) { best = candidate; break; }
      if (!best || separation > best.score) best = candidate;
    }
    if (best) placed.push({
      id: pin.id,
      left: best.left, top: best.top,
      displaced: best.distance > 5,
    });
  }
  return placed;
}
