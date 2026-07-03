"use client"

import * as React from "react"
import { Timer } from "lucide-react"

interface CountdownTimerProps {
    targetDate: Date
    size?: "sm" | "md" | "lg"
    minimal?: boolean
}

export function CountdownTimer({ targetDate, size = "md", minimal = false }: CountdownTimerProps) {
    const [timeLeft, setTimeLeft] = React.useState({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
    })

    React.useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date().getTime()
            const distance = targetDate.getTime() - now

            if (distance < 0) {
                clearInterval(interval)
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
            } else {
                setTimeLeft({
                    days: Math.floor(distance / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                    minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
                    seconds: Math.floor((distance % (1000 * 60)) / 1000)
                })
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [targetDate])

    const pad = (n: number) => n.toString().padStart(2, '0')

    if (minimal) {
        return (
            <div className="font-mono text-primary font-bold flex items-center gap-1">
                <Timer size={14} className="animate-pulse" />
                {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
            </div>
        )
    }

    return (
        <div className={`flex gap-2 text-center items-center justify-center ${size === 'lg' ? 'scale-110' : ''}`}>
            {timeLeft.days > 0 && (
                <div className="flex flex-col">
                    <span className="text-2xl font-bold font-mono text-white bg-slate-800 border border-[var(--border-default)] rounded-lg p-2 min-w-[50px]">{pad(timeLeft.days)}</span>
                    <span className="text-[10px] uppercase text-[var(--text-muted)] mt-1">Days</span>
                </div>
            )}
            <div className="flex flex-col">
                <span className="text-2xl font-bold font-mono text-white bg-slate-800 border border-[var(--border-default)] rounded-lg p-2 min-w-[50px]">{pad(timeLeft.hours)}</span>
                <span className="text-[10px] uppercase text-[var(--text-muted)] mt-1">Hrs</span>
            </div>
            <div className="text-2xl font-bold text-[var(--text-secondary)] self-start mt-2">:</div>
            <div className="flex flex-col">
                <span className="text-2xl font-bold font-mono text-white bg-slate-800 border border-[var(--border-default)] rounded-lg p-2 min-w-[50px]">{pad(timeLeft.minutes)}</span>
                <span className="text-[10px] uppercase text-[var(--text-muted)] mt-1">Mins</span>
            </div>
            <div className="text-2xl font-bold text-[var(--text-secondary)] self-start mt-2">:</div>
            <div className="flex flex-col">
                <span className="text-2xl font-bold font-mono text-primary bg-slate-800 border border-primary/50 shadow-[0_0_10px_rgba(237,28,36,0.2)] rounded-lg p-2 min-w-[50px]">{pad(timeLeft.seconds)}</span>
                <span className="text-[10px] uppercase text-[var(--text-muted)] mt-1">Secs</span>
            </div>
        </div>
    )
}
