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
        <div className="pb-24 lg:pb-0">
            <Suspense fallback={null}>
                <ProfileCompletionGate>
                    {children}
                </ProfileCompletionGate>
            </Suspense>
        </div>
    )
}

