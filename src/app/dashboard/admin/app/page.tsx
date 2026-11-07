"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowLeft, CheckCircle2, Download, Loader2, Monitor, RotateCcw, Smartphone } from "lucide-react"
import { FaAndroid, FaApple } from "react-icons/fa"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { OnlineNowCard } from "@/components/admin/OnlineNowCard"

type AppStats = {
  installs: { android: number; androidApp: number; androidWebApp: number; ios: number; windows: number }
  installsTotal: number
  androidAppInstalls: number
  androidAppInstalls30d: number
  webInstalls: Record<string, number>
  webInstallsTotal: number
  downloadClicks: Record<string, number>
  downloadClicksTotal: number
  downloadClicks30d: number
  apkDownloads: number | null
  problemReports: { open: number; total: number }
}

type ProblemReport = {
  id: string
  createdAt: string
  payload: {
    category: string; message: string; contactEmail?: string | null; platform?: string
    appVersion?: string | null; device?: string | null; screen?: string | null; status?: "new" | "resolved"
  }
  user?: { firstName?: string | null; lastName?: string | null; email?: string | null; role?: string } | null
}

const CATEGORY: Record<string, string> = {
  not_working: "Something isn’t working", sign_in: "Signing in / account", payments: "Payments",
  listings: "Listings / selling", auctions: "Auctions / bids", messages: "Messages / notifications", other: "Other",
}

const n = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("en-GB"))

export default function AdminAppPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = React.useState<AppStats | null>(null)
  const [reports, setReports] = React.useState<ProblemReport[]>([])
  const [filter, setFilter] = React.useState<"open" | "resolved">("open")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)

  const load = React.useCallback(async (which: "open" | "resolved") => {
    setLoading(true)
    setError(null)
    try {
      const [s, r] = await Promise.all([
        apiClient<AppStats>("/analytics/app-stats"),
        apiClient<{ reports: ProblemReport[] }>(`/analytics/problem-reports?limit=50&status=${which}`),
      ])
      setStats(s)
      setReports(r.reports)
    } catch (e: any) {
      setError(e?.message || "Could not load app statistics")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (authLoading) return
    if (!user) { router.replace("/auth/login"); return }
    if (profile?.role !== "ADMIN") { router.replace("/dashboard"); return }
    void load(filter)
  }, [authLoading, user, profile, router, load, filter])

  async function toggle(r: ProblemReport) {
    setBusy(r.id)
    try {
      await apiClient(`/analytics/problem-reports/${r.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: r.payload.status === "resolved" ? "new" : "resolved" }),
      })
      await load(filter)
    } catch (e: any) {
      setError(e?.message || "Could not update the report")
    } finally {
      setBusy(null)
    }
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={28} /></div>
  }
  if (!user || profile?.role !== "ADMIN") return null

  const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split("@")[0] || "Admin")
  // Different events cannot be added together as verified "installs".
  const tiles = stats ? [
    { label: "Android native first opens", value: n(stats.installs.androidApp), sub: "Distinct reported native first-open IDs, not verified hardware installations", icon: <FaAndroid className="h-5 w-5" /> },
    { label: "APK downloads", value: n(stats.apkDownloads), sub: "GitHub release APK download requests, not installations", icon: <Download className="h-5 w-5" /> },
    { label: "Android web-app opens", value: n(stats.installs.androidWebApp), sub: "First reported standalone website launches", icon: <FaAndroid className="h-5 w-5" /> },
    { label: "iPhone web-app opens", value: n(stats.installs.ios), sub: "First reported Home Screen website launches", icon: <FaApple className="h-5 w-5" /> },
    { label: "Windows web-app opens", value: n(stats.installs.windows), sub: "First reported installed website launches", icon: <Monitor className="h-5 w-5" /> },
    { label: "Open problem reports", value: n(stats.problemReports.open), sub: `${n(stats.problemReports.total)} reports in total`, icon: <AlertCircle className="h-5 w-5" /> },
  ] : []

  return (
    <div className="min-h-screen pt-20 pb-12">
      <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
        <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />
        <main className="flex-1 space-y-6 min-w-0">
          <Link href="/dashboard/admin" className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-primary transition-colors">
            <ArrowLeft size={15} /> Back to Overview
          </Link>
          <header>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
              <Smartphone className="text-primary" size={24} /> Online now, app & problem reports
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1.5 max-w-2xl">
              Separate download requests from reported first opens of the native app and installed website, alongside customer problem reports. These are event counts, not verified installation totals.
            </p>
          </header>

          <OnlineNowCard />

          {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {loading && !stats ? <Loader2 className="animate-spin text-primary" size={24} /> : tiles.map(t => (
              <div key={t.label} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                <div className="flex items-center gap-2 text-primary">{t.icon}<span className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">{t.label}</span></div>
                <p className="mt-3 font-mono text-3xl font-black">{t.value}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{t.sub}</p>
              </div>
            ))}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">Problem reports</h2>
              <div className="flex gap-2">
                {(["open", "resolved"] as const).map(f => (
                  <button key={f} type="button" onClick={() => setFilter(f)}
                    className={`min-h-9 rounded-full border px-4 text-sm font-bold ${filter === f ? "border-primary bg-primary text-white" : "border-[var(--border-default)] text-[var(--text-secondary)]"}`}>
                    {f === "open" ? "Open" : "Resolved"}
                  </button>
                ))}
              </div>
            </div>
            {!loading && reports.length === 0 && (
              <p className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 text-sm text-[var(--text-muted)]">
                {filter === "open" ? "No open problem reports." : "No resolved reports yet."}
              </p>
            )}
            {reports.map(r => {
              const p = r.payload
              const who = r.user ? `${[r.user.firstName, r.user.lastName].filter(Boolean).join(" ") || r.user.email} (${r.user.role ?? "user"})` : "Guest"
              return (
                <article key={r.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-black">{CATEGORY[p.category] ?? p.category}</h3>
                    <time className="text-xs text-[var(--text-muted)]">{new Date(r.createdAt).toLocaleString("en-GB")}</time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{p.message}</p>
                  <p className="mt-3 text-xs text-[var(--text-muted)]">{who}{p.contactEmail ? ` · ${p.contactEmail}` : ""}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{[p.platform, p.appVersion && `v${p.appVersion}`, p.device, p.screen].filter(Boolean).join(" · ")}</p>
                  <button type="button" disabled={busy === r.id} onClick={() => void toggle(r)}
                    className={`mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-60 ${p.status === "resolved" ? "border border-[var(--border-default)]" : "bg-emerald-600 text-white"}`}>
                    {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : p.status === "resolved" ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    {p.status === "resolved" ? "Reopen" : "Mark resolved"}
                  </button>
                </article>
              )
            })}
          </section>
        </main>
      </div>
    </div>
  )
}
