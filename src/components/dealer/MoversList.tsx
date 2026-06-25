"use client"

import * as React from "react"
import { Zap, Snail } from "lucide-react"

interface FastMover { make: string; model: string; units: number; avgDays: number }
interface SlowMover { make: string; model: string; count: number; avgDays: number }

interface Props {
    fastMovers: FastMover[]
    slowMovers: SlowMover[]
}

function Row({ rank, label, sub, days, accent }: { rank: number; label: string; sub: string; days: number; accent: string }) {
    return (
        <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
            <span className={`text-[10px] font-black tabular-nums w-4 shrink-0 ${rank === 1 ? 'text-amber-400' : 'text-gray-600'}`}>{rank}</span>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{label}</p>
                <p className="text-[9px] text-gray-600 font-medium">{sub}</p>
            </div>
            <span className={`text-xs font-black tabular-nums ${accent}`}>{days}d</span>
        </div>
    )
}

export function MoversList({ fastMovers, slowMovers }: Props) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Fast Movers */}
            <div className="dealer-glass-card overflow-hidden">
                <div className="p-4 border-b border-white/5 bg-black/20 flex items-center gap-2">
                    <Zap size={14} className="text-emerald-400" />
                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-300">Fast Movers</h3>
                        <p className="text-[9px] text-gray-600 font-medium">Lowest avg days to sell</p>
                    </div>
                </div>
                {fastMovers.length === 0 ? (
                    <p className="text-xs text-gray-600 font-bold text-center py-8">No sales yet</p>
                ) : (
                    <div className="divide-y divide-white/[0.03]">
                        {fastMovers.map((r, i) => (
                            <Row
                                key={`${r.make}-${r.model}`}
                                rank={i + 1}
                                label={`${r.make} ${r.model}`}
                                sub={`${r.units} unit${r.units !== 1 ? 's' : ''} sold`}
                                days={r.avgDays}
                                accent="text-emerald-400"
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Slow Movers */}
            <div className="dealer-glass-card overflow-hidden">
                <div className="p-4 border-b border-white/5 bg-black/20 flex items-center gap-2">
                    <Snail size={14} className="text-red-400" />
                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-300">Slow Movers</h3>
                        <p className="text-[9px] text-gray-600 font-medium">Longest time in active stock</p>
                    </div>
                </div>
                {slowMovers.length === 0 ? (
                    <p className="text-xs text-gray-600 font-bold text-center py-8">No active stock</p>
                ) : (
                    <div className="divide-y divide-white/[0.03]">
                        {slowMovers.map((r, i) => (
                            <Row
                                key={`${r.make}-${r.model}`}
                                rank={i + 1}
                                label={`${r.make} ${r.model}`}
                                sub={`${r.count} active listing${r.count !== 1 ? 's' : ''}`}
                                days={r.avgDays}
                                accent={r.avgDays > 60 ? 'text-red-400' : r.avgDays > 30 ? 'text-amber-400' : 'text-gray-300'}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
