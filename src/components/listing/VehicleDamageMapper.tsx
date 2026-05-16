"use client"

import * as React from "react"
import { Camera, X, ZoomIn, ZoomOut, Plus, AlertTriangle, CheckCircle2, Trash2, Upload } from "lucide-react"
import Image from "next/image"

export type BodyType = "SEDAN" | "SUV" | "HATCHBACK"
export type ViewType = "FRONT" | "TOP"

export interface DamageRecord {
  id: string
  zone: string
  description: string
  photoUrl?: string
  bodyType: BodyType
  view: ViewType
  x: number
  y: number
}

interface VehicleDamageMapperProps {
  onComplete: (records: DamageRecord[]) => void
  existingRecords?: DamageRecord[]
}

// ─── Zone definitions per body type per view ─────────────────────────────────

interface Zone {
  id: string
  label: string
  // SVG polygon or rect coordinates as percentage of viewBox
  path: string
  cx: number // center x %
  cy: number // center y %
}

const ZONES: Record<BodyType, Record<ViewType, Zone[]>> = {
  SEDAN: {
    FRONT: [
      { id: "front-bumper", label: "Front Bumper", path: "M15,82 L85,82 L88,92 L12,92 Z", cx: 50, cy: 87 },
      { id: "hood", label: "Hood", path: "M22,52 L78,52 L85,82 L15,82 Z", cx: 50, cy: 67 },
      { id: "windscreen", label: "Windscreen", path: "M30,28 L70,28 L76,52 L24,52 Z", cx: 50, cy: 40 },
      { id: "left-headlight", label: "Left Headlight", path: "M12,62 L30,62 L30,80 L12,80 Z", cx: 21, cy: 71 },
      { id: "right-headlight", label: "Right Headlight", path: "M70,62 L88,62 L88,80 L70,80 Z", cx: 79, cy: 71 },
      { id: "roof", label: "Roof", path: "M32,12 L68,12 L70,28 L30,28 Z", cx: 50, cy: 20 },
      { id: "left-wing", label: "Left Wing", path: "M10,52 L22,52 L15,82 L8,82 Z", cx: 14, cy: 67 },
      { id: "right-wing", label: "Right Wing", path: "M78,52 L90,52 L92,82 L85,82 Z", cx: 86, cy: 67 },
    ],
    TOP: [
      { id: "front-bumper", label: "Front Bumper", path: "M20,4 L80,4 L82,14 L18,14 Z", cx: 50, cy: 9 },
      { id: "hood", label: "Hood", path: "M18,14 L82,14 L80,30 L20,30 Z", cx: 50, cy: 22 },
      { id: "windscreen", label: "Windscreen", path: "M22,30 L78,30 L76,38 L24,38 Z", cx: 50, cy: 34 },
      { id: "roof", label: "Roof", path: "M24,38 L76,38 L74,62 L26,62 Z", cx: 50, cy: 50 },
      { id: "rear-screen", label: "Rear Screen", path: "M26,62 L74,62 L72,70 L28,70 Z", cx: 50, cy: 66 },
      { id: "boot", label: "Boot / Trunk", path: "M20,70 L80,70 L82,84 L18,84 Z", cx: 50, cy: 77 },
      { id: "rear-bumper", label: "Rear Bumper", path: "M18,84 L82,84 L80,94 L20,94 Z", cx: 50, cy: 89 },
      { id: "left-side", label: "Left Side", path: "M8,14 L20,14 L20,84 L8,84 Z", cx: 14, cy: 49 },
      { id: "right-side", label: "Right Side", path: "M80,14 L92,14 L92,84 L80,84 Z", cx: 86, cy: 49 },
    ],
  },
  SUV: {
    FRONT: [
      { id: "front-bumper", label: "Front Bumper", path: "M12,78 L88,78 L90,92 L10,92 Z", cx: 50, cy: 85 },
      { id: "hood", label: "Hood", path: "M18,48 L82,48 L88,78 L12,78 Z", cx: 50, cy: 63 },
      { id: "windscreen", label: "Windscreen", path: "M22,22 L78,22 L82,48 L18,48 Z", cx: 50, cy: 35 },
      { id: "left-headlight", label: "Left Headlight", path: "M8,56 L26,56 L26,76 L8,76 Z", cx: 17, cy: 66 },
      { id: "right-headlight", label: "Right Headlight", path: "M74,56 L92,56 L92,76 L74,76 Z", cx: 83, cy: 66 },
      { id: "roof", label: "Roof", path: "M20,8 L80,8 L78,22 L22,22 Z", cx: 50, cy: 15 },
      { id: "left-wing", label: "Left Wing", path: "M6,48 L18,48 L12,78 L6,78 Z", cx: 11, cy: 63 },
      { id: "right-wing", label: "Right Wing", path: "M82,48 L94,48 L94,78 L88,78 Z", cx: 89, cy: 63 },
      { id: "grille", label: "Grille / Skid Plate", path: "M25,80 L75,80 L75,90 L25,90 Z", cx: 50, cy: 85 },
    ],
    TOP: [
      { id: "front-bumper", label: "Front Bumper", path: "M18,3 L82,3 L84,12 L16,12 Z", cx: 50, cy: 7.5 },
      { id: "hood", label: "Hood", path: "M16,12 L84,12 L82,28 L18,28 Z", cx: 50, cy: 20 },
      { id: "windscreen", label: "Windscreen", path: "M20,28 L80,28 L78,36 L22,36 Z", cx: 50, cy: 32 },
      { id: "roof", label: "Roof", path: "M22,36 L78,36 L76,64 L24,64 Z", cx: 50, cy: 50 },
      { id: "rear-screen", label: "Rear Screen", path: "M24,64 L76,64 L74,72 L26,72 Z", cx: 50, cy: 68 },
      { id: "tailgate", label: "Tailgate", path: "M18,72 L82,72 L84,86 L16,86 Z", cx: 50, cy: 79 },
      { id: "rear-bumper", label: "Rear Bumper", path: "M16,86 L84,86 L82,95 L18,95 Z", cx: 50, cy: 90.5 },
      { id: "left-side", label: "Left Side", path: "M6,12 L18,12 L18,86 L6,86 Z", cx: 12, cy: 49 },
      { id: "right-side", label: "Right Side", path: "M82,12 L94,12 L94,86 L82,86 Z", cx: 88, cy: 49 },
    ],
  },
  HATCHBACK: {
    FRONT: [
      { id: "front-bumper", label: "Front Bumper", path: "M15,80 L85,80 L88,92 L12,92 Z", cx: 50, cy: 86 },
      { id: "hood", label: "Hood", path: "M22,50 L78,50 L85,80 L15,80 Z", cx: 50, cy: 65 },
      { id: "windscreen", label: "Windscreen", path: "M26,26 L74,26 L78,50 L22,50 Z", cx: 50, cy: 38 },
      { id: "left-headlight", label: "Left Headlight", path: "M10,60 L28,60 L28,78 L10,78 Z", cx: 19, cy: 69 },
      { id: "right-headlight", label: "Right Headlight", path: "M72,60 L90,60 L90,78 L72,78 Z", cx: 81, cy: 69 },
      { id: "roof", label: "Roof", path: "M28,10 L72,10 L74,26 L26,26 Z", cx: 50, cy: 18 },
      { id: "left-wing", label: "Left Wing", path: "M8,50 L22,50 L15,80 L8,80 Z", cx: 13, cy: 65 },
      { id: "right-wing", label: "Right Wing", path: "M78,50 L92,50 L92,80 L85,80 Z", cx: 87, cy: 65 },
    ],
    TOP: [
      { id: "front-bumper", label: "Front Bumper", path: "M20,4 L80,4 L82,13 L18,13 Z", cx: 50, cy: 8.5 },
      { id: "hood", label: "Hood", path: "M18,13 L82,13 L80,30 L20,30 Z", cx: 50, cy: 21.5 },
      { id: "windscreen", label: "Windscreen", path: "M22,30 L78,30 L76,38 L24,38 Z", cx: 50, cy: 34 },
      { id: "roof", label: "Roof", path: "M24,38 L76,38 L78,70 L22,70 Z", cx: 50, cy: 54 },
      { id: "rear-hatch", label: "Rear Hatch", path: "M22,70 L78,70 L80,82 L20,82 Z", cx: 50, cy: 76 },
      { id: "rear-bumper", label: "Rear Bumper", path: "M20,82 L80,82 L78,93 L22,93 Z", cx: 50, cy: 87.5 },
      { id: "left-side", label: "Left Side", path: "M8,13 L20,13 L22,82 L8,82 Z", cx: 14, cy: 47.5 },
      { id: "right-side", label: "Right Side", path: "M80,13 L92,13 L92,82 L78,82 Z", cx: 86, cy: 47.5 },
    ],
  },
}

