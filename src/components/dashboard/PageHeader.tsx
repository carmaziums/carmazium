import React from "react"

export interface PageHeaderProps {
    title: string
    subHeader: string
    children?: React.ReactNode
    /**
     * Tighter spacing and a smaller title on phones, with the sub-header
     * hidden there, so list pages (e.g. Stock) reach their cards sooner.
     * Desktop is unchanged.
     */
    compact?: boolean
}

export function PageHeader({ title, subHeader, children, compact = false }: PageHeaderProps) {
    return (
        <div className={`flex flex-col justify-between border-b border-[var(--border-default)] md:flex-row md:items-end ${compact ? "mb-3 gap-3 pb-3 md:mb-7 md:gap-5 md:pb-5" : "mb-7 gap-5 pb-5"}`}>
            <div className="min-w-0">
                <h1 className={`font-black tracking-tight text-[var(--text-primary)] md:text-3xl ${compact ? "text-xl" : "text-2xl"}`}>
                    {title}
                </h1>
                <p className={`mt-1.5 max-w-3xl text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)] ${compact ? "hidden sm:block" : ""}`}>
                    {subHeader}
                </p>
            </div>
            {children && (
                <div className={`flex flex-wrap items-center ${compact ? "gap-2 md:gap-3" : "gap-3"}`}>
                    {children}
                </div>
            )}
        </div>
    )
}
