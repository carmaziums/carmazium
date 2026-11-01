/**
 * Shared client-side preparation for listing, damage and admin vehicle photos.
 * Reduces stored bytes before upload, so Supabase image resizing is not needed.
 * Original aspect ratio is preserved; every photo is re-encoded to remove EXIF/GPS metadata.
 */

export const MAX_SOURCE_FILE_SIZE = 50 * 1024 * 1024 // Accept large modern phone photos up to 50MB before optimisation
const MAX_IMAGE_EDGE = 1920 // Full HD-class output while preserving the original aspect ratio
const TARGET_UPLOAD_SIZE = 2 * 1024 * 1024 // Aim for 2MB before storage, without paid delivery-time transforms
const INITIAL_JPEG_QUALITY = 0.86
const MIN_JPEG_QUALITY = 0.72
export const PHONE_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']

// A trusted marker exists only on a File actually produced by this module.
// Size/MIME alone cannot prove that an arbitrary JPEG had EXIF/GPS removed.
const preparedVehicleFiles = new WeakSet<File>()

/** The final vehicle-upload boundary uses this even if callers skip ImageUpload. */
export async function ensurePreparedVehiclePhoto(file: File): Promise<File> {
    if (preparedVehicleFiles.has(file)
        && file.type === 'image/jpeg'
        && file.size > 0
        && file.size <= TARGET_UPLOAD_SIZE) {
        return file // Avoid re-encoding a photo the listing wizard already prepared.
    }
    return prepareImageForUpload(file)
}

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
 * - re-encodes every image as JPEG (including small files) to strip EXIF/GPS data
 * - targets <= 2MB for reliable mobile uploads
 */
async function convertHeicToJpeg(file: File): Promise<File> {
    const extension = file.name.split('.').pop()?.toLowerCase() || ''
    const isHeic = ['heic', 'heif'].includes(extension)
        || file.type === 'image/heic'
        || file.type === 'image/heif'

    if (!isHeic) return file

    try {
        const { default: heic2any } = await import('heic2any')
        const converted = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: INITIAL_JPEG_QUALITY,
        })
        const blob = Array.isArray(converted) ? converted[0] : converted
        if (!blob) throw new Error('No JPEG was produced')

        const baseName = file.name.replace(/\.[^.]+$/, '') || 'vehicle-photo'
        return new File([blob], `${baseName}.jpg`, {
            type: 'image/jpeg',
            lastModified: file.lastModified,
        })
    } catch (error) {
        console.error('HEIC conversion failed:', error)
        throw new Error(`${file.name}: This HEIC/HEIF photo could not be converted. Please try the photo again or export it as JPEG.`)
    }
}

/**
 * Normalise customer photos before uploading:
 * - accepts high-resolution phone photos (up to 50MB source files)
 * - converts HEIC/HEIF to browser-safe JPEG first
 * - preserves aspect ratio
 * - downsizes the longest edge to 1920px (Full HD-class)
 * - targets <= 2MB for reliable mobile uploads
 * - drops decoded image/canvas references promptly to conserve iOS Safari memory
 */
export async function prepareImageForUpload(file: File): Promise<File> {
    if (file.size > MAX_SOURCE_FILE_SIZE) throw new Error(`${file.name}: Original photo must be 50MB or smaller`)
    const sourceFile = await convertHeicToJpeg(file)
    // Never return an original file unchanged, even if it is already below 2MB.
    // EXIF headers in small JPEGs can contain sensitive GPS coordinates.
    const objectUrl = URL.createObjectURL(sourceFile)
    const image = document.createElement('img')

    try {
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve()
            image.onerror = () => reject(new Error(
                `${sourceFile.name}: This photo could not be decoded after conversion. Please use JPEG, PNG or WebP.`
            ))
            image.src = objectUrl
        })

        const width = image.naturalWidth
        const height = image.naturalHeight

        if (!width || !height) {
            throw new Error(`${sourceFile.name}: Could not read the photo dimensions.`)
        }

        // Start at the same 1920px as before. Only reduce dimensions for unusually
        // detailed images that cannot meet the 2MB target at reasonable JPEG quality.
        // This keeps number plates and damage detail clearer than always using 1280px.
        const longestEdge = Math.max(width, height)
        let lastDimensions = ''
        for (const edgeLimit of [MAX_IMAGE_EDGE, 1600, 1440, 1280]) {
            const scale = Math.min(1, edgeLimit / longestEdge)
            const targetWidth = Math.max(1, Math.round(width * scale))
            const targetHeight = Math.max(1, Math.round(height * scale))
            const dimensions = `${targetWidth}x${targetHeight}`
            if (dimensions === lastDimensions) continue
            lastDimensions = dimensions

            const canvas = document.createElement('canvas')
            try {
                canvas.width = targetWidth
                canvas.height = targetHeight
                const context = canvas.getContext('2d')
                if (!context) throw new Error(`${sourceFile.name}: Your browser could not prepare this photo for upload.`)
                context.fillStyle = '#ffffff'
                context.fillRect(0, 0, targetWidth, targetHeight)
                context.drawImage(image, 0, 0, targetWidth, targetHeight)

                let quality = INITIAL_JPEG_QUALITY
                while (true) {
                    const blob = await canvasToBlob(canvas, quality)
                    if (blob.size <= TARGET_UPLOAD_SIZE) {
                        const baseName = sourceFile.name.replace(/\.[^.]+$/, '') || 'vehicle-photo'
                        const prepared = new File([blob], `${baseName}.jpg`, {
                            type: 'image/jpeg',
                            lastModified: sourceFile.lastModified,
                        })
                        preparedVehicleFiles.add(prepared)
                        return prepared
                    }
                    if (quality <= MIN_JPEG_QUALITY) break
                    quality = Math.max(MIN_JPEG_QUALITY, Number((quality - 0.07).toFixed(2)))
                }
            } finally {
                // Safari may retain canvas backing stores until garbage collection.
                // Explicitly release the pixel buffer after EVERY attempt, even
                // when a successful JPEG returns or encoding throws.
                canvas.width = 0
                canvas.height = 0
            }
        }
        // Never silently send an oversized image to storage or substitute a
        // very low-resolution damage picture just to meet a storage target.
        throw new Error(`${sourceFile.name}: The photo could not be optimised below 2MB. Please choose a smaller image.`)
    } finally {
        // Drop decoded pixels and event handlers before the next photo in a batch.
        image.onload = null
        image.onerror = null
        image.removeAttribute('src')
        URL.revokeObjectURL(objectUrl)
    }
}
