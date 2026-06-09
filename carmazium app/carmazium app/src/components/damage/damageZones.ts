// ─── 10 preset damage hotspot zones for the mobile 3D viewer ──────────────────
// `position` places the hotspot on the normalised 3D model (car ~5 units long
// on Z, ~2 wide on X, ~1.6 tall on Y — see VehicleModel normalisation).
// `coords` is the legacy percentage-based 2D position used by DamageMapViewer
// (the read-only viewer buyers see on VehicleDetailScreen) so saved records
// keep rendering correctly there.

export interface DamageZone3D {
  id: string;
  label: string;
  position: [number, number, number];
  coords: { x: number; y: number; view: 'FRONT' | 'SIDE' | 'REAR' | 'TOP' };
}

export const DAMAGE_ZONES_3D: DamageZone3D[] = [
  { id: 'front-bumper', label: 'Front Bumper', position: [0, 0.2, 2.5], coords: { x: 50, y: 12, view: 'FRONT' } },
  { id: 'bonnet', label: 'Bonnet / Hood', position: [0, 0.65, 1.5], coords: { x: 50, y: 28, view: 'FRONT' } },
  { id: 'windscreen', label: 'Windscreen', position: [0, 1.1, 0.65], coords: { x: 50, y: 38, view: 'FRONT' } },
  { id: 'roof', label: 'Roof', position: [0, 1.55, 0], coords: { x: 50, y: 50, view: 'TOP' } },
  { id: 'driver-front-door', label: "Driver's Front Door", position: [1.05, 0.7, 0.35], coords: { x: 15, y: 50, view: 'SIDE' } },
  { id: 'passenger-front-door', label: "Passenger's Front Door", position: [-1.05, 0.7, 0.35], coords: { x: 85, y: 50, view: 'SIDE' } },
  { id: 'driver-rear-door', label: "Driver's Rear Door", position: [1.05, 0.7, -0.85], coords: { x: 18, y: 70, view: 'REAR' } },
  { id: 'passenger-rear-door', label: "Passenger's Rear Door", position: [-1.05, 0.7, -0.85], coords: { x: 82, y: 70, view: 'REAR' } },
  { id: 'boot', label: 'Boot / Trunk Lid', position: [0, 0.65, -1.8], coords: { x: 50, y: 80, view: 'REAR' } },
  { id: 'rear-bumper', label: 'Rear Bumper', position: [0, 0.2, -2.5], coords: { x: 50, y: 88, view: 'REAR' } },
];

export const CUSTOM_ZONE_ID = '__custom__';

/** Fallback save-coords for a manually-typed zone that has no 3D position. */
export const CUSTOM_ZONE_COORDS = { x: 50, y: 50, view: 'FRONT' as const };
