"use client"

import { useEffect, useRef, type ReactNode } from "react"

/** Native modal semantics supply focus containment, Escape and background inertness. */
export function AccessibleModal({ label, onClose, canClose = true, children }: { label: string; onClose: () => void; canClose?: boolean; children: ReactNode }) {
    const ref = useRef<HTMLDialogElement>(null)
    useEffect(() => {
        const dialog = ref.current
        if (!dialog) return
        const previous = document.activeElement as HTMLElement | null
        const overflow = document.body.style.overflow
        dialog.showModal()
        document.body.style.overflow = "hidden"
        return () => {
            dialog.close()
            document.body.style.overflow = overflow
            if (previous?.isConnected) previous.focus()
        }
    }, [])
    return <dialog ref={ref} aria-label={label} onCancel={event => { event.preventDefault(); if (canClose) onClose() }} onClick={event => { if (event.target === event.currentTarget && canClose) onClose() }} className="m-auto max-h-[95dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-visible border-0 bg-transparent p-0 text-[var(--text-primary)] backdrop:bg-black/80 backdrop:backdrop-blur-sm">{children}</dialog>
}
