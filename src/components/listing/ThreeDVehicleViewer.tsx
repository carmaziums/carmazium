import * as React from "react"
import * as THREE from "three"
import { Canvas, type ThreeEvent } from "@react-three/fiber"
import { useGLTF, OrbitControls, Environment, Html, useProgress } from "@react-three/drei"
import { Loader2, Camera } from "lucide-react"

// ─── Model → GLB mapping ──────────────────────────────────────────────────────

const MODEL_URL: Record<string, string> = {
  SEDAN:         "/assets/3D/2020_volkswagen_polo__jetta_va3.glb",
  COUPE:         "/assets/3D/2020_volkswagen_polo__jetta_va3.glb",
  CONVERTIBLE:   "/assets/3D/2020_volkswagen_polo__jetta_va3.glb",
  SPORTS_CAR:    "/assets/3D/2020_volkswagen_polo__jetta_va3.glb",
  HATCHBACK:     "/assets/3D/2023_volkswagen_polo_gti.glb",
  ESTATE:        "/assets/3D/2023_volkswagen_polo_gti.glb",
  STATION_WAGON: "/assets/3D/2023_volkswagen_polo_gti.glb",
  SUV:           "/assets/3D/bmw_x7_m60i.glb",
  CROSSOVER:     "/assets/3D/bmw_x7_m60i.glb",
  PICKUP_TRUCK:  "/assets/3D/bmw_x7_m60i.glb",
  MINIVAN:       "/assets/3D/bmw_x7_m60i.glb",
  MPV:           "/assets/3D/bmw_x7_m60i.glb",
  VAN:           "/assets/3D/bmw_x7_m60i.glb",
}

const DEFAULT_MODEL = "/assets/3D/2020_volkswagen_polo__jetta_va3.glb"

// ─── Zone definitions ─────────────────────────────────────────────────────────
// All positions are in the normalised coordinate space where the car is:
//   Length ~5 units along Z (front = +Z, rear = -Z)
//   Width  ~2 units along X (left = -X, right = +X)
//   Height ~1.6 units along Y (bottom = 0, roof ≈ 1.55)

export interface Zone {
  id: string
  label: string
  position: [number, number, number]
}

