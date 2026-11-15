type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

export function sessionDraftKey(namespace: string, owner: string | null) {
    return `${namespace}:${owner ? `user:${owner}` : "guest"}`
}

/** Restore known fields only; never trust persisted JSON to match a form. */
export function readSessionDraft<T extends Record<string, string>>(storage: DraftStorage, key: string, empty: T): T {
    try {
        const parsed = JSON.parse(storage.getItem(key) || "null")
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return empty
        return Object.fromEntries(Object.entries(empty).map(([name, fallback]) =>
            [name, typeof parsed[name] === "string" ? parsed[name] : fallback])) as T
    } catch { return empty }
}

export function loadSessionDraft<T extends Record<string, string>>(storage: DraftStorage, namespace: string, owner: string | null, empty: T): T {
    const key = sessionDraftKey(namespace, owner)
    // Old unscoped drafts have no safe owner; do not assign them to an account.
    try { storage.removeItem(namespace) } catch { /* Storage is optional. */ }
    try {
        if (owner && storage.getItem(`${namespace}:sign-in`) === "pending") {
            storage.removeItem(`${namespace}:sign-in`)
            const guest = readSessionDraft(storage, sessionDraftKey(namespace, null), empty)
            storage.removeItem(sessionDraftKey(namespace, null))
            storage.setItem(key, JSON.stringify(guest))
            return guest
        }
    } catch { /* Restore this account's draft if handoff storage is unavailable. */ }
    return readSessionDraft(storage, key, empty)
}

export function saveSessionDraft<T>(storage: DraftStorage, activeKey: string | null, snapshot: { key: string | null; value: T; cleared: boolean }) {
    if (!activeKey || snapshot.key !== activeKey || snapshot.cleared) return
    try { storage.setItem(activeKey, JSON.stringify(snapshot.value)) } catch { /* Best effort. */ }
}
