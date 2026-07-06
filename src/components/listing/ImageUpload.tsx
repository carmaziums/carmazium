"use client"

import * as React from "react"
import { Camera, X, Upload, Loader2, GripVertical, Star, Info, CheckCircle2, AlertCircle } from "lucide-react"
import Image from "next/image"
import { uploadImage, deleteImage } from "@/lib/supabase"

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
    const [reorderDragIdx, setReorderDragIdx] = React.useState<number | null>(null)
    const [reorderOverIdx, setReorderOverIdx] = React.useState<number | null>(null)

    // Validation constants
    const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
    const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

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
        // Emit a nicely sorted flat array to the parent
        const orderConfig: Record<ImageCategory, number> = { 'EXTERIOR': 1, 'INTERIOR': 2, 'DAMAGE': 3, 'UNASSIGNED': 4 }
        const sortedUrls = [...images]
            .sort((a, b) => orderConfig[a.category] - orderConfig[b.category])
            .map(img => img.url)
        onImagesChange(sortedUrls)

        if (onDamageImageCountChange) {
            onDamageImageCountChange(images.filter(img => img.category === 'DAMAGE').length)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [images])

    const validateFile = (file: File): string | null => {
        if (!file.type.startsWith('image/') && !ACCEPTED_TYPES.includes(file.type)) {
            return `${file.name}: Only image files are allowed`
        }
        if (file.size > MAX_FILE_SIZE) {
            return `${file.name}: File size must be less than 20MB`
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
                    const publicUrl = await uploadImage(file, 'listings')
                    newImages.push({ url: publicUrl, category: activeTab })
                } catch (error) {
                    failedCount++
                    lastFailError = error instanceof Error ? error.message : 'Unknown error'
                    console.error(`Upload failed for ${file.name}:`, error)
                }

                setUploadProgress(Math.round(((i + 1) / fileArray.length) * 100))
            }

            if (newImages.length > 0) {
                setImages(prev => [...prev, ...newImages])
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
        if (!confirm('Are you sure you want to delete this image?')) return

        try {
            await deleteImage(imageUrl, 'listings')
            setImages(prev => prev.filter((_, i) => i !== index))
        } catch (error) {
            console.error('Delete failed:', error)
            alert(`Failed to delete image: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
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

        setImages(prev => {
            const next = [...prev]
            const [moved] = next.splice(reorderDragIdx, 1)
            next.splice(dropIdx, 0, moved)
            return next
        })
        setReorderDragIdx(null)
        setReorderOverIdx(null)
    }

    const onReorderDragEnd = () => {
        setReorderDragIdx(null)
        setReorderOverIdx(null)
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
                    accept="image/jpeg,image/jpg,image/png,image/webp"
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
                        <div className="inline-flex gap-4 text-xs font-semibold text-[var(--text-muted)] bg-[var(--bg-card)] px-4 py-2 rounded-full border border-[var(--border-default)]">
                            <span>JPEG, PNG, WebP</span>
                            <span className="w-1 h-1 rounded-full bg-gray-600 self-center"></span>
                            <span>Max 5MB per file</span>
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

            {/* IMAGE PREVIEW GRID */}
            {images.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-4 border-b border-[var(--border-default)] pb-2">
                        <h3 className="text-sm font-bold uppercase text-[var(--text-primary)] tracking-wider">
                            All Uploaded Photos
                        </h3>
                        {images.length > 1 && (
                            <p className="text-xs text-primary font-bold hidden sm:block">Drag thumbnails to reorder</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {images.map((imgObj, index) => {
                            const isDragging = reorderDragIdx === index
                            const isOver = reorderOverIdx === index

                            return (
                                <div
                                    key={imgObj.url}
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
                                        src={imgObj.url}
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

                                    {/* Delete Button */}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleDelete(imgObj.url, index)
                                        }}
                                        className="absolute top-2 right-2 bg-red-500/90 hover:bg-red-500 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-lg backdrop-blur-md"
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
