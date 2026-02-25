import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Contact Us",
    description:
        "Get in touch with the CarMazium team. Whether you need help buying, selling, or have questions about our platform, we're here to help.",
    openGraph: {
        title: "Contact CarMazium",
        description:
            "Need help buying or selling a car? Reach out to the CarMazium team.",
    },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
    return children
}
