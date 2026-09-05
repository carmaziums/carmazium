"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Lock, LogIn, UserPlus, Loader2 } from "lucide-react"
import { useAuth } from "@/context/AuthContext"

interface Props {
    children: React.ReactNode
    /** Shown above the buttons — say what signing in unlocks, not just that it's required. */
    message?: string
    title?: string
    /**
     * Rendered blurred behind the prompt as a teaser. Pass real content — the
     * point is to show there IS something here worth joining for. Only use
     * this where the underlying data is already public (see the note on the
     * blurred wrapper below); it is a conversion device, not a privacy one.
     */
    preview?: React.ReactNode
}

/**
 * Route-level authentication gate.
 *
 * WHY NOT MIDDLEWARE: the Supabase session is held in localStorage
 * (`sb-<ref>-auth-token`, see lib/supabase.ts), not a cookie. Next.js
 * middleware runs on the server and can only read cookies, so it would find no
 * session for ANYONE and bounce signed-in users too. The backend's `sid` cookie
 * is no help either — it belongs to the API origin, not this one. Protecting
 * routes server-side would mean migrating to @supabase/ssr cookie auth, which
 * touches every auth surface in the app; that is a deliberate decision, not
 * something to smuggle in behind a route guard.
 *
 * THE LOADING STATE IS NOT COSMETIC. `loading` stays true until AuthContext has
 * read localStorage and settled. Rendering the prompt during that window would
 * flash "please sign in" at users who are in fact signed in, on every hard
 * refresh — and rendering `children` would flash the protected content at
 * guests, which is the whole thing being prevented. Neither branch may run
 * until the answer is actually known.
 *
 * Deliberately an in-place prompt rather than a redirect to /auth/login: the
 * visitor keeps the URL they asked for, sees what they'd be signing in FOR,
 * and lands back here afterwards via ?redirect=.
 */
export function RequireAuth({
    children,
    title = "Sign up to enter the Trade Exchange",
    message = "Live and upcoming vehicle auctions are open to members. Joining takes a minute.",
    preview,
}: Props) {
    const { user, loading } = useAuth()
    const pathname = usePathname()

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        )
    }

    if (user) return <>{children}</>

    const redirect = encodeURIComponent(pathname || "/auctions")

    const promptBody = (
        <>
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 backdrop-blur-sm">
                <Lock size={26} className="text-primary" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black font-heading tracking-tight mb-3">
                {title}
            </h1>
            <p className="text-[var(--text-muted)] leading-relaxed mb-8">
                {message}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                    href={`/auth/signup?redirect=${redirect}`}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-black uppercase tracking-widest hover:bg-primary/90 transition-colors"
                >
                    <UserPlus size={16} /> Sign up
                </Link>
                <Link
                    href={`/auth/login?redirect=${redirect}`}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-body)]/60 text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-primary/40 transition-colors"
                >
                    <LogIn size={16} /> Sign in
                </Link>
            </div>

            {/* The marketing page stays public on purpose — it is what
                persuades a guest the account is worth creating. */}
            <p className="text-xs text-[var(--text-muted)] mt-8">
                New to auctions?{" "}
                <Link href="/auctions/how-it-works" className="text-primary font-semibold hover:underline">
                    See how it works
                </Link>
            </p>
        </>
    )

    // With a preview, the prompt floats over a blurred teaser; without one it
    // is just a centred card.
    if (preview) {
        return (
            <div className="relative min-h-[70vh]">
                {/*
                    `inert` (React 19) is doing real work here, not decoration.
                    A blur is only paint: without it the cards underneath stay
                    focusable and screen-reader readable, so a keyboard user
                    would tab into invisible links behind the wall. inert
                    removes the whole subtree from the tab order and the
                    accessibility tree, so the teaser is genuinely inert rather
                    than merely hard to see.

                    To be explicit about what this is: the blur is a conversion
                    device, not a privacy control. The auction API is public,
                    so nothing here is hidden from anyone who opens devtools —
                    which is exactly why showing real cars is acceptable. Do
                    not reuse this pattern for data that is actually meant to
                    be private.
                */}
                <div
                    inert
                    aria-hidden="true"
                    className="pointer-events-none select-none blur-[7px] opacity-50 saturate-75"
                >
                    {preview}
                </div>

                {/* Scrim so the prompt stays readable over whatever is behind. */}
                <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-body)]/70 via-[var(--bg-body)]/85 to-[var(--bg-body)]" />

                <div className="absolute inset-0 flex items-start justify-center px-5 pt-16 sm:pt-24">
                    <div className="w-full max-w-md text-center">
                        {promptBody}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-[70vh] flex items-center justify-center px-5 py-20">
            <div className="w-full max-w-md text-center">
                {promptBody}
            </div>
        </div>
    )
}
