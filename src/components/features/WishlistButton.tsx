"use client"

import * as React from "react"
import { Heart } from "lucide-react"
import { useRouter } from "next/navigation"
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from "@/lib/listingApi"
import { useAuth } from "@/context/AuthContext"

interface Props {
    listingId: string
    /** Initial state — skips the network check on mount when provided. */
    initialIsSaved?: boolean
    className?: string
    /** Compact `card` variant for card overlays. */
    variant?: "card" | "default"
}

/**
 * Save-to-wishlist heart button. Client-side; talks to /watchlist endpoints.
 * If the user isn't authenticated, apiClient auto-redirects to login.
 *
 * Placed as a card overlay — stops propagation on pointer + click events so a
 * tap on the heart never triggers the card's underlying link.
 */
export function WishlistButton({ listingId, initialIsSaved, className = "", variant = "card" }: Props) {
    const router = useRouter()
    const { user } = useAuth()
    const [saved, setSaved] = React.useState<boolean>(!!initialIsSaved)
    const [loading, setLoading] = React.useState(false)
    const [hydrated, setHydrated] = React.useState(initialIsSaved !== undefined)

    // Only hydrate when authenticated — /watchlist/check requires a session,
    // and the app's apiClient auto-redirects to /login on 401. An anonymous
    // page visit must not bounce every card into a redirect on mount.
    React.useEffect(() => {
        if (hydrated || !user) return
        let cancelled = false
        ;(async () => {
            try {
                const v = await isInWatchlist(listingId)
                if (!cancelled) {
                    setSaved(v)
                    setHydrated(true)
                }
            } catch {
                if (!cancelled) setHydrated(true)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [listingId, hydrated, user])

    const stop = (e: React.SyntheticEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
        stop(e)
        if (loading) return
        // Anonymous → route through login instead of hitting the API (which would
        // redirect anyway, but we control the return-to more precisely here).
        if (!user) {
            const returnTo = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/"
            router.push(`/auth/login?next=${encodeURIComponent(returnTo)}`)
            return
        }
        setLoading(true)
        const next = !saved
        setSaved(next)
        try {
            if (next) await addToWatchlist(listingId)
            else await removeFromWatchlist(listingId)
        } catch (err) {
            const msg = (err as Error).message
            if (msg === "AUTH_REDIRECT") return
            if (next && /already/i.test(msg)) return
            setSaved(!next)
        } finally {
            setLoading(false)
        }
    }

    const size = variant === "card" ? "h-8 w-8" : "h-10 w-10"
    const iconSize = variant === "card" ? 15 : 18
    const label = saved ? "Remove from wishlist" : "Add to wishlist"

    return (
        <button
            type="button"
            aria-label={label}
            aria-pressed={saved}
            title={label}
            onClick={handleClick}
            onPointerDown={stop}
            onPointerUp={stop}
            className={`${size} inline-flex items-center justify-center rounded-full backdrop-blur border transition-colors ${saved ? "bg-red-500/90 border-red-400/60 text-white" : "bg-black/50 border-white/10 text-white/85 hover:text-white hover:bg-black/60"} ${loading ? "opacity-70 cursor-progress" : ""} ${className}`}
        >
            <Heart size={iconSize} className={saved ? "fill-white" : ""} />
        </button>
    )
}
