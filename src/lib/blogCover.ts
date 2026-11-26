// Only our completed multi-size uploads use this filename contract. Existing
// covers keep their original URL; never invent variants for arbitrary images.
export function blogCoverWidths(sourceWidth: number): number[] {
    const maximum = Math.min(1600, Math.max(1, Math.floor(sourceWidth)))
    return [...[480, 960].filter(width => width < maximum), maximum]
}

export function blogCoverSrcSet(src: string): string | undefined {
    const match = src.match(/-blogcover-w(\d+)\.webp$/)
    if (!match) return undefined
    const maximum = Number(match[1])
    if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 1600) return undefined
    return blogCoverWidths(maximum).map(width =>
        `${src.replace(/-w\d+\.webp$/, `-w${width}.webp`)} ${width}w`,
    ).join(', ')
}
