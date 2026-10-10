import type { Metadata } from "next"
import Link from "next/link"
import { Apple, ArrowDownToLine, ArrowRight, CheckCircle2, ShieldCheck, Smartphone } from "lucide-react"
import { getMobileAppLinks } from "@/lib/mobileAppDownloads"

// The public store URLs are supplied after verified release and redeployment.
// Do not cache a false "available" state once a verified destination is added.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "CarMazium App for iPhone and Android",
  description: "Find the verified CarMazium iPhone and Android installation links. Buy and sell cars on CarMazium on your phone.",
  alternates: { canonical: "/download-app" },
}

const storeButton = "inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xl px-5 py-3 text-sm font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 sm:w-auto"
const cardStyle = "flex h-full flex-col rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-lg sm:p-8"

export default function DownloadAppPage() {
  const links = getMobileAppLinks()
  const androidReady = links.android.available || links.androidApk.available
  const appsReady = links.ios.available && androidReady

  return (
    <main className="min-h-screen pb-20 pt-28 sm:pt-36" style={{ color: "var(--text-primary)", background: "var(--bg-primary)" }}>
      <div className="container mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-red-500">CarMazium mobile</p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            CarMazium on your <span className="text-red-500">phone</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 sm:text-lg" style={{ color: "var(--text-secondary)" }}>
            Find cars, manage your listings and follow auctions on the go.
            Choose your device below for the official installation option.
          </p>
          {!appsReady && (
            <p role="status" className="mx-auto mt-5 max-w-2xl rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              App downloads are being prepared. We’ll enable each installation button when its official public release is verified.
              You can continue using CarMazium in your browser meanwhile.
            </p>
          )}
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-2">
          <section className={cardStyle} aria-labelledby="iphone-app-title">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-500/10">
              <Apple className="h-8 w-8" aria-hidden="true" />
            </div>
            <h2 id="iphone-app-title" className="text-2xl font-extrabold">CarMazium for iPhone</h2>
            <p className="mt-3 flex-1 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              Install the official iOS app on your iPhone through Apple’s App Store.
            </p>
            {links.ios.href ? (
              <a href={links.ios.href} className={storeButton + " mt-6 bg-red-600 text-white hover:bg-red-700"}
                aria-label="Download CarMazium for iPhone from the Apple App Store">
                <Apple className="h-5 w-5" aria-hidden="true" />
                Download on the App Store
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : (
              <div className="mt-6 flex min-h-14 items-center justify-center rounded-xl border border-[var(--border-default)] px-5 py-3 text-sm font-semibold"
                style={{ color: "var(--text-muted)" }}>
                iPhone app — coming soon
              </div>
            )}
          </section>

          <section className={cardStyle} aria-labelledby="android-app-title">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 text-green-600 dark:text-green-400">
              <Smartphone className="h-8 w-8" aria-hidden="true" />
            </div>
            <h2 id="android-app-title" className="text-2xl font-extrabold">CarMazium for Android</h2>
            <p className="mt-3 flex-1 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              Install on your Android phone using Google Play or an approved, signed CarMazium APK when available.
            </p>
            {links.android.href ? (
              <a href={links.android.href} className={storeButton + " mt-6 bg-red-600 text-white hover:bg-red-700"}
                aria-label="Install CarMazium for Android from Google Play">
                <Smartphone className="h-5 w-5" aria-hidden="true" />
                Get it on Google Play
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : (
              !links.androidApk.href && (
                <div className="mt-6 flex min-h-14 items-center justify-center rounded-xl border border-[var(--border-default)] px-5 py-3 text-sm font-semibold"
                  style={{ color: "var(--text-muted)" }}>
                  Android app — coming soon
                </div>
              )
            )}
            {links.androidApk.href && (
              <div className="mt-3">
                <a href={links.androidApk.href} download
                  className={storeButton + " border border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-red-500"}
                  aria-label="Download approved, signed CarMazium Android APK directly">
                  <ArrowDownToLine className="h-5 w-5" aria-hidden="true" />
                  Download Android APK
                </a>
                <p className="mt-2 break-all text-xs" style={{ color: "var(--text-muted)" }}>
                  SHA-256: {links.androidApk.sha256}
                </p>
                <p className="mt-2 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                  Android may ask for permission to install an app outside Google Play.
                  Only install this file from the official CarMazium website.
                </p>
              </div>
            )}
          </section>
        </div>

        <div className="mx-auto mt-9 grid max-w-5xl gap-4 rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 sm:grid-cols-3 sm:p-8">
          {[
            { icon: ShieldCheck, title: "Official download links", info: "We only show verified public install destinations." },
            { icon: CheckCircle2, title: "Your CarMazium account", info: "Use your existing account when the app is available." },
            { icon: Smartphone, title: "Built for your phone", info: "Browse, sell and manage your cars from mobile." },
          ].map(({ icon: Icon, title, info }) => (
            <div key={title} className="flex gap-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
              <div>
                <p className="font-bold">{title}</p>
                <p className="mt-1 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{info}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="mb-3 text-sm" style={{ color: "var(--text-secondary)" }}>Not ready to install? The website works in your mobile browser.</p>
          <Link href="/search" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-5 py-3 font-bold hover:border-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
            Browse cars on the website <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </main>
  )
}
