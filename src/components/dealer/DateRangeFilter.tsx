"use client"

import * as React from "react"
import { Calendar, ChevronDown, X } from "lucide-react"

export type DateRangePreset = "7d" | "30d" | "90d" | "custom"

interface DateRangeFilterProps {
    activeRange: DateRangePreset
    onRangeChange: (range: DateRangePreset) => void
    customStart?: string
    customEnd?: string
    onCustomChange?: (start: string, end: string) => void
}

const PRESETS: { key: DateRangePreset; label: string }[] = [
    { key: "7d", label: "Last 7 Days" },
    { key: "30d", label: "Last 30 Days" },
    { key: "90d", label: "Last 90 Days" },
    { key: "custom", label: "Custom" },
]

export function DateRangeFilter({
    activeRange,
    onRangeChange,
    customStart,
    customEnd,
    onCustomChange,
}: DateRangeFilterProps) {
    const [showCustom, setShowCustom] = React.useState(false)
    const customRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (customRef.current && !customRef.current.contains(e.target as Node)) {
                setShowCustom(false)
            }
        }
        document.addEventListener("mousedown", handleClick)
        return () => document.removeEventListener("mousedown", handleClick)
    }, [])

    function handleSelect(key: DateRangePreset) {
        if (key === "custom") {
            setShowCustom(true)
        } else {
            setShowCustom(false)
        }
        onRangeChange(key)
    }

    return (
        <div className="relative flex items-center gap-2" ref={customRef}>
            <div className="flex items-center gap-1 p-1 bg-slate-800/80 border border-white/[0.06] rounded-xl">
                {PRESETS.map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => handleSelect(key)}
                        className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-300 ${
                            activeRange === key
                                ? "bg-gradient-to-r from-primary to-red-700 text-white shadow-lg shadow-primary/20"
                                : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                        }`}
                    >
                        <span className="flex items-center gap-1.5">
                            {key === "custom" && <Calendar size={12} />}
                            {label}
                        </span>
                    </button>
                ))}
            </div>

            {/* Custom Date Picker Flyout */}
            {showCustom && activeRange === "custom" && (
                <div className="absolute top-full left-0 mt-2 z-50 bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-xl p-5 shadow-2xl shadow-black/60 min-w-[320px]">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Custom Range</h4>
                        <button onClick={() => setShowCustom(false)} className="text-gray-500 hover:text-white transition-colors">
                            <X size={14} />
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">From</label>
                            <input
                                type="date"
                                value={customStart || ""}
                                onChange={(e) => onCustomChange?.(e.target.value, customEnd || "")}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                            />
                        </div>
                        <span className="text-gray-600 text-xs font-bold mt-5">→</span>
                        <div className="flex-1">
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">To</label>
                            <input
                                type="date"
                                value={customEnd || ""}
                                onChange={(e) => onCustomChange?.(customStart || "", e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                            />
                        </div>
                    </div>
                    {customStart && customEnd && (
                        <div className="mt-3 pt-3 border-t border-white/5 text-center">
                            <span className="text-xs font-bold uppercase tracking-widest text-primary">
                                {new Date(customStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                {" — "}
                                {new Date(customEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
