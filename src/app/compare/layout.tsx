import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Compare Cars Side-by-Side",
    description:
        "Compare up to 3 vehicles side-by-side on CarMazium — specs, pricing, mileage, and features, all in one view.",
    openGraph: {
        title: "Compare Cars Side-by-Side — CarMazium",
        description:
            "Compare up to 3 vehicles side-by-side — specs, pricing, mileage, and features, all in one view.",
    },
}

export default function CompareLayout({ children }: { children: React.ReactNode }) {
    return children
}
