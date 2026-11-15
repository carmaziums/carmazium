"use client"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { AccessibleModal } from "./AccessibleModal"

/** One filter form: a desktop sidebar or a modal mobile sheet, never a hidden focus target. */
export function ResponsiveFilterPanel({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
    const [desktop, setDesktop] = useState(false)
    const close = useRef(onClose)
    close.current = onClose
    useEffect(() => {
        const media = window.matchMedia("(min-width: 1024px)")
        const update = () => { setDesktop(media.matches); if (media.matches) close.current() }
        update()
        media.addEventListener("change", update)
        return () => media.removeEventListener("change", update)
    }, [])
    if (desktop) return <aside aria-label="Vehicle filters" className="w-72 shrink-0 glass-card border border-[var(--border-default)] rounded-2xl sticky top-24 max-h-[calc(100dvh-7rem)] flex flex-col overflow-hidden p-0">{children}</aside>
    if (!open) return null
    return <AccessibleModal label="Vehicle filters" onClose={onClose} className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none border-0 bg-transparent p-0 text-[var(--text-primary)] backdrop:bg-black/70 backdrop:backdrop-blur-sm">
        <div className="flex flex-col h-[85dvh] rounded-t-3xl bg-[var(--bg-dropdown)] border-t border-[var(--border-default)] overflow-hidden">{children}</div>
    </AccessibleModal>
}