// ─── SVG Car Silhouettes ──────────────────────────────────────────────────────

function SedanFront() {
  return (
    <g className="car-silhouette" strokeWidth="1.2" stroke="#475569" fill="none">
      <path d="M32,12 L68,12 L70,28 L30,28 Z" strokeWidth="1" fill="#1e293b" />
      <path d="M30,28 L70,28 L76,52 L24,52 Z" fill="#1e293b" />
      <path d="M22,52 L78,52 L85,82 L15,82 Z" fill="#1e293b" />
      <path d="M15,82 L85,82 L88,92 L12,92 Z" fill="#1e293b" />
      <ellipse cx="21" cy="71" rx="9" ry="6" fill="#0f172a" stroke="#facc15" strokeWidth="1" />
      <ellipse cx="79" cy="71" rx="9" ry="6" fill="#0f172a" stroke="#facc15" strokeWidth="1" />
      <rect x="35" y="85" width="30" height="5" rx="1" fill="#0f172a" stroke="#475569" />
      <line x1="50" y1="82" x2="50" y2="92" stroke="#374151" strokeWidth="0.8" />
    </g>
  )
}

function SedanTop() {
  return (
    <g className="car-silhouette" strokeWidth="1.2" stroke="#475569" fill="none">
      <path d="M20,4 L80,4 L82,14 L18,14 Z" fill="#1e293b" />
      <path d="M18,14 L82,14 L80,30 L20,30 Z" fill="#1e293b" />
      <path d="M22,30 L78,30 L76,38 L24,38 Z" fill="#0f172a" stroke="#334155" />
      <path d="M24,38 L76,38 L74,62 L26,62 Z" fill="#1e293b" />
      <path d="M26,62 L74,62 L72,70 L28,70 Z" fill="#0f172a" stroke="#334155" />
      <path d="M20,70 L80,70 L82,84 L18,84 Z" fill="#1e293b" />
      <path d="M18,84 L82,84 L80,94 L20,94 Z" fill="#1e293b" />
      <path d="M8,14 L20,14 L20,84 L8,84 Z" fill="#1e293b" />
      <path d="M80,14 L92,14 L92,84 L80,84 Z" fill="#1e293b" />
      <circle cx="12" cy="20" r="4" fill="#0f172a" stroke="#475569" />
      <circle cx="88" cy="20" r="4" fill="#0f172a" stroke="#475569" />
      <circle cx="12" cy="78" r="4" fill="#0f172a" stroke="#475569" />
      <circle cx="88" cy="78" r="4" fill="#0f172a" stroke="#475569" />
    </g>
  )
}

