"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@/context/AuthContext"
import { getAccessToken } from "@/lib/supabase"
import { countAppEvent } from "@/lib/appInstallCounter"
import { detectDevicePlatform } from "@/components/pwa/InstallWebAppButton"

const INSTALL_COUNTED_KEY = "cm_app_install_counted"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://carmazium-hjoh9w.fly.dev"
const INTERVAL_MS = 60_000

/**
 * Tells the API this tab is open, about once a minute while it is visible, so
 * admins can see how many people are on the website right now. The id is
 * random and lives only in memory for this tab — nothing is stored on the
 * device, no cookie is set and no account details are sent.
 */
export function OnlineHeartbeat() {
  const { user } = useAuth()
  const idRef = useRef<string | null>(null)
  const signedInRef = useRef(false)
  signedInRef.current = !!user

  useEffect(() => {
    if (!idRef.current) {
      idRef.current = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
    }
    const platform = () => {
      if (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true) return "installed"
      return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? "mobile" : "desktop"
    }
    const beat = async () => {
      if (document.visibilityState !== "visible") return
      const token = signedInRef.current ? await getAccessToken().catch(() => null) : null
      // Identity is verified on the server. Never send a trusted-looking
      // signedIn boolean in publicly supplied analytics data.
      void fetch(`${API_URL}/analytics/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "omit",
        keepalive: true,
        body: JSON.stringify({ visitorId: idRef.current, surface: "web", platform: platform() }),
      }).catch(() => {})
    }
    // Count an installed web app (iPhone Home Screen, Windows/Android install)
    // once, on its first launch. Only a yes/no marker is kept on the device —
    // no id or personal data.
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (standalone) {
      try {
        if (!localStorage.getItem(INSTALL_COUNTED_KEY)) {
          const device = detectDevicePlatform()
          if (device) countAppEvent("app_web_installed", device)
          localStorage.setItem(INSTALL_COUNTED_KEY, "1")
        }
      } catch { /* storage unavailable: skip counting */ }
    }

    beat()
    const timer = window.setInterval(beat, INTERVAL_MS)
    const onVisible = () => { if (document.visibilityState === "visible") beat() }
    document.addEventListener("visibilitychange", onVisible)
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible) }
  }, [user?.id])

  return null
}
