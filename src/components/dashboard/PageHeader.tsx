import React from "react"

export interface PageHeaderProps {
    title: string
    subHeader: string
    children?: React.ReactNode
}

export function PageHeader({ title, subHeader, children }: PageHeaderProps) {
    return (
        <div className="mb-7 flex flex-col justify-between gap-5 border-b border-[var(--border-default)] pb-5 md:flex-row md:items-end">
            <div className="min-w-0">
                <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)] md:text-3xl">
                    {title}
                </h1>
                <p className="mt-1.5 max-w-3xl text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    {subHeader}
                </p>
            </div>
            {children && (
                <div className="flex flex-wrap items-center gap-3">
                    {children}
                </div>
            )}
        </div>
    )
}
