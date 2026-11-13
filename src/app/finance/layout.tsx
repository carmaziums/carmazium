import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Car Finance UK — Calculate Monthly Payments",
    description:
        "Apply from participating listings through Jigsaw Finance and Pulse Cars Limited. Finance providers should contact the CarMazium team directly.",
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
            "Buyer applications continue with Jigsaw Finance through Pulse Cars Limited. Finance providers should contact our team.",
        url: "/finance",
        type: "website",
    },
}

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
    return children
}
