"use client"

import { useEffect } from "react"

/** Registers the minimal offline-page service worker in production only. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    if (window.location.protocol !== "https:") return
    const register = () => { navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {}) }
    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })
  }, [])
  return null
}
