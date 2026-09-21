"use client"

import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"

const MaziumWidget = dynamic(
    () => import("@/components/features/MaziumWidget").then(mod => mod.MaziumWidget),
    { ssr: false }
)

export function MaziumWidgetLoader() {
    const pathname = usePathname()

    // The /sell page has one high-intent task: value and list a vehicle.
    // The general Mazium widget is a car-buying assistant, so suppress it here
    // to keep the Google Ads landing experience focused on the seller CTA.
    if (pathname?.startsWith("/sell")) return null

    return <MaziumWidget />
}
