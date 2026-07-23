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

const SWIPE_THRESHOLD_PX = 24
const TAP_MOVE_TOLERANCE_PX = 8

/**
 * A lightweight, dependency-free image carousel for use inside vehicle cards.
 * - Pointer-based swipe (touch + mouse) with tap/swipe disambiguation so a swipe
 *   never triggers the card's click-through.
 * - Only the current + adjacent images are actually mounted — the rest render as
 *   placeholder <div>s until the user pages through.
 * - Arrow buttons on desktop; dots (≤5) or N/M counter (>5) as indicator.
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
    const [loaded, setLoaded] = React.useState<Set<number>>(() => new Set([0]))
    const dragRef = React.useRef<{ startX: number; startY: number; moved: boolean } | null>(null)
    const suppressClickRef = React.useRef(false)

    React.useEffect(() => {
        setLoaded((prev) => {
            const next = new Set(prev)
            next.add(index)
            if (index > 0) next.add(index - 1)
            if (index < bounded.length - 1) next.add(index + 1)
            return next
        })
    }, [index, bounded.length])

    const go = React.useCallback(
        (delta: number) => {
            setIndex((i) => {
                const next = i + delta
                if (next < 0) return 0
                if (next >= bounded.length) return bounded.length - 1
                return next
            })
        },
        [bounded.length],
    )

    const hasMultiple = bounded.length > 1

    // ── Pointer + click disambiguation ───────────────────────────────────────
    // Pointer handlers detect the gesture; a click handler with `capture: true`
    // suppresses the anchor's navigation whenever we just paged the carousel.
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        dragRef.current = { startX: e.clientX, startY: e.clientY, moved: false }
    }

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return
        const dx = e.clientX - dragRef.current.startX
        const dy = e.clientY - dragRef.current.startY
        if (Math.abs(dx) > TAP_MOVE_TOLERANCE_PX || Math.abs(dy) > TAP_MOVE_TOLERANCE_PX) {
            dragRef.current.moved = true
        }
    }

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        const state = dragRef.current
        dragRef.current = null
        if (!state) return

        const dx = e.clientX - state.startX
        if (Math.abs(dx) >= SWIPE_THRESHOLD_PX && hasMultiple) {
            suppressClickRef.current = true
            if (dx < 0) go(1)
            else go(-1)
            return
        }
        if (state.moved) {
            // Any drag beyond tap tolerance but below swipe threshold — cancel the tap.
            suppressClickRef.current = true
        }
    }

    const handlePointerCancel = () => {
        dragRef.current = null
    }

    const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
        if (suppressClickRef.current) {
            suppressClickRef.current = false
            e.preventDefault()
            e.stopPropagation()
        }
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
            className={`relative w-full h-full select-none ${className}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onClickCapture={handleClickCapture}
            onKeyDown={handleKeyDown}
            tabIndex={hasMultiple ? 0 : -1}
            role={hasMultiple ? "group" : undefined}
            aria-roledescription={hasMultiple ? "carousel" : undefined}
            aria-label={hasMultiple ? `${alt} — ${bounded.length} photos` : undefined}
        >
            {/* Base link — receives taps. Swipes are cancelled via onClickCapture above. */}
            {href && (
                <Link
                    href={href}
                    className="absolute inset-0 z-0"
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                >
                    <span className="sr-only">{alt}</span>
                </Link>
            )}

            {/* Image layer — non-interactive so pointer events reach us, and drag can't start on the img element. */}
            <div className="absolute inset-0 pointer-events-none z-10">
                {bounded.map((src, i) => (
                    loaded.has(i) ? (
                        <Image
                            key={`${src}-${i}`}
                            src={src}
                            alt={i === 0 ? alt : `${alt} — image ${i + 1}`}
                            fill
                            sizes={sizes}
                            className={`${imageClassName} transition-opacity duration-300 ${i === index ? "opacity-100" : "opacity-0"}`}
                            loading={i === 0 ? "eager" : "lazy"}
                            draggable={false}
                        />
                    ) : (
                        <div
                            key={`ph-${i}`}
                            aria-hidden
                            className={`absolute inset-0 bg-[var(--bg-input)] ${i === index ? "opacity-100" : "opacity-0"}`}
                        />
                    )
                ))}
            </div>

            {/* Overlay slot (badges) — parent controls z-index for nested content */}
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
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerUp={(e) => e.stopPropagation()}
                        disabled={index === 0}
                        className="absolute left-2 top-1/2 -translate-y-1/2 z-30 h-8 w-8 rounded-full bg-black/50 backdrop-blur border border-white/10 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
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
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerUp={(e) => e.stopPropagation()}
                        disabled={index === bounded.length - 1}
                        className="absolute right-2 top-1/2 -translate-y-1/2 z-30 h-8 w-8 rounded-full bg-black/50 backdrop-blur border border-white/10 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
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

            {/* Single-image fallback (no images array; keeps SSR-friendly markup) */}
            {!hasMultiple && !bounded[0] && (
                <div className="absolute inset-0 bg-[var(--bg-input)]" />
            )}
        </div>
    )
}
