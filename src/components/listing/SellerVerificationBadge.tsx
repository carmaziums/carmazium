import { BadgeCheck, CheckCircle, ShieldCheck } from "lucide-react"

interface Props {
    seller: {
        role?: string
        isOfficial?: boolean
        dealerProfile?: unknown
    } | null | undefined
    /** "sm" matches the compact sidebar cards, "md" the larger seller panels. */
    size?: "sm" | "md"
}

/**
 * The verified-status line under a seller's name.
 *
 * Three states, in priority order:
 *   - CarMazium Official — a listing created by an admin. The backend brands
 *     these (see backend/src/listings/admin-seller-branding.ts) and sets
 *     `isOfficial`, so the UI never has to know what an admin is.
 *   - Verified Dealer — a dealer account with a dealer profile.
 *   - Verified Seller — everyone else.
 *
 * Official is checked FIRST and deliberately: an admin account is not a
 * DEALER, so without this it falls through to "Verified Seller" and a
 * first-party listing looks exactly like a private individual's.
 *
 * Extracted because this markup was duplicated across four render sites in two
 * files, at two different sizes. Adding a third state to four copies is how
 * they drift — one gets updated, the others quietly keep showing the old two.
 */
export function SellerVerificationBadge({ seller, size = "sm" }: Props) {
    if (!seller) return null

    const iconSize = size === "md" ? 14 : 10
    const textClass = size === "md" ? "text-xs tracking-wide" : "text-[10px]"

    if (seller.isOfficial) {
        return (
            <div className="flex items-center gap-1.5">
                <ShieldCheck size={iconSize} className="text-primary" />
                <span className={`${textClass} text-primary font-bold`}>CarMazium Official</span>
            </div>
        )
    }

    if (seller.role === "DEALER" && seller.dealerProfile) {
        return (
            <div className="flex items-center gap-1.5">
                <BadgeCheck size={iconSize} className="text-blue-500" />
                <span className={`${textClass} text-blue-500 font-medium`}>Verified Dealer</span>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-1.5">
            <CheckCircle size={iconSize} className="text-emerald-500" />
            <span className={`${textClass} text-emerald-500 font-medium`}>Verified Seller</span>
        </div>
    )
}
