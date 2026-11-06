import type { Metadata } from "next"
import Link from "next/link"
import { Hourglass } from "lucide-react"
import { Button } from "@/components/ui/Button"

/**
 * Confirmation page after a seller submits a vehicle for auction. It has its
 * own URL so marketing trackers can count a completed auction submission.
 */
export const metadata: Metadata = {
    title: "Vehicle submitted for approval",
    robots: { index: false, follow: false },
}

export default function AuctionSubmittedPage() {
    return (
        <main className="min-h-screen bg-[var(--bg-primary)] px-5 pb-20 pt-32">
            <div className="glass-card mx-auto max-w-md p-8 text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
                    <Hourglass size={40} aria-hidden="true" />
                </div>
                <h1 className="mb-3 font-heading text-2xl font-bold">Your vehicle has been submitted for approval</h1>
                <p className="mb-8 text-sm text-[var(--text-muted)]">
                    Thank you. Our team checks every vehicle before it goes into auction. You&apos;ll get a notification as soon as it&apos;s approved, usually within a short while.
                </p>
                <div className="flex flex-col gap-3">
                    <Button asChild size="lg" className="w-full">
                        <Link href="/dashboard/seller/auctions">View my auctions</Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="w-full">
                        <Link href="/sell">List another vehicle</Link>
                    </Button>
                </div>
            </div>
        </main>
    )
}
