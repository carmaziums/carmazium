import { blogCoverSrcSet } from '@/lib/blogCover'

type Props = {
    src: string
    alt: string
    sizes: string
    className?: string
    priority?: boolean
    fill?: boolean
    width?: number
    height?: number
}

/** Pre-generated sizes: no dependency on a paid image transformation quota. */
export function BlogCoverImage({ src, alt, sizes, className, priority, fill, width, height }: Props) {
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} srcSet={blogCoverSrcSet(src)} sizes={sizes} alt={alt}
            width={width} height={height}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined} decoding="async"
            className={`${fill ? 'absolute inset-0 h-full w-full ' : ''}${className || ''}`} />
    )
}
