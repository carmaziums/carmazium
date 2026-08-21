"use client"

import Link from "next/link"
import { Cookie } from "lucide-react"
import { useConsent } from "@/context/ConsentContext"

/**
 * Bottom bar shown until the visitor makes a choice (or re-opened later via
 * the footer's "Cookie preferences" link). Rejecting doesn't break anything
 * on site — only the analytics/marketing scripts are gated, nothing
 * functional.
 */
export function CookieConsentBanner() {
    const { bannerOpen, acceptAll, rejectAll } = useConsent()

    if (!bannerOpen) return null

    return (
        <div className="fixed bottom-0 inset-x-0 z-[100] p-4 sm:p-5">
            <div className="max-w-4xl mx-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-dropdown)] shadow-2xl backdrop-blur-md p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Cookie size={18} className="text-primary" />
                </div>

                <p className="text-sm text-[var(--text-secondary)] leading-relaxed flex-1">
                    One cookie keeps you logged in — that&apos;s always on. Everything else (ad and traffic tracking) only
                    runs if you say yes. See{" "}
                    <Link href="/cookie-policy" className="text-primary hover:underline font-semibold">
                        Cookie Policy
                    </Link>{" "}
                    for the breakdown.
                </p>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                    <button
                        onClick={rejectAll}
                        className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] text-sm font-bold hover:bg-[var(--bg-card)] transition-colors"
                    >
                        Reject All
                    </button>
                    <button
                        onClick={acceptAll}
                        className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-black uppercase tracking-wide hover:bg-primary/90 transition-colors"
                    >
                        Accept All
                    </button>
                </div>
            </div>
        </div>
    )
}
