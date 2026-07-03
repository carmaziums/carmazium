"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface AccordionItemProps {
    title: React.ReactNode
    icon?: React.ReactNode
    children: React.ReactNode
    defaultOpen?: boolean
}

export function AccordionItem({ title, icon, children, defaultOpen = false }: AccordionItemProps) {
    const [isOpen, setIsOpen] = React.useState(defaultOpen)

    return (
        <div className="glass-card mb-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-primary/5 dark:hover:bg-white/10 transition-colors"
            >
                <div className="flex items-center gap-4 font-medium">
                    {icon && <span className="w-5 text-center" style={{ color: 'var(--text-muted)' }}>{icon}</span>}
                    {title}
                </div>
                <ChevronDown className="transition-transform duration-300" style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : undefined }} size={20} />
            </button>

            <div
                className={cn(
                    "text-sm leading-relaxed overflow-hidden transition-all duration-300 ease-in-out",
                    isOpen ? "max-h-[500px] opacity-100 p-4 border-t" : "max-h-0 opacity-0"
                )}
                style={{ color: 'var(--text-secondary)', borderColor: isOpen ? 'var(--border-default)' : undefined }}
            >
                {children}
            </div>
        </div>
    )
}
