"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface Props {
    images: string[]
    alt: string
    href?: string
    maxImages?: number
    sizes?: string
    className?: string
    /** Overlay content — badges positioned inside the image area. */
    children?: React.ReactNode
    imageClassName?: string
}

/**
 * A lightweight, dependency-free image carousel for use inside vehicle cards.
 * - Native horizontal scroll-snap drives navigation — real touch/momentum
 *   scrolling on mobile, not a custom pointer-drag reimplementation. A tap
 *   (no scroll movement) still reaches the underlying Link normally; browsers
 *   don't fire a click after a scroll-drag, so no manual gesture/tap
 *   disambiguation is needed.
 * - Arrow buttons (desktop only — hover-revealed, which never applies on
 *   touch) call scrollTo() on the same track so mouse and touch users land
 *   on identical state.
 * - Only the current image loads eagerly; the rest use native lazy-loading,
 *   so a grid of many cards doesn't fetch all 8 images per card up front.
 */
export function CardImageCarousel({
    images,
    alt,
    href,
    maxImages = 8,
    sizes = "(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 300px",
    className = "",
    children,
    imageClassName = "object-cover",
}: Props) {
    const bounded = React.useMemo(() => images.filter(Boolean).slice(0, maxImages), [images, maxImages])
    const [index, setIndex] = React.useState(0)
    const trackRef = React.useRef<HTMLDivElement>(null)
    const hasMultiple = bounded.length > 1

    const scrollToIndex = React.useCallback((i: number) => {
        const el = trackRef.current
        if (!el) return
        const clamped = Math.max(0, Math.min(bounded.length - 1, i))
        el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" })
    }, [bounded.length])

    const go = React.useCallback((delta: number) => scrollToIndex(index + delta), [index, scrollToIndex])

    // Native scroll (touch swipe, momentum, or a programmatic scrollTo from the
    // arrow buttons) is the single source of truth for which slide is current.
    const handleScroll = () => {
        const el = trackRef.current
        if (!el || el.clientWidth === 0) return
        const i = Math.round(el.scrollLeft / el.clientWidth)
        setIndex((prev) => (prev === i ? prev : i))
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!hasMultiple) return
        if (e.key === "ArrowLeft") {
            e.preventDefault()
            go(-1)
        } else if (e.key === "ArrowRight") {
            e.preventDefault()
            go(1)
        }
    }

    const useDots = hasMultiple && bounded.length <= 5

    return (
        <div
            className={`relative w-full h-full ${className}`}
            onKeyDown={handleKeyDown}
            tabIndex={hasMultiple ? 0 : -1}
            role={hasMultiple ? "group" : undefined}
            aria-roledescription={hasMultiple ? "carousel" : undefined}
            aria-label={hasMultiple ? `${alt} — ${bounded.length} photos` : undefined}
        >
            <div
                ref={trackRef}
                onScroll={handleScroll}
                className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ overscrollBehaviorX: "contain" }}
            >
                {bounded.length > 0 ? bounded.map((src, i) => (
                    <div key={`${src}-${i}`} className="relative w-full h-full flex-shrink-0 snap-start snap-always">
                        {href && (
                            <Link href={href} className="absolute inset-0 z-0" draggable={false}>
                                <span className="sr-only">{alt}</span>
                            </Link>
                        )}
                        <Image
                            src={src}
                            alt={i === 0 ? alt : `${alt} — image ${i + 1}`}
                            fill
                            sizes={sizes}
                            className={imageClassName}
                            loading={i === 0 ? "eager" : "lazy"}
                            draggable={false}
                        />
                    </div>
                )) : (
                    <div className="relative w-full h-full flex-shrink-0 bg-[var(--bg-input)]" />
                )}
            </div>

            {/* Overlay slot (badges) — sits above the scroll track, stays fixed while it scrolls */}
            {children}

            {hasMultiple && (
                <>
                    <button
                        type="button"
                        aria-label="Previous image"
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            go(-1)
                        }}
                        disabled={index === 0}
                        className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-30 h-8 w-8 rounded-full bg-black/50 backdrop-blur border border-white/10 text-white items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        type="button"
                        aria-label="Next image"
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            go(1)
                        }}
                        disabled={index === bounded.length - 1}
                        className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-30 h-8 w-8 rounded-full bg-black/50 backdrop-blur border border-white/10 text-white items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronRight size={16} />
                    </button>
                </>
            )}

            {hasMultiple && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                    {useDots ? (
                        <div className="flex items-center gap-1 rounded-full bg-black/40 backdrop-blur px-2 py-1">
                            {bounded.map((_, i) => (
                                <span
                                    key={i}
                                    className={`block h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
                                />
                            ))}
                        </div>
                    ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/50 backdrop-blur px-2 py-0.5 text-[10px] font-bold text-white">
                            {index + 1}/{bounded.length}
                        </span>
                    )}
                </div>
            )}
        </div>
    )
}