// OS = Off Side (driver's side, right in UK), NS = Near Side (passenger, left in UK)
// F = Front, R = Rear  →  OSF = Off Side Front, NSR = Near Side Rear, etc.
export const ALL_ZONES: Zone[] = [
  // ─── Exterior: Front ──────────────────────────────────────────────────────
  { id: "front-bumper",     label: "Front Bumper",            position: [0,     0.2,   2.5]  },
  { id: "ns-headlight",     label: "Headlight (NS)",          position: [-0.65, 0.5,   2.6]  },
  { id: "os-headlight",     label: "Headlight (OS)",          position: [0.65,  0.5,   2.6]  },
  { id: "bonnet",           label: "Bonnet / Hood",           position: [0,     0.65,  1.5]  },
  { id: "nsf-wing",         label: "Front Wing / Qtr NS",     position: [-1.05, 0.65,  1.4]  },
  { id: "osf-wing",         label: "Front Wing / Qtr OS",     position: [1.05,  0.65,  1.4]  },
  // ─── Exterior: Windscreens ────────────────────────────────────────────────
  { id: "windshield",       label: "Windscreen (Front)",      position: [0,     1.1,   0.65] },
  { id: "rear-windshield",  label: "Windscreen (Rear)",       position: [0,     1.1,  -0.65] },
  // ─── Exterior: Roof ───────────────────────────────────────────────────────
  { id: "roof",             label: "Roof",                    position: [0,     1.55,  0.0]  },
  // ─── Exterior: Doors ──────────────────────────────────────────────────────
  { id: "front-left-door",  label: "Door NSF (Front NS)",     position: [-1.05, 0.7,   0.35] },
  { id: "front-right-door", label: "Door OSF (Front OS)",     position: [1.05,  0.7,   0.35] },
  { id: "rear-left-door",   label: "Door NSR (Rear NS)",      position: [-1.05, 0.7,  -0.85] },
  { id: "rear-right-door",  label: "Door OSR (Rear OS)",      position: [1.05,  0.7,  -0.85] },
  // ─── Exterior: Sills ──────────────────────────────────────────────────────
  { id: "ns-sill",          label: "Sill (NS)",               position: [-1.05, 0.15, -0.2]  },
  { id: "os-sill",          label: "Sill (OS)",               position: [1.05,  0.15, -0.2]  },
  // ─── Exterior: Rear ───────────────────────────────────────────────────────
  { id: "nsr-quarter",      label: "Rear Qtr Panel (NS)",     position: [-1.05, 0.65, -1.4]  },
  { id: "osr-quarter",      label: "Rear Qtr Panel (OS)",     position: [1.05,  0.65, -1.4]  },
  { id: "boot",             label: "Boot / Trunk Lid",        position: [0,     0.65, -1.8]  },
  { id: "ns-rear-light",    label: "Rear Light (NS)",         position: [-0.65, 0.5,  -2.6]  },
  { id: "os-rear-light",    label: "Rear Light (OS)",         position: [0.65,  0.5,  -2.6]  },
  { id: "rear-bumper",      label: "Rear Bumper",             position: [0,     0.2,  -2.5]  },
  // ─── Exterior: Wheels ─────────────────────────────────────────────────────
  { id: "nsf-wheel",        label: "Wheel NSF",               position: [-1.0,  0.15,  1.3]  },
  { id: "osf-wheel",        label: "Wheel OSF",               position: [1.0,   0.15,  1.3]  },
  { id: "nsr-wheel",        label: "Wheel NSR",               position: [-1.0,  0.15, -1.2]  },
  { id: "osr-wheel",        label: "Wheel OSR",               position: [1.0,   0.15, -1.2]  },
  // ─── Interior ─────────────────────────────────────────────────────────────
  { id: "dashboard",        label: "Dashboard",               position: [0,     0.7,   0.6]  },
  { id: "steering-wheel",   label: "Steering Wheel",          position: [0.55,  0.75,  0.5]  },
  { id: "driver-seat",      label: "Driver's Seat (OS)",      position: [0.6,   0.3,   0.0]  },
  { id: "passenger-seat",   label: "Passenger's Seat (NS)",   position: [-0.6,  0.3,   0.0]  },
  { id: "rear-seat",        label: "Rear Seats",              position: [0,     0.3,  -0.9]  },
  { id: "centre-console",   label: "Centre Console",          position: [0,     0.4,   0.2]  },
  { id: "headlining",       label: "Headlining / Roof Lining",position: [0,     1.4,   0.0]  },
  { id: "boot-interior",    label: "Boot Interior",           position: [0,     0.4,  -2.0]  },
]

// ─── Normalised vehicle model ─────────────────────────────────────────────────
// GLBs may be modelled in millimetres (thousands of units). This component
// measures the bounding box and scales + repositions the model so that:
//   • longest axis = TARGET_SIZE units
//   • bottom of car sits at Y = 0
//   • car is centred on X and Z

const TARGET_SIZE = 5 // units along the longest dimension

export interface SurfacePoint { fx: number; fy: number; fz: number }
export interface SurfaceDamagePin {
  id: string
  number: number
  point: SurfacePoint
  type?: string
  hasPhoto?: boolean
}

type ModelBounds = { min: [number, number, number]; size: [number, number, number] }
const clampUnit = (value: number) => Math.max(0, Math.min(1, value))

