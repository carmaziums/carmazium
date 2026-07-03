"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { cn } from "@/lib/utils"

export function ThemeToggle({ className }: { className?: string }) {
    const { resolvedTheme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => setMounted(true), [])

    if (!mounted) {
        return <div className={cn("w-9 h-9 rounded-lg", className)} style={{ background: 'var(--bg-card)' }} />
    }

    const isDark = resolvedTheme === "dark"

    return (
        <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className={cn(
                "flex items-center justify-center w-9 h-9 rounded-lg border transition-colors hover:opacity-80",
                className
            )}
            style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
            }}
        >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
    )
}
