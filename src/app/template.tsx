"use client"

import { useEffect } from "react"

export default function Template({ children }: { children: React.ReactNode }) {
    // Force scroll to top on page transition
    useEffect(() => {
        window.scrollTo(0, 0)
    }, [])

    return (
        <div className="animate-page-in">
            {children}
        </div>
    )
}
