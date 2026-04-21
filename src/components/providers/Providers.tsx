"use client"

import { CompareProvider } from "@/context/CompareContext"


export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <CompareProvider>
            {children}
        </CompareProvider>
    )
}
