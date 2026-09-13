"use client"

import * as React from "react"
import { Camera, Loader2, Trash2 } from "lucide-react"
import { uploadImage } from "@/lib/supabase"
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

export function ProfileImageUploader({ currentUrl, fallback, folder, label, onSave, square = false }: Props) {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

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
            await onSave(url)
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
        } catch (removeError) {
            setError(removeError instanceof Error ? removeError.message : "Could not remove this image.")
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
                <div className={`${square ? "rounded-2xl" : "rounded-full"} h-24 w-24 overflow-hidden border border-[var(--border-default)] bg-primary/10 flex items-center justify-center shrink-0`}>
                    {currentUrl ? (
                        <img src={currentUrl} alt={label} className="h-full w-full object-cover" />
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
                        {currentUrl && (
                            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={removeImage}>
                                <Trash2 size={15} className="mr-2" /> Remove image
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
            {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
    )
}
