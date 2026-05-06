import { Suspense } from "react"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="pb-24 lg:pb-0">
            <Suspense fallback={null}>
                {children}
            </Suspense>
        </div>
    )
}

