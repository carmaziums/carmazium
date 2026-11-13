import Link from "next/link"
import { ArrowRight, ShieldCheck } from "lucide-react"
import { warrantyServiceEnabled } from "@/lib/featureFlags"

export function VehicleWarrantyCta({ listingId, status, listingType, compact = false }: {
    listingId?: string
    status?: string | null
    listingType?: string
    compact?: boolean
}) {
    if (!warrantyServiceEnabled || !listingId || status !== "ACTIVE" || listingType !== "CLASSIFIED") return null

    return (
        <Link
            href={`/services/warranty?listingId=${encodeURIComponent(listingId)}`}
            className={`mt-3 flex w-full items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 text-left transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary ${compact ? "p-3" : "p-3.5"}`}
        >
            <ShieldCheck size={compact ? 17 : 22} className="shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
                <span className={`block font-bold text-[var(--text-primary)] ${compact ? "text-xs" : "text-sm"}`}>Buy this car with warranty</span>
                {!compact && <span className="mt-1 block text-xs leading-relaxed text-[var(--text-muted)]">Get an instant price, choose cover options and pay securely online.</span>}
            </span>
            <ArrowRight size={16} className="shrink-0 text-primary" />
        </Link>
    )
}
