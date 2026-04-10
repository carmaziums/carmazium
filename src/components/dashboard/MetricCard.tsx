import React from "react"
import { LucideIcon } from "lucide-react"

export interface MetricCardProps {
    label: string
    value: string | number
    icon: LucideIcon
    color: string
    bg: string
    border: string
    statusLabel?: string
    foilValue?: boolean
    loading?: boolean
}

export function MetricCard({ 
    label, 
    value, 
    icon: Icon, 
    color, 
    bg, 
    border, 
    statusLabel,
    foilValue = false,
    loading = false 
}: MetricCardProps) {
    return (
        <div className="dealer-glass-card p-6 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4 relative z-10">
                <div className={`p-2 rounded-lg border ${bg} ${border}`}>
                    <Icon size={18} className={color} />
                </div>
                {statusLabel && (
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        {statusLabel}
                    </span>
                )}
            </div>
            <h3 className={`text-3xl font-black font-heading text-white relative z-10 ${foilValue ? "metallic-foil" : ""}`}>
                {loading ? "..." : value}
            </h3>
            <p className="text-gray-400 text-xs mt-1 uppercase tracking-widest font-bold relative z-10">{label}</p>
            {/* Synthetic Sparkline */}
            <svg className="absolute bottom-0 left-0 w-full h-12 opacity-20 pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
                <path d="M0,100 L0,80 Q25,90 50,70 T100,50 L100,100 Z" fill="currentColor" className={color} />
            </svg>
        </div>
    )
}
