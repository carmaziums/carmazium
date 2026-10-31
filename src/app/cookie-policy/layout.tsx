import type { Metadata } from "next"

// The page itself is a client component (it opens the cookie preferences
// panel), so its metadata lives here. Without it the page shipped the
// homepage title and description, which search engines treat as a duplicate.
export const metadata: Metadata = {
    title: "Cookie Policy",
    description: "How CarMazium uses necessary, analytics and marketing cookies, and how to change your cookie preferences.",
    alternates: { canonical: "/cookie-policy" },
}

export default function CookiePolicyLayout({ children }: { children: React.ReactNode }) {
    return children
}
