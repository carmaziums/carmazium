"use client"

import * as React from "react"
import { apiClient } from "@/lib/apiClient"
import { BlurredPhone } from "@/components/shared/BlurredPhone"

interface ContactPhoneResponse {
    phone: string | null
    phoneAvailable: boolean
}

/**
 * Client-side island for the public seller profile page (which is otherwise
 * server-rendered and cached for SEO). Fetches the seller's contact phone
 * separately so the per-viewer auth gating doesn't require busting the SSR
 * page cache — the backend only returns the real number to logged-in callers.
 */
export function SellerContactPhone({ sellerId }: { sellerId: string }) {
    const [data, setData] = React.useState<ContactPhoneResponse | null>(null)

    React.useEffect(() => {
        let cancelled = false
        apiClient<{ data: ContactPhoneResponse }>(`/sellers/${sellerId}/phone`)
            .then(res => { if (!cancelled) setData(res.data) })
            .catch(() => { if (!cancelled) setData(null) })
        return () => { cancelled = true }
    }, [sellerId])

    if (!data || !data.phoneAvailable) return null

    return <BlurredPhone phone={data.phone} phoneAvailable={data.phoneAvailable} />
}
