"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { Camera, X, Plus, AlertTriangle, CheckCircle2, Trash2 } from "lucide-react"
import Image from "next/image"
import { ALL_ZONES } from "./ThreeDVehicleViewer"
import { uploadImage } from "@/lib/supabase"
import type { ThreeDVehicleViewerProps } from "./ThreeDVehicleViewer"
import { ThreeDErrorBoundary } from "./ThreeDErrorBoundary"

// Dynamic import — Three.js must not run on the server
const ThreeDVehicleViewer = dynamic<ThreeDVehicleViewerProps>(
  () => import("./ThreeDVehicleViewer").then(m => m.ThreeDVehicleViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full rounded-2xl border border-white/8 bg-slate-950/80 flex items-center justify-center" style={{ height: 380 }}>
        <p className="text-gray-500 text-sm">Loading 3D model…</p>
      </div>
    ),
  }
)

// ─── Types ────────────────────────────────────────────────────────────────────

export type BodyType = "SEDAN" | "SUV" | "HATCHBACK"

export interface DamageRecord {
  id: string
  zone: string
  description: string
  photoUrl?: string
  bodyType: string
  view: "TOP" | "FRONT"
  x: number
  y: number
}

interface VehicleDamageMapperProps {
  bodyType?: string
  onComplete: (records: DamageRecord[]) => void
  existingRecords?: DamageRecord[]
}

// ─── Body type selector options ───────────────────────────────────────────────

