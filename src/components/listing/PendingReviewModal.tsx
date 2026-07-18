"use client"

import { Hourglass } from "lucide-react"
import { Button } from "@/components/ui/Button"

interface PendingReviewModalProps {
    open: boolean
    onContinue: () => void
    listingTitle?: string
}

/**
 * Shown right after a listing is submitted (payment confirmed, or immediately
 * for FREE-tier auctions). Every new listing now goes through admin review
 * before it's publicly visible — this replaces any "your listing is live"
 * messaging at the point of submission.
 */
export function PendingReviewModal({ open, onContinue, listingTitle }: PendingReviewModalProps) {
    if (!open) return null

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-5">
            <div className="glass-card p-8 max-w-md w-full relative text-center">
                <div className="w-20 h-20 bg-amber-500/15 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-400">
                    <Hourglass size={40} />
                </div>
                <h2 className="text-2xl font-bold font-heading mb-3">Submitted for Review</h2>
                <p className="text-[var(--text-muted)] mb-2">
                    {listingTitle ? <>Your vehicle <strong className="text-[var(--text-primary)]">&ldquo;{listingTitle}&rdquo;</strong> has</> : "Your vehicle details have"} been submitted and {listingTitle ? "is" : "are"} now under review.
                </p>
                <p className="text-[var(--text-muted)] mb-8 text-sm">
                    Our team checks every new listing before it goes live. You&apos;ll get a notification as soon as it&apos;s approved — usually within a short while.
                </p>
                <Button onClick={onContinue} size="lg" className="w-full">
                    Got it
                </Button>
            </div>
        </div>
    )
}
