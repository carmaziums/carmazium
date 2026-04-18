"use client"

import dynamic from "next/dynamic"

const MaziumWidget = dynamic(
    () => import("@/components/features/MaziumWidget").then(mod => mod.MaziumWidget),
    { ssr: false }
)

export function MaziumWidgetLoader() {
    return <MaziumWidget />
}
