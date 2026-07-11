// ─── Damage hotspot zones for the mobile 3D viewer + quick-add button list ────
// `box` places the hotspot as a fraction of the loaded GLB's own bounding box
// (fx: 0=one side..1=other side, fy: 0=bottom..1=top, fz: 0=rear..1=front) —
// the viewer resolves this against the model's *actual* box/center/scale at
// runtime and projects it through the live camera, so hotspots stay glued to
// the model as it's rotated instead of sitting at fixed 2D percentages.
// Zones with no `box` (interior zones) have no exterior 3D position and are
// only offered via the button list.
//
// `coords` is the legacy percentage-based 2D position used by DamageMapViewer
// (the read-only viewer buyers see on VehicleDetailScreen) so saved records
// keep rendering correctly there.
//
// `section` groups zones for the quick-add button list, mirroring the web
// app's damage-marker layout (Exterior — Front / Windscreens & Roof / Doors
// & Sills / Rear, Wheels, Interior).
//
// `id` values must match the web app's zone ids (src/components/listing/VehicleDamageMapper.tsx
// / ThreeDVehicleViewer.tsx, repo root) so the `part` field saved to /damage/{id}/save is
// consistent across platforms.
//
// Verification status (2026-07-12): all 33 ids diffed directly, id-by-id, against the
// authoritative ALL_ZONES array in the web repo's src/components/listing/ThreeDVehicleViewer.tsx
// (the D:\carmazium path issue that previously blocked this — see CLAUDE.md/CONTEXT.md — is
// fixed). 14 of 33 were wrong and have been corrected here:
//   headlight-ns/-os      → ns-headlight / os-headlight
//   front-wing-ns/-os     → nsf-wing / osf-wing
//   windscreen-rear       → rear-windshield
//   sill-ns/-os           → ns-sill / os-sill
//   rear-qtr-ns/-os       → nsr-quarter / osr-quarter
//   rear-light-ns/-os     → ns-rear-light / os-rear-light
//   drivers-seat          → driver-seat (singular)
//   passengers-seat       → passenger-seat (singular)
//   rear-seats            → rear-seat (singular)
// The web's own naming isn't internally consistent (NS/OS lands as a prefix for some
// parts — ns-headlight, ns-sill, ns-rear-light — but as part of a 3-letter side+position
// code for others — nsf-wing, nsr-quarter, nsf-wheel), which is why several of the above
// were guessed wrong even though the guessing pattern (a plain "-ns"/"-os" suffix) was
// applied consistently here. The remaining 19 ids (doors, wheels, bonnet, boot, roof,
// bumpers, windshield, dashboard, steering-wheel, centre-console, headlining,
// boot-interior) were already correct. No other file in this repo hardcodes any of the
// 14 corrected id strings (confirmed by repo-wide search), so this fix is contained to
// this file — DamageMapViewer.tsx/ThreeDVehicleViewer.tsx/SellCarFlowScreen.tsx all consume
// zones generically via DAMAGE_ZONES_3D, not by hardcoded id.

export type DamageZoneSection =
  | 'Exterior — Front'
  | 'Exterior — Windscreens & Roof'
  | 'Exterior — Doors & Sills'
  | 'Exterior — Rear'
  | 'Wheels'
  | 'Interior';

export interface DamageZone3D {
  id: string;
  label: string;
  category: 'exterior' | 'interior';
  section: DamageZoneSection;
  /** Bounding-box-relative 3D position for the WebView projection. Omitted for interior zones. */
  box?: { fx: number; fy: number; fz: number };
  coords: { x: number; y: number; view: 'FRONT' | 'SIDE' | 'REAR' | 'TOP' | 'INTERIOR' };
}

