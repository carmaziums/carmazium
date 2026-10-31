"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function SellerListingsRedirect() {
    const router = useRouter()
    useEffect(() => {
        router.replace("/dashboard/user?tab=cars")
    }, [router])
    return null
}
