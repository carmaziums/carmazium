"use client"

import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/Button"

export function DealerCtaButton() {
    const { user } = useAuth()
    const href = user ? "/dashboard/partner" : "/auth/signup?role=dealer"

    return (
        <Button asChild size="lg">
            <Link href={href} className="whitespace-nowrap">
                {user ? "Open Partner Account" : "Create Partner Account"} <ArrowRight size={16} />
            </Link>
        </Button>
    )
}
