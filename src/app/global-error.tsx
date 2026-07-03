"use client"

import { useEffect } from "react"
import Link from "next/link"
import "./globals.css"

/**
 * Root-level error boundary (Next.js App Router convention).
 *
 * `error.tsx` only catches errors thrown *below* the root layout. If the
 * root layout itself (or anything that wraps every page — providers,
 * header, etc.) throws during render, Next.js falls back to this file
 * instead. Per the framework's contract, `global-error.tsx` REPLACES the
 * root layout entirely while active, so it must render its own <html> and
 * <body> — and it must import the global stylesheet itself, since the
 * layout that normally does that has been replaced.
 *
 * Without this file, a root-layout-level crash shows Next.js's bare
 * generic overlay ("Application error: a client-side exception has
 * occurred while loading carmazium.vercel.app") with absolutely nothing
 * else on the page — no branding, no way back in. This gives the user a
 * branded, actionable fallback instead.
 *
 * Deliberately self-contained: no design-system imports, no context
 * providers (they may be exactly what crashed) — just safe, static
 * Tailwind utility classes.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error("Global (root layout) error boundary caught:", error)
    }, [error])

    return (
        <html lang="en">
            <body className="bg-[#0A0A0C] text-white antialiased">
                <div className="min-h-screen flex items-center justify-center px-6">
                    <div className="max-w-md w-full text-center space-y-5">
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ed1c24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                <path d="M12 9v4" />
                                <path d="M12 17h.01" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold">Something went wrong</h1>
                        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                            CarMazium hit an unexpected error loading this page. Please
                            try again — if it keeps happening, try reloading in a
                            different browser.
                        </p>
                        <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => reset()}
                                className="px-5 py-2.5 rounded-xl bg-[#ed1c24] hover:bg-red-600 text-white font-bold text-sm transition-colors"
                            >
                                Try again
                            </button>
                            <Link
                                href="/"
                                className="px-5 py-2.5 rounded-xl border border-[var(--border-default)] hover:border-white/20 text-white font-bold text-sm transition-colors"
                            >
                                Go home
                            </Link>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    )
}