function SUVFront() {
  return (
    <g className="car-silhouette" strokeWidth="1.2" stroke="#475569" fill="none">
      <path d="M20,8 L80,8 L78,22 L22,22 Z" fill="#1e293b" />
      <path d="M22,22 L78,22 L82,48 L18,48 Z" fill="#1e293b" />
      <path d="M18,48 L82,48 L88,78 L12,78 Z" fill="#1e293b" />
      <path d="M12,78 L88,78 L90,92 L10,92 Z" fill="#1e293b" />
      <rect x="8" y="56" width="18" height="20" rx="2" fill="#0f172a" stroke="#facc15" strokeWidth="1" />
      <rect x="74" y="56" width="18" height="20" rx="2" fill="#0f172a" stroke="#facc15" strokeWidth="1" />
      <rect x="22" y="80" width="56" height="8" rx="2" fill="#0f172a" stroke="#475569" />
      <line x1="50" y1="78" x2="50" y2="92" stroke="#374151" strokeWidth="0.8" />
      <rect x="16" y="88" width="14" height="4" rx="1" fill="#334155" />
      <rect x="70" y="88" width="14" height="4" rx="1" fill="#334155" />
    </g>
  )
}

function SUVTop() {
  return (
    <g className="car-silhouette" strokeWidth="1.2" stroke="#475569" fill="none">
      <path d="M18,3 L82,3 L84,12 L16,12 Z" fill="#1e293b" />
      <path d="M16,12 L84,12 L82,28 L18,28 Z" fill="#1e293b" />
      <path d="M20,28 L80,28 L78,36 L22,36 Z" fill="#0f172a" stroke="#334155" />
      <path d="M22,36 L78,36 L76,64 L24,64 Z" fill="#1e293b" />
      <path d="M24,64 L76,64 L74,72 L26,72 Z" fill="#0f172a" stroke="#334155" />
      <path d="M18,72 L82,72 L84,86 L16,86 Z" fill="#1e293b" />
      <path d="M16,86 L84,86 L82,95 L18,95 Z" fill="#1e293b" />
      <path d="M6,12 L18,12 L18,86 L6,86 Z" fill="#1e293b" />
      <path d="M82,12 L94,12 L94,86 L82,86 Z" fill="#1e293b" />
      <circle cx="10" cy="18" r="5" fill="#0f172a" stroke="#475569" />
      <circle cx="90" cy="18" r="5" fill="#0f172a" stroke="#475569" />
      <circle cx="10" cy="80" r="5" fill="#0f172a" stroke="#475569" />
      <circle cx="90" cy="80" r="5" fill="#0f172a" stroke="#475569" />
    </g>
  )
}

