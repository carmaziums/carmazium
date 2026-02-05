"use client"

import { usePathname } from "next/navigation"
import { Footer } from "./Footer"

/**
 * ConditionalFooter
 * Renders footer conditionally based on the current route.
 * Hides footer on dashboard pages (mobile has bottom nav that conflicts).
 */
export function ConditionalFooter() {
    const pathname = usePathname()

    // Hide footer on dashboard pages
    const isDashboard = pathname?.startsWith('/dashboard')

    if (isDashboard) {
        // On mobile, don't show footer at all (bottom nav is shown)
        // On desktop, show footer
        return (
            <div className="hidden lg:block">
                <Footer />
            </div>
        )
    }

    return <Footer />
}
