import type { Metadata } from "next"

// Private customer workspace: never index sign-in placeholders or account data.
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function PrivateServiceLayout({ children }: { children: React.ReactNode }) {
    return children
}
