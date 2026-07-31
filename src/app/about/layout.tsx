import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "About Us — UK's Trusted Car Marketplace",
    description:
        "CarMazium is UK's trusted car marketplace. Learn about our mission to make buying and selling cars transparent, fair, and hassle-free.",
    openGraph: {
        title: "About CarMazium — UK's Trusted Car Marketplace",
        description:
            "Our mission: make buying and selling cars transparent, fair, and hassle-free.",
    },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
    return children
}
