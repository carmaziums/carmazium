import type { Metadata } from "next"
import { PageJsonLd } from "@/components/seo/PageJsonLd"

export const metadata: Metadata = {
    title: { absolute: "Contact CarMazium — Car Buying & Selling Support" },
    description:
        "Contact the CarMazium team for help with buying, selling, auctions, listings or other questions about the UK car marketplace.",
    alternates: {
        canonical: "/contact",
    },
    openGraph: {
        title: "Contact CarMazium — Car Buying & Selling Support",
        description:
            "Get help with buying, selling, auctions, listings or other CarMazium marketplace questions.",
        url: "/contact",
        type: "website",
    },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
    return <><PageJsonLd path="/contact" title="Contact CarMazium — Car Buying & Selling Support" type="ContactPage" description={metadata.description as string} />{children}</>
}
