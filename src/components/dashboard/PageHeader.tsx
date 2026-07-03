import React from "react"
import { LucideIcon } from "lucide-react"

export interface PageHeaderProps {
    title: string
    subHeader: string
    children?: React.ReactNode
}

export function PageHeader({ title, subHeader, children }: PageHeaderProps) {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div>
                <h1 className="text-3xl font-black font-heading uppercase tracking-tighter metallic-foil">
                    {title}
                </h1>
                <p className="text-xs font-bold uppercase tracking-widest mt-1 opacity-70" style={{ color: 'var(--text-muted)' }}>
                    {subHeader}
                </p>
            </div>
            {children && (
                <div className="flex flex-wrap items-center gap-4">
                    {children}
                </div>
            )}
        </div>
    )
}
