import type { Metadata } from "next"

// A request form is not a search result. Keep the public transport guide indexed.
export const metadata: Metadata = { title: "Request Vehicle Transport", robots: { index: false, follow: false } }

export default function TransportRequestLayout({ children }: { children: React.ReactNode }) {
    return children
}
