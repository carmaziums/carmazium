import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Sell Your Car — List for Free",
    description:
        "Sell your car quickly and for free on CarMazium. Create a listing in minutes with our step-by-step wizard, DVLA auto-fill, and reach thousands of UK buyers.",
    openGraph: {
        title: "Sell Your Car — List for Free on CarMazium",
        description:
            "Create a listing in minutes. DVLA auto-fill, transparent pricing, reach thousands of buyers in UK.",
    },
}

export default function SellLayout({ children }: { children: React.ReactNode }) {
    return children
}
