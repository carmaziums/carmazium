/**
 * Smaller vehicle photos for listing cards.
 *
 * Listing photos are stored as the seller's original uploads (often 1-7 MB),
 * and next/image optimisation is disabled in next.config, so cards download
 * full-size originals. When NEXT_PUBLIC_CARD_IMAGE_RESIZE is "true", card
 * photos stored in Supabase Storage are requested through Supabase's image
 * transformation endpoint at card size instead.
 *
 * Off by default: Supabase bills image transformations per distinct original
 * photo beyond the plan's monthly allowance, so turning this on is a business
 * decision. Any URL that is not a public Supabase Storage object is returned
 * unchanged.
 */
const PUBLIC_OBJECT = "/storage/v1/object/public/"
const RENDER_IMAGE = "/storage/v1/render/image/public/"

export function cardImageUrl(src: string, width = 640): string {
    if (process.env.NEXT_PUBLIC_CARD_IMAGE_RESIZE !== "true") return src
    if (!src || !src.includes(".supabase.co" + PUBLIC_OBJECT)) return src
    const [base] = src.split(/[?#]/)
    const resized = base.replace(PUBLIC_OBJECT, RENDER_IMAGE)
    return `${resized}?width=${Math.round(width)}&quality=70&resize=contain`
}
