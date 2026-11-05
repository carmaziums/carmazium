import type { Metadata } from "next"
import { PageJsonLd } from "@/components/seo/PageJsonLd"
import type { ReactNode } from "react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/buttonVariants"
import { ArrowDownToLine, ArrowRight, CheckCircle2, ExternalLink, ShieldCheck } from "lucide-react"
import { FaAndroid, FaApple, FaGooglePlay, FaWindows } from "react-icons/fa"
import { AppPromoShowcase, appPromoButtonClass } from "@/components/features/AppPromoShowcase"
import { getMobileAppLinks } from "@/lib/mobileAppDownloads"
import { DeviceRecommendedBadge, InstallWebAppButton } from "@/components/pwa/InstallWebAppButton"
import { TrackedDownloadLink } from "@/components/pwa/TrackedDownloadLink"

// Availability follows approved release settings, not placeholder store URLs.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: { absolute: "Get the CarMazium App | iPhone, Android and Windows" },
  description: "Install CarMazium on iPhone, Android and Windows. Add it to your iPhone Home Screen, install it on Windows from Edge or Chrome, or download the signed Android app. No app store needed.",
  alternates: { canonical: "/download-app" },
}

const installButtonClass =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-700/20 transition hover:from-blue-500 hover:to-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"

function UnavailableNotice({ children }: { children: ReactNode }) {
  return (
    <p className="mt-6 rounded-xl border border-amber-200/25 bg-amber-300/10 px-4 py-3 text-sm font-semibold leading-6 text-amber-100">
      {children}
    </p>
  )
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm font-semibold leading-6 text-blue-50">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  )
}

const FEATURES = {
  ios: ["Home Screen icon, opens full screen", "Live auctions, search and chat", "Always up to date"],
  android: ["The full CarMazium app", "Official app from CarMazium", "No Google Play needed"],
  windows: ["Its own window and taskbar icon", "Manage stock on a big screen", "Always up to date"],
} as const

