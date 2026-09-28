"use client"

import * as React from "react"
import { Timer } from "lucide-react"

interface CountdownTimerProps {
    targetDate: Date
    size?: "sm" | "md" | "lg"
    minimal?: boolean
}

type CountdownParts = {
    days: number
    hours: number
    minutes: number
    seconds: number
}

const ZERO_TIME: CountdownParts = {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
}

function getTimeLeft(targetTime: number, now: number): CountdownParts {
    const distance = targetTime - now

    if (!Number.isFinite(targetTime) || distance <= 0) {
        return ZERO_TIME
    }

    return {
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
    }
}

export function CountdownTimer({ targetDate, size = "md", minimal = false }: CountdownTimerProps) {
    const targetTime = targetDate.getTime()
    const [timeLeft, setTimeLeft] = React.useState<CountdownParts>(ZERO_TIME)

    React.useEffect(() => {
        // Depend on the primitive timestamp, not the Date object's identity.
        // Auction cards are allowed to re-render every second; a newly-created
        // Date object with the same deadline must not restart this timer before
        // its first tick.
        const update = () => {
            const next = getTimeLeft(targetTime, Date.now())
            setTimeLeft(next)
            return next.days === 0
                && next.hours === 0
                && next.minutes === 0
                && next.seconds === 0
        }

        // Calculate immediately on mount/deadline change so live cards never
        // spend their first second incorrectly displaying 00:00:00.
        if (update()) return

        const interval = window.setInterval(() => {
            if (update()) {
                window.clearInterval(interval)
            }
        }, 1000)

        return () => window.clearInterval(interval)
    }, [targetTime])

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
