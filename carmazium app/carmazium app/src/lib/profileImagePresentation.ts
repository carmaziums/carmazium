export type ProfileImageFit = "cover" | "contain"

export type ProfileImagePresentation = {
    src: string
    fit: ProfileImageFit
    x: number
    y: number
    zoom: number
}

const VIEW_MARKER = "#cm-view="

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export function parseProfileImagePresentation(
    value?: string | null,
    fallbackFit: ProfileImageFit = "cover",
): ProfileImagePresentation {
    const raw = value?.trim() || ""
    if (!raw) {
        return { src: "", fit: fallbackFit, x: 50, y: 50, zoom: 1 }
    }

    const markerIndex = raw.lastIndexOf(VIEW_MARKER)
    if (markerIndex === -1) {
        return { src: raw, fit: fallbackFit, x: 50, y: 50, zoom: 1 }
    }

    const src = raw.slice(0, markerIndex)
    const [fitValue, xValue, yValue, zoomValue] = raw.slice(markerIndex + VIEW_MARKER.length).split(",")
    const fit: ProfileImageFit = fitValue === "contain" ? "contain" : fitValue === "cover" ? "cover" : fallbackFit
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

export function encodeProfileImagePresentation(
    value: string,
    presentation: Omit<ProfileImagePresentation, "src">,
): string {
    const { src } = parseProfileImagePresentation(value)
    if (!src) return ""

    const fit: ProfileImageFit = presentation.fit === "contain" ? "contain" : "cover"
    const x = Math.round(clamp(presentation.x, 0, 100))
    const y = Math.round(clamp(presentation.y, 0, 100))
    const zoom = clamp(presentation.zoom, 1, 2.5).toFixed(2)

    return `${src}${VIEW_MARKER}${fit},${x},${y},${zoom}`
}

export function profileImageStyle(value?: string | null, fallbackFit: ProfileImageFit = "cover") {
    const presentation = parseProfileImagePresentation(value, fallbackFit)
    return {
        src: presentation.src,
        style: {
            objectFit: presentation.fit,
            objectPosition: `${presentation.x}% ${presentation.y}%`,
            transform: `scale(${presentation.zoom})`,
            transformOrigin: `${presentation.x}% ${presentation.y}%`,
        },
    }
}
