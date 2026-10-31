import Link from "next/link"
import { History, ShoppingBag, Trophy, CarFront } from "lucide-react"
import { PURCHASE_DESTINATIONS, type PurchaseDestinationId } from "@/lib/purchaseDestinations"

const ICONS = { wins: Trophy, retail: CarFront, all: ShoppingBag, history: History } as const

/**
 * Auction Wins | Retail Purchases | All Purchases | Purchase History.
 *
 * Two-by-two tabs on phones and four columns from 640px (icons above the label), so
 * nothing is clipped off the end of a scrolling strip on a 360px Samsung
 * screen and the selected destination is a solid red block.
 */
export function PurchaseDestinations({ active, className = "" }: { active: PurchaseDestinationId; className?: string }) {
    return (
        <nav aria-label="Purchases" className={`grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-1.5 ${className}`}>
            {PURCHASE_DESTINATIONS.map(item => {
                const Icon = ICONS[item.id]
                const selected = item.id === active
                const cls = "flex min-h-[56px] flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl px-1.5 py-2 text-center text-[13px] sm:text-sm font-black leading-tight"
                return selected ? (
                    <span key={item.id} aria-current="page" className={`${cls} bg-primary text-white shadow-sm`}>
                        <Icon size={18} aria-hidden /> {item.label}
                    </span>
                ) : (
                    <Link key={item.id} href={item.href} className={`${cls} text-[var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-primary`}>
                        <Icon size={18} aria-hidden /> {item.label}
                    </Link>
                )
            })}
        </nav>
    )
}
