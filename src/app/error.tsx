"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, RotateCcw, Home } from "lucide-react"

/**
 * Route-level error boundary (Next.js App Router convention).
 *
 * Catches any uncaught render-time exception thrown anywhere in this route
 * segment's tree. Without this file, such an error bubbles all the way up
 * and Next.js shows its bare generic overlay:
 *   "Application error: a client-side exception has occurred while loading
 *    carmazium.vercel.app (see the browser console for more information)"
 * — a dead end with no way back into the app.
 *
 * This renders a branded fallback instead, with a way to retry the failed
 * render (`reset()`) or escape back to the homepage.
 */
export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Surface to the console / any wired-up monitoring so the failure
        // is still diagnosable, even though the user sees a friendly page.
        console.error("Route error boundary caught:", error)
    }, [error])

    return (
        <div className="min-h-[70vh] flex items-center justify-center px-6 py-24">
            <div className="max-w-md w-full text-center space-y-5">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <AlertTriangle className="text-primary" size={28} />
                </div>
                <h1 className="text-xl font-bold font-heading text-[var(--text-primary)]">
                    Something went wrong
                </h1>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    We hit an unexpected error loading this page. Please try again —
                    if it keeps happening, heading back home and trying once more
                    usually fixes it.
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                        type="button"
                        onClick={() => reset()}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-red-600 text-white font-bold text-sm transition-colors"
                    >
                        <RotateCcw size={15} /> Try again
                    </button>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border-default)] hover:border-[var(--border-hover)] text-[var(--text-primary)] font-bold text-sm transition-colors"
                    >
                        <Home size={15} /> Go home
                    </Link>
                </div>
            </div>
        </div>
    )
}
