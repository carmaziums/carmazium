import type { CSSProperties } from "react"

export type VehicleImageFit = "cover" | "contain"

export type VehicleImagePresentation = {
    src: string
    fit: VehicleImageFit
    x: number
    y: number
    zoom: number
}

const VIEW_MARKER = "#cm-photo="

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export function parseVehicleImagePresentation(
    value?: string | null,
    fallbackFit: VehicleImageFit = "cover",
): VehicleImagePresentation {
    const raw = value?.trim() || ""
    if (!raw) return { src: "", fit: fallbackFit, x: 50, y: 50, zoom: 1 }

    const markerIndex = raw.lastIndexOf(VIEW_MARKER)
    if (markerIndex === -1) {
        return { src: raw, fit: fallbackFit, x: 50, y: 50, zoom: 1 }
    }

    const src = raw.slice(0, markerIndex)
    const [fitValue, xValue, yValue, zoomValue] = raw.slice(markerIndex + VIEW_MARKER.length).split(",")
    const fit: VehicleImageFit = fitValue === "contain" ? "contain" : fitValue === "cover" ? "cover" : fallbackFit
    const x = Number(xValue)
    const y = Number(yValue)
    const zoom = Number(zoomValue)

    return {
        src,
        fit,
        x: Number.isFinite(x) ? clamp(x, 0, 100) : 50,
        y: Number.isFinite(y) ? clamp(y, 0, 100) : 50,
        zoom: Number.isFinite(zoom) ? clamp(zoom, 1, 2.5) : 1,
    }
}

export function encodeVehicleImagePresentation(
    value: string,
    presentation: Omit<VehicleImagePresentation, "src">,
): string {
    const { src } = parseVehicleImagePresentation(value)
    if (!src) return ""

    const fit: VehicleImageFit = presentation.fit === "contain" ? "contain" : "cover"
    const x = Math.round(clamp(presentation.x, 0, 100))
    const y = Math.round(clamp(presentation.y, 0, 100))
    const zoom = clamp(presentation.zoom, 1, 2.5).toFixed(2)

    return `${src}${VIEW_MARKER}${fit},${x},${y},${zoom}`
}

export function vehicleImageStyle(value?: string | null, fallbackFit: VehicleImageFit = "cover") {
    const presentation = parseVehicleImagePresentation(value, fallbackFit)
    return {
        src: presentation.src,
        style: {
            objectFit: presentation.fit,
            objectPosition: `${presentation.x}% ${presentation.y}%`,
            transform: `scale(${presentation.zoom})`,
            transformOrigin: `${presentation.x}% ${presentation.y}%`,
        } as CSSProperties,
    }
}
