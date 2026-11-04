"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Download, Share, SquarePlus } from "lucide-react"

/**
 * Installs carmazium.com as an app without any app store.
 * - Edge / Chrome (Windows, Mac, ChromeOS, Android): uses the browser's own
 *   install prompt (beforeinstallprompt) when it is offered.
 * - Safari on iPhone/iPad: Apple offers no prompt, so show the two taps.
 * - Already installed (running standalone): say so.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const buttonClass =
  "mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-700/20 transition hover:from-blue-500 hover:to-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-60"

export function InstallWebAppButton({ platform }: { platform: "ios" | "windows" | "android" }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (standalone) setInstalled(true)
    const onPrompt = (e: Event) => { e.preventDefault(); setPromptEvent(e as BeforeInstallPromptEvent) }
    const onInstalled = () => { setInstalled(true); setPromptEvent(null) }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  if (installed) {
    return (
      <p className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100">
        <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" /> CarMazium is installed on this device.
      </p>
    )
  }

  if (promptEvent) {
    return (
      <button
        type="button"
        className={buttonClass}
        onClick={async () => {
          await promptEvent.prompt()
          const { outcome } = await promptEvent.userChoice
          if (outcome === "accepted") setInstalled(true)
          setPromptEvent(null)
        }}
      >
        <Download className="h-5 w-5" aria-hidden="true" /> Install CarMazium
      </button>
    )
  }

  const steps = platform === "ios"
    ? [
        { icon: Share, text: <>Open <strong>carmazium.com</strong> in <strong>Safari</strong> and tap the <strong>Share</strong> button.</> },
        { icon: SquarePlus, text: <>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>. CarMazium opens full screen like an app.</> },
      ]
    : platform === "windows"
      ? [
          { icon: Download, text: <>Open <strong>carmazium.com</strong> in <strong>Microsoft Edge</strong> or <strong>Google Chrome</strong>.</> },
          { icon: SquarePlus, text: <>Click the <strong>Install</strong> icon in the address bar (or menu › <strong>Apps › Install CarMazium</strong>). It gets its own window, Start menu and taskbar icon.</> },
        ]
      : [
          { icon: Download, text: <>Open <strong>carmazium.com</strong> in <strong>Chrome</strong>.</> },
          { icon: SquarePlus, text: <>Tap the menu › <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</> },
        ]

  return (
    <ol className="mt-6 space-y-3 rounded-xl border border-white/15 bg-white/[0.06] p-4 text-sm leading-6 text-blue-50">
      {steps.map(({ icon: Icon, text }, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-black">{i + 1}</span>
          <span className="flex-1"><Icon className="mr-1.5 inline h-4 w-4 align-[-2px]" aria-hidden="true" />{text}</span>
        </li>
      ))}
    </ol>
  )
}
