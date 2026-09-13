import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Car Finance UK — Calculate Monthly Payments",
    description:
        "Explore car finance options on CarMazium and estimate monthly vehicle payments with our car finance calculator before making an enquiry.",
    keywords: [
        "car finance UK",
        "car finance calculator",
        "used car finance UK",
        "vehicle finance UK",
        "monthly car payments",
        "CarMazium finance",
    ],
    alternates: {
        canonical: "/finance",
    },
    openGraph: {
        title: "Car Finance UK — Calculate Monthly Payments | CarMazium",
        description:
            "Explore car finance options and estimate monthly vehicle payments before making an enquiry on CarMazium.",
        url: "/finance",
        type: "website",
    },
}

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
    return children
}
