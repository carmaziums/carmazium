"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import Link from "next/link"
import { X } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { getMarketingPopupConfig, type MarketingPopupConfig } from "@/lib/marketingApi"

const TRANSITION_MS = 200
const SESSION_KEY = "cz_marketing_popup_seen"
const SHOW_DELAY_MS = 1500
// Fallback shown only if the admin hasn't configured an image yet (config
// row exists with imageUrl: null) — keeps the popup working out of the box.
const DEFAULT_IMAGE = "/assets/images/promo-100-auction-popup.jpeg"
const DEFAULT_ALT = "We pay you £100 — auction your car now with Carmazium"

/**
 * One-time-per-session marketing promo for non-logged-in visitors, shown a
 * beat after landing on any page. Fully admin-configurable — see
 * /dashboard/admin/marketing-popup: the image and on/off state are read from
 * GET /marketing-popup at mount, not hardcoded.
 *
 * - Only shown to signed-out users (waits for auth state to resolve first,
 *   so a logged-in user never sees a flash of it before the check completes).
 * - Config fetch failing (network error, etc.) or `enabled: false` both mean
 *   the popup simply never shows — fail-safe, never fail-crash.
 * - sessionStorage flag means it reappears once per new tab/session, not
 *   endlessly on every page navigation within the same session.
 * - Deterministic mount/unmount + CSS transition (not framer-motion's
 *   AnimatePresence) — see ImageLightbox for why: AnimatePresence's exit
 *   animation got stuck in production when this pattern was first tried
 *   elsewhere on the site, leaving an invisible-but-interactive backdrop
 *   blocking the page. A plain setTimeout-driven unmount can't get stuck.
 * - Clicking the image navigates to the configured link (default /auctions);
 *   the X button, Escape, and backdrop click all close without navigating.
 */
export function MarketingPopup() {
    const { user, loading: authLoading } = useAuth()
    const [open, setOpen] = React.useState(false)
    const [shouldMount, setShouldMount] = React.useState(false)
    const [visible, setVisible] = React.useState(false)
    const closeBtnRef = React.useRef<HTMLButtonElement>(null)
    const previousFocusRef = React.useRef<HTMLElement | null>(null)
    const [domReady, setDomReady] = React.useState(false)
    const [config, setConfig] = React.useState<MarketingPopupConfig | null>(null)

    React.useEffect(() => { setDomReady(true) }, [])

    // Decide whether to show, once auth state has resolved and the admin
    // config has been fetched. Any failure to fetch config just means the
    // popup doesn't show this session — never blocks or breaks the page.
    React.useEffect(() => {
        if (authLoading || user) return
        if (typeof window === "undefined") return
        if (sessionStorage.getItem(SESSION_KEY)) return

        let cancelled = false
        let showTimer: number | undefined
        getMarketingPopupConfig()
            .then((cfg) => {
                if (cancelled || !cfg.enabled) return
                setConfig(cfg)
                showTimer = window.setTimeout(() => {
                    setOpen(true)
                    sessionStorage.setItem(SESSION_KEY, "1")
                }, SHOW_DELAY_MS)
            })
            .catch(() => { /* silently skip the popup this session */ })
        return () => {
            cancelled = true
            if (showTimer !== undefined) window.clearTimeout(showTimer)
        }
    }, [authLoading, user])

    // Deterministic mount/unmount: shouldMount controls DOM presence, visible
    // controls the CSS transition state.
    React.useEffect(() => {
        if (open) {
            setShouldMount(true)
            const t = window.setTimeout(() => setVisible(true), 10)
            return () => window.clearTimeout(t)
        }
        setVisible(false)
        const t = window.setTimeout(() => setShouldMount(false), TRANSITION_MS)
        return () => window.clearTimeout(t)
    }, [open])

    // Body scroll lock while open.
    React.useEffect(() => {
        if (!open) return
        const prev = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => { document.body.style.overflow = prev }
    }, [open])

    // Focus management: move to the close button on open, restore on close.
    React.useEffect(() => {
        if (!open) return
        previousFocusRef.current = (document.activeElement as HTMLElement) ?? null
        const t = window.setTimeout(() => closeBtnRef.current?.focus(), 120)
        return () => {
            window.clearTimeout(t)
            const target = previousFocusRef.current
            if (target && typeof target.focus === "function") target.focus()
        }
    }, [open])

    // Escape closes.
    React.useEffect(() => {
        if (!open) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault()
                setOpen(false)
            }
        }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [open])

    if (!domReady || !shouldMount) return null

    return createPortal(
        <div
            className={`fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity ease-out ${visible ? "opacity-100" : "opacity-0"}`}
            style={{ transitionDuration: `${TRANSITION_MS}ms` }}
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Carmazium promotion — auction your car and earn £100"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className={`relative w-full max-w-xs sm:max-w-sm transition-transform ease-out ${visible ? "scale-100" : "scale-95"}`}
                style={{ transitionDuration: `${TRANSITION_MS}ms` }}
            >
                <button
                    ref={closeBtnRef}
                    type="button"
                    aria-label="Close promotion"
                    onClick={() => setOpen(false)}
                    className="absolute -top-3 -right-3 z-10 h-9 w-9 rounded-full bg-black/85 hover:bg-black text-white flex items-center justify-center border border-white/20 shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/70"
                >
                    <X size={18} />
                </button>
                <Link
                    href={config?.linkUrl || "/auctions"}
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl overflow-hidden border border-primary/30 shadow-2xl shadow-black/60 hover:border-primary/50 transition-colors"
                >
                    <Image
                        src={config?.imageUrl || DEFAULT_IMAGE}
                        alt={DEFAULT_ALT}
                        width={1600}
                        height={1600}
                        className="w-full h-auto"
                        priority
                        sizes="(max-width: 400px) 90vw, 384px"
                        unoptimized
                    />
                </Link>
            </div>
        </div>,
        document.body,
    )
}
