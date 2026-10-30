import type { Metadata } from "next"
import { PageJsonLd } from "@/components/seo/PageJsonLd"
import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowDownToLine, ArrowRight, CheckCircle2, ExternalLink, ShieldCheck } from "lucide-react"
import { FaAndroid, FaApple, FaGooglePlay, FaWindows } from "react-icons/fa"
import { AppPromoShowcase, appPromoButtonClass } from "@/components/features/AppPromoShowcase"
import { getMobileAppLinks } from "@/lib/mobileAppDownloads"

// Availability follows approved release settings, not placeholder store URLs.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Get the CarMazium App | iPhone, Android and Windows",
  description: "Explore CarMazium app installation options for iPhone, Android and Windows. Official links appear only when the corresponding release is approved.",
  alternates: { canonical: "/download-app" },
}

const installButtonClass =
  "mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-700/20 transition hover:from-blue-500 hover:to-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"

function UnavailableNotice({ children }: { children: ReactNode }) {
  return (
    <p className="mt-6 rounded-xl border border-amber-200/25 bg-amber-300/10 px-4 py-3 text-sm font-semibold leading-6 text-amber-100">
      {children}
    </p>
  )
}

export default function DownloadAppPage() {
  const links = getMobileAppLinks()
  const iosHref = links.ios.href ?? links.iosTestFlight.href
  const androidHref = links.android.href ?? links.androidApk.href
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
                aria-label={iosHref ? "Open verified CarMazium iPhone installation" : "See iPhone installation status"}>
                <FaApple className="h-8 w-8 shrink-0" aria-hidden="true" />
                <span className="min-w-0 text-xs leading-4">
                  {iosHref ? "Install for" : "Explore"} <strong className="block text-base">iPhone</strong>
                </span>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />
              </a>
              <a href={androidHref ?? "#android"} className={appPromoButtonClass}
                aria-label={androidHref ? "Open verified CarMazium Android installation" : "See Android installation status"}>
                <FaGooglePlay className="h-7 w-7 shrink-0 text-emerald-300" aria-hidden="true" />
                <span className="min-w-0 text-xs leading-4">
                  {androidHref ? "Install for" : "Explore"} <strong className="block text-base">Android</strong>
                </span>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />
              </a>
              <a href={windowsHref ?? "#windows"} className={appPromoButtonClass}
                aria-label={windowsHref ? "Open verified CarMazium Microsoft Store listing" : "See Microsoft Store availability"}>
                <FaWindows className="h-7 w-7 shrink-0 text-sky-300" aria-hidden="true" />
                <span className="min-w-0 text-xs leading-4">
                  {windowsHref ? "Get it from" : "Check"} <strong className="block text-sm">Microsoft Store</strong>
                </span>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />
              </a>
            </>
          }
        />

        {!anyAvailable && (
          <div role="status" className="mx-auto mt-7 max-w-5xl rounded-2xl border border-amber-300/30 bg-amber-400/10 px-5 py-4 text-center text-sm leading-6 text-amber-100">
            Official installation releases are being prepared. The buttons above show each platform&apos;s status;
            they do not take you to unverified downloads. CarMazium is available in your browser now.
          </div>
        )}

        <div className="mx-auto mt-12 max-w-7xl">
          <div className="mb-8 text-center">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Choose your device</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Your CarMazium. Your way.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
              Install through a verified official release when available, or continue using the full website today.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <section id="iphone" aria-labelledby="iphone-app-title"
              className="relative scroll-mt-28 overflow-hidden rounded-3xl border border-blue-300/30 bg-[linear-gradient(145deg,#203a79_0%,#1a2454_54%,#48227d_100%)] p-6 shadow-2xl sm:p-8">
              <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl" />
              <div className="relative">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-lg">
                  <FaApple className="h-9 w-9" aria-hidden="true" />
                </div>
                <h3 id="iphone-app-title" className="text-2xl font-black">CarMazium for iPhone</h3>
                <p className="mt-3 min-h-20 text-sm leading-6 text-blue-100">
                  Access CarMazium with Apple&apos;s official App Store or an approved public TestFlight beta invitation.
                </p>
                {links.ios.href ? (
                  <a href={links.ios.href} className={installButtonClass} aria-label="Install CarMazium from Apple App Store">
                    <FaApple className="h-5 w-5" aria-hidden="true" />
                    Download on the App Store <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                ) : links.iosTestFlight.href ? (
                  <div>
                    <a href={links.iosTestFlight.href} className={installButtonClass}
                      aria-label="Join the approved CarMazium TestFlight beta">
                      <FaApple className="h-5 w-5" aria-hidden="true" />
                      Install iPhone Beta via TestFlight <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                    <p className="mt-3 text-xs leading-5 text-blue-100">
                      TestFlight is operated by Apple. Beta invitations can expire and places may be limited.
                    </p>
                  </div>
                ) : (
                  <UnavailableNotice>iPhone release coming soon. No public App Store or TestFlight installation is available yet.</UnavailableNotice>
                )}
              </div>
            </section>

            <section id="android" aria-labelledby="android-app-title"
              className="relative scroll-mt-28 overflow-hidden rounded-3xl border border-emerald-300/25 bg-[linear-gradient(145deg,#123f61_0%,#18325d_55%,#203b78_100%)] p-6 shadow-2xl sm:p-8">
              <div aria-hidden="true" className="pointer-events-none absolute -right-12 top-5 h-48 w-48 rounded-full bg-emerald-400/15 blur-3xl" />
              <div className="relative">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-400/10 text-lime-300 shadow-lg">
                  <FaAndroid className="h-10 w-10" aria-hidden="true" />
                </div>
                <h3 id="android-app-title" className="text-2xl font-black">CarMazium for Android</h3>
                <p className="mt-3 min-h-20 text-sm leading-6 text-blue-100">
                  Get CarMazium through Google Play when published, or download an approved signed release APK from our website.
                </p>
                {links.android.href ? (
                  <a href={links.android.href} className={installButtonClass}
                    aria-label="Install CarMazium from Google Play">
                    <FaGooglePlay className="h-5 w-5" aria-hidden="true" />
                    Get it on Google Play <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                ) : !links.androidApk.href ? (
                  <UnavailableNotice>Android release coming soon. No approved public APK or Google Play installation is available yet.</UnavailableNotice>
                ) : null}
                {links.androidApk.href && (
                  <div className="mt-4">
                    <a href={links.androidApk.href} download className={installButtonClass}
                      aria-label="Download approved signed CarMazium Android APK">
                      <ArrowDownToLine className="h-5 w-5" aria-hidden="true" />
                      Download Android APK <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                    <p className="mt-3 break-all text-xs leading-5 text-blue-100">
                      Verified release SHA-256: {links.androidApk.sha256}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-blue-100">
                      Android may ask for permission to install apps outside Google Play.
                      Only use the approved file on the official CarMazium domain.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section id="windows" aria-labelledby="windows-heading"
              className="relative scroll-mt-28 overflow-hidden rounded-3xl border border-sky-300/25 bg-[linear-gradient(145deg,#123768_0%,#1a265f_55%,#332173_100%)] p-6 shadow-2xl sm:p-8">
              <div aria-hidden="true" className="pointer-events-none absolute -right-12 top-5 h-48 w-48 rounded-full bg-blue-400/20 blur-3xl" />
              <div className="relative">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-300/30 bg-sky-400/15 text-cyan-200 shadow-lg">
                  <FaWindows className="h-9 w-9" aria-hidden="true" />
                </div>
                <h3 id="windows-heading" className="text-2xl font-black">CarMazium for Windows</h3>
                <p className="mt-3 min-h-20 text-sm leading-6 text-blue-100">
                  Use CarMazium on your Windows computer today. We&apos;ll show a Microsoft Store install link after a verified Windows release.
                </p>
                {windowsHref ? (
                  <a href={windowsHref} className={installButtonClass}
                    aria-label="Get CarMazium from Microsoft Store">
                    <FaWindows className="h-5 w-5" aria-hidden="true" />
                    Get it from Microsoft Store <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                ) : (
                  <UnavailableNotice>Microsoft Store app coming soon. CarMazium works in your Windows browser now.</UnavailableNotice>
                )}
                <Link href="/search" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-cyan-200 underline decoration-cyan-300/50 underline-offset-4 hover:text-white">
                  Open the website <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </section>
          </div>

          <div className="mt-8 grid gap-5 rounded-3xl border border-white/15 bg-white/[0.06] p-6 sm:grid-cols-3 sm:p-8">
            {[
              { icon: ShieldCheck, heading: "Official installation only", detail: "We enable store and APK links only after the corresponding customer release is approved." },
              { icon: CheckCircle2, heading: "One CarMazium account", detail: "Use your existing CarMazium account on supported devices." },
              { icon: ArrowRight, heading: "Website ready now", detail: "You can browse, sell and manage your vehicles in a browser while apps are prepared." },
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
