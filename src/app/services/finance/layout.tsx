import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Vehicle Finance Enquiries UK",
    description: "Send a vehicle finance enquiry to approved matching providers through CarMazium TradeXchange. Providers set their own eligibility, rates and regulated terms.",
    alternates: { canonical: "/services/finance" },
    openGraph: {
        title: "Vehicle Finance Enquiries UK | CarMazium",
        description: "Send a vehicle finance enquiry to approved matching providers through CarMazium TradeXchange.",
        url: "/services/finance",
        type: "website",
    },
}

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
    return children
}
