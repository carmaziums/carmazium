"use client"

import { useEffect, useState } from "react"

/**
 * Which social sign-in providers are switched on in Supabase. Buttons for a
 * provider that is not enabled are hidden, so customers never hit
 * "provider is not enabled". When the owner enables Apple in the Supabase
 * dashboard, the Apple button appears automatically.
 */
let cached: Promise<{ google: boolean; apple: boolean }> | null = null

function loadProviders() {
  if (!cached) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    cached = (async () => {
      if (!url || !key) return { google: true, apple: false }
      try {
        const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
        const body = await res.json()
        return { google: body?.external?.google === true, apple: body?.external?.apple === true }
      } catch {
        return { google: true, apple: false }
      }
    })()
  }
  return cached
}

export function useOAuthProviders() {
  const [providers, setProviders] = useState<{ google: boolean; apple: boolean }>({ google: true, apple: false })
  useEffect(() => {
    let alive = true
    void loadProviders().then(p => { if (alive) setProviders(p) })
    return () => { alive = false }
  }, [])
  return providers
}
