import type { Metadata } from "next"
export const metadata: Metadata = { title: "Your Warranty Order", robots: { index: false, follow: false } }
export default function WarrantyOrderLayout({ children }: { children: React.ReactNode }) { return children }
