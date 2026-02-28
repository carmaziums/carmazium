"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { fetchWithRetry } from "@/lib/fetchWithRetry"
import { Loader2 } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://carmazium-hjoh9w.fly.dev";

/**
 * Parses hash fragment for Supabase auth redirect (e.g. #access_token=...&refresh_token=...&type=signup).
 * The verification email link uses this format; the hash is only available in the browser.
 */
function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {}
  if (!hash || !hash.startsWith("#")) return params
  const query = hash.slice(1)
  for (const part of query.split("&")) {
    const [key, value] = part.split("=")
    if (key && value) params[key] = decodeURIComponent(value)
  }
  return params
}

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const redirectTo = searchParams?.get("redirect_to") || "/auth/onboarding"
      const code = searchParams?.get("code")
      const error = searchParams?.get("error")
      const errorDescription = searchParams?.get("error_description")

      if (error) {
        setErrorMessage(errorDescription || error)
        setStatus("error")
        return
      }

      // 1) PKCE: server redirects with ?code=...
      if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (cancelled) return
        if (exchangeError) {
          setErrorMessage(exchangeError.message)
          setStatus("error")
          return
        }
        if (data.session && data.user) {
          await syncBackendAndRedirect(data.user, data.session.access_token, redirectTo)
        }
        return
      }

      // 2) Implicit / email link: tokens in hash (#access_token=...&refresh_token=...)
      if (typeof window === "undefined") return
      const hashParams = parseHashParams(window.location.hash)
      const accessToken = hashParams.access_token
      const refreshToken = hashParams.refresh_token

      if (accessToken) {
        try {
          const { data, error: setError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || "",
          })
          if (cancelled) return
          if (setError) {
            setErrorMessage(setError.message)
            setStatus("error")
            return
          }
          if (data.user && data.session) {
            await syncBackendAndRedirect(data.user, data.session.access_token, redirectTo)
            return
          }
        } catch (err: any) {
          setErrorMessage(err?.message || "Failed to complete sign in")
          setStatus("error")
          return
        }
      }

      // No code and no token in hash -> go to login
      router.replace("/auth/login")
    }

    async function syncBackendAndRedirect(
      user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
      accessToken: string,
      redirectTo: string
    ) {
      const apiBase = API_URL.replace(/\/$/, "")
      const meta = (user.user_metadata || {}) as Record<string, string>

      try {
        const syncRes = await fetchWithRetry(
          `${apiBase}/users/sync`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: user.id,
              email: user.email,
              firstName: meta.first_name ?? meta.firstName,
              lastName: meta.last_name ?? meta.lastName,
              role: meta.role,
            }),
          },
          { timeoutMs: 60000, retries: 2 }
        )
        if (!syncRes.ok && syncRes.status !== 403) {
          console.warn("Backend sync returned", syncRes.status)
        }
      } catch {
        console.warn("Backend sync request failed")
      }

      try {
        await fetchWithRetry(
          `${apiBase}/auth/supabase-session`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: accessToken }),
            credentials: "include",
          },
          { timeoutMs: 60000, retries: 2 }
        )
      } catch {
        console.warn("Backend session bridge failed")
      }

      if (cancelled) return
      router.replace(redirectTo)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [router, searchParams])

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-900 text-white p-6">
        <p className="text-red-400 text-center">{errorMessage}</p>
        <a href="/auth/login" className="text-primary hover:underline">
          Back to login
        </a>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-900 text-white">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-slate-300">Completing sign in…</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-900 text-white">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-slate-300">Completing sign in…</p>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
