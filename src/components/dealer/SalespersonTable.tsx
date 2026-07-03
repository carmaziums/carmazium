"use client"

import * as React from "react"
import { Users } from "lucide-react"

interface SalespersonRow {
    name: string
    total: number
    won: number
    active: number
    conversionRate: number
}

interface Props {
    data: SalespersonRow[]
    title?: string
}

export function SalespersonTable({ data, title = "Salesperson Performance" }: Props) {
    return (
        <div className="dealer-glass-card overflow-hidden">
            <div className="p-5 border-b border-[var(--border-default)] bg-black/20 flex items-center gap-2">
                <Users size={14} className="text-cyan-400" />
                <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)]">{title}</h3>
                    <p className="text-xs text-[var(--text-muted)] font-medium">Lead performance by assigned agent</p>
                </div>
            </div>

            {data.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <Users size={28} className="text-gray-700" />
                    <p className="text-xs text-[var(--text-muted)] font-bold">No assigned leads yet</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-black/30 text-[var(--text-muted)] text-xs uppercase font-black tracking-widest border-b border-[var(--border-default)]">
                            <tr>
                                <th className="px-5 py-3">Agent</th>
                                <th className="px-5 py-3 text-right">Total Leads</th>
                                <th className="px-5 py-3 text-right">Active</th>
                                <th className="px-5 py-3 text-right">Won</th>
                                <th className="px-5 py-3 text-right">Conv %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                            {data.map((row, i) => (
                                <tr key={row.name} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                                                <span className="text-xs font-black text-primary">{i + 1}</span>
                                            </div>
                                            <span className="text-xs font-bold">{row.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <span className="text-sm font-black  tabular-nums">{row.total}</span>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <span className="text-sm font-black text-amber-400 tabular-nums">{row.active}</span>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <span className="text-sm font-black text-emerald-400 tabular-nums">{row.won}</span>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-black tabular-nums ${
                                            row.conversionRate >= 30 ? 'bg-emerald-500/10 text-emerald-400' :
                                            row.conversionRate >= 15 ? 'bg-amber-500/10 text-amber-400' :
                                            'bg-red-500/10 text-red-400'
                                        }`}>
                                            {row.conversionRate}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
