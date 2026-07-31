import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Service Hub — MOT, Servicing & Repairs",
    description:
        "Find trusted mechanics, MOT testing centres, and servicing options near you in UK. Compare quotes and book online through CarMazium.",
    openGraph: {
        title: "Service Hub — MOT, Servicing & Repairs | CarMazium",
        description:
            "Find trusted mechanics and book MOT, servicing, or repairs near you in UK.",
    },
}

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
    return children
}
