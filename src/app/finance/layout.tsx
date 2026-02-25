import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Car Finance — Flexible Monthly Payments",
    description:
        "Get flexible car finance options from trusted UK lenders. Use our calculator to estimate monthly payments and apply online in minutes.",
    openGraph: {
        title: "Car Finance — Flexible Monthly Payments | CarMazium",
        description:
            "Estimate monthly payments and apply for car finance online in minutes.",
    },
}

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
    return children
}
