"use client"

import * as React from "react"

/**
 * Persist an in-progress form for the lifetime of the browser tab. This is
 * intentionally sessionStorage rather than localStorage: drafts survive an
 * authentication redirect but are not kept indefinitely on a shared device.
 */
export function useSessionDraft<T>(key: string, initialValue: T) {
    const [value, setValue] = React.useState<T>(initialValue)
    const [hydrated, setHydrated] = React.useState(false)

    React.useEffect(() => {
        try {
            const raw = window.sessionStorage.getItem(key)
            if (raw) setValue(JSON.parse(raw) as T)
        } catch {
            // Ignore malformed/blocked storage and keep the clean form.
        } finally {
            setHydrated(true)
        }
    }, [key])

    React.useEffect(() => {
        if (!hydrated) return
        try {
            window.sessionStorage.setItem(key, JSON.stringify(value))
        } catch {
            // Storage failure must never prevent the user completing the form.
        }
    }, [hydrated, key, value])

    const clearDraft = React.useCallback(() => {
        try {
            window.sessionStorage.removeItem(key)
        } catch {
            // Best effort only.
        }
    }, [key])

    return { value, setValue, clearDraft, hydrated }
}
