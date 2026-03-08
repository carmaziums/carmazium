"use client"

import { CompareProvider } from "@/context/CompareContext"
import dynamic from "next/dynamic"

const CompareDrawer = dynamic(
    () => import("@/components/features/CompareDrawer").then(mod => mod.CompareDrawer),
    { ssr: false }
)

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <CompareProvider>
            {children}
            <CompareDrawer />
        </CompareProvider>
    )
}
