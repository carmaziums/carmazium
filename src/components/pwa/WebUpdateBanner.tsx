"use client"

import { useEffect, useRef, useState } from "react"
import { RefreshCw, X } from "lucide-react"

const CHECK_EVERY_MS = 5 * 60_000

async function servedVersion(): Promise<string | null> {
  try {
    const res = await fetch("/api/build-version", { cache: "no-store" })
    if (!res.ok) return null
    const body = (await res.json()) as { version?: unknown }
    return typeof body.version === "string" ? body.version : null
  } catch {
    return null
  }
}

/**
 * "New version available — Update" for the installed iPhone/Windows app and
 * open website tabs. Notes the version served when the page opened, checks
 * again every few minutes and whenever the app comes back into view, and on
 * Update reloads straight into the new version.
 */
export function WebUpdateBanner() {
  const started = useRef<string | null>(null)
  const [available, setAvailable] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let alive = true
    const check = async () => {
      const v = await servedVersion()
      if (!alive || !v || v === "local") return
      if (!started.current) { started.current = v; return }
      if (v !== started.current) setAvailable(true)
    }
    void check()
    const timer = window.setInterval(check, CHECK_EVERY_MS)
    const onVisible = () => { if (document.visibilityState === "visible") void check() }
    document.addEventListener("visibilitychange", onVisible)
    return () => { alive = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible) }
  }, [])

  if (!available || dismissed) return null

  return (
    <div role="status" className="fixed inset-x-3 top-24 z-[120] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3 pl-4 shadow-2xl">
      <RefreshCw className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <p className="flex-1 text-sm font-semibold">A new version of CarMazium is available.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-10 rounded-xl bg-primary px-4 text-sm font-bold text-white"
      >
        Update
      </button>
      <button type="button" onClick={() => setDismissed(true)} aria-label="Later" className="rounded-lg p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
