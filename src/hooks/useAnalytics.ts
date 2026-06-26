"use client"

import { useCallback, useEffect, useRef } from "react"
import { useAuth } from "@/context/AuthContext"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://carmazium-hjoh9w.fly.dev"

function getSessionId(): string {
    const KEY = "cm_session_id"
    let id = sessionStorage.getItem(KEY)
    if (!id) {
        id = crypto.randomUUID()
        sessionStorage.setItem(KEY, id)
    }
    return id
}

function getDeviceType(): string {
    if (typeof navigator === "undefined") return "unknown"
    const ua = navigator.userAgent.toLowerCase()
    if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet"
    if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile"
    return "desktop"
}

/**
 * Fire-and-forget analytics hook.
 * Every call is non-blocking — failures are silently swallowed.
 * Each event is automatically enriched with url, referrer, and device type.
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
                const enriched: Record<string, unknown> = {
                    url: typeof window !== "undefined" ? window.location.pathname : "",
                    referrer: typeof window !== "undefined" ? (document.referrer || "direct") : "",
                    device: getDeviceType(),
                    ...payload, // caller-supplied fields take precedence
                }

                fetch(`${API_URL}/analytics/event`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type,
                        payload: enriched,
                        sessionId: sessionId.current,
                        userId: user?.id ?? undefined,
                    }),
                    keepalive: true,
                }).catch((err) => {
                    if (process.env.NODE_ENV === "development") {
                        console.warn("[analytics] event failed:", err)
                    }
                })
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
