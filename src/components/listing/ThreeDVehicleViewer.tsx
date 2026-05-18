import * as React from "react"
import { Canvas } from "@react-three/fiber"
import { useGLTF, OrbitControls, Environment, Html, Center, useProgress } from "@react-three/drei"
import { Loader2 } from "lucide-react"

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
// Position: [x (right+), y (up+), z (front toward camera+)]
// Approximate coords for a ~4-unit-long centered car model.
// Adjust ZONE_POSITIONS if hotspots need repositioning after visual check.

export interface Zone {
  id: string
  label: string
  position: [number, number, number]
}

export const ALL_ZONES: Zone[] = [
  { id: "front-bumper",     label: "Front Bumper",      position: [0,     0.25,  2.4]  },
  { id: "bonnet",           label: "Bonnet / Hood",      position: [0,     0.7,   1.5]  },
  { id: "windshield",       label: "Windshield",         position: [0,     1.15,  0.7]  },
  { id: "front-left-door",  label: "Front Left Door",   position: [-1.05, 0.75,  0.35] },
  { id: "front-right-door", label: "Front Right Door",  position: [1.05,  0.75,  0.35] },
  { id: "roof",             label: "Roof",               position: [0,     1.6,   0.0]  },
  { id: "rear-left-door",   label: "Rear Left Door",    position: [-1.05, 0.75, -0.85] },
  { id: "rear-right-door",  label: "Rear Right Door",   position: [1.05,  0.75, -0.85] },
  { id: "boot",             label: "Boot / Trunk",       position: [0,     0.7,  -1.8]  },
  { id: "rear-bumper",      label: "Rear Bumper",        position: [0,     0.25, -2.4]  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function VehicleModel({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  return <primitive object={scene} />
}

function LoadingScreen() {
  const { progress } = useProgress()
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3 text-white">
        <Loader2 size={28} className="animate-spin text-primary" />
        <span className="text-sm font-medium text-gray-300">
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

interface HotspotProps {
  zone: Zone
  isMarked: boolean
  isSelected: boolean
  onClick: (id: string) => void
}

function Hotspot({ zone, isMarked, isSelected, onClick }: HotspotProps) {
  return (
    <Html position={zone.position} distanceFactor={6} zIndexRange={[100, 0]} style={{ pointerEvents: "auto" }}>
      <button
        onClick={() => onClick(zone.id)}
        title={zone.label}
        style={{ transform: "translate(-50%, -50%)" }}
        className={[
          "w-7 h-7 rounded-full flex items-center justify-center",
          "text-xs font-black border-2 backdrop-blur-sm transition-all duration-150 cursor-pointer select-none",
          "shadow-lg hover:scale-110 active:scale-95",
          isSelected
            ? "bg-primary border-primary text-white ring-2 ring-primary/50 scale-110"
            : isMarked
              ? "bg-amber-500 border-amber-400 text-black"
              : "bg-black/60 border-white/40 text-white hover:bg-primary/80 hover:border-primary",
        ].join(" ")}
      >
        {isMarked ? "!" : "+"}
      </button>
    </Html>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface ThreeDVehicleViewerProps {
  bodyType?: string
  selectedZone: string | null
  markedZones: string[]
  onZoneClick: (zoneId: string) => void
}

export function ThreeDVehicleViewer({ bodyType, selectedZone, markedZones, onZoneClick }: ThreeDVehicleViewerProps) {
  const url = (bodyType && MODEL_URL[bodyType]) ?? DEFAULT_MODEL
  const markedSet = new Set(markedZones)

  return (
    <div className="w-full rounded-2xl overflow-hidden bg-slate-950/80 border border-white/8" style={{ height: 380 }}>
      <Canvas
        camera={{ position: [4.5, 2.5, 5.5], fov: 38 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.7} />
        <directionalLight position={[6, 8, 5]} intensity={1.4} castShadow />
        <directionalLight position={[-4, 3, -4]} intensity={0.4} />
        <pointLight position={[0, 5, 0]} intensity={0.5} />

        <Environment preset="city" />

        <React.Suspense fallback={<LoadingScreen />}>
          <Center>
            <VehicleModel url={url} />
          </Center>

          {ALL_ZONES.map(zone => (
            <Hotspot
              key={zone.id}
              zone={zone}
              isMarked={markedSet.has(zone.id)}
              isSelected={selectedZone === zone.id}
              onClick={onZoneClick}
            />
          ))}
        </React.Suspense>

        <OrbitControls
          autoRotate
          autoRotateSpeed={0.5}
          enableDamping
          dampingFactor={0.08}
          minPolarAngle={Math.PI / 8}
          maxPolarAngle={Math.PI / 2.2}
          enablePan={false}
          minDistance={5}
          maxDistance={14}
        />
      </Canvas>
    </div>
  )
}

// Kick off downloads as soon as this module is loaded
useGLTF.preload("/assets/3D/2020_volkswagen_polo__jetta_va3.glb")
useGLTF.preload("/assets/3D/2023_volkswagen_polo_gti.glb")
useGLTF.preload("/assets/3D/bmw_x7_m60i.glb")
