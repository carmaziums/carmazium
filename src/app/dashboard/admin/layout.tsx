import type { Metadata } from "next"
import { AdminAccessGate } from "@/components/dashboard/AdminAccessGate"

export const metadata: Metadata = {
    robots: { index: false, follow: false },
}

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
    return <AdminAccessGate>{children}</AdminAccessGate>
}
