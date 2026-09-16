import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PageHeroProps {
    eyebrow?: ReactNode
    title: ReactNode
    description?: ReactNode
    actions?: ReactNode
    align?: "left" | "center"
    compact?: boolean
    className?: string
}

export function PageHero({
    eyebrow,
    title,
    description,
    actions,
    align = "center",
    compact = false,
    className,
}: PageHeroProps) {
    const centred = align === "center"

    return (
        <section
            className={cn(
                "relative overflow-hidden border-b border-[var(--border-default)] bg-gradient-to-b from-primary/[0.06] via-transparent to-transparent",
                className
            )}
        >
            <div className="pointer-events-none absolute left-1/2 top-0 h-56 w-[40rem] max-w-full -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
            <div
                className={cn(
                    "container relative z-10 mx-auto px-5",
                    compact ? "py-10 md:py-12" : "py-14 md:py-16 lg:py-20",
                    centred ? "text-center" : "text-left"
                )}
            >
                <div className={cn("max-w-3xl", centred && "mx-auto")}>
                    {eyebrow && (
                        <div
                            className={cn(
                                "mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-primary",
                                centred && "justify-center"
                            )}
                        >
                            {eyebrow}
                        </div>
                    )}
                    <h1 className="text-4xl font-black tracking-tight text-[var(--text-primary)] md:text-5xl lg:text-6xl">
                        {title}
                    </h1>
                    {description && (
                        <div className="mt-5 text-base leading-7 text-[var(--text-muted)] md:text-lg md:leading-8">
                            {description}
                        </div>
                    )}
                    {actions && (
                        <div
                            className={cn(
                                "mt-8 flex flex-wrap items-center gap-3",
                                centred && "justify-center"
                            )}
                        >
                            {actions}
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}
