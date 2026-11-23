import type { Metadata } from "next"
export const metadata: Metadata = { title: "Request Vehicle Inspection", robots: { index: false, follow: false } }
export default function InspectionRequestLayout({ children }: { children: React.ReactNode }) { return children }
