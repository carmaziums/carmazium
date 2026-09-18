"use client"

import * as React from "react"
import { Heart, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import {
    addToWatchlist,
    isInWatchlist,
    removeFromWatchlist,
} from "@/lib/listingApi"

interface SaveCarButtonProps {
    listingId: string
    redirectHref: string
    className?: string
}

type WatchlistChangedDetail = {
    listingId: string
    saved: boolean
}

export function SaveCarButton({ listingId, redirectHref, className = "" }: SaveCarButtonProps) {
    const { user, loading: authLoading } = useAuth()
    const router = useRouter()
    const [saved, setSaved] = React.useState(false)
    const [loading, setLoading] = React.useState(false)

    React.useEffect(() => {
        if (authLoading || !user) {
            if (!authLoading) setSaved(false)
            return
        }

        let cancelled = false
        isInWatchlist(listingId)
            .then((value) => { if (!cancelled) setSaved(value) })
            .catch(() => { })

        return () => { cancelled = true }
    }, [authLoading, user, listingId])

    React.useEffect(() => {
        const sync = (event: Event) => {
            const detail = (event as CustomEvent<WatchlistChangedDetail>).detail
            if (detail?.listingId === listingId) setSaved(detail.saved)
        }
        window.addEventListener("carmazium:watchlist-changed", sync)
        return () => window.removeEventListener("carmazium:watchlist-changed", sync)
    }, [listingId])

    const toggle = async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault()
        event.stopPropagation()

        if (!user) {
            router.push("/auth/login?redirect=" + encodeURIComponent(redirectHref))
            return
        }
        if (loading) return

        const nextSaved = !saved
        setLoading(true)
        setSaved(nextSaved)

        try {
            if (nextSaved) await addToWatchlist(listingId)
            else await removeFromWatchlist(listingId)

            window.dispatchEvent(new CustomEvent<WatchlistChangedDetail>("carmazium:watchlist-changed", {
                detail: { listingId, saved: nextSaved },
            }))
        } catch {
            setSaved(!nextSaved)
        } finally {
            setLoading(false)
        }
    }

    const visualClass = saved
        ? "bg-red-500/90 border-red-400/60 text-white"
        : "bg-black/55 border-white/20 text-white hover:bg-black/75 hover:border-red-400/60 hover:text-red-300"

    return (
        <button
            type="button"
            onClick={toggle}
            disabled={loading}
            aria-label={saved ? "Remove from Saved Cars" : "Save car"}
            title={saved ? "Saved — tap to remove" : "Save car"}
            className={"w-11 h-11 rounded-full border backdrop-blur-md flex items-center justify-center shadow-lg transition-all disabled:opacity-60 " + visualClass + " " + className}
        >
            {loading
                ? <Loader2 size={18} className="animate-spin" />
                : <Heart size={19} className={saved ? "fill-current" : ""} />}
        </button>
    )
}
