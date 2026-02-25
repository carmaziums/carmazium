import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "How It Works — Simple Steps to Buy or Sell",
    description:
        "Buying or selling a car on CarMazium is easy. Learn how our step-by-step process works, from creating a listing to completing the sale.",
    openGraph: {
        title: "How It Works | CarMazium",
        description:
            "Learn how to buy or sell a car on CarMazium in a few simple steps.",
    },
}

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
    return children
}