function HatchbackFront() {
  return (
    <g className="car-silhouette" strokeWidth="1.2" stroke="#475569" fill="none">
      <path d="M28,10 L72,10 L74,26 L26,26 Z" fill="#1e293b" />
      <path d="M26,26 L74,26 L78,50 L22,50 Z" fill="#1e293b" />
      <path d="M22,50 L78,50 L85,80 L15,80 Z" fill="#1e293b" />
      <path d="M15,80 L85,80 L88,92 L12,92 Z" fill="#1e293b" />
      <ellipse cx="19" cy="69" rx="9" ry="6" fill="#0f172a" stroke="#facc15" strokeWidth="1" />
      <ellipse cx="81" cy="69" rx="9" ry="6" fill="#0f172a" stroke="#facc15" strokeWidth="1" />
      <rect x="32" y="83" width="36" height="5" rx="1" fill="#0f172a" stroke="#475569" />
      <line x1="50" y1="80" x2="50" y2="92" stroke="#374151" strokeWidth="0.8" />
    </g>
  )
}

function HatchbackTop() {
  return (
    <g className="car-silhouette" strokeWidth="1.2" stroke="#475569" fill="none">
      <path d="M20,4 L80,4 L82,13 L18,13 Z" fill="#1e293b" />
      <path d="M18,13 L82,13 L80,30 L20,30 Z" fill="#1e293b" />
      <path d="M22,30 L78,30 L76,38 L24,38 Z" fill="#0f172a" stroke="#334155" />
      <path d="M24,38 L76,38 L78,70 L22,70 Z" fill="#1e293b" />
      <path d="M22,70 L78,70 L80,82 L20,82 Z" fill="#1e293b" />
      <path d="M20,82 L80,82 L78,93 L22,93 Z" fill="#1e293b" />
      <path d="M8,13 L20,13 L22,82 L8,82 Z" fill="#1e293b" />
      <path d="M80,13 L92,13 L92,82 L78,82 Z" fill="#1e293b" />
      <circle cx="12" cy="19" r="4" fill="#0f172a" stroke="#475569" />
      <circle cx="88" cy="19" r="4" fill="#0f172a" stroke="#475569" />
      <circle cx="12" cy="76" r="4" fill="#0f172a" stroke="#475569" />
      <circle cx="88" cy="76" r="4" fill="#0f172a" stroke="#475569" />
    </g>
  )
}

