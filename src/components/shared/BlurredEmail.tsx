"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Mail, Eye } from "lucide-react"
import { LoginWall } from "@/components/auth/LoginWall"

interface BlurredEmailProps {
    /** Real email address, or null if the backend withheld it from this viewer */
    email: string | null
    /** Whether the seller has an email on file at all */
    emailAvailable: boolean
    className?: string
    /**
     * Override for contexts where "log in" isn't why the address is withheld
     * (e.g. a live auction, where it unlocks only once this viewer has won
     * and paid the buyer fee). When set, the locked state renders as an inert
     * block with this message instead of a clickable "log in" prompt.
     */
    lockedMessage?: string
}

/**
 * Same gating pattern as BlurredPhone — the backend is the source of truth
 * for gating, so this just reflects what it was given: a real mailto: link
 * if `email` is present, a blurred "log in to view" prompt (or `lockedMessage`
 * if provided) if the address exists but was withheld, or nothing if the
 * seller has no email on file.
 */
export function BlurredEmail({ email, emailAvailable, className = "", lockedMessage }: BlurredEmailProps) {
    const pathname = usePathname()
    const [showLoginWall, setShowLoginWall] = React.useState(false)

    if (!emailAvailable) return null

    if (email) {
        return (
            <a
                href={`mailto:${email}`}
                className={`flex items-center gap-3 hover:text-primary dark:hover:text-white transition-colors bg-[var(--bg-input)] p-2.5 rounded-lg border border-[var(--border-default)] group ${className}`}
            >
                <div className="bg-[var(--bg-card)] p-1.5 rounded-md group-hover:bg-primary/20 transition-colors">
                    <Mail size={14} className="text-[var(--text-muted)] group-hover:text-primary transition-colors" />
                </div>
                <span className="font-medium truncate">{email}</span>
            </a>
        )
    }

    if (lockedMessage) {
        return (
            <div className={`flex items-center gap-3 bg-[var(--bg-input)] p-2.5 rounded-lg border border-[var(--border-default)] ${className}`}>
                <div className="bg-[var(--bg-card)] p-1.5 rounded-md">
                    <Mail size={14} className="text-[var(--text-muted)] shrink-0" />
                </div>
                <span className="blur-[4px] select-none text-[var(--text-muted)]">email@hidden.com</span>
                <span className="text-[var(--text-muted)] text-xs font-bold whitespace-nowrap">{lockedMessage}</span>
            </div>
        )
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setShowLoginWall(true)}
                className={`flex items-center gap-3 group bg-[var(--bg-input)] p-2.5 rounded-lg border border-[var(--border-default)] ${className}`}
            >
                <div className="bg-[var(--bg-card)] p-1.5 rounded-md group-hover:bg-primary/20 transition-colors">
                    <Eye size={14} className="text-[var(--text-muted)] group-hover:text-primary shrink-0 transition-colors" />
                </div>
                <span className="blur-[4px] select-none text-[var(--text-muted)] group-hover:blur-[3px] transition-all">email@hidden.com</span>
                <span className="text-primary text-xs font-bold whitespace-nowrap group-hover:underline">Reveal email</span>
            </button>
            <LoginWall
                open={showLoginWall}
                onClose={() => setShowLoginWall(false)}
                redirectTo={pathname || '/'}
                message="Log in or create an account to view this seller's email address."
            />
        </>
    )
}
