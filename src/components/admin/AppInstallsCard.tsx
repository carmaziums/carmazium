"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, Download } from "lucide-react"
import { FaAndroid, FaApple } from "react-icons/fa"
import { apiClient } from "@/lib/apiClient"

type AppStats = {
  installs: { android: number; androidApp: number; androidWebApp: number; ios: number; iosApp: number; iosWebApp: number; windows: number }
  installsTotal: number
  apkDownloads: number | null
}

/** Admin overview: all-time download requests and reported first opens. */
export function AppInstallsCard() {
  const [data, setData] = React.useState<AppStats | null>(null)
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    const load = () => apiClient<AppStats>("/analytics/app-stats")
      .then(d => { if (alive) { setData(d); setFailed(false) } })
      .catch(() => { if (alive) setFailed(true) })
    void load()
    const t = window.setInterval(load, 60_000)
    return () => { alive = false; window.clearInterval(t) }
  }, [])

  const v = (x: number | null | undefined) => (x == null ? "—" : x.toLocaleString("en-GB"))
  // Distinguish native first opens, website-as-app opens and file downloads.
  // Download counts must never be presented as verified device installations.
  const items = [
    { label: "Android native first opens", value: v(data?.installs?.androidApp), icon: <FaAndroid className="h-4 w-4 text-lime-500" /> },
    { label: "APK downloads", value: v(data?.apkDownloads), icon: <Download className="h-4 w-4 text-primary" /> },
    { label: "Android web-app first opens", value: v(data?.installs?.androidWebApp), icon: <FaAndroid className="h-4 w-4 text-lime-500" /> },
    { label: "iPhone web-app first opens", value: v(data?.installs?.iosWebApp), icon: <FaApple className="h-4 w-4" /> },
  ]

  return (
    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex min-w-0 items-start gap-2 text-sm font-black uppercase tracking-widest text-[var(--text-muted)]">
          <Download className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>App downloads &amp; first opens</span>
        </h2>
        <span className="shrink-0 text-xs text-[var(--text-muted)]">{failed ? "Couldn’t refresh" : "All time"}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {items.map(i => (
          <div key={i.label}>
            <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)]">{i.icon} {i.label}</p>
            <p className="mt-1 font-mono text-3xl font-black">{i.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-default)] pt-3">
        <p className="text-xs text-[var(--text-muted)]">All time · iPhone native first opens: <strong>{v(data?.installs?.iosApp)}</strong> · Windows web-app first opens: <strong>{v(data?.installs?.windows)}</strong>. Downloads do not prove installation; first opens are reported events.</p>
        <Link href="/dashboard/admin/app" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
          Details & problem reports <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  )
}
