"use client"

import * as React from "react"
import { AlertTriangle } from "lucide-react"
import { isPreviewEnvironment } from "@/lib/featureFlags"

/**
 * Marks a Vercel preview deployment as staging.
 *
 * This is not decoration. Staging shares production's backend and database, so
 * nothing here is a sandbox: an account created is a real account, a listing is
 * visible in real search results, and any checkout is a live Stripe charge on a
 * real card. Someone who mistakes this URL for a safe copy will find that out
 * expensively, so the warning is permanent and not dismissible.
 *
 * Renders nothing on production — `isPreviewEnvironment` is false there, and
 * the whole subtree disappears.
 */
export function StagingBanner() {
    if (!isPreviewEnvironment) return null

    return (
        <div
            role="alert"
            className="sticky top-0 z-[70] w-full bg-amber-500 text-black"
        >
            <div className="container mx-auto px-4 py-1.5 flex items-center justify-center gap-2 text-center">
                <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
                <p className="text-[11px] sm:text-xs font-black uppercase tracking-wider">
                    Staging — live data and real payments. Not a sandbox.
                </p>
            </div>
        </div>
    )
}