export const DAMAGE_ZONES_3D: DamageZone3D[] = [
  // ── Exterior — Front ──
  { id: 'front-bumper', label: 'Front Bumper', category: 'exterior', section: 'Exterior — Front', box: { fx: 0.5, fy: 0.13, fz: 1.0 }, coords: { x: 50, y: 12, view: 'FRONT' } },
  { id: 'ns-headlight', label: 'Headlight (NS)', category: 'exterior', section: 'Exterior — Front', box: { fx: 0.15, fy: 0.32, fz: 0.92 }, coords: { x: 25, y: 20, view: 'FRONT' } },
  { id: 'os-headlight', label: 'Headlight (OS)', category: 'exterior', section: 'Exterior — Front', box: { fx: 0.85, fy: 0.32, fz: 0.92 }, coords: { x: 75, y: 20, view: 'FRONT' } },
  { id: 'bonnet', label: 'Bonnet / Hood', category: 'exterior', section: 'Exterior — Front', box: { fx: 0.5, fy: 0.41, fz: 0.8 }, coords: { x: 50, y: 28, view: 'FRONT' } },
  { id: 'nsf-wing', label: 'Front Wing / Qtr NS', category: 'exterior', section: 'Exterior — Front', box: { fx: 0.12, fy: 0.35, fz: 0.72 }, coords: { x: 15, y: 32, view: 'FRONT' } },
  { id: 'osf-wing', label: 'Front Wing / Qtr OS', category: 'exterior', section: 'Exterior — Front', box: { fx: 0.88, fy: 0.35, fz: 0.72 }, coords: { x: 85, y: 32, view: 'FRONT' } },

  // ── Exterior — Windscreens & Roof ──
  { id: 'windshield', label: 'Windscreen (Front)', category: 'exterior', section: 'Exterior — Windscreens & Roof', box: { fx: 0.5, fy: 0.69, fz: 0.63 }, coords: { x: 50, y: 38, view: 'FRONT' } },
  { id: 'rear-windshield', label: 'Windscreen (Rear)', category: 'exterior', section: 'Exterior — Windscreens & Roof', box: { fx: 0.5, fy: 0.62, fz: 0.08 }, coords: { x: 50, y: 76, view: 'REAR' } },
  { id: 'roof', label: 'Roof', category: 'exterior', section: 'Exterior — Windscreens & Roof', box: { fx: 0.5, fy: 0.97, fz: 0.5 }, coords: { x: 50, y: 50, view: 'TOP' } },

  // ── Exterior — Doors & Sills ──
  { id: 'front-right-door', label: 'Door OSF (Front OS)', category: 'exterior', section: 'Exterior — Doors & Sills', box: { fx: 0.92, fy: 0.44, fz: 0.57 }, coords: { x: 15, y: 50, view: 'SIDE' } },
  { id: 'front-left-door', label: 'Door NSF (Front NS)', category: 'exterior', section: 'Exterior — Doors & Sills', box: { fx: 0.08, fy: 0.44, fz: 0.57 }, coords: { x: 85, y: 50, view: 'SIDE' } },
  { id: 'rear-right-door', label: 'Door OSR (Rear OS)', category: 'exterior', section: 'Exterior — Doors & Sills', box: { fx: 0.92, fy: 0.44, fz: 0.33 }, coords: { x: 18, y: 70, view: 'REAR' } },
  { id: 'rear-left-door', label: 'Door NSR (Rear NS)', category: 'exterior', section: 'Exterior — Doors & Sills', box: { fx: 0.08, fy: 0.44, fz: 0.33 }, coords: { x: 82, y: 70, view: 'REAR' } },
  { id: 'ns-sill', label: 'Sill (NS)', category: 'exterior', section: 'Exterior — Doors & Sills', box: { fx: 0.06, fy: 0.12, fz: 0.4 }, coords: { x: 88, y: 62, view: 'SIDE' } },
  { id: 'os-sill', label: 'Sill (OS)', category: 'exterior', section: 'Exterior — Doors & Sills', box: { fx: 0.94, fy: 0.12, fz: 0.4 }, coords: { x: 12, y: 62, view: 'SIDE' } },

  // ── Exterior — Rear ──
  { id: 'nsr-quarter', label: 'Rear Qtr Panel (NS)', category: 'exterior', section: 'Exterior — Rear', box: { fx: 0.1, fy: 0.45, fz: 0.2 }, coords: { x: 88, y: 74, view: 'REAR' } },
  { id: 'osr-quarter', label: 'Rear Qtr Panel (OS)', category: 'exterior', section: 'Exterior — Rear', box: { fx: 0.9, fy: 0.45, fz: 0.2 }, coords: { x: 12, y: 74, view: 'REAR' } },
  { id: 'boot', label: 'Boot / Trunk Lid', category: 'exterior', section: 'Exterior — Rear', box: { fx: 0.5, fy: 0.41, fz: 0.14 }, coords: { x: 50, y: 80, view: 'REAR' } },
  { id: 'ns-rear-light', label: 'Rear Light (NS)', category: 'exterior', section: 'Exterior — Rear', box: { fx: 0.15, fy: 0.35, fz: 0.05 }, coords: { x: 25, y: 84, view: 'REAR' } },
  { id: 'os-rear-light', label: 'Rear Light (OS)', category: 'exterior', section: 'Exterior — Rear', box: { fx: 0.85, fy: 0.35, fz: 0.05 }, coords: { x: 75, y: 84, view: 'REAR' } },
  { id: 'rear-bumper', label: 'Rear Bumper', category: 'exterior', section: 'Exterior — Rear', box: { fx: 0.5, fy: 0.13, fz: 0.0 }, coords: { x: 50, y: 88, view: 'REAR' } },

  // ── Wheels ──
  { id: 'nsf-wheel', label: 'Wheel NSF', category: 'exterior', section: 'Wheels', box: { fx: 0.08, fy: 0.05, fz: 0.62 }, coords: { x: 88, y: 42, view: 'SIDE' } },
  { id: 'osf-wheel', label: 'Wheel OSF', category: 'exterior', section: 'Wheels', box: { fx: 0.92, fy: 0.05, fz: 0.62 }, coords: { x: 12, y: 42, view: 'SIDE' } },
  { id: 'nsr-wheel', label: 'Wheel NSR', category: 'exterior', section: 'Wheels', box: { fx: 0.08, fy: 0.05, fz: 0.22 }, coords: { x: 88, y: 58, view: 'SIDE' } },
  { id: 'osr-wheel', label: 'Wheel OSR', category: 'exterior', section: 'Wheels', box: { fx: 0.92, fy: 0.05, fz: 0.22 }, coords: { x: 12, y: 58, view: 'SIDE' } },

  // ── Interior (no exterior 3D position — button list only). Own 'INTERIOR'
  // view in the flat 2D viewer with distinct y coords so multiple interior
  // pins don't stack on top of each other (mobile-audit.md W3). ──
  { id: 'dashboard', label: 'Dashboard', category: 'interior', section: 'Interior', coords: { x: 50, y: 10, view: 'INTERIOR' } },
  { id: 'steering-wheel', label: 'Steering Wheel', category: 'interior', section: 'Interior', coords: { x: 50, y: 21, view: 'INTERIOR' } },
  { id: 'driver-seat', label: "Driver's Seat (OS)", category: 'interior', section: 'Interior', coords: { x: 50, y: 32, view: 'INTERIOR' } },
  { id: 'passenger-seat', label: "Passenger's Seat (NS)", category: 'interior', section: 'Interior', coords: { x: 50, y: 43, view: 'INTERIOR' } },
  { id: 'rear-seat', label: 'Rear Seats', category: 'interior', section: 'Interior', coords: { x: 50, y: 54, view: 'INTERIOR' } },
  { id: 'centre-console', label: 'Centre Console', category: 'interior', section: 'Interior', coords: { x: 50, y: 65, view: 'INTERIOR' } },
  { id: 'headlining', label: 'Headlining / Roof Lining', category: 'interior', section: 'Interior', coords: { x: 50, y: 76, view: 'INTERIOR' } },
  { id: 'boot-interior', label: 'Boot Interior', category: 'interior', section: 'Interior', coords: { x: 50, y: 87, view: 'INTERIOR' } },
];

export const DAMAGE_ZONE_SECTIONS: DamageZoneSection[] = [
  'Exterior — Front',
  'Exterior — Windscreens & Roof',
  'Exterior — Doors & Sills',
  'Exterior — Rear',
  'Wheels',
  'Interior',
];

export const CUSTOM_ZONE_ID = '__custom__';

/** Fallback save-coords for a manually-typed zone that has no 3D position. */
export const CUSTOM_ZONE_COORDS = { x: 50, y: 50, view: 'FRONT' as const };
