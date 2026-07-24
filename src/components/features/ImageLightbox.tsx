"use client"

import * as React from "react"
import Image from "next/image"
import { X, ChevronLeft, ChevronRight } from "lucide-react"

interface Props {
    images: string[]
    alt: string
    startIndex?: number
    open: boolean
    onClose: () => void
}

/**
 * Full-screen image gallery — opens on tap of a card thumbnail so users
 * can preview all 8 images without leaving the browse grid or opening
 * the detail page. Detail navigation stays on the card's own "View
 * Details" button.
 *
 * Behaviour:
 *  - Arrow keys / prev-next buttons navigate.
 *  - Esc closes.
 *  - Backdrop click closes; clicks on the image or nav controls do not.
 *  - Native horizontal scroll-snap on the image track means real touch
 *    swipe + momentum on mobile — the same primitive the card carousel
 *    already uses, no bespoke gesture code.
 *  - Body scroll is locked while open.
 */
export function ImageLightbox({ images, alt, startIndex = 0, open, onClose }: Props) {
    const [index, setIndex] = React.useState(startIndex)
    const trackRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        if (open) setIndex(startIndex)
    }, [open, startIndex])

    // Jump the scroll track to the starting slide when the modal opens.
    // useLayoutEffect would fire before paint, but the track needs its
    // clientWidth measured — which requires the modal to be mounted first.
    React.useEffect(() => {
        if (!open) return
        const el = trackRef.current
        if (!el) return
        const raf = requestAnimationFrame(() => {
            el.scrollTo({ left: startIndex * el.clientWidth, behavior: "auto" })
        })
        return () => cancelAnimationFrame(raf)
    }, [open, startIndex])

    // Body scroll lock — restore the original overflow on unmount so we
    // don't strand the page in overflow:hidden if the modal is unmounted
    // while another effect is still running.
    React.useEffect(() => {
        if (!open) return
        const prev = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => { document.body.style.overflow = prev }
    }, [open])

    React.useEffect(() => {
        if (!open) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
            else if (e.key === "ArrowLeft") scrollBy(-1)
            else if (e.key === "ArrowRight") scrollBy(1)
        }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [open])

    const scrollBy = (delta: number) => {
        const el = trackRef.current
        if (!el) return
        const clamped = Math.max(0, Math.min(images.length - 1, index + delta))
        el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" })
    }

    const handleScroll = () => {
        const el = trackRef.current
        if (!el || el.clientWidth === 0) return
        const i = Math.round(el.scrollLeft / el.clientWidth)
        setIndex((prev) => (prev === i ? prev : i))
    }

    if (!open || images.length === 0) return null

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={`${alt} — image gallery`}
        >
            {/* Top bar: counter + close */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4">
                <span className="text-white text-sm font-semibold bg-black/50 px-3 py-1.5 rounded-full">
                    {index + 1} / {images.length}
                </span>
                <button
                    type="button"
                    aria-label="Close"
                    onClick={(e) => { e.stopPropagation(); onClose() }}
                    className="h-10 w-10 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Image track — clicks inside must not close */}
            <div
                ref={trackRef}
                onScroll={handleScroll}
                onClick={(e) => e.stopPropagation()}
                className="w-full h-full flex overflow-x-auto snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ overscrollBehaviorX: "contain" }}
            >
                {images.map((src, i) => (
                    <div key={`${src}-${i}`} className="relative w-full h-full flex-shrink-0 snap-start snap-always flex items-center justify-center p-4 md:p-16">
                        <Image
                            src={src}
                            alt={i === 0 ? alt : `${alt} — image ${i + 1}`}
                            fill
                            sizes="100vw"
                            className="object-contain"
                            priority={i === startIndex}
                            draggable={false}
                        />
                    </div>
                ))}
            </div>

            {/* Desktop prev/next */}
            {images.length > 1 && (
                <>
                    <button
                        type="button"
                        aria-label="Previous image"
                        onClick={(e) => { e.stopPropagation(); scrollBy(-1) }}
                        disabled={index === 0}
                        className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-black/50 hover:bg-black/80 text-white items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <button
                        type="button"
                        aria-label="Next image"
                        onClick={(e) => { e.stopPropagation(); scrollBy(1) }}
                        disabled={index === images.length - 1}
                        className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-black/50 hover:bg-black/80 text-white items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronRight size={24} />
                    </button>
                </>
            )}

            {/* Thumbnail strip — desktop only, wraps to next line if wide */}
            {images.length > 1 && (
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="hidden md:flex absolute bottom-4 left-1/2 -translate-x-1/2 z-10 max-w-[80vw] gap-2 overflow-x-auto p-2 bg-black/40 rounded-xl"
                >
                    {images.map((src, i) => (
                        <button
                            key={`thumb-${i}`}
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                const el = trackRef.current
                                if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" })
                            }}
                            className={`relative h-16 w-24 flex-shrink-0 rounded overflow-hidden border-2 transition-colors ${i === index ? "border-white" : "border-transparent opacity-60 hover:opacity-100"}`}
                            aria-label={`Go to image ${i + 1}`}
                        >
                            <Image src={src} alt="" fill sizes="96px" className="object-cover" draggable={false} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
