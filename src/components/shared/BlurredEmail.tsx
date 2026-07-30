"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { Mail, Lock } from "lucide-react"

interface BlurredEmailProps {
    /** Real email address, or null if the backend withheld it from an anonymous viewer */
    email: string | null
    /** Whether the seller has an email on file at all */
    emailAvailable: boolean
    className?: string
}

/**
 * Same gating pattern as BlurredPhone — the backend only sends the real
 * address to authenticated requests, so this just reflects what it was given.
 */
export function BlurredEmail({ email, emailAvailable, className = "" }: BlurredEmailProps) {
    const router = useRouter()
    const pathname = usePathname()

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

    return (
        <button
            type="button"
            onClick={() => router.push(`/auth/login?redirect=${encodeURIComponent(pathname || '/')}`)}
            className={`flex items-center gap-3 group bg-[var(--bg-input)] p-2.5 rounded-lg border border-[var(--border-default)] ${className}`}
        >
            <div className="bg-[var(--bg-card)] p-1.5 rounded-md group-hover:bg-primary/20 transition-colors">
                <Lock size={14} className="text-[var(--text-muted)] shrink-0" />
            </div>
            <span className="blur-[4px] select-none text-[var(--text-muted)] group-hover:blur-[3px] transition-all">email@hidden.com</span>
            <span className="text-primary text-xs font-bold whitespace-nowrap group-hover:underline">Log in to view</span>
        </button>
    )
}