export default function DownloadAppPage() {
  const links = getMobileAppLinks()
  const iosHref = links.ios.href ?? links.iosTestFlight.href
  const androidHref = links.androidApk.href ?? links.android.href
  const windowsHref = links.microsoftStore.href
  const anyAvailable = Boolean(iosHref || androidHref || windowsHref)

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#101c44] pb-20 pt-24 text-white sm:pt-28">
      <PageJsonLd path="/download-app" title="Get the CarMazium App | iPhone, Android and Windows" description={metadata.description as string} />
      <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8">
        <AppPromoShowcase
          variant="page"
          actions={
            <>
              <a href={iosHref ?? "#iphone"} className={appPromoButtonClass}
                aria-label={iosHref ? "Open verified CarMazium iPhone installation" : "Install CarMazium on iPhone"}>
                <FaApple className="h-8 w-8 shrink-0" aria-hidden="true" />
                <span className="min-w-0 text-xs leading-4">
                  Install for <strong className="block text-base">iPhone</strong>
                </span>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />
              </a>
              <a href={androidHref ?? "#android"} className={appPromoButtonClass}
                aria-label={androidHref ? "Open verified CarMazium Android installation" : "See Android installation status"}>
                <FaAndroid className="h-7 w-7 shrink-0 text-emerald-300" aria-hidden="true" />
                <span className="min-w-0 text-xs leading-4">
                  {androidHref ? "Install for" : "Explore"} <strong className="block text-base">Android</strong>
                </span>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />
              </a>
              <a href={windowsHref ?? "#windows"} className={appPromoButtonClass}
                aria-label={windowsHref ? "Open verified CarMazium Microsoft Store listing" : "Install CarMazium on Windows"}>
                <FaWindows className="h-7 w-7 shrink-0 text-sky-300" aria-hidden="true" />
                <span className="min-w-0 text-xs leading-4">
                  {windowsHref ? "Get it from" : "Install for"} <strong className="block text-sm">{windowsHref ? "Microsoft Store" : "Windows"}</strong>
                </span>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />
              </a>
            </>
          }
        />

        {!anyAvailable && (
          <div role="status" className="mx-auto mt-7 max-w-5xl rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-5 py-4 text-center text-sm leading-6 text-cyan-50">
            Install CarMazium straight from this website on iPhone and Windows today — no app store needed.
            The signed Android app download appears here as soon as its release is approved.
          </div>
        )}

        <div className="mx-auto mt-12 max-w-7xl">
          <div className="mb-8 text-center">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Choose your device</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Your CarMazium. Your way.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
              Install CarMazium on your phone or computer straight from this website — no app store needed.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <section id="iphone" aria-labelledby="iphone-app-title"
              className="relative flex scroll-mt-28 flex-col overflow-hidden rounded-3xl border border-blue-300/30 bg-[linear-gradient(145deg,#203a79_0%,#1a2454_54%,#48227d_100%)] p-6 shadow-2xl sm:p-8">
              <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl" />
              <div className="relative flex flex-1 flex-col">
                <DeviceRecommendedBadge platform="ios" />
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-lg">
                  <FaApple className="h-9 w-9" aria-hidden="true" />
                </div>
                <h3 id="iphone-app-title" className="text-2xl font-black">CarMazium for iPhone</h3>
                <p className="mt-3 text-sm leading-6 text-blue-100">Add CarMazium to your Home Screen. It opens full screen, just like an app.</p>
                <FeatureList items={[...FEATURES.ios]} />
                <div className="mt-auto pt-6">
                  {links.ios.href ? (
                    <a href={links.ios.href} className={installButtonClass} aria-label="Install CarMazium from Apple App Store">
                      <FaApple className="h-5 w-5" aria-hidden="true" />
                      Download on the App Store <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  ) : links.iosTestFlight.href ? (
                    <a href={links.iosTestFlight.href} className={installButtonClass}
                      aria-label="Join the approved CarMazium TestFlight beta">
                      <FaApple className="h-5 w-5" aria-hidden="true" />
                      Install iPhone Beta via TestFlight <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  ) : (
                    <InstallWebAppButton platform="ios" />
                  )}
                </div>
              </div>
            </section>

            <section id="android" aria-labelledby="android-app-title"
              className="relative flex scroll-mt-28 flex-col overflow-hidden rounded-3xl border border-emerald-300/25 bg-[linear-gradient(145deg,#123f61_0%,#18325d_55%,#203b78_100%)] p-6 shadow-2xl sm:p-8">
              <div aria-hidden="true" className="pointer-events-none absolute -right-12 top-5 h-48 w-48 rounded-full bg-emerald-400/15 blur-3xl" />
              <div className="relative flex flex-1 flex-col">
                <DeviceRecommendedBadge platform="android" />
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-400/10 text-lime-300 shadow-lg">
                  <FaAndroid className="h-10 w-10" aria-hidden="true" />
                </div>
                <h3 id="android-app-title" className="text-2xl font-black">CarMazium for Android</h3>
                <p className="mt-3 text-sm leading-6 text-blue-100">Download the CarMazium app straight to your Android phone.</p>
                <FeatureList items={[...FEATURES.android]} />
                <div className="mt-auto pt-6">
                  {links.android.href ? (
                    <a href={links.android.href} className={installButtonClass}
                      aria-label="Install CarMazium from Google Play">
                      <FaGooglePlay className="h-5 w-5" aria-hidden="true" />
                      Get it on Google Play <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  ) : links.androidApk.href ? (
                    <TrackedDownloadLink href={links.androidApk.href} platform="android" className={installButtonClass}
                      ariaLabel="Download the CarMazium Android app">
                      <ArrowDownToLine className="h-5 w-5" aria-hidden="true" />
                      Download for Android
                    </TrackedDownloadLink>
                  ) : (
                    <InstallWebAppButton platform="android" />
                  )}
                </div>
              </div>
            </section>

            <section id="windows" aria-labelledby="windows-heading"
              className="relative flex scroll-mt-28 flex-col overflow-hidden rounded-3xl border border-sky-300/25 bg-[linear-gradient(145deg,#123768_0%,#1a265f_55%,#332173_100%)] p-6 shadow-2xl sm:p-8">
              <div aria-hidden="true" className="pointer-events-none absolute -right-12 top-5 h-48 w-48 rounded-full bg-blue-400/20 blur-3xl" />
              <div className="relative flex flex-1 flex-col">
                <DeviceRecommendedBadge platform="windows" />
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-300/30 bg-sky-400/15 text-cyan-200 shadow-lg">
                  <FaWindows className="h-9 w-9" aria-hidden="true" />
                </div>
                <h3 id="windows-heading" className="text-2xl font-black">CarMazium for Windows</h3>
                <p className="mt-3 text-sm leading-6 text-blue-100">Install CarMazium on your PC from Microsoft Edge or Google Chrome.</p>
                <FeatureList items={[...FEATURES.windows]} />
                <div className="mt-auto pt-6">
                  {windowsHref ? (
                    <a href={windowsHref} className={installButtonClass}
                      aria-label="Get CarMazium from Microsoft Store">
                      <FaWindows className="h-5 w-5" aria-hidden="true" />
                      Get it from Microsoft Store <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  ) : (
                    <InstallWebAppButton platform="windows" />
                  )}
                </div>
              </div>
            </section>
          </div>

          <div className="mt-8 grid gap-5 rounded-3xl border border-white/15 bg-white/[0.06] p-6 sm:grid-cols-3 sm:p-8">
            {[
              { icon: ShieldCheck, heading: "Official installation only", detail: "Only install CarMazium from carmazium.com or an official app store." },
              { icon: CheckCircle2, heading: "One CarMazium account", detail: "Use your existing CarMazium account on supported devices." },
              { icon: ArrowRight, heading: "Always up to date", detail: "The latest cars, auctions and features, every time you open it." },
            ].map(({ icon: Icon, heading, detail }) => (
              <div key={heading} className="flex gap-3">
                <Icon className="mt-0.5 h-6 w-6 shrink-0 text-cyan-300" aria-hidden="true" />
                <div>
                  <h3 className="font-extrabold">{heading}</h3>
                  <p className="mt-1 text-sm leading-6 text-blue-100">{detail}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link href="/search" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 font-bold transition hover:bg-white/20">
              Browse cars on the website <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
