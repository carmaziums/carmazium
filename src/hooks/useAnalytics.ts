"use client"

import { useCallback, useEffect, useRef } from "react"
import { useAuth } from "@/context/AuthContext"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

/** Get or create a persistent anonymous session ID */
function getSessionId(): string {
    const KEY = "cm_session_id"
    let id = sessionStorage.getItem(KEY)
    if (!id) {
        id = crypto.randomUUID()
        sessionStorage.setItem(KEY, id)
    }
    return id
}

/**
 * Fire-and-forget analytics hook.
 * Every call is non-blocking — failures are silently swallowed.
 */
export function useAnalytics() {
    const { user } = useAuth()
    const sessionId = useRef<string | null>(null)

    useEffect(() => {
        sessionId.current = getSessionId()
    }, [])

    const trackEvent = useCallback(
        (type: string, payload: Record<string, unknown> = {}) => {
            try {
                fetch(`${API_URL}/analytics/event`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type,
                        payload,
                        sessionId: sessionId.current,
                        userId: user?.id ?? undefined,
                    }),
                    keepalive: true, // survives page navigations
                }).catch(() => { }) // swallow
            } catch {
                // swallow
            }
        },
        [user],
    )

    const captureEmail = useCallback(
        (email: string, source: string) => {
            return fetch(`${API_URL}/analytics/email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, source }),
            }).then((r) => r.json())
        },
        [],
    )

    return { trackEvent, captureEmail }
}
