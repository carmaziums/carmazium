"use client"

import { CompareProvider } from "@/context/CompareContext"
import { CompareDrawer } from "@/components/features/CompareDrawer"

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <CompareProvider>
            {children}
            <CompareDrawer />
        </CompareProvider>
    )
}
