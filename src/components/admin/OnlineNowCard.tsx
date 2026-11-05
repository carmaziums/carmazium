"use client"

import * as React from "react"
import { Globe, Smartphone, Users } from "lucide-react"
import { apiClient } from "@/lib/apiClient"

type OnlineNow = {
  total: number
  web: { total: number; signedIn: number; desktop: number; mobile: number; installed: number }
  app: { total: number; signedIn: number; android: number; ios: number }
  updatedAt: string
}

/** Admin "Online now": people on the website vs in the app, refreshed every 30s. */
export function OnlineNowCard() {
  const [data, setData] = React.useState<OnlineNow | null>(null)
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    const load = () => apiClient<OnlineNow>("/analytics/online")
      .then(d => { if (alive) { setData(d); setFailed(false) } })
      .catch(() => { if (alive) setFailed(true) })
    void load()
    const t = window.setInterval(load, 30_000)
    return () => { alive = false; window.clearInterval(t) }
  }, [])

  const v = (x: number | undefined) => (x == null ? "—" : x.toLocaleString("en-GB"))

  return (
    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[var(--text-muted)]">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          Online now
        </h2>
        <span className="text-xs text-[var(--text-muted)]">{failed ? "Couldn’t refresh" : "Updates every 30 seconds"}</span>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]"><Users className="h-4 w-4" /> Total</p>
          <p className="mt-1 font-mono text-3xl font-black">{v(data?.total)}</p>
          <p className="text-xs text-[var(--text-muted)]">{data ? `${v(data.web.signedIn + data.app.signedIn)} signed in` : " "}</p>
        </div>
        <div>
          <p className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]"><Globe className="h-4 w-4" /> On the website</p>
          <p className="mt-1 font-mono text-3xl font-black text-emerald-500">{v(data?.web.total)}</p>
          <p className="text-xs text-[var(--text-muted)]">{data ? `${data.web.desktop} desktop · ${data.web.mobile} mobile · ${data.web.installed} installed` : " "}</p>
        </div>
        <div>
          <p className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]"><Smartphone className="h-4 w-4" /> In the app</p>
          <p className="mt-1 font-mono text-3xl font-black text-emerald-500">{v(data?.app.total)}</p>
          <p className="text-xs text-[var(--text-muted)]">{data ? `${data.app.android} Android · ${data.app.ios} iPhone` : " "}</p>
        </div>
      </div>
    </section>
  )
}
