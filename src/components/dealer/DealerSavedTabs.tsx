import Link from "next/link"

export function DealerSavedTabs({ active }: { active: "auctions" | "retail" }) {
    return (
        <nav aria-label="Saved cars" className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-1">
            {([["auctions", "Auctions"], ["retail", "Retail cars"]] as const).map(([tab, label]) => (
                <Link key={tab} href={`/dashboard/dealer/wishlist?tab=${tab}`}
                    aria-current={active === tab ? "page" : undefined}
                    className={`flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold ${active === tab ? "bg-primary text-white" : "text-[var(--text-secondary)] hover:bg-primary/10"}`}>
                    {label}
                </Link>
            ))}
        </nav>
    )
}
