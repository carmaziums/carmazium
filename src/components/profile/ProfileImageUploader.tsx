"use client"

import * as React from "react"
import { Camera, Loader2, RotateCcw, SlidersHorizontal, Trash2 } from "lucide-react"
import { uploadImage } from "@/lib/supabase"
import {
    encodeProfileImagePresentation,
    parseProfileImagePresentation,
    type ProfileImageFit,
} from "@/lib/profileImagePresentation"
import { Button } from "@/components/ui/Button"

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

type Props = {
    currentUrl?: string | null
    fallback: string
    folder: string
    label: string
    onSave: (url: string) => Promise<void>
    square?: boolean
}

type DraftPresentation = {
    fit: ProfileImageFit
    x: number
    y: number
    zoom: number
}

export function ProfileImageUploader({ currentUrl, fallback, folder, label, onSave, square = false }: Props) {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [adjusting, setAdjusting] = React.useState(false)
    const fallbackFit: ProfileImageFit = square ? "contain" : "cover"
    const presentation = React.useMemo(
        () => parseProfileImagePresentation(currentUrl, fallbackFit),
        [currentUrl, fallbackFit],
    )
    const [draft, setDraft] = React.useState<DraftPresentation>({
        fit: presentation.fit,
        x: presentation.x,
        y: presentation.y,
        zoom: presentation.zoom,
    })

    React.useEffect(() => {
        setDraft({
            fit: presentation.fit,
            x: presentation.x,
            y: presentation.y,
            zoom: presentation.zoom,
        })
    }, [presentation.fit, presentation.x, presentation.y, presentation.zoom])

    const previewStyle = (value: DraftPresentation) => ({
        objectFit: value.fit,
        objectPosition: `${value.x}% ${value.y}%`,
        transform: `scale(${value.zoom})`,
        transformOrigin: `${value.x}% ${value.y}%`,
    })

    const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.target.value = ""
        if (!file) return

        if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
            setError("Use a JPG, PNG or WebP image.")
            return
        }
        if (file.size > MAX_IMAGE_BYTES) {
            setError("Image must be 5 MB or smaller.")
            return
        }

        setBusy(true)
        setError(null)
        try {
            const url = await uploadImage(file, "listings", folder)
            const defaultPresentation: DraftPresentation = { fit: fallbackFit, x: 50, y: 50, zoom: 1 }
            await onSave(encodeProfileImagePresentation(url, defaultPresentation))
            setDraft(defaultPresentation)
            setAdjusting(true)
        } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : "Could not upload this image.")
        } finally {
            setBusy(false)
        }
    }

    const removeImage = async () => {
        if (!currentUrl) return
        setBusy(true)
        setError(null)
        try {
            // Clear the profile reference. Profile uploads share the existing
            // listings bucket, so do not guess a storage path and risk deleting
            // an unrelated object from that shared bucket.
            await onSave("")
            setAdjusting(false)
        } catch (removeError) {
            setError(removeError instanceof Error ? removeError.message : "Could not remove this image.")
        } finally {
            setBusy(false)
        }
    }

    const saveDisplay = async () => {
        if (!currentUrl || !presentation.src) return
        setBusy(true)
        setError(null)
        try {
            await onSave(encodeProfileImagePresentation(currentUrl, draft))
            setAdjusting(false)
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Could not save the display settings.")
        } finally {
            setBusy(false)
        }
    }

    const resetDisplay = () => {
        setDraft({ fit: fallbackFit, x: 50, y: 50, zoom: 1 })
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
                <div className={`${square ? "rounded-2xl" : "rounded-full"} h-24 w-24 overflow-hidden border border-[var(--border-default)] bg-primary/10 flex items-center justify-center shrink-0`}>
                    {presentation.src ? (
                        <img src={presentation.src} alt={label} className="h-full w-full transition-transform duration-200" style={previewStyle(presentation)} />
                    ) : (
                        <span className="text-2xl font-bold text-primary">{fallback.slice(0, 2).toUpperCase()}</span>
                    )}
                </div>
                <div>
                    <p className="font-semibold">{label}</p>
                    <p className="text-xs mt-1 mb-3" style={{ color: "var(--text-muted)" }}>JPG, PNG or WebP. Maximum 5 MB.</p>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
                            {busy ? <Loader2 size={15} className="animate-spin mr-2" /> : <Camera size={15} className="mr-2" />}
                            {currentUrl ? "Change image" : "Upload image"}
                        </Button>
                        {currentUrl && presentation.src && (
                            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setAdjusting((value) => !value)}>
                                <SlidersHorizontal size={15} className="mr-2" /> Adjust display
                            </Button>
                        )}
                        {currentUrl && (
                            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={removeImage}>
                                <Trash2 size={15} className="mr-2" /> Remove image
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {adjusting && presentation.src && (
                <div className="mt-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4 sm:p-5">
                    <div className="grid gap-5 md:grid-cols-[220px_1fr] md:items-start">
                        <div>
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Visitor preview</p>
                            <div className="aspect-square w-full max-w-[220px] overflow-hidden rounded-3xl border border-[var(--border-default)] bg-white/5 flex items-center justify-center">
                                <img src={presentation.src} alt={`${label} visitor preview`} className="h-full w-full transition-transform duration-150" style={previewStyle(draft)} />
                            </div>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <p className="text-sm font-bold">How much of the image should visitors see?</p>
                                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>These controls only change the public display. Your original uploaded image is not altered.</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button type="button" onClick={() => setDraft((current) => ({ ...current, fit: "cover" }))} className={`rounded-full border px-3 py-2 text-xs font-bold transition-colors ${draft.fit === "cover" ? "border-primary bg-primary/15 text-primary" : "border-[var(--border-default)]"}`}>Fill frame</button>
                                    <button type="button" onClick={() => setDraft((current) => ({ ...current, fit: "contain" }))} className={`rounded-full border px-3 py-2 text-xs font-bold transition-colors ${draft.fit === "contain" ? "border-primary bg-primary/15 text-primary" : "border-[var(--border-default)]"}`}>Show full image</button>
                                </div>
                            </div>
                            <RangeControl label="Zoom" value={draft.zoom} min={1} max={2.5} step={0.05} valueLabel={`${Math.round(draft.zoom * 100)}%`} onChange={(zoom) => setDraft((current) => ({ ...current, zoom }))} />
                            <RangeControl label="Move left / right" value={draft.x} min={0} max={100} step={1} valueLabel={`${Math.round(draft.x)}%`} onChange={(x) => setDraft((current) => ({ ...current, x }))} />
                            <RangeControl label="Move up / down" value={draft.y} min={0} max={100} step={1} valueLabel={`${Math.round(draft.y)}%`} onChange={(y) => setDraft((current) => ({ ...current, y }))} />
                            <div className="flex flex-wrap gap-2 pt-1">
                                <Button type="button" size="sm" disabled={busy} onClick={saveDisplay}>{busy && <Loader2 size={15} className="animate-spin mr-2" />}Save display</Button>
                                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={resetDisplay}><RotateCcw size={14} className="mr-2" /> Reset</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
            {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
    )
}

function RangeControl({ label, value, min, max, step, valueLabel, onChange }: { label: string; value: number; min: number; max: number; step: number; valueLabel: string; onChange: (value: number) => void }) {
    return (
        <label className="block">
            <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                <span>{label}</span>
                <span>{valueLabel}</span>
            </span>
            <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-[var(--primary)]" />
        </label>
    )
}