function VehicleModel({ url, onSurfaceTap, onBounds }: {
  url: string
  onSurfaceTap?: (point: SurfacePoint) => void
  onBounds?: (bounds: ModelBounds) => void
}) {
  const { scene } = useGLTF(url)
  const groupRef = React.useRef<THREE.Group>(null)

  React.useLayoutEffect(() => {
    const group = groupRef.current
    if (!group) return

    // Reset any previous transforms
    group.scale.set(1, 1, 1)
    group.position.set(0, 0, 0)

    // Measure the raw scene
    const box = new THREE.Box3().setFromObject(group)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    if (maxDim === 0) return

    // Scale uniformly so the longest dimension = TARGET_SIZE
    const scale = TARGET_SIZE / maxDim
    group.scale.setScalar(scale)

    // Re-measure after scale to get correct world positions
    const scaledBox = new THREE.Box3().setFromObject(group)
    const center = scaledBox.getCenter(new THREE.Vector3())

    // Centre on X/Z, sit bottom on Y=0
    group.position.x -= center.x
    group.position.z -= center.z
    group.position.y -= scaledBox.min.y
    group.updateMatrixWorld(true)
    const world = new THREE.Box3().setFromObject(group)
    const min = world.min
    const worldSize = world.getSize(new THREE.Vector3())
    onBounds?.({ min: [min.x, min.y, min.z], size: [worldSize.x, worldSize.y, worldSize.z] })
  }, [scene, onBounds])

  const handleMeshTap = (event: ThreeEvent<MouseEvent>) => {
    if (!onSurfaceTap) return
    // R3F emits click for short taps; never mark during OrbitControls drags.
    if (event.delta > 8) return
    const group = groupRef.current
    if (!group) return
    const bounds = new THREE.Box3().setFromObject(group)
    const size = bounds.getSize(new THREE.Vector3())
    if (size.x <= 0 || size.y <= 0 || size.z <= 0) return
    event.stopPropagation()
    onSurfaceTap({
      fx: clampUnit((event.point.x - bounds.min.x) / size.x),
      fy: clampUnit((event.point.y - bounds.min.y) / size.y),
      fz: clampUnit((event.point.z - bounds.min.z) / size.z),
    })
  }

  return (
    <group ref={groupRef} onClick={onSurfaceTap ? handleMeshTap : undefined}>
      <primitive object={scene} />
    </group>
  )
}

// ─── Loading screen ───────────────────────────────────────────────────────────

function LoadingScreen() {
  const { progress } = useProgress()
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3 text-white">
        <Loader2 size={28} className="animate-spin text-primary" />
        <span className="text-sm font-medium text-[var(--text-secondary)]">
          Loading model… {Math.round(progress)}%
        </span>
        <div className="w-32 h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </Html>
  )
}

// Public viewers render only the seller's actual saved damage locations.
// The old Hotspot component displayed a plus button for EVERY predefined
// body panel whenever onSurfaceTap was absent (the public-view state).
// Editor mode already marks damage by tapping the mesh, so neither view
// should render those obsolete controls.

