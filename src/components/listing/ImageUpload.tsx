"use client"

import * as React from "react"
import { Camera, X, Upload, Loader2 } from "lucide-react"
import Image from "next/image"
import { uploadImage, deleteImage } from "@/lib/supabase"

interface ImageUploadProps {
    onImagesChange: (images: string[]) => void
    maxImages?: number
    existingImages?: string[]
}

export function ImageUpload({
    onImagesChange,
    maxImages = 20,
    existingImages = []
}: ImageUploadProps) {
    const [images, setImages] = React.useState<string[]>(existingImages)
    const [uploading, setUploading] = React.useState(false)
    const [uploadProgress, setUploadProgress] = React.useState(0)
    const [dragActive, setDragActive] = React.useState(false)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    // Validation constants
    const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
    const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

    React.useEffect(() => {
        onImagesChange(images)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [images])

    const validateFile = (file: File): string | null => {
        if (!ACCEPTED_TYPES.includes(file.type)) {
            return `${file.name}: Only JPEG, PNG, and WebP images are allowed`
        }
        if (file.size > MAX_FILE_SIZE) {
            return `${file.name}: File size must be less than 5MB`
        }
        return null
    }

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return

        const fileArray = Array.from(files)
        const remainingSlots = maxImages - images.length

        if (fileArray.length > remainingSlots) {
            alert(`You can only upload ${remainingSlots} more image(s). Maximum is ${maxImages}.`)
            return
        }

        // Validate all files first
        const validationErrors: string[] = []
        fileArray.forEach((file) => {
            const error = validateFile(file)
            if (error) validationErrors.push(error)
        })

        if (validationErrors.length > 0) {
            alert(validationErrors.join('\n'))
            return
        }

        // Upload files
        setUploading(true)
        const newImageUrls: string[] = []

        try {
            for (let i = 0; i < fileArray.length; i++) {
                const file = fileArray[i]
                setUploadProgress(Math.round(((i + 1) / fileArray.length) * 100))

                const publicUrl = await uploadImage(file, 'listings')
                newImageUrls.push(publicUrl)
            }

            setImages(prev => [...prev, ...newImageUrls])
        } catch (error) {
            console.error('Upload failed:', error)
            alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
        }
    }

    const handleDelete = async (imageUrl: string, index: number) => {
        if (!confirm('Are you sure you want to delete this image?')) return

        try {
            // Delete from Supabase storage
            await deleteImage(imageUrl, 'listings')

            // Remove from state
            setImages(prev => prev.filter((_, i) => i !== index))
        } catch (error) {
            console.error('Delete failed:', error)
            alert(`Failed to delete image: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    const openFileDialog = () => {
        fileInputRef.current?.click()
    }

    return (
        <div className="space-y-6">
            {/* Upload Zone */}
            <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 cursor-pointer group ${dragActive
                    ? 'border-primary bg-primary/10'
                    : 'border-white/20 bg-white/5 hover:bg-white/10'
                    } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={openFileDialog}
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
                        <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin" />
                        <p className="text-lg font-bold text-white">Uploading...</p>
                        <div className="max-w-xs mx-auto bg-white/10 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-primary h-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                        <p className="text-sm text-gray-400">{uploadProgress}% complete</p>
                    </div>
                ) : (
                    <>
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                            {dragActive ? (
                                <Upload className="h-8 w-8 text-primary" />
                            ) : (
                                <Camera className="h-8 w-8 text-primary" />
                            )}
                        </div>
                        <p className="text-lg font-bold text-white mb-2">
                            {dragActive ? 'Drop images here' : 'Drag and drop photos here'}
                        </p>
                        <p className="text-gray-400 text-sm">
                            or click to browse files (Max {maxImages} photos)
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                            Accepted: JPEG, PNG, WebP • Max 5MB per image
                        </p>
                    </>
                )}
            </div>

            {/* Image Preview Grid */}
            {images.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold uppercase text-gray-400">
                            Uploaded Images ({images.length}/{maxImages})
                        </h3>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {images.map((imageUrl, index) => (
                            <div
                                key={imageUrl}
                                className="relative aspect-video bg-slate-800 rounded-lg overflow-hidden border border-white/10 group"
                            >
                                <Image
                                    src={imageUrl}
                                    alt={`Upload ${index + 1}`}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 768px) 50vw, 25vw"
                                />

                                {/* Delete Button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleDelete(imageUrl, index)
                                    }}
                                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                    title="Delete image"
                                >
                                    <X size={16} />
                                </button>

                                {/* Image Number Badge */}
                                <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                    {index + 1}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
