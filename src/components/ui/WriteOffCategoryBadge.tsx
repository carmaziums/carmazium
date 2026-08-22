import { AlertTriangle } from "lucide-react"

export type WriteOffCategoryValue = 'NONE' | 'CAT_S' | 'CAT_N' | 'CAT_A' | 'CAT_B'

const CATEGORY_STYLES: Record<string, { label: string; className: string }> = {
    CAT_N: { label: "Category N", className: "bg-amber-500/90 border-amber-400/50" },
    CAT_S: { label: "Category S", className: "bg-amber-500/90 border-amber-400/50" },
    CAT_A: { label: "Category A", className: "bg-red-600/90 border-red-400/50" },
    CAT_B: { label: "Category B", className: "bg-red-600/90 border-red-400/50" },
}

/** Insurance write-off category badge — only renders when a real category is set. */
export function WriteOffCategoryBadge({ category, className = "" }: { category?: string | null; className?: string }) {
    if (!category || category === "NONE") return null
    const style = CATEGORY_STYLES[category]
    if (!style) return null

    return (
        <span className={`inline-flex items-center gap-1 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded shadow border ${style.className} ${className}`}>
            <AlertTriangle size={10} /> {style.label}
        </span>
    )
}
