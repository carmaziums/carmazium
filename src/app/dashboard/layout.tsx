import { Suspense } from "react"
import type { Metadata } from "next"
import { ProfileCompletionGate } from "@/components/dashboard/ProfileCompletionGate"

// Everything under /dashboard is behind auth and role-gated — never indexable.
export const metadata: Metadata = {
    robots: { index: false, follow: false },
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        // Phones: leave room for the bottom tab bar plus the assistant
        // launcher above it, so the last card on a page can always be
        // scrolled clear of both instead of sitting underneath them.
        <div className="pb-40 lg:pb-0">
            <Suspense fallback={null}>
                <ProfileCompletionGate>
                    {children}
                </ProfileCompletionGate>
            </Suspense>
        </div>
    )
}

