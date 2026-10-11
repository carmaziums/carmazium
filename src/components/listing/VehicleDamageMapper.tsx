"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { Camera, X, Plus, AlertTriangle, CheckCircle2, Trash2, Pencil, ChevronDown, ChevronUp, Images } from "lucide-react"
import Image from "next/image"
import { ALL_ZONES } from "./ThreeDVehicleViewer"
import { uploadImage } from "@/lib/supabase"
import type { ThreeDVehicleViewerProps, SurfacePoint } from "./ThreeDVehicleViewer"
import { ThreeDErrorBoundary } from "./ThreeDErrorBoundary"
import { computeExteriorGradeFromDefectCount } from "@/lib/exteriorGrade"

// Dynamic import — Three.js must not run on the server
const ThreeDVehicleViewer = dynamic<ThreeDVehicleViewerProps>(
  () => import("./ThreeDVehicleViewer").then(m => m.ThreeDVehicleViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full rounded-2xl border border-white/8 bg-slate-950/80 flex items-center justify-center" style={{ height: 380 }}>
        <p className="text-[var(--text-muted)] text-sm">Loading 3D model…</p>
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
  type?: "SCRATCH" | "SCUFF" | "DENT" | "CRACK" | "OTHER"
  surfacePoint?: SurfacePoint
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
  const [pendingSurfacePoint, setPendingSurfacePoint] = React.useState<SurfacePoint | null>(null)
  const [editingDamageId, setEditingDamageId] = React.useState<string | null>(null)
  const [pendingType, setPendingType] = React.useState<NonNullable<DamageRecord["type"]>>("SCRATCH")
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const [manualOpen, setManualOpen] = React.useState(false)
  const uploadInFlightRef = React.useRef(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const cameraInputRef = React.useRef<HTMLInputElement>(null)

  const [customZoneInput, setCustomZoneInput] = React.useState('')
  const [pendingCustomLabel, setPendingCustomLabel] = React.useState('')

  const markedZones = records.map(r => r.zone)
  const pendingZone =
    pendingZoneId === '__custom__'
      ? { id: '__custom__', label: pendingCustomLabel, position: [0, 0, 0] as [number, number, number] }
      : ALL_ZONES.find(z => z.id === pendingZoneId) ?? null

  function handleZoneClick(zoneId: string) {
    if (uploadInFlightRef.current) return
    setEditingDamageId(null)
    setPendingZoneId(zoneId)
    setPendingDesc("")
    setPendingPhoto(undefined)
    setPendingSurfacePoint(null)
    setPendingType("SCRATCH")
    setUploadError(null)
  }

  function handleSurfaceTap({ zoneId, point }: { zoneId: string; point: SurfacePoint }) {
    if (uploadInFlightRef.current) return
    handleZoneClick(zoneId)
    setPendingSurfacePoint(point)
    setManualOpen(false)
  }

  function editRecord(id: string) {
    if (uploadInFlightRef.current) return
    const record = records.find(item => item.id === id)
    if (!record) return
    setEditingDamageId(id)
    setPendingZoneId(ALL_ZONES.some(zone => zone.id === record.zone) ? record.zone : "__custom__")
    if (!ALL_ZONES.some(zone => zone.id === record.zone)) setPendingCustomLabel(record.zone)
    setPendingDesc(record.description)
    setPendingPhoto(record.photoUrl)
    setPendingSurfacePoint(record.surfacePoint ?? null)
    setPendingType(record.type ?? "OTHER")
    setUploadError(null)
    setManualOpen(false)
  }

  function chooseCorrectedZone(zoneId: string) {
    if (uploadInFlightRef.current) return
    // A known panel correction retains the precise original surface point.
    setPendingZoneId(zoneId)
    setManualOpen(false)
  }

  function resetEditor() {
    setPendingZoneId(null)
    setPendingDesc("")
    setPendingPhoto(undefined)
    setPendingSurfacePoint(null)
    setPendingType("SCRATCH")
    setEditingDamageId(null)
    setPendingCustomLabel("")
    setUploadError(null)
  }

  function handleCustomZone() {
    const label = customZoneInput.trim()
    if (!label) return
    setPendingCustomLabel(label)
    setPendingZoneId('__custom__')
    setPendingDesc("")
    setPendingPhoto(undefined)
    setPendingSurfacePoint(null)
    setEditingDamageId(null)
    setPendingType("SCRATCH")
    setManualOpen(false)
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || uploadInFlightRef.current) return
    uploadInFlightRef.current = true
    setUploading(true)
    setUploadError(null)
    try {
      if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) {
        throw new Error("Choose an image smaller than 15 MB.")
      }
      const url = await uploadImage(file, "listings", "damage")
      if (!url.startsWith("https://")) throw new Error("Photo storage did not return a permanent URL.")
      setPendingPhoto(url)
    } catch (error) {
      // Never silently commit a base64/data URL as permanent seller evidence.
      // Seller may select the same image again to retry.
      setUploadError(error instanceof Error ? error.message : "Photo upload failed. Try again.")
    } finally {
      uploadInFlightRef.current = false
      setUploading(false)
      e.target.value = ""
    }
  }

  function addRecord() {
    if (!pendingZoneId || uploading || uploadError) return
    const zone = ALL_ZONES.find(item => item.id === pendingZoneId)
    if (pendingZoneId === "__custom__" && !pendingCustomLabel.trim()) return
    if (pendingZoneId !== "__custom__" && !zone) return
    const zoneId = pendingZoneId === "__custom__" ? pendingCustomLabel.trim() : pendingZoneId
    const edited = records.find(item => item.id === editingDamageId)
    const rec: DamageRecord = {
      id: edited?.id ?? crypto.randomUUID(),
      zone: zoneId,
      description: pendingDesc.trim(),
      photoUrl: pendingPhoto,
      type: pendingType,
      ...(pendingSurfacePoint ? { surfacePoint: pendingSurfacePoint } : {}),
      bodyType,
      view: edited?.view ?? "TOP",
      x: edited?.x ?? zone?.position[0] ?? 0,
      y: edited?.y ?? zone?.position[1] ?? 0,
    }
    const updated = edited ? records.map(item => item.id === edited.id ? rec : item) : [...records, rec]
    setRecords(updated)
    onComplete(updated)
    resetEditor()
  }

  function removeRecord(id: string) {
    const updated = records.filter(r => r.id !== id)
    setRecords(updated)
    onComplete(updated)
  }

  function zoneLabel(zoneId: string) {
    return ALL_ZONES.find(z => z.id === zoneId)?.label ?? zoneId
  }

  const pins = records.flatMap((item, index) => item.surfacePoint
    ? [{ id: item.id, number: index + 1, point: item.surfacePoint,
      type: item.type, hasPhoto: Boolean(item.photoUrl) }] : [])
  const photoCount = records.filter(item => Boolean(item.photoUrl)).length
  const grade = computeExteriorGradeFromDefectCount(records.length)
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
            <p className="text-[11px] text-[var(--text-muted)]">{gm.desc}</p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">{records.length} damages · {pins.length} 3D pins · {photoCount} photos</span>
      </div>

      {/* Instruction banner */}
      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
        <p className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-0.5">How to mark damage</p>
        <p className="text-xs text-slate-700 dark:text-[var(--text-muted)]">
          Rotate the 3D model, then tap the actual visible car surface. Check the suggested panel,
          take or choose a photo, select the damage type, and optionally describe it.
          Press Save &amp; Add Another to mark another point. You can also choose a panel manually.
        </p>
      </div>

      {/* Body type override (in case wizard didn't pass one) */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Vehicle Type</p>
        <div className="flex gap-2">
          {BODY_TYPES.map(bt => (
            <button
              key={bt}
              type="button"
              onClick={() => setBodyType(bt)}
              className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${
                bodyType === bt
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-primary/30"
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
            <p className="text-sm font-bold">3D preview isn&apos;t available on this device</p>
            <p className="text-xs text-[var(--text-muted)] max-w-xs">No problem — just pick the damaged area from the list below to mark it.</p>
          </div>
        }
      >
        <ThreeDVehicleViewer
          bodyType={bodyType}
          selectedZone={pendingZoneId}
          markedZones={markedZones}
          onZoneClick={handleZoneClick}
          onSurfaceTap={handleSurfaceTap}
          damagePins={pins}
          onDamagePinPress={editRecord}
          selectedDamageId={editingDamageId}
        />
      </ThreeDErrorBoundary>

      {/* Pending zone panel */}
      {pendingZone && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-primary" />
              <p className="font-bold text-[var(--text-primary)] text-sm">
                {editingDamageId ? "Editing damage:" : "Selected panel:"} <span className="text-primary">{pendingZone.label}</span>
              </p>
            </div>
            <button type="button" onClick={resetEditor} disabled={uploading} aria-label="Cancel damage entry" className="text-[var(--text-muted)] hover:text-primary dark:hover:text-white">
              <X size={15} />
            </button>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-[var(--text-muted)]">
              {pendingSurfacePoint ? "Suggested from a generic 3D model. Check that this panel matches your vehicle." : "Manually selected area."}
            </p>
            <button type="button" onClick={() => setManualOpen(true)} disabled={uploading}
              className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-xs text-primary">
              <Pencil size={13} className="inline mr-1" /> Change panel
            </button>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Damage type</label>
            <div className="flex flex-wrap gap-2">
              {(["SCRATCH", "SCUFF", "DENT", "CRACK", "OTHER"] as const).map(type => (
                <button type="button" key={type} onClick={() => setPendingType(type)}
                  disabled={uploading} aria-pressed={pendingType === type}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold ${pendingType === type
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-[var(--border-default)] text-[var(--text-secondary)]"}`}>
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Description (optional)</label>
            <textarea
              value={pendingDesc}
              onChange={e => setPendingDesc(e.target.value)}
              placeholder="e.g. Deep scratch approx 10cm, paint chipped to metal…"
              rows={3}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-4 py-3 text-sm placeholder:text-[var(--text-secondary)] focus:border-primary focus:outline-none resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Damage photo (optional)</label>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={uploading} onClick={() => cameraInputRef.current?.click()}
                className="rounded-xl border border-[var(--border-default)] px-3 py-2 text-sm">
                <Camera size={14} className="inline mr-2" />Take Photo
              </button>
              <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-[var(--border-default)] px-3 py-2 text-sm">
                <Images size={14} className="inline mr-2" />Gallery
              </button>
            </div>
            {uploadError && <p role="alert" className="text-xs text-red-500">
              {uploadError} Your description is still here. Select a photo again to retry.
            </p>
            {pendingPhoto ? (
              <div className="relative inline-block">
                <Image src={pendingPhoto} alt="damage" width={120} height={90} className="rounded-xl object-cover border border-[var(--border-default)]" />
                <button
                  type="button"
                  onClick={() => setPendingPhoto(undefined)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                >
                  <X size={10} />
                </button>
              </div>
            ) : uploading ? (
              <p role="status" className="text-xs text-[var(--text-muted)]">Uploading damage photo…</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={addRecord}
            disabled={uploading || Boolean(uploadError)}
            className="w-full py-2.5 rounded-xl bg-primary hover:bg-red-600 text-white font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Plus size={16} /> {editingDamageId ? "Save Changes" : "Save & Add Another"}
          </button>
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)]">
        {records.length} damages · {pins.length} 3D pins · {photoCount} uploaded photos
        {records.length > pins.length ? ` · ${records.length - pins.length} manually listed` : ""}
      </p>
      <button type="button" onClick={() => setManualOpen(open => !open)}
        aria-expanded={manualOpen} className="flex w-full items-center justify-between rounded-xl border border-[var(--border-default)] px-4 py-3 text-sm font-semibold">
        Choose area manually {manualOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {manualOpen && <div className="space-y-3">
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
            <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)] pt-1">{group.label}</p>
            <div className="grid grid-cols-2 gap-1">
              {groupZones.map(z => {
                const isMarked = records.some(r => r.zone === z.id)
                const isSelected = pendingZoneId === z.id
                return (
                  <div
                    key={z.id}
                    onClick={() => chooseCorrectedZone(z.id)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] border cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : isMarked
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          : "bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-muted)] hover:border-primary/20 hover:text-[var(--text-secondary)]"
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
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Other Damage Area</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. Interior – Driver Seat, Engine Bay…"
            value={customZoneInput}
            onChange={e => setCustomZoneInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCustomZone()}
            className="flex-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm placeholder:text-[var(--text-secondary)] focus:border-primary focus:outline-none"
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
        <p className="text-[10px] text-[var(--text-secondary)]">
          Not in the list above? Type any area and press Mark to describe the damage.
        </p>
      </div>

      </div>

      {/* Recorded damage list */}
      {records.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-amber-400" />
            <p className="text-sm font-bold">
              {records.length} damage{records.length !== 1 ? "s" : ""} recorded
            </p>
          </div>
          <div className="space-y-2">
            {records.map((rec, index) => (
              <div key={rec.id} className={`flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-input)] border ${editingDamageId === rec.id ? "border-primary" : "border-[var(--border-default)]"}`}>
                {rec.photoUrl && (
                  <Image
                    src={rec.photoUrl}
                    alt=""
                    width={56}
                    height={42}
                    className="rounded-lg object-cover shrink-0 border border-[var(--border-default)]"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-amber-300">#{index + 1} · {zoneLabel(rec.zone)} · {rec.type || "OTHER"}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{rec.description}</p>
                </div>
                <button type="button" disabled={uploading} onClick={() => editRecord(rec.id)}
                  aria-label={`Edit damage ${index + 1}`} className="rounded-lg p-2 text-primary hover:bg-primary/10">
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => removeRecord(rec.id)}
                  className="text-[var(--text-secondary)] hover:text-red-400 transition-colors shrink-0"
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
