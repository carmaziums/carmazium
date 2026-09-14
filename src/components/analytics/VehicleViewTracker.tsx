"use client"

import { useEffect, useRef } from "react"
import { useAnalytics } from "@/hooks/useAnalytics"
import { useConsent } from "@/context/ConsentContext"

interface VehicleViewTrackerProps {
    id: string
    title?: string | null
    make?: string | null
    model?: string | null
    year?: string | number | null
    price?: string | number | null
    listingType?: string | null
}

/**
 * Records a real vehicle detail view once per mounted listing.
 * Registration/VRM, seller details, phone, email and postcode are deliberately
 * excluded from every destination.
 */
export function VehicleViewTracker({
    id,
    title,
    make,
    model,
    year,
    price,
    listingType,
}: VehicleViewTrackerProps) {
    const { granted } = useConsent()
    const { trackEvent } = useAnalytics()
    const trackedId = useRef<string | null>(null)

    useEffect(() => {
        if (!granted || !id || trackedId.current === id) return
        trackedId.current = id

        const numericPrice = Number(price)
        const hasPrice = Number.isFinite(numericPrice) && numericPrice >= 0
        const item = {
            item_id: id,
            item_name: title || undefined,
            item_category: "vehicle",
            item_brand: make || undefined,
            item_variant: model || undefined,
            price: hasPrice ? numericPrice : undefined,
        }

        trackEvent("view_item", {
            currency: hasPrice ? "GBP" : undefined,
            value: hasPrice ? numericPrice : undefined,
            item_id: id,
            item_name: title || undefined,
            item_category: "vehicle",
            make: make || undefined,
            model: model || undefined,
            year: year ?? undefined,
            listing_type: listingType?.toLowerCase() || undefined,
            items: [item],
        })
    }, [granted, id, title, make, model, year, price, listingType, trackEvent])

    return null
}
