"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { Phone, Lock } from "lucide-react"

interface BlurredPhoneProps {
    /** Real phone number, or null if the backend withheld it from an anonymous viewer */
    phone: string | null
    /** Whether the seller has a phone number on file at all */
    phoneAvailable: boolean
    className?: string
}

/**
 * Renders a seller's contact phone. The backend is the source of truth for
 * gating — it only sends the real number to authenticated requests — so this
 * component just reflects what it was given: a real tel: link if `phone` is
 * present, a blurred "log in to view" prompt if the number exists but was
 * withheld, or nothing if the seller has no phone on file.
 */
export function BlurredPhone({ phone, phoneAvailable, className = "" }: BlurredPhoneProps) {
    const router = useRouter()
    const pathname = usePathname()

    if (!phoneAvailable) return null

    if (phone) {
        return (
            <a
                href={`tel:${phone}`}
                className={`flex items-center gap-2 text-emerald-500 hover:text-primary dark:hover:text-white transition-colors ${className}`}
            >
                <Phone size={14} className="text-emerald-500 shrink-0" /> {phone}
            </a>
        )
    }

    return (
        <button
            type="button"
            onClick={() => router.push(`/auth/login?redirect=${encodeURIComponent(pathname || '/')}`)}
            className={`flex items-center gap-2 group ${className}`}
        >
            <Lock size={14} className="text-[var(--text-muted)] shrink-0" />
            <span className="blur-[4px] select-none text-[var(--text-muted)] group-hover:blur-[3px] transition-all">07XXX XXXXXX</span>
            <span className="text-primary text-xs font-bold whitespace-nowrap group-hover:underline">Log in to view</span>
        </button>
    )
}
