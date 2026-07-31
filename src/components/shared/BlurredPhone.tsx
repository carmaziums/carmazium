"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { Phone, Lock } from "lucide-react"

interface BlurredPhoneProps {
    /** Real phone number, or null if the backend withheld it from this viewer */
    phone: string | null
    /** Whether the seller has a phone number on file at all */
    phoneAvailable: boolean
    className?: string
    /**
     * Override for contexts where "log in" isn't why the number is withheld
     * (e.g. a live auction, where it unlocks only once this viewer has won
     * and paid the buyer fee). When set, the locked state renders as an inert
     * block with this message instead of a clickable "log in" prompt.
     */
    lockedMessage?: string
}

/**
 * Renders a seller's contact phone. The backend is the source of truth for
 * gating — it only sends the real number once the viewer is entitled to see
 * it — so this component just reflects what it was given: a real tel: link
 * if `phone` is present, a blurred "log in to view" prompt (or `lockedMessage`
 * if provided) if the number exists but was withheld, or nothing if the
 * seller has no phone on file.
 */
export function BlurredPhone({ phone, phoneAvailable, className = "", lockedMessage }: BlurredPhoneProps) {
    const router = useRouter()
    const pathname = usePathname()

    if (!phoneAvailable) return null

    if (phone) {
        return (
            <a
                href={`tel:${phone}`}
                className={`flex items-center gap-3 hover:text-primary dark:hover:text-white transition-colors bg-[var(--bg-input)] p-2.5 rounded-lg border border-[var(--border-default)] group ${className}`}
            >
                <div className="bg-[var(--bg-card)] p-1.5 rounded-md group-hover:bg-primary/20 transition-colors">
                    <Phone size={14} className="text-emerald-500 group-hover:text-primary transition-colors" />
                </div>
                <span className="font-medium text-emerald-500">{phone}</span>
            </a>
        )
    }

    if (lockedMessage) {
        return (
            <div className={`flex items-center gap-3 bg-[var(--bg-input)] p-2.5 rounded-lg border border-[var(--border-default)] ${className}`}>
                <div className="bg-[var(--bg-card)] p-1.5 rounded-md">
                    <Lock size={14} className="text-[var(--text-muted)] shrink-0" />
                </div>
                <span className="blur-[4px] select-none text-[var(--text-muted)]">07XXX XXXXXX</span>
                <span className="text-[var(--text-muted)] text-xs font-bold whitespace-nowrap">{lockedMessage}</span>
            </div>
        )
    }

    return (
        <button
            type="button"
            onClick={() => router.push(`/auth/login?redirect=${encodeURIComponent(pathname || '/')}`)}
            className={`flex items-center gap-3 group bg-[var(--bg-input)] p-2.5 rounded-lg border border-[var(--border-default)] ${className}`}
        >
            <div className="bg-[var(--bg-card)] p-1.5 rounded-md group-hover:bg-primary/20 transition-colors">
                <Lock size={14} className="text-[var(--text-muted)] shrink-0" />
            </div>
            <span className="blur-[4px] select-none text-[var(--text-muted)] group-hover:blur-[3px] transition-all">07XXX XXXXXX</span>
            <span className="text-primary text-xs font-bold whitespace-nowrap group-hover:underline">Log in to view</span>
        </button>
    )
}
