"use client"

import * as React from "react"
import { Gavel, Tag } from "lucide-react"

interface SalesByType {
    AUCTION: { units: number; revenue: number }
    CLASSIFIED: { units: number; revenue: number }
}

interface Props {
    data: SalesByType
    title?: string
}

function formatPrice(v: number): string {
    if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `£${(v / 1_000).toFixed(1)}k`
    return `£${v.toFixed(0)}`
}

export function SalesByTypeChart({ data, title = "Sales Channel Mix" }: Props) {
    const totalUnits = (data.AUCTION?.units ?? 0) + (data.CLASSIFIED?.units ?? 0)
    const auctionPct = totalUnits > 0 ? Math.round(((data.AUCTION?.units ?? 0) / totalUnits) * 100) : 0
    const classifiedPct = 100 - auctionPct

    return (
        <div className="dealer-glass-card p-5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">{title}</h3>

            {totalUnits === 0 ? (
                <p className="text-xs text-gray-600 font-bold text-center py-6">No sales yet</p>
            ) : (
                <>
                    {/* Stacked bar */}
                    <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-5">
                        {auctionPct > 0 && (
                            <div
                                className="bg-purple-500 transition-all duration-700 rounded-l-full"
                                style={{ width: `${auctionPct}%` }}
                                title={`Auction: ${auctionPct}%`}
                            />
                        )}
                        {classifiedPct > 0 && (
                            <div
                                className="bg-blue-500 transition-all duration-700 rounded-r-full"
                                style={{ width: `${classifiedPct}%` }}
                                title={`Classified: ${classifiedPct}%`}
                            />
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {/* Auction */}
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 mb-2">
                                <Gavel size={12} className="text-purple-400" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-purple-400">Auction</span>
                            </div>
                            <p className="text-2xl font-black text-white leading-none">{data.AUCTION?.units ?? 0}</p>
                            <p className="text-[9px] text-gray-500 font-medium mt-0.5">units · {auctionPct}%</p>
                            <p className="text-xs font-bold text-purple-300 mt-1">{formatPrice(data.AUCTION?.revenue ?? 0)}</p>
                        </div>

                        {/* Classified */}
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 mb-2">
                                <Tag size={12} className="text-blue-400" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Classified</span>
                            </div>
                            <p className="text-2xl font-black text-white leading-none">{data.CLASSIFIED?.units ?? 0}</p>
                            <p className="text-[9px] text-gray-500 font-medium mt-0.5">units · {classifiedPct}%</p>
                            <p className="text-xs font-bold text-blue-300 mt-1">{formatPrice(data.CLASSIFIED?.revenue ?? 0)}</p>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
