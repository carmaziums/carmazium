"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import { X, ChevronLeft, ChevronRight } from "lucide-react"

const TRANSITION_MS = 200

interface Props {
    images: string[]
    alt: string
    startIndex?: number
    open: boolean
    onClose: () => void
}

/**
 * Full-screen image gallery for previewing a listing's photos without
 * leaving the browse grid.
 *
 * Requirements met:
 *  - Full-screen (fixed inset-0), image sized via object-contain so
 *    aspect ratio is preserved and the whole image fits the viewport.
 *  - Multi-image navigation via left/right buttons AND ArrowLeft/Right
 *    keys. Native horizontal scroll-snap gives real touch swipe on
 *    mobile with momentum — no bespoke gesture code.
 *  - Close (X) button top-LEFT + backdrop-click + Escape all close.
 *  - Body scroll locked while open.
 *  - Fade + subtle scale in/out via plain CSS transition, with a
 *    setTimeout-driven unmount (see shouldMount/visible below) so the
 *    element is deterministically removed from the DOM — an earlier
 *    framer-motion AnimatePresence version left an invisible-but-fully-
 *    interactive backdrop stuck in the DOM after close (exit animation
 *    never resolved when many carousel instances shared the page),
 *    which silently blocked clicks on the whole page underneath it.
 *  - Accessibility: role=dialog + aria-modal + descriptive aria-label,
 *    focus moves to the close button on open, previously-focused
 *    element receives focus back on close, Tab is trapped inside the
 *    modal, all interactive controls have accessible names + focus
 *    rings.
 *  - Responsive: padding + control sizing collapses at mobile widths.
 */
