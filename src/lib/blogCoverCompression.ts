import { blogCoverWidths } from './blogCover'

export async function prepareBlogCover(file: File): Promise<Array<{ width: number; file: File }>> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 25 * 1024 * 1024) {
        throw new Error('Choose a JPG, PNG or WebP cover smaller than 25 MB.')
    }
    const url = URL.createObjectURL(file)
    const image = new Image()
    try {
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve()
            image.onerror = () => reject(new Error('The cover image could not be read.'))
            image.src = url
        })
        if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) {
            throw new Error('Choose a cover image with fewer than 40 million pixels.')
        }
        const variants = []
        for (const width of blogCoverWidths(image.naturalWidth)) {
            const canvas = document.createElement('canvas')
            try {
                canvas.width = width
                canvas.height = Math.max(1, Math.round(image.naturalHeight * width / image.naturalWidth))
                const context = canvas.getContext('2d')
                if (!context) throw new Error('Your browser could not prepare the cover.')
                context.drawImage(image, 0, 0, canvas.width, canvas.height)
                const blob = await new Promise<Blob>((resolve, reject) => {
                    canvas.toBlob(value => value ? resolve(value) : reject(new Error('Cover conversion failed.')), 'image/webp', 0.86)
                })
                if (blob.type !== 'image/webp' || blob.size > 2 * 1024 * 1024) {
                    throw new Error('The cover could not be compressed. Please choose a smaller image or use an updated browser.')
                }
                variants.push({ width, file: new File([blob], `cover-w${width}.webp`, { type: 'image/webp' }) })
            } finally {
                canvas.width = 0
                canvas.height = 0
            }
        }
        return variants
    } finally {
        image.onload = null
        image.onerror = null
        image.removeAttribute('src')
        URL.revokeObjectURL(url)
    }
}
