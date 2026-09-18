"use client"

import * as React from "react"
import { Camera, X, Upload, Loader2, GripVertical, Star, Info, CheckCircle2, AlertCircle, Sparkles } from "lucide-react"
import Image from "next/image"
import { uploadImage, deleteImage } from "@/lib/supabase"
import { recommendVehicleCoverPhoto } from "@/lib/listingApi"
import { parseVehicleImagePresentation } from "@/lib/vehicleImagePresentation"

export type ImageCategory = 'EXTERIOR' | 'INTERIOR' | 'DAMAGE' | 'UNASSIGNED'

interface CategorizedImage {
    url: string
    category: ImageCategory
}

interface ImageUploadProps {
    onImagesChange: (images: string[]) => void
    onDamageImageCountChange?: (count: number) => void
    maxImages?: number
    existingImages?: string[]
}

const CATEGORIES: { id: ImageCategory; label: string; tip: string; minReq?: number }[] = [
    {
        id: 'EXTERIOR',
        label: 'Exterior',
        minReq: 8,
        tip: 'Park in an open, well-lit area. Take photos from all 4 corners, straight on front/back, and close-ups of wheels.'
    },
    {
        id: 'INTERIOR',
        label: 'Interior',
        minReq: 8,
        tip: 'Show the dashboard, front seats, rear seats, boot space, and center console. Ensure the steering wheel is straight.'
    },
    {
        id: 'DAMAGE',
        label: 'Damage',
        tip: 'Be transparent about any scratches, dents, or wear to build buyer trust and get an accurate valuation.'
    },
]

const MAX_SOURCE_FILE_SIZE = 50 * 1024 * 1024 // Accept large modern phone photos up to 50MB before optimisation
const MAX_IMAGE_EDGE = 1920 // Full HD-class output while preserving the original aspect ratio
const TARGET_UPLOAD_SIZE = 4 * 1024 * 1024 // Keep standard Supabase uploads fast and reliable
const INITIAL_JPEG_QUALITY = 0.9
const MIN_JPEG_QUALITY = 0.68
const PHONE_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error('Could not prepare this photo for upload.')),
            'image/jpeg',
            quality,
        )
    })
}

/**
 * Normalise customer photos before uploading:
 * - accepts high-resolution phone photos (up to 50MB source files)
 * - preserves aspect ratio
 * - downsizes the longest edge to 1920px (Full HD-class)
 * - converts to JPEG and targets <= 4MB for reliable mobile uploads
 */
async function prepareImageForUpload(file: File): Promise<File> {
    const safeType = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)
    const alreadyOptimised = safeType && file.size <= TARGET_UPLOAD_SIZE

    const objectUrl = URL.createObjectURL(file)

    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const element = document.createElement('img')
            element.onload = () => resolve(element)
            element.onerror = () => reject(new Error(
                `${file.name}: This photo format could not be read by your browser. Please use JPEG, PNG or WebP.`
            ))
            element.src = objectUrl
        })

        const width = image.naturalWidth
        const height = image.naturalHeight

        if (!width || !height) {
            throw new Error(`${file.name}: Could not read the photo dimensions.`)
        }

        // Smaller, already-efficient images do not need recompressing.
        if (alreadyOptimised && Math.max(width, height) <= MAX_IMAGE_EDGE) {
            return file
        }

        const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height))
        const targetWidth = Math.max(1, Math.round(width * scale))
        const targetHeight = Math.max(1, Math.round(height * scale))

        const canvas = document.createElement('canvas')
        canvas.width = targetWidth
        canvas.height = targetHeight

        const context = canvas.getContext('2d')
        if (!context) {
            throw new Error(`${file.name}: Your browser could not prepare this photo for upload.`)
        }

        // White background avoids black transparency when PNG/WebP images are converted to JPEG.
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, targetWidth, targetHeight)
        context.drawImage(image, 0, 0, targetWidth, targetHeight)

        let quality = INITIAL_JPEG_QUALITY
        let blob = await canvasToBlob(canvas, quality)

        while (blob.size > TARGET_UPLOAD_SIZE && quality > MIN_JPEG_QUALITY) {
            quality = Math.max(MIN_JPEG_QUALITY, quality - 0.08)
            blob = await canvasToBlob(canvas, quality)
        }

        const baseName = file.name.replace(/\.[^.]+$/, '') || 'vehicle-photo'
        return new File([blob], `${baseName}.jpg`, {
            type: 'image/jpeg',
            lastModified: file.lastModified,
        })
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}

