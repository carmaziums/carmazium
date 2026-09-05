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

    return (
        <div className="min-h-[70vh] flex items-center justify-center px-5 py-20">
            <div className="w-full max-w-md text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
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
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[var(--border-default)] text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-primary/40 transition-colors"
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
            </div>
        </div>
    )
}
