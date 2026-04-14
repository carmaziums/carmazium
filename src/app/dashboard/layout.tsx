/**
 * Dashboard Layout
 * This layout wraps all dashboard pages and provides proper spacing
 * for the mobile bottom navigation bar.
 * Footer visibility is handled by ConditionalFooter in root layout.
 */
export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="pb-24 lg:pb-0">
            {children}
        </div>
    )
}

