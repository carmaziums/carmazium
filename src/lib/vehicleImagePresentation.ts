import type { CSSProperties } from "react"

export type VehicleImageFit = "cover" | "contain"
export type VehicleImageCategory = "EXTERIOR" | "INTERIOR" | "DAMAGE" | "UNASSIGNED"

export type VehicleImagePresentation = {
    src: string
    fit: VehicleImageFit
    x: number
    y: number
    zoom: number
    category: VehicleImageCategory
}

const VIEW_MARKER = "#cm-photo="

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

function inferVehicleImageCategory(src: string): VehicleImageCategory {
    const clean = src.toLowerCase()
    if (clean.includes("/exterior/")) return "EXTERIOR"
    if (clean.includes("/interior/")) return "INTERIOR"
    if (clean.includes("/damage/")) return "DAMAGE"
    return "UNASSIGNED"
}

function parseCategory(value: string | undefined, src: string): VehicleImageCategory {
    if (value === "EXTERIOR" || value === "INTERIOR" || value === "DAMAGE" || value === "UNASSIGNED") {
        return value
    }
    return inferVehicleImageCategory(src)
}

export function parseVehicleImagePresentation(
    value?: string | null,
    fallbackFit: VehicleImageFit = "cover",
): VehicleImagePresentation {
    const raw = value?.trim() || ""
    if (!raw) {
        return {
            src: "",
            fit: fallbackFit,
            x: 50,
            y: 50,
            zoom: 1,
            category: "UNASSIGNED",
        }
    }

    const markerIndex = raw.lastIndexOf(VIEW_MARKER)
    if (markerIndex === -1) {
        return {
            src: raw,
            fit: fallbackFit,
            x: 50,
            y: 50,
            zoom: 1,
            category: inferVehicleImageCategory(raw),
        }
    }

    const src = raw.slice(0, markerIndex)
    const [fitValue, xValue, yValue, zoomValue, categoryValue] = raw
        .slice(markerIndex + VIEW_MARKER.length)
        .split(",")
    const fit: VehicleImageFit = fitValue === "contain"
        ? "contain"
        : fitValue === "cover"
            ? "cover"
            : fallbackFit
    const x = Number(xValue)
    const y = Number(yValue)
    const zoom = Number(zoomValue)

    return {
        src,
        fit,
        x: Number.isFinite(x) ? clamp(x, 0, 100) : 50,
        y: Number.isFinite(y) ? clamp(y, 0, 100) : 50,
        zoom: Number.isFinite(zoom) ? clamp(zoom, 1, 2.5) : 1,
        category: parseCategory(categoryValue, src),
    }
}

export function encodeVehicleImagePresentation(
    value: string,
    presentation: Omit<VehicleImagePresentation, "src" | "category"> & {
        category?: VehicleImageCategory
    },
): string {
    const current = parseVehicleImagePresentation(value)
    const { src } = current
    if (!src) return ""

    const fit: VehicleImageFit = presentation.fit === "contain" ? "contain" : "cover"
    const x = Math.round(clamp(presentation.x, 0, 100))
    const y = Math.round(clamp(presentation.y, 0, 100))
    const zoom = clamp(presentation.zoom, 1, 2.5).toFixed(2)
    const category = presentation.category ?? current.category

    return `${src}${VIEW_MARKER}${fit},${x},${y},${zoom},${category}`
}

export function encodeVehicleImageCategory(
    value: string,
    category: VehicleImageCategory,
): string {
    const current = parseVehicleImagePresentation(value)
    if (!current.src) return ""

    return encodeVehicleImagePresentation(value, {
        fit: current.fit,
        x: current.x,
        y: current.y,
        zoom: current.zoom,
        category,
    })
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
