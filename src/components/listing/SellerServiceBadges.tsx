export type SellerServices = { financeOffered?: boolean; warrantyOffered?: boolean } | null | undefined

export function SellerServiceBadges({ seller, compact = false }: { seller: SellerServices; compact?: boolean }) {
    if (!seller?.financeOffered && !seller?.warrantyOffered) return null
    return <div className="my-3 space-y-2">
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {seller.financeOffered === true && <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1">Seller can arrange finance</span>}
            {seller.warrantyOffered === true && <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1">Seller offers warranties</span>}
        </div>
        {!compact && <p className="text-xs text-[var(--text-muted)]">Contact this seller for availability, eligibility, prices and terms.</p>}
    </div>
}
