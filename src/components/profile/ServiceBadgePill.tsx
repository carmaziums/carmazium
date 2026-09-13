import { BadgeCheck, Car, Landmark, ShieldCheck, Truck, Wrench } from "lucide-react"

type ServiceBadge = { key: string; label: string; verified: boolean }

const BADGE_STYLES: Record<string, string> = {
    "vehicle-dealer": "border-red-400/50 bg-gradient-to-r from-red-500/25 to-rose-500/10 text-red-700 dark:text-red-100 shadow-[0_0_18px_rgba(239,68,68,0.14)]",
    "service-delivery": "border-blue-400/50 bg-gradient-to-r from-blue-500/25 to-cyan-500/10 text-blue-700 dark:text-blue-100 shadow-[0_0_18px_rgba(59,130,246,0.14)]",
    "service-inspection": "border-emerald-400/50 bg-gradient-to-r from-emerald-500/25 to-green-500/10 text-emerald-700 dark:text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.14)]",
    "service-finance": "border-amber-400/50 bg-gradient-to-r from-amber-500/25 to-yellow-500/10 text-amber-800 dark:text-amber-100 shadow-[0_0_18px_rgba(245,158,11,0.14)]",
    "vehicle-finance": "border-amber-400/50 bg-gradient-to-r from-amber-500/25 to-yellow-500/10 text-amber-800 dark:text-amber-100 shadow-[0_0_18px_rgba(245,158,11,0.14)]",
    "service-warranty": "border-fuchsia-400/50 bg-gradient-to-r from-fuchsia-500/25 to-pink-500/10 text-fuchsia-700 dark:text-fuchsia-100 shadow-[0_0_18px_rgba(217,70,239,0.14)]",
    "vehicle-insurance": "border-sky-400/50 bg-gradient-to-r from-sky-500/25 to-cyan-500/10 text-sky-700 dark:text-sky-100 shadow-[0_0_18px_rgba(14,165,233,0.14)]",
}

function BadgeIcon({ badgeKey, size }: { badgeKey: string; size: number }) {
    const props = { size, strokeWidth: 2.2 }
    if (badgeKey === "vehicle-dealer") return <Car {...props} />
    if (badgeKey === "service-delivery") return <Truck {...props} />
    if (badgeKey === "service-inspection") return <Wrench {...props} />
    if (badgeKey === "service-finance" || badgeKey === "vehicle-finance") return <Landmark {...props} />
    if (badgeKey === "service-warranty" || badgeKey === "vehicle-insurance") return <ShieldCheck {...props} />
    return <BadgeCheck {...props} />
}

export function ServiceBadgePill({ badge, compact = false }: { badge: ServiceBadge; compact?: boolean }) {
    const style = BADGE_STYLES[badge.key] || "border-violet-400/50 bg-gradient-to-r from-violet-500/20 to-indigo-500/10 text-violet-700 dark:text-violet-100 shadow-[0_0_18px_rgba(139,92,246,0.12)]"

    return (
        <span
            className={`inline-flex items-center gap-2 rounded-full border font-bold transition-transform duration-200 hover:-translate-y-0.5 ${compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} ${style}`}
            title={badge.verified ? `${badge.label} verified` : badge.label}
        >
            <BadgeIcon badgeKey={badge.key} size={compact ? 13 : 16} />
            <span>{badge.label}</span>
            {badge.verified && <BadgeCheck size={compact ? 12 : 14} strokeWidth={2.3} />}
        </span>
    )
}