const SILHOUETTES: Record<BodyType, Record<ViewType, React.FC>> = {
  SEDAN: { FRONT: SedanFront, TOP: SedanTop },
  SUV: { FRONT: SUVFront, TOP: SUVTop },
  HATCHBACK: { FRONT: HatchbackFront, TOP: HatchbackTop },
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function VehicleDamageMapper({ onComplete, existingRecords = [] }: VehicleDamageMapperProps) {
  const [bodyType, setBodyType] = React.useState<BodyType>("SEDAN")
  const [view, setView] = React.useState<ViewType>("TOP")
  const [zoom, setZoom] = React.useState(1)
  const [records, setRecords] = React.useState<DamageRecord[]>(existingRecords)

  // Active zone being configured
  const [pendingZone, setPendingZone] = React.useState<Zone | null>(null)
  const [pendingDesc, setPendingDesc] = React.useState("")
  const [pendingPhoto, setPendingPhoto] = React.useState<string | undefined>()
  const [uploading, setUploading] = React.useState(false)

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const zones = ZONES[bodyType][view]
  const Silhouette = SILHOUETTES[bodyType][view]

  const markedZoneIds = new Set(
    records
      .filter(r => r.bodyType === bodyType && r.view === view)
      .map(r => r.zone)
  )

  function handleZoneClick(zone: Zone) {
    setPendingZone(zone)
    setPendingDesc("")
    setPendingPhoto(undefined)
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      if (res.ok) {
        const data = await res.json()
        setPendingPhoto(data.url)
      }
    } catch {
      // fallback to local preview
      const reader = new FileReader()
      reader.onload = (ev) => setPendingPhoto(ev.target?.result as string)
      reader.readAsDataURL(file)
    } finally {
      setUploading(false)
    }
  }

  function addDamageRecord() {
    if (!pendingZone || !pendingDesc.trim()) return
    const newRecord: DamageRecord = {
      id: crypto.randomUUID(),
      zone: pendingZone.id,
      description: pendingDesc.trim(),
      photoUrl: pendingPhoto,
      bodyType,
      view,
      x: pendingZone.cx,
      y: pendingZone.cy,
    }
    const updated = [...records, newRecord]
    setRecords(updated)
    setPendingZone(null)
    setPendingDesc("")
    setPendingPhoto(undefined)
    onComplete(updated)
  }

  function removeRecord(id: string) {
    const updated = records.filter(r => r.id !== id)
    setRecords(updated)
    onComplete(updated)
  }

  const zoneLabel = (zoneId: string) =>
    zones.find(z => z.id === zoneId)?.label ?? zoneId

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
        <p className="text-xs text-blue-300 font-semibold mb-1">How to mark damage</p>
        <p className="text-xs text-gray-400">
          Select your vehicle body type and view, then click any highlighted zone on the car diagram to mark a damage area.
          Upload a close-up photo and describe the damage for each area.
        </p>
      </div>

      {/* Body type selector */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Body Type</p>
        <div className="flex gap-3">
          {(["SEDAN", "SUV", "HATCHBACK"] as BodyType[]).map((bt) => (
            <button
              key={bt}
              type="button"
              onClick={() => setBodyType(bt)}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                bodyType === bt
                  ? "border-primary bg-primary/10 text-white"
                  : "border-white/10 bg-slate-900/50 text-gray-400 hover:border-white/20"
              }`}
            >
              {bt.charAt(0) + bt.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* View + zoom controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["FRONT", "TOP"] as ViewType[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest border transition-all ${
                view === v
                  ? "bg-primary border-primary text-white"
                  : "bg-slate-900 border-white/10 text-gray-400 hover:border-white/30"
              }`}
            >
              {v === "TOP" ? "Top View" : "Front View"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom(z => Math.max(0.7, z - 0.15))}
            className="p-2 rounded-lg bg-slate-800 border border-white/10 text-gray-400 hover:text-white hover:bg-slate-700 transition-all"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-xs text-gray-500 w-10 text-center font-mono">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom(z => Math.min(2, z + 0.15))}
            className="p-2 rounded-lg bg-slate-800 border border-white/10 text-gray-400 hover:text-white hover:bg-slate-700 transition-all"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      {/* SVG viewer */}
      <div className="relative rounded-2xl bg-slate-950/80 border border-white/8 overflow-hidden" style={{ minHeight: 320 }}>
        <div className="overflow-auto p-4 flex items-center justify-center" style={{ minHeight: 320 }}>
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "center center", transition: "transform 0.2s" }}>
            <svg
              viewBox="0 0 100 100"
              style={{ width: 280, height: 280 }}
              className="select-none"
            >
              {/* Car silhouette */}
              <Silhouette />

              {/* Clickable zone overlays */}
              {zones.map((zone) => {
                const isMarked = markedZoneIds.has(zone.id)
                const isPending = pendingZone?.id === zone.id
                return (
                  <g key={zone.id}>
                    <polygon
                      points={zone.path.replace(/[MLZ]/g, "").trim()}
                      fill={
                        isPending
                          ? "rgba(237,28,36,0.25)"
                          : isMarked
                          ? "rgba(251,191,36,0.2)"
                          : "rgba(255,255,255,0.03)"
                      }
                      stroke={
                        isPending
                          ? "#ed1c24"
                          : isMarked
                          ? "#facc15"
                          : "rgba(255,255,255,0.15)"
                      }
                      strokeWidth={isPending || isMarked ? "0.6" : "0.4"}
                      strokeDasharray={isMarked ? "" : "1,1"}
                      className="cursor-pointer hover:fill-[rgba(237,28,36,0.15)] transition-all"
                      onClick={() => handleZoneClick(zone)}
                    />
                    {/* Zone label on hover — shown as title */}
                    <title>{zone.label}{isMarked ? " ✓" : " — click to mark"}</title>
                    {/* Damage marker dot */}
                    {isMarked && (
                      <circle
                        cx={zone.cx}
                        cy={zone.cy}
                        r={1.8}
                        fill="#facc15"
                        className="pointer-events-none"
                      />
                    )}
                    {isPending && (
                      <circle
                        cx={zone.cx}
                        cy={zone.cy}
                        r={1.8}
                        fill="#ed1c24"
                        className="pointer-events-none animate-ping"
                      />
                    )}
                  </g>
                )
              })}
            </svg>
          </div>
        </div>

        {/* View label */}
        <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 rounded text-[10px] font-bold text-gray-400 uppercase tracking-widest border border-white/5">
          {bodyType} · {view === "TOP" ? "Top View" : "Front View"}
        </div>

        {/* Click hint */}
        <div className="absolute bottom-3 right-3 text-[10px] text-gray-600 italic">
          Click any zone to mark damage
        </div>
      </div>

      {/* Zone click panel */}
      {pendingZone && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-primary" />
              <p className="font-bold text-white text-sm">Mark damage on: <span className="text-primary">{pendingZone.label}</span></p>
            </div>
            <button type="button" onClick={() => setPendingZone(null)} className="text-gray-500 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Damage Description *</label>
            <textarea
              value={pendingDesc}
              onChange={e => setPendingDesc(e.target.value)}
              placeholder="e.g. Deep scratch on front bumper, approx 15cm long, paint chipped..."
              rows={3}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-primary focus:outline-none resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Close-up Photo (optional)</label>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            {pendingPhoto ? (
              <div className="relative inline-block">
                <Image src={pendingPhoto} alt="damage" width={120} height={90} className="rounded-xl object-cover border border-white/10" />
                <button
                  type="button"
                  onClick={() => setPendingPhoto(undefined)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                >
                  <X size={10} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/20 text-gray-400 hover:border-white/40 hover:text-white transition-all text-sm"
              >
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera size={14} />
                )}
                {uploading ? "Uploading…" : "Upload Photo"}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={addDamageRecord}
            disabled={!pendingDesc.trim()}
            className="w-full py-2.5 rounded-xl bg-primary hover:bg-red-600 text-white font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Confirm Damage Area
          </button>
        </div>
      )}

      {/* Recorded damages list */}
      {records.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <p className="text-sm font-bold text-white">{records.length} damage area{records.length > 1 ? "s" : ""} recorded</p>
          </div>
          <div className="space-y-2">
            {records.map((rec) => (
              <div key={rec.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/50 border border-white/5">
                {rec.photoUrl && (
                  <Image src={rec.photoUrl} alt="" width={56} height={42} className="rounded-lg object-cover shrink-0 border border-white/10" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{rec.bodyType}</span>
                    <span className="text-[10px] text-gray-600">·</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{rec.view}</span>
                  </div>
                  <p className="text-xs font-bold text-white">
                    {ZONES[rec.bodyType]?.[rec.view]?.find(z => z.id === rec.zone)?.label ?? rec.zone}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{rec.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeRecord(rec.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
