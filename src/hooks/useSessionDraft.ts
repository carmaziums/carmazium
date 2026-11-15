"use client"

import * as React from "react"
import { loadSessionDraft, saveSessionDraft, sessionDraftKey } from "@/lib/sessionDraftStorage"

/** Tab-lifetime drafts isolated by account, with an explicit guest sign-in handoff. */
export function useSessionDraft<T extends Record<string, string>>(namespace: string, initialValue: T, owner: string | null, authLoading: boolean) {
    const key = authLoading ? null : sessionDraftKey(namespace, owner)
    const [snapshot, setSnapshot] = React.useState<{ key: string | null; value: T; cleared: boolean }>({ key: null, value: initialValue, cleared: false })
    const hydrated = key !== null && snapshot.key === key
    const value = hydrated ? snapshot.value : initialValue

    React.useEffect(() => {
        if (!key) return
        let restored = initialValue
        try { restored = loadSessionDraft(window.sessionStorage, namespace, owner, initialValue) } catch { /* Storage may be disabled. */ }
        setSnapshot({ key, value: restored, cleared: false })
    }, [key, namespace, owner, initialValue])

    React.useEffect(() => {
        try { saveSessionDraft(window.sessionStorage, key, snapshot) } catch { /* Storage may be disabled. */ }
    }, [key, snapshot])

    const setValue = React.useCallback((update: React.SetStateAction<T>) => {
        setSnapshot(previous => {
            if (!key || previous.key !== key) return previous
            return { key, value: typeof update === "function" ? update(previous.value) : update, cleared: false }
        })
    }, [key])

    const prepareSignIn = React.useCallback(() => {
        if (owner || !hydrated) return
        try {
            window.sessionStorage.setItem(sessionDraftKey(namespace, null), JSON.stringify(value))
            window.sessionStorage.setItem(`${namespace}:sign-in`, "pending")
        } catch { /* Sign-in must still work with storage disabled. */ }
    }, [owner, hydrated, namespace, value])

    const clearDraft = React.useCallback(() => {
        setSnapshot(previous => previous.key === key ? { ...previous, value: initialValue, cleared: true } : previous)
        try { if (key) window.sessionStorage.removeItem(key) } catch { /* Best effort. */ }
    }, [key, initialValue])

    return { value, setValue, clearDraft, hydrated, prepareSignIn }
}
