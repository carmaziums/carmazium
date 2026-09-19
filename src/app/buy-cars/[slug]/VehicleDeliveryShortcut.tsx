"use client"

import Link from "next/link"
import { Truck } from "lucide-react"
import { deliveryServiceEnabled } from "@/lib/featureFlags"

interface VehicleDeliveryShortcutProps {
    listing: {
        id: string
        title: string
        status?: string | null
        vrm?: string | null
        make?: string | null
        model?: string | null
        year?: number | null
        location?: string | null
    }
}

export function VehicleDeliveryShortcut({ listing }: VehicleDeliveryShortcutProps) {
    if (!deliveryServiceEnabled || listing.status !== "ACTIVE") return null

    const params = new URLSearchParams({
        listingId: listing.id,
        vehicleTitle: listing.title,
    })

    if (listing.vrm) params.set("registration", listing.vrm)
    if (listing.make) params.set("make", listing.make)
    if (listing.model) params.set("model", listing.model)
    if (listing.year) params.set("year", String(listing.year))
    if (listing.location) params.set("pickup", listing.location)

    return (
        <Link
            href={`/services/delivery/new?${params.toString()}`}
            className="fixed z-40 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-[5.5rem] lg:bottom-7 lg:right-7 inline-flex items-center gap-2.5 sm:gap-3 rounded-2xl bg-primary px-3 py-2.5 sm:px-4 sm:py-3.5 text-white shadow-2xl shadow-black/30 hover:bg-primary/90 transition-colors max-w-[calc(100vw-6.5rem)] lg:max-w-[calc(100vw-3.5rem)]"
            aria-label={`Get ${listing.title} delivered`}
        >
            <span className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Truck size={19} />
            </span>
            <span className="text-left leading-tight min-w-0">
                <span className="block text-sm font-black whitespace-nowrap">Get this car delivered</span>
                <span className="hidden sm:block text-[10px] text-white/80 mt-0.5">Post a job · compare provider quotes</span>
            </span>
        </Link>
    )
}