export function ImageUpload({
    onImagesChange,
    onDamageImageCountChange,
    maxImages = 100,
    existingImages = []
}: ImageUploadProps) {
    // Map existing string[] to CategorizedImage[] (default to EXTERIOR or UNASSIGNED)
    const [images, setImages] = React.useState<CategorizedImage[]>(() =>
        existingImages.map(url => ({ url, category: 'UNASSIGNED' }))
    )
    const [activeTab, setActiveTab] = React.useState<ImageCategory>('EXTERIOR')
    const [uploading, setUploading] = React.useState(false)
    const [uploadProgress, setUploadProgress] = React.useState(0)
    const [dragActive, setDragActive] = React.useState(false)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    // Reorder drag state
    const [uploadError, setUploadError] = React.useState<string | null>(null)
    const [coverSelectionMessage, setCoverSelectionMessage] = React.useState<string | null>(null)
    const [reorderDragIdx, setReorderDragIdx] = React.useState<number | null>(null)
    const [reorderOverIdx, setReorderOverIdx] = React.useState<number | null>(null)
    const reorderPointerRef = React.useRef<{ pointerId: number; index: number } | null>(null)
    const originalImageSourcesRef = React.useRef(new Set(existingImages.map(url => parseVehicleImagePresentation(url).src)))

    React.useEffect(() => {
        for (const url of existingImages) {
            originalImageSourcesRef.current.add(parseVehicleImagePresentation(url).src)
        }
    }, [existingImages])

    // Validation constants
    // Source photos may be much larger than the final upload. They are resized/compressed
    // to Full HD-class JPEGs in the browser before being sent to storage.

    // Sort order: Cover photo is always index 0, then by category order
    const getSortedImages = React.useCallback(() => {
        const order = { 'EXTERIOR': 1, 'INTERIOR': 2, 'DAMAGE': 3, 'UNASSIGNED': 4 }
        const sorted = [...images].sort((a, b) => {
            // Keep user's explicit order within the same category if possible, but for simplicity we rely on the flat array order
            // Actually, to support manual drag-and-drop ordering perfectly, we should NOT auto-sort the entire array.
            // We only sort when emitting to the parent, giving priority to Exterior.
            return 0; // Disable auto-sorting in state to preserve drag-and-drop
        })
        return images
    }, [images])

    React.useEffect(() => {
        // Preserve the exact visible order. Photo 1 is the cover, so category
        // sorting here would silently undo AI/manual cover selection.
        onImagesChange(images.map(img => img.url))

        if (onDamageImageCountChange) {
            onDamageImageCountChange(images.filter(img => img.category === 'DAMAGE').length)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [images])

    const validateFile = (file: File): string | null => {
        const extension = file.name.split('.').pop()?.toLowerCase() || ''
        const looksLikeImage = file.type.startsWith('image/') || PHONE_IMAGE_EXTENSIONS.includes(extension)

        if (!looksLikeImage) {
            return `${file.name}: Only image files are allowed`
        }
        if (file.size > MAX_SOURCE_FILE_SIZE) {
            return `${file.name}: Original photo must be 50MB or smaller`
        }
        return null
    }

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return

        const fileArray = Array.from(files)
        const remainingSlots = maxImages - images.length

        if (fileArray.length > remainingSlots) {
            const err = `You can only upload ${remainingSlots} more image(s). Maximum is ${maxImages}.`
            alert(err)
            return
        }

        const validationErrors: string[] = []
        fileArray.forEach((file) => {
            const error = validateFile(file)
            if (error) validationErrors.push(error)
        })

        if (validationErrors.length > 0) {
            alert(validationErrors.join('\n'))
            return
        }

        setUploading(true)
        setUploadError(null)
        const newImages: CategorizedImage[] = []
        let failedCount = 0
        let lastFailError = ''

        try {
            for (let i = 0; i < fileArray.length; i++) {
                const file = fileArray[i]
                setUploadProgress(Math.round((i / fileArray.length) * 100))

                try {
                    const preparedFile = await prepareImageForUpload(file)
                    const publicUrl = await uploadImage(preparedFile, 'listings')
                    newImages.push({ url: publicUrl, category: activeTab })
                } catch (error) {
                    failedCount++
                    lastFailError = error instanceof Error ? error.message : 'Unknown error'
                    console.error(`Upload failed for ${file.name}:`, error)
                }

                setUploadProgress(Math.round(((i + 1) / fileArray.length) * 100))
            }

            if (newImages.length > 0) {
                let combined = [...images, ...newImages]

                // Exterior uploads get an automatic professional-cover pass. This
                // is advisory only: if vision cannot identify a clear front view,
                // the existing order is preserved and the user can still drag or
                // use "Make cover" manually.
                if (activeTab === 'EXTERIOR' && combined.length > 1) {
                    try {
                        setCoverSelectionMessage('Checking for the best front photo...')
                        const candidates = combined.slice(0, 30)
                        const recommendation = await recommendVehicleCoverPhoto(candidates.map(img => parseVehicleImagePresentation(img.url).src))
                        const recommendedIndex = recommendation.recommendedIndex
                        if (recommendation.confidence >= 0.6 && recommendedIndex !== null && recommendedIndex > 0 && recommendedIndex < candidates.length) {
                            const next = [...combined]
                            const [cover] = next.splice(recommendedIndex, 1)
                            next.unshift(cover)
                            combined = next
                            setCoverSelectionMessage(
                                recommendation.view === 'front'
                                    ? 'Front photo selected automatically as the cover.'
                                    : 'Best front-angle photo selected automatically as the cover.'
                            )
                        } else if (recommendation.confidence >= 0.6 && recommendedIndex === 0) {
                            setCoverSelectionMessage('Your current first photo is already the best front cover.')
                        } else {
                            setCoverSelectionMessage('No clear front photo was found. You can choose the cover manually below.')
                        }
                    } catch (error) {
                        console.warn('Automatic cover selection unavailable:', error)
                        setCoverSelectionMessage('Photos uploaded. You can choose the cover manually below.')
                    }
                }

                setImages(combined)
            }

            if (failedCount > 0) {
                const msg = newImages.length > 0
                    ? `${newImages.length} uploaded, ${failedCount} failed — ${lastFailError}`
                    : lastFailError
                setUploadError(msg)
            }
        } finally {
            setUploading(false)
            setUploadProgress(0)
        }
    }

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true)
        } else if (e.type === "dragleave") {
            setDragActive(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault()
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files)
            if (fileInputRef.current) fileInputRef.current.value = '' // Reset input
        }
    }

    const handleDelete = async (imageUrl: string, index: number) => {
        if (!confirm('Are you sure you want to remove this image?')) return

        const source = parseVehicleImagePresentation(imageUrl).src
        const existedWhenEditorOpened = originalImageSourcesRef.current.has(source)

        try {
            // Existing listing photos are only removed from the pending form.
            // The listing record is still pointing at them until Save succeeds,
            // so deleting the physical object here could leave a broken listing
            // if the user cancels or the later save fails. Newly uploaded,
            // unsaved photos are safe to delete immediately.
            if (!existedWhenEditorOpened) {
                await deleteImage(source, 'listings')
            }
            setImages(prev => prev.filter((_, i) => i !== index))
        } catch (error) {
            console.error('Delete failed:', error)
            alert(`Failed to delete image: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    const moveImageTo = (from: number, target: number) => {
        if (from === target || from < 0 || target < 0 || from >= images.length || target >= images.length) return
        setImages(prev => {
            const next = [...prev]
            const [moved] = next.splice(from, 1)
            next.splice(target, 0, moved)
            return next
        })
    }

    const beginPointerReorder = (index: number, event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        event.currentTarget.setPointerCapture(event.pointerId)
        reorderPointerRef.current = { pointerId: event.pointerId, index }
        setReorderDragIdx(index)
    }

    const handlePointerReorder = (event: React.PointerEvent<HTMLButtonElement>) => {
        const drag = reorderPointerRef.current
        if (!drag || drag.pointerId !== event.pointerId) return

        event.preventDefault()
        const targetCard = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-photo-index]')
        const target = targetCard ? Number(targetCard.dataset.photoIndex) : NaN
        if (!Number.isInteger(target) || target < 0 || target >= images.length || target === drag.index) return

        moveImageTo(drag.index, target)
        drag.index = target
        setReorderDragIdx(target)
    }

    const endPointerReorder = (event: React.PointerEvent<HTMLButtonElement>) => {
        const drag = reorderPointerRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
        }
        reorderPointerRef.current = null
        setReorderDragIdx(null)
        setReorderOverIdx(null)
    }

    // Reorder drag handlers
    const onReorderDragStart = (e: React.DragEvent, idx: number) => {
        setReorderDragIdx(idx)
        e.dataTransfer.effectAllowed = 'move'
        const ghost = document.createElement('div')
        ghost.style.opacity = '0'
        document.body.appendChild(ghost)
        e.dataTransfer.setDragImage(ghost, 0, 0)
        setTimeout(() => document.body.removeChild(ghost), 0)
    }

    const onReorderDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (reorderDragIdx !== null && idx !== reorderDragIdx) {
            setReorderOverIdx(idx)
        }
    }

    const onReorderDrop = (e: React.DragEvent, dropIdx: number) => {
        e.preventDefault()
        e.stopPropagation()
        if (reorderDragIdx === null || reorderDragIdx === dropIdx) {
            setReorderDragIdx(null)
            setReorderOverIdx(null)
            return
        }

        moveImageTo(reorderDragIdx, dropIdx)
        setReorderDragIdx(null)
        setReorderOverIdx(null)
    }

    const onReorderDragEnd = () => {
        setReorderDragIdx(null)
        setReorderOverIdx(null)
    }

    const makeCover = (index: number) => {
        if (index <= 0) return
        setImages(prev => {
            const next = [...prev]
            const [cover] = next.splice(index, 1)
            next.unshift(cover)
            return next
        })
        setCoverSelectionMessage('Cover photo changed manually.')
    }


    // Tracker logic
    const RECOMMENDED_TOTAL = 20
    const currentTotal = images.length
    const progressPct = Math.min(100, (currentTotal / RECOMMENDED_TOTAL) * 100)

    const activeCategoryDef = CATEGORIES.find(c => c.id === activeTab)

    return (
        <div className="space-y-6">
            {/* GOAL TRACKER */}
            <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border-default)]">
                <div className="flex justify-between items-end mb-2">
                    <div>
                        <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                            {currentTotal >= RECOMMENDED_TOTAL ? <CheckCircle2 className="text-emerald-400" size={16} /> : <Camera className="text-primary" size={16} />}
                            Photo Tracker
                        </h4>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                            Cars with 20+ photos sell on average 40% faster.
                        </p>
                    </div>
                    <div className="text-right">
                        <span className={`text-2xl font-black font-mono ${currentTotal >= RECOMMENDED_TOTAL ? 'text-emerald-400' : 'text-[var(--text-primary)]'}`}>{currentTotal}</span>
                        <span className="text-sm text-[var(--text-muted)] font-bold"> / {RECOMMENDED_TOTAL}</span>
                    </div>
                </div>
                <div className="h-2 w-full bg-[var(--bg-input)] rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${currentTotal >= RECOMMENDED_TOTAL ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-primary'}`}
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
            </div>

            {/* CATEGORY TABS */}
            <div className="flex bg-[var(--bg-input)] p-1.5 rounded-xl border border-[var(--border-default)] overflow-x-auto hide-scrollbar">
                {CATEGORIES.map((cat) => {
                    const count = images.filter(img => img.category === cat.id).length
                    const isActive = activeTab === cat.id
                    return (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setActiveTab(cat.id)}
                            className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${isActive
                                ? 'bg-primary text-white shadow-neon'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                                }`}
                        >
                            {cat.label}
                            {count > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-[var(--bg-card)]'}`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* PRO TIP */}
            {activeCategoryDef && (
                <div className="bg-blue-500/10 border border-blue-500/20 text-blue-200 p-4 rounded-xl flex gap-3 text-sm">
                    <Info size={20} className="shrink-0 text-blue-400 mt-0.5" />
                    <div>
                        <p className="font-bold text-blue-300 font-heading tracking-wide uppercase text-xs mb-1">Pro Tip: {activeCategoryDef.label}</p>
                        <p className="text-blue-100/80 leading-relaxed">{activeCategoryDef.tip}</p>
                    </div>
                </div>
            )}

            {/* UPLOAD ZONE */}
            <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 cursor-pointer group relative overflow-hidden ${dragActive
                    ? 'border-primary bg-primary/10'
                    : 'border-[var(--border-default)] bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)]'
                    } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    accept="image/*,.heic,.heif"
                    onChange={handleChange}
                    disabled={uploading || images.length >= maxImages}
                />

                {uploading ? (
                    <div className="space-y-4">
                        <Loader2 className="h-10 w-10 text-primary mx-auto animate-spin" />
                        <p className="text-lg font-bold">Uploading to {CATEGORIES.find(c => c.id === activeTab)?.label}...</p>
                        <div className="max-w-xs mx-auto bg-white/10 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-primary h-full transition-all duration-300 shadow-neon"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                        <p className="text-sm text-[var(--text-muted)]">{uploadProgress}% complete</p>
                    </div>
                ) : (
                    <>
                        <div className="w-16 h-16 bg-[var(--bg-card)] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[var(--border-default)] group-hover:border-primary/50 group-hover:scale-110 transition-all shadow-xl">
                            {dragActive ? (
                                <Upload className="h-7 w-7 text-primary animate-bounce" />
                            ) : (
                                <Camera className="h-7 w-7 text-[var(--text-muted)] group-hover:text-primary transition-colors" />
                            )}
                        </div>
                        <h3 className="text-xl font-bold font-heading text-[var(--text-primary)] mb-2">
                            {dragActive ? 'Drop images here' : `Add ${CATEGORIES.find(c => c.id === activeTab)?.label} Photos`}
                        </h3>
                        <p className="text-[var(--text-muted)] text-sm mb-4">
                            Drag and drop or click to browse (Max {maxImages} photos)
                        </p>
                        <div className="inline-flex flex-wrap justify-center gap-2 sm:gap-4 text-xs font-semibold text-[var(--text-muted)] bg-[var(--bg-card)] px-4 py-2 rounded-xl sm:rounded-full border border-[var(--border-default)]">
                            <span>Phone photos supported</span>
                            <span className="w-1 h-1 rounded-full bg-gray-600 self-center"></span>
                            <span>Auto-optimised to Full HD</span>
                            <span className="w-1 h-1 rounded-full bg-gray-600 self-center"></span>
                            <span>Up to 50MB original</span>
                        </div>
                    </>
                )}
            </div>

            {/* UPLOAD ERROR */}
            {uploadError && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-red-300 text-xs uppercase tracking-wide mb-0.5">Upload failed</p>
                        <p className="text-xs text-red-200/80 break-words">{uploadError}</p>
                    </div>
                    <button type="button" onClick={() => setUploadError(null)} className="shrink-0 text-red-400 hover:text-red-200">
                        <X size={14} />
                    </button>
                </div>
            )}

            {coverSelectionMessage && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-primary/25 bg-primary/10 text-sm">
                    <Sparkles size={16} className="shrink-0 mt-0.5 text-primary" />
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs uppercase tracking-wide mb-0.5">Smart cover</p>
                        <p className="text-xs text-[var(--text-muted)]">{coverSelectionMessage}</p>
                    </div>
                    <button type="button" onClick={() => setCoverSelectionMessage(null)} className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* IMAGE PREVIEW GRID */}
            {images.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-4 border-b border-[var(--border-default)] pb-2">
                        <h3 className="text-sm font-bold uppercase text-[var(--text-primary)] tracking-wider">
                            All Uploaded Photos
                        </h3>
                        {images.length > 1 && (
                            <p className="text-xs text-primary font-bold hidden sm:block">Drag photos to reorder</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {images.map((imgObj, index) => {
                            const isDragging = reorderDragIdx === index
                            const isOver = reorderOverIdx === index

                            return (
                                <div
                                    key={imgObj.url}
                                    data-photo-index={index}
                                    draggable
                                    onDragStart={(e) => onReorderDragStart(e, index)}
                                    onDragOver={(e) => onReorderDragOver(e, index)}
                                    onDrop={(e) => onReorderDrop(e, index)}
                                    onDragEnd={onReorderDragEnd}
                                    className={`relative aspect-[4/3] bg-[var(--bg-input)] rounded-xl overflow-hidden border-2 group cursor-grab active:cursor-grabbing transition-all duration-200
                                        ${isDragging ? 'opacity-40 scale-95 border-primary/50' : ''}
                                        ${isOver ? 'border-primary shadow-[0_0_15px_rgba(237,28,36,0.3)] scale-[1.02]' : 'border-[var(--border-default)] hover:border-white/20'}
                                    `}
                                >
                                    <Image
                                        src={parseVehicleImagePresentation(imgObj.url).src}
                                        alt={`Upload ${index + 1}`}
                                        fill
                                        className="object-cover pointer-events-none"
                                        sizes="(max-width: 768px) 50vw, 20vw"
                                    />

                                    {/* Category tag */}
                                    <div className="absolute top-2 left-2 bg-black/60 text-white/90 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded backdrop-blur-md border border-[var(--border-default)]">
                                        {imgObj.category !== 'UNASSIGNED' ? imgObj.category : 'Photo'}
                                    </div>

                                    {/* Cover Badge (first image) */}
                                    {index === 0 && (
                                        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xl border border-amber-300/30">
                                            <Star size={12} fill="currentColor" /> Cover
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        aria-label={`Drag photo ${index + 1} to reorder`}
                                        title="Drag to reorder"
                                        onPointerDown={(event) => beginPointerReorder(index, event)}
                                        onPointerMove={handlePointerReorder}
                                        onPointerUp={endPointerReorder}
                                        onPointerCancel={endPointerReorder}
                                        onClick={(event) => event.stopPropagation()}
                                        className="absolute bottom-2 right-2 z-10 inline-flex touch-none items-center gap-1 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-bold text-white shadow-lg active:cursor-grabbing"
                                        style={{ touchAction: 'none' }}
                                    >
                                        <GripVertical size={11} /> Drag
                                    </button>

                                    {/* Cover / delete controls */}
                                    {index !== 0 && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                makeCover(index)
                                            }}
                                            className="absolute bottom-2 left-2 bg-black/70 hover:bg-amber-500 text-white rounded-lg px-2 py-1 text-[10px] font-bold flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all shadow-lg backdrop-blur-md"
                                            title="Make this the cover photo"
                                        >
                                            <Star size={11} /> Make cover
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleDelete(imgObj.url, index)
                                        }}
                                        className="absolute top-2 right-2 bg-red-500/90 hover:bg-red-500 text-white rounded-lg p-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:scale-110 shadow-lg backdrop-blur-md"
                                        title="Delete image"
                                    >
                                        <X size={14} strokeWidth={3} />
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