export function ImageLightbox({ images, alt, startIndex = 0, open, onClose }: Props) {
    const [index, setIndex] = React.useState(startIndex)
    const trackRef = React.useRef<HTMLDivElement>(null)
    const dialogRef = React.useRef<HTMLDivElement>(null)
    const closeBtnRef = React.useRef<HTMLButtonElement>(null)
    const previousFocusRef = React.useRef<HTMLElement | null>(null)

    React.useEffect(() => {
        if (open) setIndex(startIndex)
    }, [open, startIndex])

    // Position the scroll track at startIndex once the track is mounted.
    // A short setTimeout, not rAF (see the mount-lifecycle effect below for
    // why) — the track needs a layout pass before scrollTo's clientWidth
    // read is meaningful.
    React.useEffect(() => {
        if (!open) return
        const el = trackRef.current
        if (!el) return
        const t = window.setTimeout(() => {
            el.scrollTo({ left: startIndex * el.clientWidth, behavior: "auto" })
        }, 10)
        return () => window.clearTimeout(t)
    }, [open, startIndex])

    // Body scroll lock — restore the original overflow on close so we
    // don't strand the page in overflow:hidden.
    React.useEffect(() => {
        if (!open) return
        const prev = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => { document.body.style.overflow = prev }
    }, [open])

    // Focus management: remember who had focus, move focus to the close
    // button, restore focus to the original element on close.
    React.useEffect(() => {
        if (!open) return
        previousFocusRef.current = (document.activeElement as HTMLElement) ?? null
        const t = window.setTimeout(() => closeBtnRef.current?.focus(), 120)
        return () => {
            window.clearTimeout(t)
            const target = previousFocusRef.current
            if (target && typeof target.focus === "function") {
                target.focus()
            }
        }
    }, [open])

    const scrollBy = React.useCallback((delta: number) => {
        const el = trackRef.current
        if (!el) return
        const clamped = Math.max(0, Math.min(images.length - 1, index + delta))
        el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" })
        // Update the counter immediately so users get feedback while the
        // smooth scroll animates. IntersectionObserver will confirm on settle.
        setIndex(clamped)
    }, [images.length, index])

    const goTo = React.useCallback((target: number) => {
        const el = trackRef.current
        if (!el) return
        const clamped = Math.max(0, Math.min(images.length - 1, target))
        el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" })
        setIndex(clamped)
    }, [images.length])

    // Keyboard: Esc closes, arrows navigate, Tab is trapped inside the
    // dialog so keyboard users can't wander into the background page.
    React.useEffect(() => {
        if (!open) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault()
                onClose()
                return
            }
            if (e.key === "ArrowLeft") {
                e.preventDefault()
                scrollBy(-1)
                return
            }
            if (e.key === "ArrowRight") {
                e.preventDefault()
                scrollBy(1)
                return
            }
            if (e.key === "Tab") {
                const dialog = dialogRef.current
                if (!dialog) return
                const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )).filter(el => el.offsetParent !== null)
                if (focusables.length === 0) return
                const first = focusables[0]
                const last = focusables[focusables.length - 1]
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault()
                    last.focus()
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault()
                    first.focus()
                }
            }
        }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [open, onClose, scrollBy])

    // IntersectionObserver is the source of truth for which slide is active —
    // it fires reliably for both native touch swipe and programmatic scrollTo,
    // whereas the raw `scroll` event on this snap container has been
    // inconsistent in practice (and framer-motion wrappers can eat React's
    // `onScroll` prop). The button/keyboard handlers below also nudge `index`
    // directly for instant counter feedback while the smooth scroll animates.
    React.useEffect(() => {
        if (!open) return
        const root = trackRef.current
        if (!root) return
        const slides = root.querySelectorAll<HTMLElement>("[data-slide-index]")
        if (slides.length === 0) return
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                        const i = Number(entry.target.getAttribute("data-slide-index"))
                        if (!Number.isNaN(i)) setIndex((prev) => (prev === i ? prev : i))
                    }
                })
            },
            { root, threshold: [0.5, 0.9] },
        )
        slides.forEach((s) => observer.observe(s))
        return () => observer.disconnect()
    }, [open, images.length])

    // Deterministic mount/unmount: `shouldMount` controls DOM presence,
    // `visible` controls the CSS transition state. On open we mount first,
    // then flip to visible a frame later so the transition actually runs.
    // On close we flip visible off immediately (starts the fade-out) and
    // unmount via a plain setTimeout matched to TRANSITION_MS — this is a
    // deterministic remove-from-DOM regardless of how the animation is
    // rendered, so the backdrop can never get stuck invisible-but-present.
    const [shouldMount, setShouldMount] = React.useState(false)
    const [visible, setVisible] = React.useState(false)

    React.useEffect(() => {
        if (open) {
            setShouldMount(true)
            // A short setTimeout, not requestAnimationFrame — rAF is fully
            // suspended by spec while the document is hidden (backgrounded
            // tab), which would leave this stuck un-animated-in. setTimeout
            // isn't gated by page visibility for a one-shot delay this short.
            const t = window.setTimeout(() => setVisible(true), 10)
            return () => window.clearTimeout(t)
        }
        setVisible(false)
        const t = window.setTimeout(() => setShouldMount(false), TRANSITION_MS)
        return () => window.clearTimeout(t)
    }, [open])

    // Portal into document.body so the modal escapes any ancestor with a
    // `transform` / `filter` / `will-change` that would otherwise establish
    // a containing block for `position: fixed` — the vehicle card sets
    // `transform: translateZ(0)` on its image wrapper, which without this
    // would clip a `fixed inset-0` modal to the card's image area instead
    // of the viewport.
    const [domReady, setDomReady] = React.useState(false)
    React.useEffect(() => { setDomReady(true) }, [])
    if (!domReady || !shouldMount || images.length === 0) return null

    return createPortal(
        <div
            ref={dialogRef}
            className={`fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center transition-opacity ease-out ${visible ? "opacity-100" : "opacity-0"}`}
            style={{ transitionDuration: `${TRANSITION_MS}ms` }}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={`${alt} — image gallery`}
        >
            {/* Close button — top-left per spec */}
            <button
                ref={closeBtnRef}
                type="button"
                aria-label="Close image preview"
                onClick={(e) => { e.stopPropagation(); onClose() }}
                className="absolute top-3 left-3 md:top-4 md:left-4 z-20 h-10 w-10 md:h-11 md:w-11 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-white/70"
            >
                <X size={20} />
            </button>

            {/* Counter — top-right */}
            <div className="absolute top-3 right-3 md:top-4 md:right-4 z-20 pointer-events-none">
                <span className="text-white text-xs md:text-sm font-semibold bg-black/60 px-3 py-1.5 rounded-full">
                    {index + 1} / {images.length}
                </span>
            </div>

            {/* Image track — clicks inside must not close the modal (only
                backdrop clicks do). Scale transition tied to `visible` gives
                the modal a soft zoom-in/out to match the backdrop's fade. */}
            <div
                ref={trackRef}
                onClick={(e) => e.stopPropagation()}
                className={`w-full h-full flex overflow-x-auto snap-x snap-mandatory transition-transform ease-out [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${visible ? "scale-100" : "scale-95"}`}
                style={{ overscrollBehaviorX: "contain", transitionDuration: `${TRANSITION_MS}ms` }}
            >
                {images.map((src, i) => (
                    <div key={`${src}-${i}`} data-slide-index={i} className="relative w-full h-full flex-shrink-0 snap-start snap-always flex items-center justify-center p-4 md:p-16">
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
                        className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-black/60 hover:bg-black/80 text-white items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white/70"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <button
                        type="button"
                        aria-label="Next image"
                        onClick={(e) => { e.stopPropagation(); scrollBy(1) }}
                        disabled={index === images.length - 1}
                        className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-black/60 hover:bg-black/80 text-white items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white/70"
                    >
                        <ChevronRight size={24} />
                    </button>
                </>
            )}

            {/* Thumbnail strip — desktop only */}
            {images.length > 1 && (
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="hidden md:flex absolute bottom-4 left-1/2 -translate-x-1/2 z-20 max-w-[80vw] gap-2 overflow-x-auto p-2 bg-black/40 rounded-xl"
                >
                    {images.map((src, i) => (
                        <button
                            key={`thumb-${i}`}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); goTo(i) }}
                            aria-label={`Go to image ${i + 1}`}
                            aria-current={i === index ? "true" : undefined}
                            className={`relative h-16 w-24 flex-shrink-0 rounded overflow-hidden border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-white/70 ${i === index ? "border-white" : "border-transparent opacity-60 hover:opacity-100"}`}
                        >
                            <Image src={src} alt="" fill sizes="96px" className="object-cover" draggable={false} />
                        </button>
                    ))}
                </div>
            )}
        </div>,
        document.body,
    )
}
