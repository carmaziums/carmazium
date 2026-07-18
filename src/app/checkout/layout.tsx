import type { Metadata } from "next"

// Checkout, checkout/success, and checkout/cancel are transactional,
// session-specific pages — never indexable.
export const metadata: Metadata = {
    robots: { index: false, follow: false },
}

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
    return children
}