function CameraGlyph() {
  return <Camera size={11} aria-hidden className="absolute -right-1 -top-1 rounded-full bg-slate-950 p-0.5" />
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface ThreeDVehicleViewerProps {
  bodyType?: string
  /** Deprecated legacy zone selectors, retained for caller compatibility.
   *  No editable zone hotspots are rendered for public viewers. */
  selectedZone?: string | null
  markedZones?: string[]
  onZoneClick?: (zoneId: string) => void
  /** Opt-in seller-only mesh click; does not expose editing to public viewers. */
  onSurfaceTap?: (tap: { zoneId: string; point: SurfacePoint }) => void
  damagePins?: SurfaceDamagePin[]
  onDamagePinPress?: (damageId: string) => void
  selectedDamageId?: string | null
}

/**
 * Fetches only the one GLB this listing actually needs, and only once the
 * viewer has scrolled into view. This used to load unconditionally on mount —
 * worse, the module bottom preloaded all three models (~91MB combined) on
 * every vehicle page regardless of body type, which was the single largest
 * driver of the site's outbound data transfer given this renders on every
 * listing detail page.
 */
export function ThreeDVehicleViewer({
  bodyType,
  onSurfaceTap,
  damagePins = [],
  onDamagePinPress,
  selectedDamageId,
}: ThreeDVehicleViewerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [inView, setInView] = React.useState(false)
  const [modelBounds, setModelBounds] = React.useState<ModelBounds | null>(null)
  const handleBounds = React.useCallback((next: ModelBounds) => {
    setModelBounds(prev => prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next)
  }, [])

  const chooseSurface = React.useCallback((point: SurfacePoint) => {
    if (!onSurfaceTap) return
    // This is a suggested body panel on a generic GLB, not an exact part map.
    const nearest = ALL_ZONES.filter(zone => !['dashboard', 'steering-wheel', 'driver-seat',
      'passenger-seat', 'rear-seat', 'centre-console', 'headlining', 'boot-interior'].includes(zone.id))
      .map(zone => {
        const [x, y, z] = zone.position
        const dx = (point.fx - clampUnit((x + 1.1) / 2.2)) * 2.2
        const dy = (point.fy - clampUnit(y / 1.6)) * 1.6
        const dz = (point.fz - clampUnit((z + 2.6) / 5.2)) * 5.2
        return { zone, dist: dx * dx + dy * dy + dz * dz }
      })
      .sort((a, b) => a.dist - b.dist)[0]?.zone
    if (nearest) onSurfaceTap({ zoneId: nearest.id, point })
  }, [onSurfaceTap])

  React.useEffect(() => {
    if (inView) return
    const el = containerRef.current
    if (!el) return
    // 200px rootMargin starts the fetch a little before the viewer is fully
    // on screen, so it's ready by the time scrolling reaches it.
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) setInView(true) },
      { rootMargin: "200px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [inView])

  const url = (bodyType && MODEL_URL[bodyType]) ?? DEFAULT_MODEL

  return (
    <div
      ref={containerRef}
      className="w-full rounded-2xl overflow-hidden bg-slate-950/80 border border-white/8"
      role="group"
      aria-label={onSurfaceTap
        ? "Interactive 3D vehicle marking area. Tap the surface or use the manual area selector. Use the saved damage list for keyboard navigation."
        : "Read-only 3D vehicle damage view. Only the seller's positioned damage markers are displayed. Recorded damage details are listed below."}
      style={{ height: 400 }}
    >
      {!inView ? (
        // Plain DOM placeholder — LoadingScreen below uses drei's <Html>,
        // which portals through react-three-fiber's context and crashes
        // outside an actual <Canvas>.
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-white">
          <Loader2 size={28} className="animate-spin text-primary" />
          <span className="text-sm font-medium text-[var(--text-secondary)]">3D preview</span>
        </div>
      ) : (
      <Canvas
        camera={{ position: [5, 3, 7], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent", touchAction: "none" }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[6, 8, 5]} intensity={1.4} castShadow />
        <directionalLight position={[-4, 3, -4]} intensity={0.4} />
        <pointLight position={[0, 4, 0]} intensity={0.5} />

        <Environment preset="city" />

        <React.Suspense fallback={<LoadingScreen />}>
          <VehicleModel url={url} onSurfaceTap={onSurfaceTap ? chooseSurface : undefined} onBounds={handleBounds} />

          {/* Never render a plus control for every predefined body zone.
              Read-only pages show only persisted numbered damage pins;
              the seller editor continues to add damage via direct mesh taps. */}
          {modelBounds && damagePins.map(pin => {
            const { min, size } = modelBounds
            const position: [number, number, number] = [
              min[0] + pin.point.fx * size[0],
              min[1] + pin.point.fy * size[1],
              min[2] + pin.point.fz * size[2],
            ]
            return (
              <Html key={pin.id} position={position} distanceFactor={6} zIndexRange={[110, 20]}>
                <button
                  type="button"
                  title={`Damage ${pin.number}: ${pin.type || 'Other'}`}
                  aria-label={`Damage ${pin.number}. ${pin.type || 'Other'}. ${pin.hasPhoto ? 'Photo attached.' : 'No photo attached.'} ${onSurfaceTap ? 'Edit' : 'Inspect'} this recorded damage`}
                  aria-pressed={selectedDamageId === pin.id}
                  onClick={event => { event.stopPropagation(); onDamagePinPress?.(pin.id) }}
                  disabled={!onDamagePinPress}
                  className={`flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-sm font-black text-white shadow-xl transition focus:outline-none focus:ring-4 focus:ring-white ${selectedDamageId === pin.id ? 'ring-4 ring-primary bg-primary' : pin.type === 'DENT' || pin.type === 'CRACK' ? 'bg-red-600' : 'bg-amber-600'}`}
                >
                  {pin.number}{pin.hasPhoto ? <CameraGlyph /> : null}
                </button>
              </Html>
            )
          })}
        </React.Suspense>

        <OrbitControls
          autoRotate={!onSurfaceTap && damagePins.length === 0}
          autoRotateSpeed={0.5}
          enableDamping
          dampingFactor={0.08}
          minPolarAngle={Math.PI / 8}
          maxPolarAngle={Math.PI / 2.2}
          enablePan={false}
          minDistance={4}
          maxDistance={18}
        />
      </Canvas>
      )}
    </div>
  )
}