const BODY_TYPES = ["SEDAN", "HATCHBACK", "SUV"] as const
const BODY_TYPE_LABELS: Record<string, string> = {
  SEDAN: "Sedan",
  HATCHBACK: "Hatchback",
  SUV: "SUV / 4x4",
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VehicleDamageMapper({ bodyType: initialBodyType, onComplete, existingRecords = [] }: VehicleDamageMapperProps) {
  // Internally we only need one of the 3 model categories for body type selection
  function resolveBodyType(bt: string | undefined): string {
    if (!bt) return "SEDAN"
    if (["SUV", "CROSSOVER", "PICKUP_TRUCK", "MINIVAN", "MPV", "VAN"].includes(bt)) return "SUV"
    if (["HATCHBACK", "ESTATE", "STATION_WAGON"].includes(bt)) return "HATCHBACK"
    return "SEDAN"
  }

  const [bodyType, setBodyType] = React.useState<string>(() => resolveBodyType(initialBodyType))
  const [records, setRecords] = React.useState<DamageRecord[]>(existingRecords)

  // Sync existing records when the parent loads them asynchronously (edit mode)
  React.useEffect(() => {
    if (existingRecords.length > 0) {
      setRecords(existingRecords)
    }
  }, [existingRecords])

  // Zone being configured (clicked in viewer or legend)
  const [pendingZoneId, setPendingZoneId] = React.useState<string | null>(null)
  const [pendingDesc, setPendingDesc] = React.useState("")
  const [pendingPhoto, setPendingPhoto] = React.useState<string | undefined>()
  const [uploading, setUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [customZoneInput, setCustomZoneInput] = React.useState('')
  const [pendingCustomLabel, setPendingCustomLabel] = React.useState('')

  const markedZones = records.map(r => r.zone)
  const pendingZone =
    pendingZoneId === '__custom__'
      ? { id: '__custom__', label: pendingCustomLabel, position: [0, 0, 0] as [number, number, number] }
      : ALL_ZONES.find(z => z.id === pendingZoneId) ?? null

  function handleZoneClick(zoneId: string) {
    setPendingZoneId(zoneId)
    setPendingDesc("")
    setPendingPhoto(undefined)
  }

  function handleCustomZone() {
    const label = customZoneInput.trim()
    if (!label) return
    setPendingCustomLabel(label)
    setPendingZoneId('__custom__')
    setPendingDesc("")
    setPendingPhoto(undefined)
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadImage(file, 'listings', 'damage')
      setPendingPhoto(url)
    } catch {
      // Fallback: preview the image locally if upload fails
      const reader = new FileReader()
      reader.onload = ev => setPendingPhoto(ev.target?.result as string)
      reader.readAsDataURL(file)
    } finally {
      setUploading(false)
    }
  }

  function addRecord() {
    if (!pendingZoneId || !pendingDesc.trim()) return

    let zoneId: string
    let x: number
    let y: number

    if (pendingZoneId === '__custom__') {
      if (!pendingCustomLabel) return
      zoneId = pendingCustomLabel
      x = 0
      y = 0
    } else {
      // Defensive: `pendingZoneId` is set from zone IDs we control (legend
      // clicks / 3D hotspot clicks), so it should always match an entry in
      // ALL_ZONES — but a stale ID or future data mismatch must NOT throw
      // (a non-null assertion here would crash the whole page on click,
      // since there's no error boundary around event handlers). Fall back
      // to a safe default position instead.
      const z = ALL_ZONES.find(z => z.id === pendingZoneId)
      if (!z) return
      zoneId = pendingZoneId
      x = z.position[0]
      y = z.position[1]
    }

    const rec: DamageRecord = {
      id: crypto.randomUUID(),
      zone: zoneId,
      description: pendingDesc.trim(),
      photoUrl: pendingPhoto,
      bodyType,
      view: "TOP",
      x,
      y,
    }
    const updated = [...records, rec]
    setRecords(updated)
    onComplete(updated)
    setPendingZoneId(null)
    setPendingDesc("")
    setPendingPhoto(undefined)
    setCustomZoneInput('')
    setPendingCustomLabel('')
  }

  function removeRecord(id: string) {
    const updated = records.filter(r => r.id !== id)
    setRecords(updated)
    onComplete(updated)
  }

  function zoneLabel(zoneId: string) {
    return ALL_ZONES.find(z => z.id === zoneId)?.label ?? zoneId
  }

  const grade = records.length === 0 ? 1 : records.length <= 2 ? 1 : records.length <= 4 ? 2 : records.length <= 6 ? 3 : records.length <= 9 ? 4 : 5
  const GRADE_META: Record<number, { label: string; desc: string; color: string; bg: string }> = {
    1: { label: 'Excellent', desc: 'Negligible or no cosmetic damage', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    2: { label: 'Great', desc: 'Minor cosmetic damage only', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    3: { label: 'Good', desc: 'Noticeable but moderate damage', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
    4: { label: 'Average', desc: 'Multiple moderate damage areas', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
    5: { label: 'Below Average', desc: 'Extensive wear and major damage', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  }
  const gm = GRADE_META[grade]

  return (
    <div className="space-y-5">
      {/* Grade badge */}
      <div className={`flex items-center justify-between p-3 rounded-xl border ${gm.bg}`}>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-black ${gm.color}`}>{grade}</span>
          <div>
            <p className={`text-sm font-bold ${gm.color}`}>{gm.label}</p>
            <p className="text-[11px] text-gray-400">{gm.desc}</p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{records.length} zone{records.length !== 1 ? 's' : ''} marked</span>
      </div>

      {/* Instruction banner */}
      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
        <p className="text-xs font-bold text-blue-300 mb-0.5">How to mark damage</p>
        <p className="text-xs text-gray-400">
          Rotate the 3D model to inspect all angles. Click any <span className="text-white font-bold">+</span> hotspot
          on the vehicle to mark a damage zone, then describe it and optionally add a photo.
          You can also click any zone in the list below the model.
        </p>
      </div>

      {/* Body type override (in case wizard didn't pass one) */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Vehicle Type</p>
        <div className="flex gap-2">
          {BODY_TYPES.map(bt => (
            <button
              key={bt}
              type="button"
              onClick={() => setBodyType(bt)}
              className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${
                bodyType === bt
                  ? "border-primary bg-primary/10 text-white"
                  : "border-white/10 bg-slate-900/50 text-gray-400 hover:border-white/20"
              }`}
            >
              {BODY_TYPE_LABELS[bt]}
            </button>
          ))}
        </div>
      </div>

      {/* 3D Viewer — wrapped in an error boundary because WebGL isn't
          guaranteed on every device (in-app browsers, low-power mode,
          older phones). Without this, a WebGL init failure here would
          crash the entire listing page. */}
      <ThreeDErrorBoundary
        fallback={
          <div
            className="w-full rounded-2xl border border-white/8 bg-slate-950/80 flex flex-col items-center justify-center gap-2 text-center px-6"
            style={{ height: 400 }}
          >
            <AlertTriangle className="text-amber-400" size={22} />
            <p className="text-sm font-bold text-white">3D preview isn&apos;t available on this device</p>
            <p className="text-xs text-gray-500 max-w-xs">No problem — just pick the damaged area from the list below to mark it.</p>
          </div>
        }
      >
        <ThreeDVehicleViewer
          bodyType={bodyType}
          selectedZone={pendingZoneId}
          markedZones={markedZones}
          onZoneClick={handleZoneClick}
        />
      </ThreeDErrorBoundary>

      {/* Zone legend — grouped by area (BCA-standard categories) */}
      {[
        {
          label: "Exterior — Front",
          ids: ["front-bumper", "ns-headlight", "os-headlight", "bonnet", "nsf-wing", "osf-wing"],
        },
        {
          label: "Exterior — Windscreens & Roof",
          ids: ["windshield", "rear-windshield", "roof"],
        },
        {
          label: "Exterior — Doors & Sills",
          ids: ["front-left-door", "front-right-door", "rear-left-door", "rear-right-door", "ns-sill", "os-sill"],
        },
        {
          label: "Exterior — Rear",
          ids: ["nsr-quarter", "osr-quarter", "boot", "ns-rear-light", "os-rear-light", "rear-bumper"],
        },
        {
          label: "Wheels",
          ids: ["nsf-wheel", "osf-wheel", "nsr-wheel", "osr-wheel"],
        },
        {
          label: "Interior",
          ids: ["dashboard", "steering-wheel", "driver-seat", "passenger-seat", "rear-seat", "centre-console", "headlining", "boot-interior"],
        },
      ].map(group => {
        const groupZones = ALL_ZONES.filter(z => group.ids.includes(z.id))
        return (
          <div key={group.label} className="space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600 pt-1">{group.label}</p>
            <div className="grid grid-cols-2 gap-1">
              {groupZones.map(z => {
                const isMarked = records.some(r => r.zone === z.id)
                const isSelected = pendingZoneId === z.id
                return (
                  <div
                    key={z.id}
                    onClick={() => handleZoneClick(z.id)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] border cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-primary/15 border-primary/40 text-white"
                        : isMarked
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          : "bg-slate-800/30 border-white/5 text-gray-500 hover:border-white/15 hover:text-gray-300"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? "bg-primary" : isMarked ? "bg-amber-400" : "bg-gray-600"}`} />
                    {z.label}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Custom area input */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Other Damage Area</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. Interior – Driver Seat, Engine Bay…"
            value={customZoneInput}
            onChange={e => setCustomZoneInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCustomZone()}
            className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-primary focus:outline-none"
            maxLength={80}
          />
          <button
            type="button"
            onClick={handleCustomZone}
            disabled={!customZoneInput.trim()}
            className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-bold text-white hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Mark
          </button>
        </div>
        <p className="text-[10px] text-gray-600">
          Not in the list above? Type any area and press Mark to describe the damage.
        </p>
      </div>

      {/* Pending zone panel */}
      {pendingZone && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-primary" />
              <p className="font-bold text-white text-sm">
                Marking: <span className="text-primary">{pendingZone.label}</span>
              </p>
            </div>
            <button type="button" onClick={() => { setPendingZoneId(null); setCustomZoneInput(''); setPendingCustomLabel('') }} className="text-gray-500 hover:text-white">
              <X size={15} />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Damage Description *</label>
            <textarea
              value={pendingDesc}
              onChange={e => setPendingDesc(e.target.value)}
              placeholder="e.g. Deep scratch approx 10cm, paint chipped to metal…"
              rows={3}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-primary focus:outline-none resize-none"
            />
          </div>

          <div className="space-y-1.5">
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
                {uploading
                  ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  : <Camera size={14} />
                }
                {uploading ? "Uploading…" : "Upload Photo"}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={addRecord}
            disabled={!pendingDesc.trim()}
            className="w-full py-2.5 rounded-xl bg-primary hover:bg-red-600 text-white font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Confirm Damage
          </button>
        </div>
      )}

      {/* Recorded damage list */}
      {records.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-amber-400" />
            <p className="text-sm font-bold text-white">
              {records.length} damage area{records.length !== 1 ? "s" : ""} recorded
            </p>
          </div>
          <div className="space-y-2">
            {records.map(rec => (
              <div key={rec.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/50 border border-white/5">
                {rec.photoUrl && (
                  <Image
                    src={rec.photoUrl}
                    alt=""
                    width={56}
                    height={42}
                    className="rounded-lg object-cover shrink-0 border border-white/10"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-amber-300">{zoneLabel(rec.zone)}</p>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{rec.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeRecord(rec.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
