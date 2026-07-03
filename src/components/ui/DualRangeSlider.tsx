"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface DualRangeSliderProps {
    min: number
    max: number
    step?: number
    value: [number, number]
    onChange: (value: [number, number]) => void
    className?: string
}

export function DualRangeSlider({ min, max, step = 1, value, onChange, className }: DualRangeSliderProps) {
    const [lower, upper] = value

    // Calculate percent positions for the styling track
    const minPercent = ((lower - min) / (max - min)) * 100
    const maxPercent = ((upper - min) / (max - min)) * 100

    const handleLowerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Math.min(Number(e.target.value), upper - step)
        onChange([val, upper])
    }

    const handleUpperChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Math.max(Number(e.target.value), lower + step)
        onChange([lower, val])
    }

    return (
        <div className={cn("relative w-full h-4 flex items-center mt-2 mb-1", className)}>
            {/* Background Track */}
            <div className="absolute w-full h-1.5 bg-[var(--bg-input)] rounded-full" />

            {/* Active Track (Highlight) */}
            <div
                className="absolute h-1.5 bg-primary rounded-full shadow-[0_0_10px_rgba(237,28,36,0.6)]"
                style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
            />

            {/* Lower Thumb */}
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={lower}
                onChange={handleLowerChange}
                className="absolute w-full h-4 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary hover:[&::-webkit-slider-thumb]:scale-125 hover:[&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(237,28,36,0.8)] [&::-webkit-slider-thumb]:transition-transform cursor-pointer z-10"
            />

            {/* Upper Thumb */}
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={upper}
                onChange={handleUpperChange}
                className="absolute w-full h-4 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary hover:[&::-webkit-slider-thumb]:scale-125 hover:[&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(237,28,36,0.8)] [&::-webkit-slider-thumb]:transition-transform cursor-pointer z-20"
            />
        </div>
    )
}
