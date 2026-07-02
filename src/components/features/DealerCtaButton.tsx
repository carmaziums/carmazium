"use client"

import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/context/AuthContext"

export function DealerCtaButton() {
    const { user } = useAuth()
    const href = user ? "/dashboard/dealer" : "/auth/signup?role=dealer"

    return (
        <Link
            href={href}
            className="inline-flex items-center gap-2 bg-primary hover:bg-red-600 text-white font-bold px-8 py-3.5 rounded-xl transition-all shadow-neon whitespace-nowrap"
        >
            Apply as Dealer <ArrowRight size={16} />
        </Link>
    )
}
